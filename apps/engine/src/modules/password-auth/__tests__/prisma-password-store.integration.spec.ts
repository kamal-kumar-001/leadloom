import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaPasswordStore } from '../prisma-password-store';
import { PasswordAccountService, MAX_OTP_ATTEMPTS } from '../password-account.service';
import type { TransactionalEmail, TransactionalMessage } from '../../email/transactional';

/** Gated: LEADLOOM_INTEGRATION=1 + LEADLOOM_TEST_DATABASE_URL on a migrated DB. Real concurrency, not sequential calls. */
const URL = process.env.LEADLOOM_TEST_DATABASE_URL;
const RUN = process.env.LEADLOOM_INTEGRATION === '1' && Boolean(URL);

describe.runIf(RUN)('password OTP store on real Postgres (gated)', () => {
  let prisma: any; const tag = randomUUID().slice(0, 8); const emails: string[] = [];
  const sent: TransactionalMessage[] = [];
  const mailer: TransactionalEmail = { async send(m) { sent.push(m); return { sent: true as const, providerId: 'x' }; } };
  const mk = (cooldown = 60) => new PasswordAccountService(new PrismaPasswordStore(prisma), mailer, { otpKey: randomBytes(32), resendCooldownSeconds: cooldown });
  const codeOf = (m: TransactionalMessage) => /\n(\d{6})\n/.exec(m.text)![1];
  const liveCount = async (email: string, purpose: string) => (await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM email_otps o JOIN users u ON u.id = o.user_id WHERE u.email = $1 AND o.purpose = $2 AND o.consumed_at IS NULL`, email, purpose))[0].n;
  beforeAll(async () => { const { PrismaClient } = await import('@leadloom/database'); prisma = new PrismaClient({ datasources: { db: { url: URL } } }); });
  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM workspaces WHERE id IN (SELECT workspace_id FROM users WHERE email = ANY($1::text[]))`, emails);
    await prisma.$executeRawUnsafe(`DELETE FROM audit_log WHERE target IN (SELECT id::text FROM users WHERE email = ANY($1::text[]))`, emails);
    await prisma.$disconnect();
  });

  it('20 parallel resends create exactly one live code and send exactly one mail', async () => {
    const email = `par-resend-${tag}@example.invalid`; emails.push(email);
    const svc = mk(); await svc.register(email, 'correct horse battery');
    sent.length = 0;
    await new Promise((r) => setTimeout(r, 1100));
    await Promise.all(Array.from({ length: 20 }, () => mk(1).resendVerification(email)));
    expect(sent).toHaveLength(1);
    expect(await liveCount(email, 'signup')).toBe(1);
  });

  it('20 parallel submissions of the right code verify exactly once', async () => {
    const email = `par-right-${tag}@example.invalid`; emails.push(email);
    const svc = mk(); sent.length = 0; await svc.register(email, 'correct horse battery');
    const code = codeOf(sent[0]);
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => svc.verifyEmail(email, code)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const audit = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'user.email_verified' AND target = (SELECT id::text FROM users WHERE email = $1)`, email);
    expect(audit[0].n).toBe(1);
  });

  it('parallel wrong guesses are counted exactly: the code dies at the cap and the right code then fails', async () => {
    const email = `par-wrong-${tag}@example.invalid`; emails.push(email);
    const svc = mk(); sent.length = 0; await svc.register(email, 'correct horse battery');
    const code = codeOf(sent[0]); const wrong = code === '000000' ? '111111' : '000000';
    await Promise.allSettled(Array.from({ length: 30 }, () => svc.verifyEmail(email, wrong)));
    const row = (await prisma.$queryRawUnsafe(`SELECT o.attempts FROM email_otps o JOIN users u ON u.id = o.user_id WHERE u.email = $1`, email))[0];
    expect(row.attempts).toBe(MAX_OTP_ATTEMPTS); // not 30, not fewer: attempts past the cap are refused, none lost
    await expect(svc.verifyEmail(email, code)).rejects.toThrow();
  });

  it('a right guess racing wrong guesses never verifies after the cap is reached', async () => {
    const email = `par-mixed-${tag}@example.invalid`; emails.push(email);
    const svc = mk(); sent.length = 0; await svc.register(email, 'correct horse battery');
    const code = codeOf(sent[0]); const wrong = code === '000000' ? '111111' : '000000';
    const ops = [...Array.from({ length: 10 }, () => svc.verifyEmail(email, wrong)), svc.verifyEmail(email, code)];
    const results = await Promise.allSettled(ops);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBeLessThanOrEqual(1);
    const row = (await prisma.$queryRawUnsafe(`SELECT o.attempts, o.consumed_at IS NOT NULL AS used FROM email_otps o JOIN users u ON u.id = o.user_id WHERE u.email = $1`, email))[0];
    expect(row.attempts).toBeLessThanOrEqual(MAX_OTP_ATTEMPTS);
    expect(row.used).toBe(ok === 1);
  });

  it('parallel registrations of one email create one account and one live code', async () => {
    const email = `par-reg-${tag}@example.invalid`; emails.push(email);
    sent.length = 0;
    await Promise.allSettled(Array.from({ length: 10 }, () => mk(60).register(email, 'correct horse battery')));
    const n = (await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM users WHERE email = $1`, email))[0].n;
    expect(n).toBe(1);
    expect(await liveCount(email, 'signup')).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it('stored values and audit rows never contain the code or the password', async () => {
    const email = `leak-${tag}@example.invalid`; emails.push(email);
    const svc = mk(); sent.length = 0; await svc.register(email, 'correct horse battery');
    const code = codeOf(sent[0]);
    const dump = JSON.stringify(await prisma.$queryRawUnsafe(`SELECT o.code_hash, a.action, a.metadata::text AS m FROM email_otps o JOIN users u ON u.id = o.user_id LEFT JOIN audit_log a ON a.target = u.id::text WHERE u.email = $1`, email));
    expect(dump).not.toContain(code); expect(dump).not.toContain('correct horse battery');
  });
});
