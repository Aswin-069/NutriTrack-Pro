import nodemailer from 'nodemailer';

let transporterInstance = null;
let transporterVerified = false;

/**
 * Returns a reusable, pooled Nodemailer transporter.
 * The instance is created once and reused across all requests (connection pooling).
 */
function getTransporter() {
  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPassword = process.env.SMTP_APP_PASSWORD;

  if (!smtpEmail || !smtpPassword || smtpEmail.includes('your_gmail')) {
    const errMsg =
      'SMTP_EMAIL or SMTP_APP_PASSWORD is not configured in backend .env file. Please provide valid Gmail credentials.';
    console.error(`❌ [GMAIL SMTP CONFIG ERROR]: ${errMsg}`);
    throw new Error(errMsg);
  }

  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      service: 'gmail',
      pool: true,          // enable connection pooling
      maxConnections: 5,
      maxMessages: 100,
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
    });
    transporterVerified = false; // reset verification flag on new instance
  }

  return { transporter: transporterInstance, smtpEmail };
}

/**
 * Verifies the SMTP connection once on first use, then reuses the verified transporter.
 */
async function getVerifiedTransporter() {
  const { transporter, smtpEmail } = getTransporter();

  if (!transporterVerified) {
    try {
      await transporter.verify();
      transporterVerified = true;
      console.log('✅ [GMAIL SMTP] Transporter verified and ready.');
    } catch (err) {
      // Reset so next request retries verification
      transporterInstance = null;
      transporterVerified = false;
      console.error('❌ [GMAIL SMTP VERIFY FAILED]:', err.message);
      throw new Error(`SMTP connection failed: ${err.message}`);
    }
  }

  return { transporter, smtpEmail };
}

export async function sendOtpEmail(toEmail, otpCode) {
  const { transporter, smtpEmail } = await getVerifiedTransporter();

  const subject = 'NutriTrack Pro - Password Reset Verification Code';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000; color: #ffffff; margin: 0; padding: 40px 20px; }
          .container { max-width: 480px; margin: 0 auto; background-color: #09090b; border: 1px solid #27272a; border-radius: 20px; padding: 36px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          .logo { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin-bottom: 24px; text-align: center; }
          .title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #a1a1aa; margin-bottom: 12px; }
          .text { font-size: 13px; line-height: 1.6; color: #d4d4d8; margin-bottom: 28px; }
          .otp-box { background-color: #18181b; border: 1px solid #3f3f46; border-radius: 14px; padding: 20px; text-align: center; font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #ffffff; margin-bottom: 28px; }
          .notice { font-size: 11px; color: #71717a; text-align: center; line-height: 1.5; border-top: 1px solid #18181b; padding-top: 20px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">NutriTrack Pro</div>
          <div class="title">Password Reset Verification</div>
          <div class="text">You requested a password reset for your account. Use the 6-digit verification code below to proceed:</div>
          <div class="otp-box">${otpCode}</div>
          <div class="text" style="text-align: center; font-size: 12px; color: #a1a1aa;">This code will expire in <strong>5 minutes</strong>.</div>
          <div class="notice">
            If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `NutriTrack Pro - Password Reset Verification Code\n\nYour 6-digit verification code is: ${otpCode}\n\nThis code expires in 5 minutes.\n\nIf you did not request a password reset, please ignore this email.`;

  try {
    const info = await transporter.sendMail({
      from: `"NutriTrack Pro" <${smtpEmail}>`,
      to: toEmail,
      subject,
      html: htmlContent,
      text: textContent,
    });

    console.log(`✅ [GMAIL SMTP DISPATCH SUCCESSFUL] Message ID: ${info.messageId} (To: ${toEmail})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ [GMAIL SMTP DISPATCH FAILED] (To: ${toEmail}):`, err.message);
    throw new Error(err.message || 'Failed to send verification email via Gmail SMTP');
  }
}
