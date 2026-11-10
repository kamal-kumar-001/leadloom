import { describe, it, expect } from 'vitest';
import { renderOtpEmail } from './otp-template';
import { TRANSACTIONAL_KINDS } from './transactional';

describe('renderOtpEmail', () => {
  it('signup and reset use the right kind, subject, wording and the code in text and html', () => {
    const s = renderOtpEmail('signup', '042913', 'a@example.com'), r = renderOtpEmail('reset', '555000', 'a@example.com');
    expect(s.kind).toBe('auth_verification'); expect(r.kind).toBe('password_reset');
    expect(TRANSACTIONAL_KINDS).toContain(s.kind);
    expect(s.subject).toMatch(/Confirm/); expect(r.subject).toMatch(/Reset/);
    expect(s.text).toContain('\n042913\n'); expect(s.html).toContain('042913'); expect(r.html).toContain('555000');
    expect(s.subject).not.toContain('042913'); // the code is not in the subject line
    expect(s.text).toMatch(/10 minutes/); expect(s.html).toMatch(/LeadLoom/);
  });
  it('refuses anything that is not a 6-digit code (nothing can be injected into the html)', () => {
    for (const bad of ['12345', '1234567', '12a456', '<b>1234', '']) expect(() => renderOtpEmail('signup', bad, 'a@example.com')).toThrow();
  });
  it('never names the reference product or another product', () => {
    const t = JSON.stringify(renderOtpEmail('reset', '123456', 'a@example.com')).toLowerCase();
    for (const w of ['bakery', 'pump', 'dmpilot']) expect(t).not.toContain(w);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EMAIL_BRAND } from '@leadloom/contracts';

describe('email brand matches the light theme tokens', () => {
  it('EMAIL_BRAND equals tokens.css [data-theme="light"]', () => {
    const css = readFileSync(resolve(__dirname, '../../../../web/app/tokens.css'), 'utf8');
    const light = css.slice(css.indexOf('\n[data-theme="light"] {'));
    const v = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(light)?.[1]?.toLowerCase();
    expect(v('bg-canvas')).toBe(EMAIL_BRAND.canvas);
    expect(v('bg-surface')).toBe(EMAIL_BRAND.surface);
    expect(v('bg-elevated')).toBe(EMAIL_BRAND.elevated);
    expect(v('border-subtle')).toBe(EMAIL_BRAND.borderSubtle);
    expect(v('text-primary')).toBe(EMAIL_BRAND.textPrimary);
    expect(v('text-secondary')).toBe(EMAIL_BRAND.textSecondary);
    expect(v('text-muted')).toBe(EMAIL_BRAND.textMuted);
    expect(v('accent-loom')).toBe(EMAIL_BRAND.accent);
    expect(v('on-accent')).toBe(EMAIL_BRAND.onAccent);
  });
});
