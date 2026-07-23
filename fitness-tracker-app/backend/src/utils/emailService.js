/**
 * Resend REST API Email Service (Port 443 HTTPS Only - Zero SMTP)
 */

export function verifyEmailProviderSetup() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  
  if (!apiKey) {
    console.error('❌ [FATAL STARTUP ERROR] RESEND_API_KEY environment variable is missing.');
    console.error('👉 Please add RESEND_API_KEY=re_... in your Render Environment Variables.');
    return { valid: false, maskedKey: 'NOT_CONFIGURED' };
  }

  const masked = apiKey.length > 7 ? `${apiKey.substring(0, 7)}****` : 're_****';
  console.log(`📧 [EMAIL PROVIDER]: Resend REST API (Port 443 HTTPS)`);
  console.log(`🔑 [RESEND API KEY LOADED]: ${masked}`);
  return { valid: true, maskedKey: masked };
}

/**
 * Sends OTP Email exclusively via Resend REST API over HTTPS (Port 443).
 */
export async function sendOtpEmail(toEmail, otpCode) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');

  console.log(`🔑 [OTP GENERATED] To: ${toEmail} | Verification Code: [ ${otpCode} ]`);

  if (!apiKey) {
    const err = 'RESEND_API_KEY is not set in Render environment variables. Please add RESEND_API_KEY=re_... to send emails.';
    console.error(`❌ [EMAIL DISPATCH ERROR]: ${err}`);
    throw new Error(err);
  }

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

  const fromSender = process.env.RESEND_FROM_EMAIL || 'NutriTrack Pro <onboarding@resend.dev>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
      console.log(`✅ [RESEND REST API DISPATCH SUCCESS] ID: ${resJson.id} -> ${toEmail}`);
      return { success: true, messageId: resJson.id };
    } else {
      const errorDetail = resJson.message || resJson.name || resText || `HTTP ${response.status}`;
      console.error(`❌ [RESEND REST API REJECTED] (${response.status}):`, errorDetail);
      throw new Error(`Resend API Error: ${errorDetail}`);
    }
  } catch (err) {
    console.error(`❌ [RESEND API DISPATCH FAILED] (To: ${toEmail}):`, err.message);
    throw new Error(err.message || 'Failed to dispatch email via Resend REST API');
  }
}
