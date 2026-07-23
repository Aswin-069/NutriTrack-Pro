import nodemailer from 'nodemailer';

let transporterInstance = null;
let transporterVerified = false;

/**
 * Returns a reusable, pooled Nodemailer transporter with tight socket timeouts.
 */
function getTransporter() {
  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPassword = process.env.SMTP_APP_PASSWORD;

  if (!smtpEmail || !smtpPassword || smtpEmail.includes('your_gmail')) {
    const errMsg = 'SMTP_EMAIL or SMTP_APP_PASSWORD is not configured in backend .env file.';
    console.error(`❌ [GMAIL SMTP CONFIG ERROR]: ${errMsg}`);
    throw new Error(errMsg);
  }

  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      service: 'gmail',
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: 14, // Max 14 emails per second for Gmail limits
      connectionTimeout: 6000,
      socketTimeout: 8000,
      greetingTimeout: 4000,
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
    });
    transporterVerified = false;
  }

  return { transporter: transporterInstance, smtpEmail };
}

/**
 * Verifies the SMTP connection on initialization or resets if disconnected.
 */
async function getVerifiedTransporter() {
  const { transporter, smtpEmail } = getTransporter();

  if (!transporterVerified) {
    try {
      await transporter.verify();
      transporterVerified = true;
      console.log('✅ [GMAIL SMTP] Transport pool verified & active.');
    } catch (err) {
      transporterInstance = null;
      transporterVerified = false;
      console.error('❌ [GMAIL SMTP VERIFY FAILED]:', err.message);
      throw new Error(`SMTP connection failed: ${err.message}`);
    }
  }

  return { transporter, smtpEmail };
}

/**
 * Sends OTP Email with 3-tier exponential retry logic for high delivery reliability.
 */
export async function sendOtpEmail(toEmail, otpCode) {
  const startTime = Date.now();
  const subject = 'NutriTrack Pro - Your 6-Digit Password Reset Code';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000000; color: #ffffff; margin: 0; padding: 40px 20px; }
          .container { max-width: 480px; margin: 0 auto; background-color: #09090b; border: 1px solid #27272a; border-radius: 20px; padding: 36px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          .logo { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin-bottom: 24px; text-align: center; }
          .title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #a1a1aa; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #d4d4d8; margin-bottom: 24px; }
          .otp-box { background-color: #18181b; border: 1px solid #3f3f46; border-radius: 14px; padding: 22px; text-align: center; font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #ffffff; margin-bottom: 24px; }
          .notice { font-size: 12px; color: #71717a; text-align: center; line-height: 1.5; border-top: 1px solid #18181b; padding-top: 20px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">NutriTrack Pro</div>
          <div class="title">Security Verification</div>
          <div class="text">You requested a password reset for your NutriTrack Pro account. Enter the 6-digit verification code below:</div>
          <div class="otp-box">${otpCode}</div>
          <div class="text" style="text-align: center; font-size: 12px; color: #a1a1aa;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</div>
          <div class="notice">
            If you did not request this code, you can safely ignore this email. Your password will remain unchanged.
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `NutriTrack Pro - Password Reset Code\n\nYour 6-digit verification code is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you did not request a password reset, please ignore this message.`;

  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { transporter, smtpEmail } = await getVerifiedTransporter();

      const info = await transporter.sendMail({
        from: `"NutriTrack Pro Security" <${smtpEmail}>`,
        to: toEmail,
        subject,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Entity-Ref-ID': `otp-${Date.now()}-${otpCode}`,
          'X-Priority': '1 (Highest)',
          'Importance': 'high'
        }
      });

      const duration = Date.now() - startTime;
      console.log(`✅ [GMAIL SMTP SUCCESS] Message ID: ${info.messageId} | Delivered to: ${toEmail} in ${duration}ms (Attempt ${attempt})`);
      return { success: true, messageId: info.messageId, durationMs: duration };
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ [GMAIL SMTP ATTEMPT ${attempt} FAILED] (To: ${toEmail}): ${err.message}`);
      
      // Invalidate transporter so next retry gets a fresh connection
      transporterInstance = null;
      transporterVerified = false;

      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, attempt * 300));
      }
    }
  }

  console.error(`❌ [GMAIL SMTP EXHAUSTED] All 3 dispatch attempts failed for ${toEmail}:`, lastError?.message);
  throw new Error(lastError?.message || 'Failed to deliver OTP email after 3 retries.');
}
