import nodemailer from 'nodemailer';

/**
 * Creates a direct Nodemailer transport for Gmail SMTP fallback.
 */
function createDirectTransporter(smtpEmail, smtpPassword, configType = 'service') {
  if (configType === 'ssl') {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      connectionTimeout: 4000,
      socketTimeout: 4000,
      greetingTimeout: 2000,
      auth: { user: smtpEmail, pass: smtpPassword },
      tls: { rejectUnauthorized: false }
    });
  }

  if (configType === 'starttls') {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      connectionTimeout: 4000,
      socketTimeout: 4000,
      greetingTimeout: 2000,
      auth: { user: smtpEmail, pass: smtpPassword },
      tls: { rejectUnauthorized: false }
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: 4000,
    socketTimeout: 4000,
    greetingTimeout: 2000,
    auth: { user: smtpEmail, pass: smtpPassword }
  });
}

/**
 * Sends OTP Email via Resend HTTPS API (Port 443 - Bypasses Cloud Firewalls) or Gmail SMTP.
 */
export async function sendOtpEmail(toEmail, otpCode) {
  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPassword = process.env.SMTP_APP_PASSWORD;
  const resendApiKey = process.env.RESEND_API_KEY;

  // Print OTP to server console logs for instant developer audit & fallback
  console.log(`🔑 [OTP GENERATED] To: ${toEmail} | Verification Code: [ ${otpCode} ]`);

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

  // METHOD 1: Resend HTTPS API (Port 443 - Never blocked by Render firewall)
  if (resendApiKey && resendApiKey.startsWith('re_')) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'NutriTrack Pro <onboarding@resend.dev>',
          to: [toEmail],
          subject: subject,
          html: htmlContent,
          text: textContent
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ [RESEND HTTPS DISPATCH SUCCESS] ID: ${data.id} -> ${toEmail}`);
        return { success: true, messageId: data.id };
      } else {
        const errText = await response.text();
        console.warn(`⚠️ [RESEND API WARN]: ${errText}`);
      }
    } catch (apiErr) {
      console.warn(`⚠️ [RESEND HTTPS ERROR]: ${apiErr.message}`);
    }
  }

  // METHOD 2: Gmail SMTP Direct Connections (Ports 465 / 587)
  if (smtpEmail && smtpPassword && !smtpEmail.includes('your_gmail')) {
    const emailOptions = {
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
    };

    const transportConfigs = ['service', 'ssl', 'starttls'];
    let lastError = null;

    for (const configType of transportConfigs) {
      try {
        const transporter = createDirectTransporter(smtpEmail, smtpPassword, configType);
        const info = await transporter.sendMail(emailOptions);
        console.log(`✅ [GMAIL SMTP DISPATCH SUCCESS] (${configType.toUpperCase()}) Message ID: ${info.messageId} -> ${toEmail}`);
        return { success: true, messageId: info.messageId };
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ [SMTP ATTEMPT (${configType.toUpperCase()}) FAILED]: ${err.message}`);
      }
    }

    console.error(`❌ [GMAIL SMTP BLOCKED BY CLOUD FIREWALL] (To: ${toEmail}):`, lastError?.message);
  }

  // If cloud firewall blocks raw SMTP and no Resend key is set
  throw new Error('Cloud provider firewall blocked SMTP ports (465/587). Add RESEND_API_KEY in Render environment variables for instant HTTPS delivery.');
}
