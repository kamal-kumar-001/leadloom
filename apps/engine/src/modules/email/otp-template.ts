import type { TransactionalMessage } from './transactional';

export type OtpPurpose = 'signup' | 'reset';
export const OTP_TTL_MINUTES = 10;

/**
 * Branded one-time-code email. Same shape as the BakeryPOS verification mail
 * (card, header band, large spaced code, expiry notice) with Leadloom wording.
 * Only a 6-digit code is interpolated (validated here), so the HTML cannot be
 * injected into. Inline styles only, because mail clients ignore stylesheets
 * and cannot read the app's theme variables.
 */
export function renderOtpEmail(purpose: OtpPurpose, code: string, to: string): TransactionalMessage {
  if (!/^\d{6}$/.test(code)) throw new Error('OTP must be 6 digits');
  const signup = purpose === 'signup';
  const subject = signup ? 'Confirm your Leadloom email' : 'Reset your Leadloom password';
  const lead = signup ? 'Use this code to finish creating your Leadloom account:' : 'Use this code to reset your Leadloom password:';
  const text = `${lead}\n\n${code}\n\nThe code works once and expires in ${OTP_TTL_MINUTES} minutes. Do not share it with anyone. If you did not ask for it, ignore this email.`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2430;">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e3e6ef;border-radius:12px;overflow:hidden;">
<div style="background:#3b3fd8;padding:20px 24px;text-align:center;color:#ffffff;"><span style="font-size:20px;font-weight:700;letter-spacing:.2px;">Leadloom</span></div>
<div style="padding:32px 24px;text-align:center;">
<p style="margin:0;font-size:15px;line-height:1.5;">${lead}</p>
<div style="margin:24px 0;padding:14px 12px;background:#eef0ff;border-radius:8px;display:inline-block;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;font-weight:800;letter-spacing:8px;color:#3b3fd8;">${code}</div>
<p style="margin:0;font-size:13px;line-height:1.6;color:#646b7d;">This code works once and expires in <strong>${OTP_TTL_MINUTES} minutes</strong>. Do not share it with anyone.</p>
</div>
<div style="padding:14px 24px;text-align:center;font-size:11px;color:#8b92a5;border-top:1px solid #eef0f5;background:#fafbfd;">You are receiving this because someone used this address on Leadloom. If that was not you, ignore this email.</div>
</div></body></html>`;
  return { kind: signup ? 'auth_verification' : 'password_reset', to, subject, text, html };
}
