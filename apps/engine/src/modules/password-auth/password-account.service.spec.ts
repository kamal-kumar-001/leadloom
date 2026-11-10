import { describe, it, expect } from 'vitest';
import { PasswordAccountService, InvalidTokenError, EmailNotVerifiedError, InvalidCredentialsError, WeakPasswordError, MailUnavailableError, AccountInactiveError } from './password-account.service';
import type { PasswordAccountStore, PasswordUser } from './password-account.service';
import { DisabledTransactionalEmail } from '../email/transactional';
import type { TransactionalEmail, TransactionalMessage } from '../email/transactional';
import { createHash } from 'node:crypto';

class MemStore implements PasswordAccountStore {
  users = new Map<string, PasswordUser & { email: string }>();
  tokens: Array<{ userId: string; kind: string; hash: string; exp: Date; used: boolean }> = [];
  audits: string[] = [];
  async findByEmail(e: string) { return [...this.users.values()].find(u => u.email === e) ?? null; }
  async createPasswordAccount(i: any) {
    if ([...this.users.values()].some(u => u.email === i.email)) return null;
    const id = 'u' + (this.users.size + 1);
    this.users.set(id, { id, email: i.email, workspaceId: 'w' + id, role: 'admin', passwordHash: i.passwordHash, verified: false, active: true });
    return { userId: id };
  }
  async putToken(i: any) { this.tokens = this.tokens.filter(t => !(t.userId === i.userId && t.kind === i.kind && !t.used)); this.tokens.push({ userId: i.userId, kind: i.kind, hash: i.tokenHash, exp: i.expiresAt, used: false }); }
  async consumeToken(h: string, kind: any) { const t = this.tokens.find(x => x.hash === h && x.kind === kind && !x.used && x.exp.getTime() > Date.now()); if (!t) return null; t.used = true; return t.userId; }
  async markVerified(id: string) { this.users.get(id)!.verified = true; }
  async setPassword(id: string, h: string) { const u = this.users.get(id)!; u.passwordHash = h; u.verified = true; }
  async claimByProvider(e: string) { const u = [...this.users.values()].find(x => x.email === e && !x.verified); if (u) { u.verified = true; u.passwordHash = null; } }
  async audit(a: string) { this.audits.push(a); }
}
class Capture implements TransactionalEmail { sent: TransactionalMessage[] = []; async send(m: TransactionalMessage) { this.sent.push(m); return { sent: true as const, providerId: 'x' }; } }
const tokenOf = (m: TransactionalMessage) => /token=([\w-]+)/.exec(m.text)![1];
const mk = (gate?: () => boolean) => { const s = new MemStore(), m = new Capture(); return { s, m, svc: new PasswordAccountService(s, m, { baseUrl: 'https://app.example/', creationGate: gate }) }; };
const PW = 'correct horse battery';

