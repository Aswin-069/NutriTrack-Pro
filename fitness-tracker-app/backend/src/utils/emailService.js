import nodemailer from 'nodemailer';

export function verifyEmailProviderSetup() {
  const email = process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_APP_PASSWORD;

  if (!email || !pass) {
    console.error('❌ [EMAIL CONFIG ERROR] SMTP_EMAIL or SMTP_APP_PASSWORD environment variable is missing.');
    return { valid: false, maskedUser: email || 'NOT_SET' };
  }

  const masked = email.length > 5 ? `${email.substring(0, 4)}***` : '***';
  console.log(`📧 [EMAIL PROVIDER]: Nodemailer Gmail SMTP (smtp.gmail.com:465)`);
  console.log(`👤 [GMAIL USER LOADED]: ${masked}`);
  return { valid: true, maskedUser: masked };
}

/**
 * Sends OTP Email via Nodemailer using Gmail SMTP with a strict 8-second timeout guarantee
 */
export async function sendOtpEmail(toEmail, otpCode) {
  const emailUser = process.env.SMTP_EMAIL;
  const emailPass = process.env.SMTP_APP_PASSWORD;

  console.log(`\n========================================`);
  console.log(`[STAGE 5/7] Initiating SMTP Email Dispatch...`);
  console.log(`📧 Target Recipient: ${toEmail}`);
  console.log(`🔑 Verification OTP Code: [ ${otpCode} ]`);
  console.log(`========================================\n`);

  if (!emailUser || !emailPass) {
    const missingErr = 'SMTP_EMAIL or SMTP_APP_PASSWORD environment variable is not configured in process.env.';
    console.error(`❌ [STAGE 5 FAILED] ${missingErr}`);
    throw new Error(missingErr);
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : (port === 465);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: emailUser,
      pass: emailPass
    },
    connectionTimeout: 6000, // 6s connection timeout
    greetingTimeout: 4000,   // 4s greeting timeout
    socketTimeout: 8000      // 8s socket idle timeout
  });

  const subject = 'NutriTrack Pro - Your 6-Digit Verification Code';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
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

  const textContent = `NutriTrack Pro - Password Reset Code\n\nYour 6-digit verification code is: ${otpCode}\n\nThis code expires in 10 minutes.`;

  const fromAddress = process.env.EMAIL_FROM || `"NutriTrack Pro" <${emailUser}>`;

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject,
    text: textContent,
    html: htmlContent
  };

  try {
    console.log(`[STAGE 6/7] Verifying SMTP connection to ${host}:${port}...`);

    const timeoutMs = 8000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`SMTP Connection Timed Out after ${timeoutMs / 1000}s. Note: Render free tier blocks outbound TCP ports 465/587. If hosted on Render, please add RESEND_API_KEY for instant HTTPS delivery.`));
      }, timeoutMs);
    });

    const sendPromise = (async () => {
      await transporter.verify();
      console.log(`✅ [STAGE 6.1] Transporter verified successfully.`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ [STAGE 6.2] sendMail() succeeded. MessageID: ${info.messageId}`);
      return info;
    })();

    const info = await Promise.race([sendPromise, timeoutPromise]);
    console.log(`✅ [STAGE 6 COMPLETE] Email sent successfully to ${toEmail}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ [STAGE 6 FAILED] Email Dispatch Error:`, err.message);
    throw new Error(`Email Dispatch Error: ${err.message}`);
  }
}
