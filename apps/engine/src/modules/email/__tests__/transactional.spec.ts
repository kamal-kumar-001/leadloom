import { describe, it, expect } from 'vitest';
import { createTransactionalEmail, ResendTransactionalEmail, type FetchLike } from '../transactional';

const msg = { kind: 'password_reset' as const, to: 'user@example.invalid', subject: 'Reset', text: 'link' };
const okFetch = (calls: any[]): FetchLike => async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ id: 'em_1' }) }; };

describe('transactional email', () => {
  it('is disabled by default and never calls the network', async () => {
    const calls: any[] = [];
    const mail = createTransactionalEmail({}, okFetch(calls));
    expect(await mail.send(msg)).toEqual({ sent: false, reason: 'disabled' });
    expect(calls).toHaveLength(0);
  });
  it('requires key and from when enabled', () => {
    expect(() => createTransactionalEmail({ LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED: 'true' }, okFetch([]))).toThrow();
    expect(() => createTransactionalEmail({ LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED: 'true', LEADLOOM_RESEND_API_KEY: 'k', LEADLOOM_EMAIL_FROM: 'a\nb' }, okFetch([]))).toThrow();
  });
  it('sends one recipient with the configured sender only (fake fetch)', async () => {
    const calls: any[] = [];
    const mail = createTransactionalEmail({ LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED: 'true', LEADLOOM_RESEND_API_KEY: 'test-key', LEADLOOM_EMAIL_FROM: 'Leadloom <noreply@leadloom.example.invalid>' }, okFetch(calls));
    expect(await mail.send(msg)).toEqual({ sent: true, providerId: 'em_1' });
    const body = JSON.parse(calls[0].init.body);
    expect(body.to).toEqual(['user@example.invalid']); expect(body.from).toContain('leadloom.example.invalid');
  });
  it('rejects invalid messages, injected headers, unknown kinds; rate-limits; maps provider failure', async () => {
    const calls: any[] = [];
    const mail = new ResendTransactionalEmail({ apiKey: 'k', from: 'a@b.co', maxPerMinute: 2 }, okFetch(calls), () => 1000);
    expect((await mail.send({ ...msg, to: 'a@b.co,c@d.co' })).sent).toBe(false);
    expect((await mail.send({ ...msg, subject: 'x\r\nBcc: y@z.co' })).sent).toBe(false);
    expect((await mail.send({ ...msg, kind: 'cold_outreach' as never })).sent).toBe(false);
    expect(calls).toHaveLength(0);
    expect((await mail.send(msg)).sent).toBe(true); expect((await mail.send(msg)).sent).toBe(true);
    expect(await mail.send(msg)).toEqual({ sent: false, reason: 'rate_limited' });
    const bad = new ResendTransactionalEmail({ apiKey: 'k', from: 'a@b.co' }, async () => ({ ok: false, json: async () => ({}) }));
    expect(await bad.send(msg)).toEqual({ sent: false, reason: 'provider_error' });
  });
});
