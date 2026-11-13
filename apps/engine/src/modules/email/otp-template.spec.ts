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
  it('renders on the app dark theme (default), not the light palette', () => {
    const { html } = renderOtpEmail('signup', '483920', 'a@example.com');
    expect(html).toContain(`bgcolor="${EMAIL_BRAND_DARK.canvas}"`);
    expect(html).toContain(`color:${EMAIL_BRAND_DARK.accent};`);
    expect(html).toContain('color-scheme" content="dark"');
    expect(html).not.toContain(`bgcolor="${EMAIL_BRAND.canvas}"`); // no light-canvas background anywhere
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EMAIL_BRAND, EMAIL_BRAND_DARK } from '@leadloom/contracts';

describe('email brand matches the theme tokens', () => {
  const css = readFileSync(resolve(__dirname, '../../../../web/app/tokens.css'), 'utf8');
  const tokens = (block: string) => (name: string) =>
    new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block)?.[1]?.toLowerCase();

  it('EMAIL_BRAND equals tokens.css [data-theme="light"]', () => {
    const v = tokens(css.slice(css.indexOf('\n[data-theme="light"] {')));
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

  it('EMAIL_BRAND_DARK equals tokens.css [data-theme="dark"]', () => {
    const v = tokens(css.slice(css.indexOf('[data-theme="dark"] {'), css.indexOf('\n[data-theme="light"] {')));
    expect(v('bg-canvas')).toBe(EMAIL_BRAND_DARK.canvas);
    expect(v('bg-surface')).toBe(EMAIL_BRAND_DARK.surface);
    expect(v('bg-elevated')).toBe(EMAIL_BRAND_DARK.elevated);
    expect(v('border-subtle')).toBe(EMAIL_BRAND_DARK.borderSubtle);
    expect(v('text-primary')).toBe(EMAIL_BRAND_DARK.textPrimary);
    expect(v('text-secondary')).toBe(EMAIL_BRAND_DARK.textSecondary);
    expect(v('text-muted')).toBe(EMAIL_BRAND_DARK.textMuted);
    expect(v('accent-loom')).toBe(EMAIL_BRAND_DARK.accent);
    expect(v('on-accent')).toBe(EMAIL_BRAND_DARK.onAccent);
  });
});
