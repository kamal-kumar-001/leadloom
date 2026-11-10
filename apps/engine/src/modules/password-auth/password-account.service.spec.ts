import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { PasswordAccountService, InvalidCodeError, EmailNotVerifiedError, InvalidCredentialsError, WeakPasswordError, MailUnavailableError, AccountInactiveError, MAX_OTP_ATTEMPTS } from './password-account.service';
import type { PasswordAccountStore, PasswordUser } from './password-account.service';
import { DisabledTransactionalEmail } from '../email/transactional';
import type { TransactionalEmail, TransactionalMessage } from '../email/transactional';

type Otp = { userId: string; purpose: string; hash: string; exp: Date; used: boolean; attempts: number; at: number };
class MemStore implements PasswordAccountStore {
  users = new Map<string, PasswordUser & { email: string }>();
  otps: Otp[] = [];
  audits: string[] = [];
  clock = () => Date.now();
  async findByEmail(e: string) { return [...this.users.values()].find(u => u.email === e) ?? null; }
  async createPasswordAccount(i: any) {
    if ([...this.users.values()].some(u => u.email === i.email)) return null;
    const id = 'u' + (this.users.size + 1);
    this.users.set(id, { id, email: i.email, workspaceId: 'w' + id, role: 'admin', sessionVersion: 0, passwordHash: i.passwordHash, verified: false, active: true });
    return { userId: id };
  }
  async replaceUnverifiedPassword(e: string, h: string) { const u = [...this.users.values()].find(x => x.email === e && !x.verified && x.active); if (!u) return null; u.passwordHash = h; return u.id; }
  async putOtp(i: any) { this.otps = this.otps.filter(o => !(o.userId === i.userId && o.purpose === i.purpose && !o.used)); this.otps.push({ userId: i.userId, purpose: i.purpose, hash: i.codeHash, exp: i.expiresAt, used: false, attempts: 0, at: this.clock() }); }
  async otpSentWithin(id: string, p: string, s: number) { return this.otps.some(o => o.userId === id && o.purpose === p && this.clock() - o.at < s * 1000); }
  async checkOtp(id: string, p: string, h: string, max: number) {
    const o = [...this.otps].reverse().find(x => x.userId === id && x.purpose === p && !x.used && x.exp.getTime() > this.clock());
    if (!o || o.attempts >= max) return false;
    if (o.hash === h) { o.used = true; return true; }
    o.attempts++; return false;
  }
  async markVerified(id: string) { this.users.get(id)!.verified = true; }
  async setPassword(id: string, h: string) { const u = this.users.get(id)!; u.passwordHash = h; u.verified = true; u.sessionVersion++; }
  async claimByProvider(e: string) { const u = [...this.users.values()].find(x => x.email === e && !x.verified); if (u) { u.verified = true; u.passwordHash = null; u.sessionVersion++; } }
  async audit(a: string) { this.audits.push(a); }
}
class Capture implements TransactionalEmail { sent: TransactionalMessage[] = []; async send(m: TransactionalMessage) { this.sent.push(m); return { sent: true as const, providerId: 'x' }; } }
const codeOf = (m: TransactionalMessage) => /\n(\d{6})\n/.exec(m.text)![1];
const mk = (gate?: () => boolean) => {
  const s = new MemStore(), m = new Capture(); let t = Date.now(); s.clock = () => t;
  const svc = new PasswordAccountService(s, m, { otpKey: randomBytes(32), creationGate: gate, now: () => t });
  return { s, m, svc, advance: (ms: number) => { t += ms; } };
};
const PW = 'correct horse battery';
const wrong = (c: string) => (c === '000000' ? '111111' : '000000');

