import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../utils/prisma.js';
import { calculateTargets } from '../utils/calculations.js';
import { sendOtpEmail } from '../utils/emailService.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('\n❌ JWT_SECRET is not set in your .env file.');
  process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production';

// Helper to log security events
function logSecurityEvent(eventType, details) {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY AUDIT] [${timestamp}] [${eventType}] : ${JSON.stringify(details)}`);
}

// Automatic retry helper for serverless DB cold-starts (Neon compute sleep)
async function withDbRetry(fn, maxRetries = 2) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isConn = err.code === 'P1001' || err.message?.includes("Can't reach database") || err.message?.includes('connect');
      if (isConn && attempt < maxRetries) {
        console.warn(`⚠️ [DB WAKEUP RETRY ${attempt}] Waiting 600ms for Neon database compute to initialize...`);
        await new Promise(r => setTimeout(r, 600));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export const register = async (req, res) => {
  try {
    const { name, email, password, height, weight, age, gender, fitnessGoal, activityLevel } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const existingUser = await withDbRetry(() => prisma.user.findUnique({ where: { email: cleanEmail } }));
    if (existingUser) {
      logSecurityEvent('REGISTRATION_FAILED_EMAIL_TAKEN', { email: cleanEmail });
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash with bcrypt cost factor 10 (OWASP recommended standard for responsive cloud auth)
    const passwordHash = await bcrypt.hash(password, 10);

    const parsedHeight = parseFloat(height);
    const parsedWeight = parseFloat(weight);
    const parsedAge = parseInt(age);

    const { dailyCalorieTarget, dailyProteinTarget } = calculateTargets({
      gender,
      weight: parsedWeight,
      height: parsedHeight,
      age: parsedAge,
      activityLevel,
      fitnessGoal
    });

    const user = await prisma.user.create({
      data: {
        name,
        email: cleanEmail,
        passwordHash,
        height: parsedHeight,
        weight: parsedWeight,
        age: parsedAge,
        gender,
        fitnessGoal,
        activityLevel,
        dailyCalorieTarget,
        dailyProteinTarget
      }
    });

    logSecurityEvent('USER_REGISTERED', { userId: user.id, email: user.email });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const { passwordHash: _, otpHash: __, otpExpires: ___, failedLoginAttempts: ____, lockoutUntil: _____, ...userWithoutPassword } = user;
    return res.status(201).json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error('Registration error:', error);
    const isDbError = error.message?.includes('localhost') || error.message?.includes("Can't reach database");
    return res.status(500).json({ 
      error: isDbError 
        ? "Database error: Please update DATABASE_URL in Render to your cloud PostgreSQL database URL (Neon / Render Postgres / Supabase)."
        : (error.message || 'Registration failed. Please try again.') 
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();

    const user = await withDbRetry(() => prisma.user.findUnique({ where: { email: cleanEmail } }));
    if (!user) {
      logSecurityEvent('LOGIN_FAILED_UNKNOWN_EMAIL', { email });
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const minutesRemaining = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / (60 * 1000));
      logSecurityEvent('LOGIN_ATTEMPT_ON_LOCKED_ACCOUNT', { email, userId: user.id });
      return res.status(400).json({ 
        error: `Account is temporarily locked due to repeated login failures. Try again in ${minutesRemaining} minutes.` 
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const updatedAttempts = user.failedLoginAttempts + 1;
      let lockoutUntil = null;
      let message = 'Invalid email or password';

      logSecurityEvent('LOGIN_FAILED_BAD_PASSWORD', { email, userId: user.id, attemptCount: updatedAttempts });

      if (updatedAttempts >= 5) {
        lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
        message = 'Account is temporarily locked for 15 minutes due to 5 consecutive login failures.';
        logSecurityEvent('ACCOUNT_LOCKED', { email, userId: user.id });
      }

      await withDbRetry(() => prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: lockoutUntil ? 0 : updatedAttempts,
          lockoutUntil
        }
      }));

      return res.status(400).json({ error: message });
    }

    await withDbRetry(() => prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null
      }
    }));

    logSecurityEvent('LOGIN_SUCCESS', { userId: user.id, email: user.email });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const { passwordHash: _, otpHash: __, otpExpires: ___, failedLoginAttempts: ____, lockoutUntil: _____, ...userWithoutPassword } = user;
    return res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error('Login error:', error);
    const isDbError = error.message?.includes('localhost') || error.message?.includes("Can't reach database");
    return res.status(500).json({ 
      error: isDbError 
        ? "Database error: Please update DATABASE_URL in Render to your cloud PostgreSQL database URL (Neon / Render Postgres / Supabase)."
        : (error.message || 'Login failed. Please try again.') 
    });
  }
};

export const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict'
  });
  return res.json({ message: 'Logged out successfully' });
};

export const me = async (req, res) => {
  try {
    const user = await withDbRetry(() => prisma.user.findUnique({ where: { id: req.userId } }));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { passwordHash: _, otpHash: __, otpExpires: ___, failedLoginAttempts: ____, lockoutUntil: _____, ...userWithoutPassword } = user;
    return res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Failed to retrieve profile' });
  }
};

// Step 1: Send 6-Digit Email OTP
export const sendOtp = async (req, res) => {
  try {
    console.log(`\n========================================`);
    console.log(`[STAGE 1/7] OTP Request Received.`);
    
    const { email } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    console.log(`[STAGE 1/7] Target email normalized: "${cleanEmail}"`);

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      console.warn(`❌ [STAGE 1 FAILED] Invalid email format: "${cleanEmail}"`);
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    console.log(`[STAGE 2/7] Searching for user in database...`);
    const user = await withDbRetry(() => prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, email: true, otpLockoutUntil: true }
    }));

    if (!user) {
      console.warn(`❌ [STAGE 2 FAILED] No account found with email: "${cleanEmail}"`);
      logSecurityEvent('OTP_REQUEST_UNKNOWN_EMAIL', { email: cleanEmail });
      return res.status(400).json({ error: 'No account exists with this email address.' });
    }

    console.log(`✅ [STAGE 2 COMPLETE] User found. ID: ${user.id}`);

    if (user.otpLockoutUntil && user.otpLockoutUntil > new Date()) {
      const minsRemaining = Math.ceil((user.otpLockoutUntil.getTime() - Date.now()) / (60 * 1000));
      console.warn(`❌ [STAGE 2 LOCKED] Account locked for ${minsRemaining} mins.`);
      return res.status(400).json({ 
        error: `Too many failed attempts. Verification is locked for ${minsRemaining} minutes.` 
      });
    }

    console.log(`[STAGE 3/7] Generating 6-digit cryptographic OTP...`);
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');
    console.log(`✅ [STAGE 3 COMPLETE] OTP Code generated successfully.`);

    console.log(`[STAGE 4/7] Storing OTP hash & expiration in database...`);
    await withDbRetry(() => prisma.user.update({
      where: { id: user.id },
      data: {
        otpHash,
        otpExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 mins expiry
        otpAttempts: 0,
        otpLockoutUntil: null
      }
    }));
    console.log(`✅ [STAGE 4 COMPLETE] OTP saved in DB for User ID: ${user.id}`);

    // Deliver email via SMTP and handle failures with strict timeout
    try {
      await sendOtpEmail(user.email, otpCode);
      logSecurityEvent('OTP_GENERATED_AND_DELIVERED', { userId: user.id, email: user.email });
      console.log(`[STAGE 7/7] Returning 200 OK JSON response to client.`);
      return res.json({ message: 'Verification code sent to your email.' });
    } catch (emailErr) {
      console.error(`❌ [STAGE 5/6 DISPATCH FAILED] (To: ${user.email}):`, emailErr.message);
      logSecurityEvent('OTP_EMAIL_DELIVERY_FAILED', { userId: user.id, email: user.email, error: emailErr.message });
      console.log(`[STAGE 7/7] Returning 500 Error JSON response to client.`);
      return res.status(500).json({ error: `Failed to send verification email: ${emailErr.message}` });
    }

  } catch (error) {
    console.error('❌ [SEND OTP FATAL UNHANDLED ERROR]:', error);
    return res.status(500).json({ error: error.message || 'Failed to send verification code' });
  }
};

// Step 2: Verify OTP
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ error: 'Verification code must be 6 digits' });
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or verification code' });
    }

    if (user.otpLockoutUntil && user.otpLockoutUntil > new Date()) {
      const minsRemaining = Math.ceil((user.otpLockoutUntil.getTime() - Date.now()) / (60 * 1000));
      return res.status(400).json({ 
        error: `Too many failed attempts. Verification is locked for ${minsRemaining} minutes.` 
      });
    }

    if (!user.otpHash || !user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    const incomingHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
    if (incomingHash !== user.otpHash) {
      const attempts = user.otpAttempts + 1;
      let lockoutUntil = null;
      let errMsg = `Incorrect verification code. Attempts remaining: ${Math.max(0, 5 - attempts)}`;

      if (attempts >= 5) {
        lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
        errMsg = 'Maximum failed attempts exceeded. Verification locked for 15 minutes.';
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpAttempts: attempts,
          otpLockoutUntil: lockoutUntil
        }
      });

      return res.status(400).json({ error: errMsg });
    }

    // Immediately delete/invalidate OTP upon successful verification
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpHash: null,
        otpExpires: null,
        otpAttempts: 0,
        otpLockoutUntil: null
      }
    });

    const resetSessionToken = jwt.sign(
      { userId: user.id, email: user.email, scope: 'password_reset_otp' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    logSecurityEvent('OTP_VERIFIED_SUCCESS', { userId: user.id, email: user.email });

    return res.json({
      message: 'OTP verified successfully',
      resetSessionToken
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ error: 'Verification failed' });
  }
};

// Step 3: Reset Password using resetSessionToken
export const resetPasswordWithOtp = async (req, res) => {
  try {
    const { resetSessionToken, password } = req.body;
    if (!resetSessionToken || !password) {
      return res.status(400).json({ error: 'Reset session token and new password are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetSessionToken, JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'Reset session has expired or is invalid. Please request a new code.' });
    }

    if (decoded.scope !== 'password_reset_otp' || !decoded.userId) {
      return res.status(400).json({ error: 'Invalid reset session token' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#.])[A-Za-z\d@$!%*?&#.]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must contain at least 8 characters, with at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#.)' 
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        otpHash: null,
        otpExpires: null,
        otpAttempts: 0,
        otpLockoutUntil: null,
        failedLoginAttempts: 0,
        lockoutUntil: null
      }
    });

    logSecurityEvent('PASSWORD_RESET_OTP_SUCCESS', { userId: user.id, email: user.email });

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Reset password OTP error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { height, weight, age, gender, fitnessGoal, activityLevel } = req.body;

    const parsedHeight = parseFloat(height);
    const parsedWeight = parseFloat(weight);
    const parsedAge = parseInt(age);

    if (isNaN(parsedHeight) || isNaN(parsedWeight) || isNaN(parsedAge) || !gender || !fitnessGoal || !activityLevel) {
      return res.status(400).json({ error: 'All profile details are required and must be valid numbers/strings' });
    }

    const { dailyCalorieTarget, dailyProteinTarget } = calculateTargets({
      gender,
      weight: parsedWeight,
      height: parsedHeight,
      age: parsedAge,
      activityLevel,
      fitnessGoal
    });

    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: {
        height: parsedHeight,
        weight: parsedWeight,
        age: parsedAge,
        gender,
        fitnessGoal,
        activityLevel,
        dailyCalorieTarget,
        dailyProteinTarget
      }
    });

    const { passwordHash: _, otpHash: __, otpExpires: ___, failedLoginAttempts: ____, lockoutUntil: _____, ...userWithoutPassword } = updatedUser;
    return res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile settings' });
  }
};
