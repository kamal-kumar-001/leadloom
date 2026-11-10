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
    expect(s.text).toMatch(/10 minutes/); expect(s.html).toMatch(/Leadloom/);
  });
  it('refuses anything that is not a 6-digit code (nothing can be injected into the html)', () => {
    for (const bad of ['12345', '1234567', '12a456', '<b>1234', '']) expect(() => renderOtpEmail('signup', bad, 'a@example.com')).toThrow();
  });
  it('never names the reference product or another product', () => {
    const t = JSON.stringify(renderOtpEmail('reset', '123456', 'a@example.com')).toLowerCase();
    for (const w of ['bakery', 'pump', 'dmpilot']) expect(t).not.toContain(w);
  });
});