describe('PasswordAccountService (emailed codes)', () => {
  it('register creates an unverified admin of its own workspace and mails one signup code', async () => {
    const { s, m, svc } = mk();
    await svc.register('A@Example.com', PW, 'Ann');
    const u = [...s.users.values()][0];
    expect(u.email).toBe('a@example.com'); expect(u.role).toBe('admin'); expect(u.verified).toBe(false);
    expect(u.passwordHash).toMatch(/^scrypt\$/); expect(u.passwordHash).not.toContain(PW);
    expect(m.sent).toHaveLength(1); expect(m.sent[0].to).toBe('a@example.com'); expect(m.sent[0].kind).toBe('auth_verification');
    expect(codeOf(m.sent[0])).toMatch(/^\d{6}$/);
    expect(s.otps[0].hash).toMatch(/^[0-9a-f]{64}$/); expect(s.otps[0].hash).not.toContain(codeOf(m.sent[0])); // only an HMAC is stored
    expect(m.sent[0].html).toContain(codeOf(m.sent[0]));
  });
  it('cannot sign in until the code verifies, then can; a wrong password never can', async () => {
    const { m, svc } = mk();
    await svc.register('a@example.com', PW);
    await expect(svc.authenticate('a@example.com', PW)).rejects.toBeInstanceOf(EmailNotVerifiedError);
    await svc.verifyEmail('a@example.com', codeOf(m.sent[0]));
    await expect(svc.authenticate('a@example.com', PW)).resolves.toMatchObject({ role: 'admin' });
    await expect(svc.authenticate('a@example.com', PW + 'x')).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(svc.authenticate('nobody@example.com', PW)).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
  it('wrong password on an unverified account does not reveal verification state', async () => {
    const { svc } = mk();
    await svc.register('a@example.com', PW);
    await expect(svc.authenticate('a@example.com', 'wrong wrong wrong')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
  it('code is single-use, expires, and must be six digits', async () => {
    const { m, svc, advance } = mk();
    await svc.register('a@example.com', PW);
    const c = codeOf(m.sent[0]);
    await svc.verifyEmail('a@example.com', c);
    await expect(svc.verifyEmail('a@example.com', c)).rejects.toBeInstanceOf(InvalidCodeError);
    await svc.register('b@example.com', PW);
    advance(11 * 60_000);
    await expect(svc.verifyEmail('b@example.com', codeOf(m.sent[1]))).rejects.toBeInstanceOf(InvalidCodeError);
    await expect(svc.verifyEmail('b@example.com', '12345')).rejects.toBeInstanceOf(InvalidCodeError);
    await expect(svc.verifyEmail('b@example.com', 'abcdef')).rejects.toBeInstanceOf(InvalidCodeError);
  });
  it('five wrong guesses kill the code, even the right one afterwards; a resend gives a new code', async () => {
    const { m, svc, advance } = mk();
    await svc.register('a@example.com', PW);
    const c = codeOf(m.sent[0]);
    for (let i = 0; i < MAX_OTP_ATTEMPTS; i++) await expect(svc.verifyEmail('a@example.com', wrong(c))).rejects.toBeInstanceOf(InvalidCodeError);
    await expect(svc.verifyEmail('a@example.com', c)).rejects.toBeInstanceOf(InvalidCodeError);
    advance(61_000);
    await svc.resendVerification('a@example.com');
    expect(m.sent).toHaveLength(2);
    await svc.verifyEmail('a@example.com', codeOf(m.sent[1]));
  });
  it('resend has a cooldown and replaces the earlier code', async () => {
    const { m, svc, advance } = mk();
    await svc.register('a@example.com', PW);
    await svc.resendVerification('a@example.com'); expect(m.sent).toHaveLength(1); // inside cooldown: silent
    advance(61_000);
    await svc.resendVerification('a@example.com'); expect(m.sent).toHaveLength(2);
    const [c1, c2] = [codeOf(m.sent[0]), codeOf(m.sent[1])];
    if (c1 !== c2) await expect(svc.verifyEmail('a@example.com', c1)).rejects.toBeInstanceOf(InvalidCodeError);
    await svc.verifyEmail('a@example.com', c2);
  });
  it('registering a verified email changes nothing and sends nothing (no enumeration)', async () => {
    const { s, m, svc } = mk();
    await svc.register('a@example.com', PW); await svc.verifyEmail('a@example.com', codeOf(m.sent[0]));
    const hash = [...s.users.values()][0].passwordHash;
    await expect(svc.register('a@example.com', 'another long password')).resolves.toBeUndefined();
    expect(s.users.size).toBe(1); expect(m.sent).toHaveLength(1); expect([...s.users.values()][0].passwordHash).toBe(hash);
  });
  it('re-registering an UNVERIFIED email replaces the password and mails a fresh code (squatter cannot lock the owner out)', async () => {
    const { s, m, svc, advance } = mk();
    await svc.register('v@example.com', 'attacker chosen password');
    advance(61_000);
    await svc.register('v@example.com', 'owner chosen password');
    expect(s.users.size).toBe(1); expect(m.sent).toHaveLength(2);
    await svc.verifyEmail('v@example.com', codeOf(m.sent[1]));
    await expect(svc.authenticate('v@example.com', 'attacker chosen password')).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(svc.authenticate('v@example.com', 'owner chosen password')).resolves.toBeDefined();
  });
  it('weak passwords and bad emails are rejected before any account exists', async () => {
    const { s, svc } = mk();
    await expect(svc.register('a@example.com', 'short')).rejects.toBeInstanceOf(WeakPasswordError);
    await expect(svc.register('a@example.com', 'xx a@example.com xx')).rejects.toBeInstanceOf(WeakPasswordError);
    await expect(svc.register('not-an-email', PW)).rejects.toThrow();
    expect(s.users.size).toBe(0);
  });
  it('refuses to create accounts when mail is disabled (nobody could verify)', async () => {
    const s = new MemStore();
    const svc = new PasswordAccountService(s, new DisabledTransactionalEmail(), { otpKey: randomBytes(32) });
    await expect(svc.register('a@example.com', PW)).rejects.toBeInstanceOf(MailUnavailableError);
    expect(s.users.size).toBe(0);
  });
  it('signup cap applies only to new accounts', async () => {
    let allow = true; const { s, svc } = mk(() => allow);
    await svc.register('a@example.com', PW);
    allow = false;
    await expect(svc.register('b@example.com', PW)).rejects.toThrow();
    await expect(svc.register('a@example.com', PW)).resolves.toBeUndefined();
    expect(s.users.size).toBe(1);
  });
  it('reset: code mailed only for real active accounts; new password works, old does not; version bumps', async () => {
    const { s, m, svc } = mk();
    await svc.register('a@example.com', PW); await svc.verifyEmail('a@example.com', codeOf(m.sent[0]));
    await svc.forgotPassword('ghost@example.com'); expect(m.sent).toHaveLength(1);
    const before = await svc.authenticate('a@example.com', PW);
    await svc.forgotPassword('a@example.com'); expect(m.sent).toHaveLength(2); expect(m.sent[1].kind).toBe('password_reset');
    const c = codeOf(m.sent[1]);
    await svc.resetPassword('a@example.com', c, 'brand new password');
    await expect(svc.resetPassword('a@example.com', c, 'yet another password')).rejects.toBeInstanceOf(InvalidCodeError);
    await expect(svc.authenticate('a@example.com', PW)).rejects.toBeInstanceOf(InvalidCredentialsError);
    const after = await svc.authenticate('a@example.com', 'brand new password');
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(s.audits).toContain('user.password_reset');
  });
  it('a weak new password is refused without spending the reset code', async () => {
    const { m, svc, advance } = mk();
    await svc.register('a@example.com', PW); await svc.verifyEmail('a@example.com', codeOf(m.sent[0]));
    await svc.forgotPassword('a@example.com');
    const c = codeOf(m.sent[1]);
    await expect(svc.resetPassword('a@example.com', c, 'short')).rejects.toBeInstanceOf(WeakPasswordError);
    advance(1);
    await svc.resetPassword('a@example.com', c, 'brand new password');
  });
  it('purposes are bound: a signup code cannot reset a password, a reset code cannot verify', async () => {
    const { m, svc, advance } = mk();
    await svc.register('a@example.com', PW);
    const signup = codeOf(m.sent[0]);
    await expect(svc.resetPassword('a@example.com', signup, 'brand new password')).rejects.toBeInstanceOf(InvalidCodeError);
    advance(61_000);
    await svc.forgotPassword('a@example.com'); // unverified accounts may reset
    const reset = codeOf(m.sent[1]);
    await expect(svc.verifyEmail('a@example.com', reset)).rejects.toBeInstanceOf(InvalidCodeError);
  });
  it('a code for one account never works for another (hash is bound to the user)', async () => {
    const { m, svc } = mk();
    await svc.register('a@example.com', PW); await svc.register('b@example.com', PW);
    await expect(svc.verifyEmail('b@example.com', codeOf(m.sent[0]))).rejects.toBeInstanceOf(InvalidCodeError);
  });
  it('suspended accounts cannot sign in, reset or get codes', async () => {
    const { s, m, svc } = mk();
    await svc.register('a@example.com', PW); await svc.verifyEmail('a@example.com', codeOf(m.sent[0]));
    [...s.users.values()][0].active = false;
    await expect(svc.authenticate('a@example.com', PW)).rejects.toBeInstanceOf(AccountInactiveError);
    await svc.forgotPassword('a@example.com'); expect(m.sent).toHaveLength(1);
  });
  it('accounts without a password (provider-only users) cannot password sign in', async () => {
    const { s, svc } = mk();
    s.users.set('g', { id: 'g', email: 'g@example.com', workspaceId: 'w', role: 'admin', sessionVersion: 0, passwordHash: null, verified: true, active: true });
    await expect(svc.authenticate('g@example.com', PW)).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
  it('a provider-proven email takes over an unverified password account and drops the planted password', async () => {
    const { svc } = mk();
    await svc.register('v@example.com', PW);
    await svc.claimByProvider('V@Example.com');
    await expect(svc.authenticate('v@example.com', PW)).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
