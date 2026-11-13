import { BRAND_NAME, EMAIL_BRAND_DARK } from '@leadloom/contracts';
import type { TransactionalMessage } from './transactional';

export type OtpPurpose = 'signup' | 'reset';
export const OTP_TTL_MINUTES = 10;

/**
 * One-time-code email styled from the shared brand values in @leadloom/contracts
 * (EMAIL_BRAND_DARK, mirrors [data-theme="dark"] in apps/web/app/tokens.css -
 * the app's default theme, so the email looks like the product the user just
 * came from). Only a 6-digit code is interpolated (validated here), so the
 * HTML cannot be injected into. Table skeleton, bgcolor attributes and inline
 * styles only: mail clients ignore stylesheets and cannot read the app's
 * theme variables, and border-radius simply degrades to square corners where
 * unsupported.
 */
export function renderOtpEmail(purpose: OtpPurpose, code: string, to: string): TransactionalMessage {
  if (!/^\d{6}$/.test(code)) throw new Error('OTP must be 6 digits');
  const signup = purpose === 'signup';
  const subject = signup ? `Confirm your ${BRAND_NAME} email` : `Reset your ${BRAND_NAME} password`;
  const lead = signup ? `Use this code to finish creating your ${BRAND_NAME} account:` : `Use this code to reset your ${BRAND_NAME} password:`;
  const text = `${lead}\n\n${code}\n\nThe code works once and expires in ${OTP_TTL_MINUTES} minutes. Do not share it with anyone. If you did not ask for it, ignore this email.`;
  const b = EMAIL_BRAND_DARK;
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${subject}</title></head>
<body bgcolor="${b.canvas}" style="margin:0;padding:0;background-color:${b.canvas};">
<div style="display:none;max-height:0;overflow:hidden;">${lead} ${code} (expires in ${OTP_TTL_MINUTES} minutes)</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${b.canvas}" style="background-color:${b.canvas};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${b.surface}" style="width:100%;max-width:480px;background-color:${b.surface};border:1px solid ${b.borderSubtle};border-radius:14px;">
<tr><td bgcolor="${b.accent}" style="height:4px;line-height:4px;font-size:0;background-color:${b.accent};border-radius:13px 13px 0 0;">&nbsp;</td></tr>
<tr><td align="center" style="padding:28px 32px 8px;font-family:${font};font-size:20px;font-weight:700;letter-spacing:0.5px;color:${b.accent};">${BRAND_NAME}</td></tr>
<tr><td align="center" style="padding:12px 32px 0;font-family:${font};font-size:15px;line-height:22px;color:${b.textPrimary};">${lead}</td></tr>
<tr><td align="center" style="padding:22px 32px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" bgcolor="${b.accentSoft}" style="background-color:${b.accentSoft};border:1px solid ${b.borderSubtle};border-radius:10px;"><tr>
<td style="padding:14px 28px;font-family:ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:${b.accent};">${code}</td>
</tr></table>
</td></tr>
<tr><td align="center" style="padding:8px 32px 4px;font-family:${font};font-size:13px;line-height:20px;color:${b.textSecondary};">This code works once and expires in <strong>${OTP_TTL_MINUTES} minutes</strong>. Do not share it with anyone.</td></tr>
<tr><td align="center" style="padding:0 32px 28px;font-family:${font};font-size:13px;line-height:20px;color:${b.textSecondary};">If you did not ask for it, ignore this email.</td></tr>
<tr><td align="center" bgcolor="${b.elevated}" style="padding:14px 32px;font-family:${font};font-size:11px;line-height:16px;color:${b.textMuted};background-color:${b.elevated};border-top:1px solid ${b.borderSubtle};border-radius:0 0 13px 13px;">You are receiving this because someone used this address on ${BRAND_NAME}. If that was not you, ignore this email.</td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { kind: signup ? 'auth_verification' : 'password_reset', to, subject, text, html };
}