describe('PasswordAccountService', () => {
  it('register creates an unverified admin of its own workspace and mails one verification link', async () => {
    const { s, m, svc } = mk();
    await svc.register('A@Example.com', PW, 'Ann');
    expect(s.users.size).toBe(1);
    const u = [...s.users.values()][0];
    expect(u.email).toBe('a@example.com'); expect(u.role).toBe('admin'); expect(u.verified).toBe(false);
    expect(u.passwordHash).toMatch(/^scrypt\$/); expect(u.passwordHash).not.toContain(PW);
    expect(m.sent).toHaveLength(1); expect(m.sent[0].to).toBe('a@example.com'); expect(m.sent[0].kind).toBe('auth_verification');
    expect(m.sent[0].text).toContain('https://app.example/verify-email?token=');
    expect(s.tokens[0].hash).toBe(createHash('sha256').update(tokenOf(m.sent[0])).digest('hex')); // only hash stored
  });
  it('cannot sign in until verified, then can; wrong password never can', async () => {
    const { m, svc } = mk();
    await svc.register('a@example.com', PW);
    await expect(svc.authenticate('a@example.com', PW)).rejects.toBeInstanceOf(EmailNotVerifiedError);
    await svc.verifyEmail(tokenOf(m.sent[0]));
    await expect(svc.authenticate('a@example.com', PW)).resolves.toMatchObject({ role: 'admin' });
    await expect(svc.authenticate('a@example.com', PW + 'x')).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(svc.authenticate('nobody@example.com', PW)).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
  it('wrong password on an unverified account does not reveal verification state', async () => {
    const { svc } = mk();
    await svc.register('a@example.com', PW);
    await expect(svc.authenticate('a@example.com', 'wrong wrong wrong')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
  it('verification token is single-use and expires', async () => {
    const { s, m, svc } = mk();
    await svc.register('a@example.com', PW);
    const t = tokenOf(m.sent[0]);
    await svc.verifyEmail(t);
    await expect(svc.verifyEmail(t)).rejects.toBeInstanceOf(InvalidTokenError);
    await svc.register('b@example.com', PW);
    s.tokens[s.tokens.length - 1].exp = new Date(Date.now() - 1000);
    await expect(svc.verifyEmail(tokenOf(m.sent[1]))).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(svc.verifyEmail('short')).rejects.toBeInstanceOf(InvalidTokenError);
  });
  it('registering an existing email changes nothing and sends nothing (no enumeration)', async () => {
    const { s, m, svc } = mk();
    await svc.register('a@example.com', PW);
    const hash = [...s.users.values()][0].passwordHash;
    await expect(svc.register('a@example.com', 'another long password')).resolves.toBeUndefined();
    expect(s.users.size).toBe(1); expect(m.sent).toHaveLength(1); expect([...s.users.values()][0].passwordHash).toBe(hash);
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
    const svc = new PasswordAccountService(s, new DisabledTransactionalEmail(), { baseUrl: 'https://x' });
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
  it('reset: only verified active users get mail; token single-use; new password works, old does not; also verifies', async () => {
    const { s, m, svc } = mk();
    await svc.register('a@example.com', PW);
    await svc.forgotPassword('a@example.com'); expect(m.sent).toHaveLength(2); // unverified may reset; the link proves control
    m.sent.pop();
    await svc.forgotPassword('ghost@example.com'); expect(m.sent).toHaveLength(1);
    await svc.verifyEmail(tokenOf(m.sent[0]));
    await svc.forgotPassword('a@example.com'); expect(m.sent).toHaveLength(2); expect(m.sent[1].kind).toBe('password_reset');
    const t = tokenOf(m.sent[1]);
    await svc.resetPassword(t, 'brand new password');
    await expect(svc.resetPassword(t, 'yet another password')).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(svc.authenticate('a@example.com', PW)).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(svc.authenticate('a@example.com', 'brand new password')).resolves.toBeDefined();
    expect(s.audits).toContain('user.password_reset');
  });
  it('a verify token cannot be used as a reset token', async () => {
    const { m, svc } = mk();
    await svc.register('a@example.com', PW);
    await expect(svc.resetPassword(tokenOf(m.sent[0]), 'brand new password')).rejects.toBeInstanceOf(InvalidTokenError);
  });
  it('suspended accounts cannot sign in or get reset mail', async () => {
    const { s, m, svc } = mk();
    await svc.register('a@example.com', PW);
    await svc.verifyEmail(tokenOf(m.sent[0]));
    [...s.users.values()][0].active = false;
    await expect(svc.authenticate('a@example.com', PW)).rejects.toBeInstanceOf(AccountInactiveError);
    await svc.forgotPassword('a@example.com'); expect(m.sent).toHaveLength(1);
  });
  it('accounts without a password (provider-only users) cannot password sign in', async () => {
    const { s, svc } = mk();
    s.users.set('g', { id: 'g', email: 'g@example.com', workspaceId: 'w', role: 'admin', passwordHash: null, verified: true, active: true });
    await expect(svc.authenticate('g@example.com', PW)).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
  it('a provider-proven email takes over an unverified password account and drops the planted password', async () => {
    const { svc } = mk();
    await svc.register('v@example.com', PW); // attacker pre-registers the victim address
    await svc.claimByProvider('V@Example.com'); // victim later signs in with a verified provider
    await expect(svc.authenticate('v@example.com', PW)).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
