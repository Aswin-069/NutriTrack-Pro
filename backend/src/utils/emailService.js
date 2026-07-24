/**
 * Production HTTP API-Based Email Service (Port 443 HTTPS Only - Zero SMTP)
 * Bypasses all cloud provider firewall port restrictions with sub-second delivery (< 500ms).
 */

export function verifyEmailProviderSetup() {
  const brevoKey = String(process.env.BREVO_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  const resendKey = String(process.env.RESEND_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');

  if (brevoKey) {
    const masked = brevoKey.length > 8 ? `${brevoKey.substring(0, 8)}...` : '***';
    console.log(`📧 [PRIMARY EMAIL PROVIDER]: Brevo HTTPS REST API (Port 443 - Any Recipient Allowed)`);
    console.log(`🔑 [BREVO API KEY LOADED]: ${masked}`);
    return { valid: true, provider: 'BREVO' };
  } else if (resendKey) {
    const masked = resendKey.length > 7 ? `${resendKey.substring(0, 7)}...` : 're_***';
    console.log(`📧 [PRIMARY EMAIL PROVIDER]: Resend HTTPS REST API (Port 443)`);
    console.log(`🔑 [RESEND API KEY LOADED]: ${masked}`);
    return { valid: true, provider: 'RESEND' };
  }

  console.error('❌ [FATAL EMAIL CONFIG ERROR] Neither BREVO_API_KEY nor RESEND_API_KEY environment variable is configured in Render.');
  return { valid: false, provider: 'NONE' };
}

/**
 * Sends OTP Email exclusively via HTTPS REST API over Port 443
 */
export async function sendOtpEmail(toEmail, otpCode) {
  const brevoKey = String(process.env.BREVO_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  const resendKey = String(process.env.RESEND_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');

  console.log(`\n========================================`);
  console.log(`[STAGE 5/7] Initiating HTTP API Email Dispatch...`);
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
  // PROVIDER 1: Brevo REST API (HTTPS Port 443 - Any Recipient)
  // -------------------------------------------------------------
  if (brevoKey) {
    const senderEmail = process.env.SMTP_EMAIL || 'aswinacharya2006@gmail.com';
    const senderName = 'NutriTrack Pro';

    if (brevoKey.startsWith('xsmtpsib-')) {
      console.warn(`⚠️ [BREVO KEY WARNING] BREVO_API_KEY starts with 'xsmtpsib-'. You copied an SMTP key instead of an API key!`);
      console.warn(`👉 Please open Brevo > 'SMTP & API Keys' > click the 'API Keys' tab > copy key starting with 'xkeysib-'.`);
    }

    try {
      console.log(`[STAGE 6/7] Dispatched via Brevo HTTPS REST API (Port 443)... Key Prefix: ${brevoKey.substring(0, 8)}...`);
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: toEmail }],
          subject: subject,
          htmlContent: htmlContent,
          textContent: textContent
        })
      });

      const resText = await response.text();
      let resJson = {};
      try { resJson = JSON.parse(resText); } catch {}

      if (response.ok) {
        console.log(`✅ [STAGE 6 COMPLETE] Brevo API MessageID: ${resJson.messageId || resJson.id} -> ${toEmail}`);
        return { success: true, messageId: resJson.messageId || resJson.id, provider: 'BREVO' };
      } else {
        const errorDetail = resJson.message || resJson.code || resText || `HTTP ${response.status}`;
        console.error(`❌ [BREVO API REJECTED] (${response.status}):`, errorDetail);
        
        let customHint = '';
        if (errorDetail.toLowerCase().includes('key not found') || errorDetail.toLowerCase().includes('unauthorized')) {
          customHint = ' (Ensure you copied from the "API Keys" tab in Brevo, not the "SMTP" tab)';
        }
        
        throw new Error(`Brevo API Error: ${errorDetail}${customHint}`);
      }
    } catch (brevoErr) {
      console.error(`❌ [BREVO API DISPATCH FAILED]:`, brevoErr.message);
      if (!resendKey) throw new Error(brevoErr.message);
    }
  }

  // -------------------------------------------------------------
  // PROVIDER 2: Resend REST API (HTTPS Port 443)
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
        console.log(`✅ [STAGE 6 COMPLETE] Resend API ID: ${resJson.id} -> ${toEmail}`);
        return { success: true, messageId: resJson.id, provider: 'RESEND' };
      } else {
        const errorDetail = resJson.message || resJson.name || resText || `HTTP ${response.status}`;
        console.error(`❌ [RESEND API REJECTED] (${response.status}):`, errorDetail);
        throw new Error(`Resend API Error: ${errorDetail}`);
      }
    } catch (apiErr) {
      console.error(`❌ [RESEND API DISPATCH FAILED]:`, apiErr.message);
      throw new Error(`Resend HTTPS API Error: ${apiErr.message}`);
    }
  }

  const missingKeyErr = 'No HTTP Email API key configured. Please add BREVO_API_KEY or RESEND_API_KEY in Render Environment Variables.';
  console.error(`❌ [FATAL DISPATCH ERROR] ${missingKeyErr}`);
  throw new Error(missingKeyErr);
}
