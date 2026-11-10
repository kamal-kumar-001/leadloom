import { createHash, randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from '../auth/password';
import type { Role } from '../auth/rbac';
import { DisabledTransactionalEmail } from '../email/transactional';
import type { TransactionalEmail } from '../email/transactional';

export class MailUnavailableError extends Error { constructor() { super('Email sending is not configured'); } }
export class SignupLimitedError extends Error { constructor() { super('Signup temporarily limited'); } }
export class InvalidTokenError extends Error { constructor() { super('Invalid or expired link'); } }
export class WeakPasswordError extends Error { constructor() { super('Password must be 10-256 characters and not contain your email'); } }
export class InvalidCredentialsError extends Error { constructor() { super('Invalid credentials'); } }
export class EmailNotVerifiedError extends Error { constructor() { super('Email not verified'); } }
export class AccountInactiveError extends Error { constructor() { super('Account unavailable'); } }

export interface PasswordUser { id: string; workspaceId: string; role: Role; passwordHash: string | null; verified: boolean; active: boolean }

/** Persistence port. Token consumption must be atomic and single-use. */
export interface PasswordAccountStore {
  findByEmail(email: string): Promise<PasswordUser | null>;
  /** Atomic: workspace + admin user + audit row, unverified. Null when the email already exists. */
  createPasswordAccount(input: { email: string; name: string | null; workspaceName: string; passwordHash: string }): Promise<{ userId: string } | null>;
  /** Replaces any unused token of the same kind for the user. */
  putToken(input: { userId: string; kind: 'verify' | 'reset'; tokenHash: string; expiresAt: Date }): Promise<void>;
  /** Marks the token used and returns its user, only if unused and unexpired. */
  consumeToken(tokenHash: string, kind: 'verify' | 'reset'): Promise<string | null>;
  markVerified(userId: string): Promise<void>;
  setPassword(userId: string, passwordHash: string): Promise<void>;
  audit(action: string, userId: string | null): Promise<void>;
}

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const normEmail = (e: string) => e.trim().toLowerCase();

export function checkPassword(password: string, email: string): void {
  if (typeof password !== 'string' || password.length < 10 || password.length > 256) throw new WeakPasswordError();
  const local = email.split('@')[0];
  if (password.toLowerCase().includes(email.toLowerCase()) || (local.length >= 4 && password.toLowerCase() === local.toLowerCase())) throw new WeakPasswordError();
}

export interface PasswordAccountConfig {
  baseUrl: string; // public web app origin used in links, for example https://leadloom.dmpilot.org
  verifyTtlMs?: number;
  resetTtlMs?: number;
  /** Runs only when a NEW account would be created (signup abuse cap). */
  creationGate?: () => boolean;
  now?: () => number;
}

/**
 * Email and password accounts. The engine verifies the password hash itself and
 * issues its own session: nothing here ever claims a provider identity, and the
 * NextAuth bridge stays provider-only. A password account cannot sign in until
 * the emailed link proves control of the address. Responses never reveal whether
 * an email already has an account.
 */
export class PasswordAccountService {
  constructor(
    private readonly store: PasswordAccountStore,
    private readonly mailer: TransactionalEmail,
    private readonly cfg: PasswordAccountConfig,
  ) {}

  private now() { return (this.cfg.now ?? Date.now)(); }
  private mailReady() { return !(this.mailer instanceof DisabledTransactionalEmail); }

  private async issue(userId: string, email: string, kind: 'verify' | 'reset'): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const ttl = kind === 'verify' ? (this.cfg.verifyTtlMs ?? 24 * 3600_000) : (this.cfg.resetTtlMs ?? 3600_000);
    await this.store.putToken({ userId, kind, tokenHash: sha256(token), expiresAt: new Date(this.now() + ttl) });
    const base = this.cfg.baseUrl.replace(/\/+$/, '');
    const link = `${base}/${kind === 'verify' ? 'verify-email' : 'reset-password'}?token=${token}`;
    const text = kind === 'verify'
      ? `Confirm your email to finish creating your Leadloom account:\n\n${link}\n\nThe link works once and expires in 24 hours. If you did not sign up, ignore this email.`
      : `Reset your Leadloom password:\n\n${link}\n\nThe link works once and expires in 1 hour. If you did not ask for this, ignore this email.`;
    const res = await this.mailer.send({ kind: kind === 'verify' ? 'auth_verification' : 'password_reset', to: email, subject: kind === 'verify' ? 'Confirm your Leadloom email' : 'Reset your Leadloom password', text });
    if (!res.sent) throw new MailUnavailableError();
  }

  /** Same outcome for new and existing emails so the response cannot be used to list accounts. */
  async register(emailIn: string, password: string, nameIn?: string | null): Promise<void> {
    const email = normEmail(emailIn);
    if (!EMAIL.test(email) || email.length > 320) throw new Error('Invalid email');
    checkPassword(password, email);
    if (!this.mailReady()) throw new MailUnavailableError(); // never create an account nobody can verify
    const existing = await this.store.findByEmail(email);
    if (existing) { await hashPassword(password); return; } // similar cost, no signal, no mail
    if (this.cfg.creationGate && !this.cfg.creationGate()) throw new SignupLimitedError();
    const name = (nameIn ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 255) || null;
    const workspaceName = (name ? `${name}'s workspace` : `${email.split('@')[0]}'s workspace`).slice(0, 255);
    const made = await this.store.createPasswordAccount({ email, name, workspaceName, passwordHash: await hashPassword(password) });
    if (!made) return; // lost a race with another registration of the same email
    await this.issue(made.userId, email, 'verify');
  }

  async verifyEmail(token: string): Promise<void> {
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) throw new InvalidTokenError();
    const userId = await this.store.consumeToken(sha256(token), 'verify');
    if (!userId) throw new InvalidTokenError();
    await this.store.markVerified(userId);
    await this.store.audit('user.email_verified', userId);
  }

  async forgotPassword(emailIn: string): Promise<void> {
    const email = normEmail(emailIn);
    if (!EMAIL.test(email)) return;
    if (!this.mailReady()) throw new MailUnavailableError();
    const u = await this.store.findByEmail(email);
    if (!u || !u.active || !u.verified) return; // no signal either way
    await this.issue(u.id, email, 'reset');
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) throw new InvalidTokenError();
    if (typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 256) throw new WeakPasswordError();
    const userId = await this.store.consumeToken(sha256(token), 'reset');
    if (!userId) throw new InvalidTokenError();
    await this.store.setPassword(userId, await hashPassword(newPassword));
    await this.store.audit('user.password_reset', userId);
  }

  /** Verifies the stored hash. Unverified, suspended or unknown accounts never get an identity. */
  async authenticate(emailIn: string, password: string): Promise<{ userId: string; workspaceId: string; role: Role }> {
    const email = normEmail(emailIn);
    const u = await this.store.findByEmail(email);
    if (!u || !u.passwordHash) { await verifyPassword(password, DUMMY_HASH); throw new InvalidCredentialsError(); }
    if (!(await verifyPassword(password, u.passwordHash))) throw new InvalidCredentialsError();
    if (!u.verified) throw new EmailNotVerifiedError();
    if (!u.active) throw new AccountInactiveError();
    return { userId: u.id, workspaceId: u.workspaceId, role: u.role };
  }
}
