import nodemailer from 'nodemailer';

export function verifyEmailProviderSetup() {
  const email = process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_APP_PASSWORD;
  const resendKey = process.env.RESEND_API_KEY;

  if (!email && !resendKey) {
    console.error('❌ [EMAIL CONFIG ERROR] Neither SMTP (SMTP_EMAIL) nor Resend (RESEND_API_KEY) environment variables are configured.');
    return { valid: false, provider: 'NONE' };
  }

  if (resendKey) {
    console.log(`📧 [PRIMARY EMAIL PROVIDER]: Resend REST API (HTTPS Port 443 - Cloud Egress Unblocked)`);
  } else if (email && pass) {
    const masked = email.length > 5 ? `${email.substring(0, 4)}***` : '***';
    console.log(`📧 [PRIMARY EMAIL PROVIDER]: Nodemailer Gmail SMTP (smtp.gmail.com:465, IPv4 Enforced)`);
    console.log(`👤 [GMAIL USER LOADED]: ${masked}`);
  }

  return { valid: true, provider: resendKey ? 'RESEND' : 'SMTP' };
}

/**
 * Sends OTP Email with comprehensive SMTP diagnostics and instant HTTPS API failover
 */
export async function sendOtpEmail(toEmail, otpCode) {
  const emailUser = process.env.SMTP_EMAIL;
  const emailPass = process.env.SMTP_APP_PASSWORD;
  const resendKey = String(process.env.RESEND_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');

  console.log(`\n========================================`);
  console.log(`[STAGE 5/7] Initiating Email Dispatch...`);
  console.log(`📧 Target Recipient: ${toEmail}`);
  console.log(`🔑 Verification OTP Code: [ ${otpCode} ]`);
  console.log(`========================================\n`);

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

  // -------------------------------------------------------------
  // STRATEGY 1: HTTPS REST API (Preferred on Cloud Hosting like Render)
  // -------------------------------------------------------------
  if (resendKey) {
    const fromSender = process.env.RESEND_FROM_EMAIL || 'NutriTrack Pro <onboarding@resend.dev>';

    try {
      console.log(`[STAGE 6/7] Dispatched via Resend HTTPS REST API (Port 443)...`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromSender,
          to: [toEmail],
          subject: subject,
          html: htmlContent,
          text: textContent
        })
      });

      const resText = await response.text();
      let resJson = {};
      try { resJson = JSON.parse(resText); } catch {}

      if (response.ok) {
        console.log(`✅ [RESEND API SUCCESS] ID: ${resJson.id} -> ${toEmail}`);
        return { success: true, messageId: resJson.id, provider: 'RESEND' };
      } else {
        const errorDetail = resJson.message || resJson.name || resText || `HTTP ${response.status}`;
        console.error(`❌ [RESEND API REJECTED] (${response.status}):`, errorDetail);
        throw new Error(`Resend API Error: ${errorDetail}`);
      }
    } catch (apiErr) {
      console.error(`❌ [HTTPS API DISPATCH FAILED]:`, apiErr.message);
      if (!emailUser) throw new Error(`HTTPS API Dispatch Error: ${apiErr.message}`);
    }
  }

  // -------------------------------------------------------------
  // STRATEGY 2: Gmail SMTP via Nodemailer (IPv4 Enforced)
  // -------------------------------------------------------------
  if (emailUser && emailPass) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : (port === 465);
    const fromAddress = process.env.EMAIL_FROM || `"NutriTrack Pro" <${emailUser}>`;

    console.log(`[SMTP DIAGNOSTIC 1/5] Target Host: ${host} | Port: ${port} | Secure: ${secure}`);
    console.log(`[SMTP DIAGNOSTIC 2/5] Enforcing IPv4 (family: 4) socket connection...`);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: emailUser,
        pass: emailPass
      },
      family: 4, // FORCE IPv4 ONLY to eliminate ENETUNREACH IPv6 errors on cloud containers
      connectionTimeout: 5000,
      greetingTimeout: 3000,
      socketTimeout: 6000,
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      }
    });

    const mailOptions = {
      from: fromAddress,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent
    };

    try {
      console.log(`[SMTP DIAGNOSTIC 3/5] Verifying SMTP connection & auth credentials...`);
      
      const timeoutMs = 6000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Gmail SMTP Connection Timed Out (${timeoutMs / 1000}s). Note: Render free tier blocks outbound TCP ports 465/587. Add RESEND_API_KEY in Render Environment Variables for instant HTTPS delivery.`));
        }, timeoutMs);
      });

      const sendPromise = (async () => {
        await transporter.verify();
        console.log(`✅ [SMTP DIAGNOSTIC 4/5] Transporter verified successfully. Sending mail...`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ [SMTP DIAGNOSTIC 5/5] sendMail() succeeded. MessageID: ${info.messageId}`);
        return info;
      })();

      const info = await Promise.race([sendPromise, timeoutPromise]);
      console.log(`✅ [STAGE 6 COMPLETE] Email dispatched via Gmail SMTP to ${toEmail}`);
      return { success: true, messageId: info.messageId, provider: 'SMTP' };
    } catch (smtpErr) {
      console.error(`❌ [SMTP DIAGNOSTIC FAILED] ${smtpErr.message}`);
      throw new Error(smtpErr.message);
    }
  }

  throw new Error('No valid email provider configured. Add RESEND_API_KEY or SMTP credentials to environment variables.');
}
