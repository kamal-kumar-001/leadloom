import { BRAND_NAME, EMAIL_BRAND } from '@leadloom/contracts';
import type { TransactionalMessage } from './transactional';

export type OtpPurpose = 'signup' | 'reset';
export const OTP_TTL_MINUTES = 10;

/**
 * One-time-code email styled from the shared brand values in @leadloom/contracts
 * (EMAIL_BRAND, mirrors the light theme in apps/web/app/tokens.css).
 * Only a 6-digit code is interpolated (validated here), so the HTML cannot be
 * injected into. Inline styles only, because mail clients ignore stylesheets
 * and cannot read the app's theme variables.
 */
export function renderOtpEmail(purpose: OtpPurpose, code: string, to: string): TransactionalMessage {
  if (!/^\d{6}$/.test(code)) throw new Error('OTP must be 6 digits');
  const signup = purpose === 'signup';
  const subject = signup ? `Confirm your ${BRAND_NAME} email` : `Reset your ${BRAND_NAME} password`;
  const lead = signup ? `Use this code to finish creating your ${BRAND_NAME} account:` : `Use this code to reset your ${BRAND_NAME} password:`;
  const text = `${lead}\n\n${code}\n\nThe code works once and expires in ${OTP_TTL_MINUTES} minutes. Do not share it with anyone. If you did not ask for it, ignore this email.`;
  const b = EMAIL_BRAND;
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:24px 12px;background:${b.canvas};font-family:${font};color:${b.textPrimary};">
<div style="max-width:480px;margin:0 auto;background:${b.surface};border:1px solid ${b.borderSubtle};border-radius:14px;overflow:hidden;">
<div style="height:4px;background:${b.accent};line-height:4px;font-size:0;">&nbsp;</div>
<div style="padding:24px 24px 0;text-align:center;"><span style="font-size:20px;font-weight:700;color:${b.textPrimary};">${BRAND_NAME}</span></div>
<div style="padding:20px 24px 32px;text-align:center;">
<p style="margin:0;font-size:15px;line-height:1.5;color:${b.textPrimary};">${lead}</p>
<div style="margin:24px 0;padding:14px 16px;background:${b.accentSoft};border:1px solid ${b.borderSubtle};border-radius:10px;display:inline-block;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${b.accent};">${code}</div>
<p style="margin:0;font-size:13px;line-height:1.6;color:${b.textSecondary};">This code works once and expires in <strong>${OTP_TTL_MINUTES} minutes</strong>. Do not share it with anyone.</p>
</div>
<div style="padding:14px 24px;text-align:center;font-size:11px;line-height:1.5;color:${b.textMuted};border-top:1px solid ${b.borderSubtle};background:${b.elevated};">You are receiving this because someone used this address on ${BRAND_NAME}. If that was not you, ignore this email.</div>
</div></body></html>`;
  return { kind: signup ? 'auth_verification' : 'password_reset', to, subject, text, html };
}
