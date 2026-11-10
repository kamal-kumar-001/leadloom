import { createHmac, randomInt } from 'node:crypto';
import { hashPassword, verifyPassword } from '../auth/password';
import type { Role } from '../auth/rbac';
import { DisabledTransactionalEmail } from '../email/transactional';
import type { TransactionalEmail } from '../email/transactional';
import { renderOtpEmail, OTP_TTL_MINUTES } from '../email/otp-template';
import type { OtpPurpose } from '../email/otp-template';

export class MailUnavailableError extends Error { constructor() { super('Email sending is not configured'); } }
export class SignupLimitedError extends Error { constructor() { super('Signup temporarily limited'); } }
export class InvalidCodeError extends Error { constructor() { super('Invalid or expired code'); } }
export class WeakPasswordError extends Error { constructor() { super('Password must be 10-256 characters and not contain your email'); } }
export class InvalidCredentialsError extends Error { constructor() { super('Invalid credentials'); } }
export class EmailNotVerifiedError extends Error { constructor() { super('Email not verified'); } }
export class AccountInactiveError extends Error { constructor() { super('Account unavailable'); } }

export interface PasswordUser { id: string; workspaceId: string; role: Role; sessionVersion: number; passwordHash: string | null; verified: boolean; active: boolean }

/** Persistence port. Code checking must be atomic, single-use and attempt-counted. */
export interface PasswordAccountStore {
  findByEmail(email: string): Promise<PasswordUser | null>;
  /** Atomic: workspace + admin user + audit row, unverified. Null when the email already exists. */
  createPasswordAccount(input: { email: string; name: string | null; workspaceName: string; passwordHash: string }): Promise<{ userId: string } | null>;
  /** Unverified account only: replace its password (the mailbox owner proves the address next). Returns the user id, or null when none applies. */
  replaceUnverifiedPassword(email: string, passwordHash: string): Promise<string | null>;
  /** Supersedes any unused code of the same purpose for the user. */
  putOtp(input: { userId: string; purpose: OtpPurpose; codeHash: string; expiresAt: Date }): Promise<void>;
  /** True when a code of this purpose was created for the user in the last `seconds`. */
  otpSentWithin(userId: string, purpose: OtpPurpose, seconds: number): Promise<boolean>;
  /**
   * Checks the latest unused, unexpired code. A wrong guess counts an attempt;
   * at `maxAttempts` the code is dead. A right guess consumes it. Atomic.
   */
  checkOtp(userId: string, purpose: OtpPurpose, candidateHash: string, maxAttempts: number): Promise<boolean>;
  markVerified(userId: string): Promise<void>;
  /** Sets the password, verifies the address (the code proved the mailbox) and bumps session_version. */
  setPassword(userId: string, passwordHash: string): Promise<void>;
  /** A provider has proven this email: verify an unverified password account and drop its password (pre-registration takeover guard). */
  claimByProvider(email: string): Promise<void>;
  audit(action: string, userId: string | null): Promise<void>;
}

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const normEmail = (e: string) => e.trim().toLowerCase();
export const MAX_OTP_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;

export function checkPassword(password: string, email: string): void {
  if (typeof password !== 'string' || password.length < 10 || password.length > 256) throw new WeakPasswordError();
  const local = email.split('@')[0];
  if (password.toLowerCase().includes(email.toLowerCase()) || (local.length >= 4 && password.toLowerCase() === local.toLowerCase())) throw new WeakPasswordError();
}

export interface PasswordAccountConfig {
  /** Server secret for keying code hashes. Derive it; never reuse the raw session key. */
  otpKey: Buffer;
  /** Runs only when a NEW account would be created (signup abuse cap). */
  creationGate?: () => boolean;
  /** Seconds before another code may be sent for the same account and purpose (default 60). */
  resendCooldownSeconds?: number;
  now?: () => number;
}

/**
 * Email and password accounts with emailed one-time codes (signup verification
 * and password reset share one purpose-bound code flow). The engine checks the
 * password hash itself and issues its own session; nothing here claims a
 * provider identity and the NextAuth bridge stays provider-only. A password
 * account cannot sign in until a code proves the mailbox. Responses never reveal
 * whether an email already has an account.
 */
export class PasswordAccountService {
  constructor(
    private readonly store: PasswordAccountStore,
    private readonly mailer: TransactionalEmail,
    private readonly cfg: PasswordAccountConfig,
  ) {
    if (cfg.otpKey.length < 32) throw new Error('OTP key must have at least 32 bytes');
  }

  private now() { return (this.cfg.now ?? Date.now)(); }
  private mailReady() { return !(this.mailer instanceof DisabledTransactionalEmail); }

  /** HMAC bound to purpose and user, so a code for one purpose or account verifies nothing else. */
  codeHash(userId: string, purpose: OtpPurpose, code: string): string {
    return createHmac('sha256', this.cfg.otpKey).update(`${purpose}:${userId}:${code}`).digest('hex');
  }

  private async issue(userId: string, email: string, purpose: OtpPurpose): Promise<void> {
    if (await this.store.otpSentWithin(userId, purpose, this.cfg.resendCooldownSeconds ?? RESEND_COOLDOWN_SECONDS)) return; // silent: a code was just sent
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.store.putOtp({ userId, purpose, codeHash: this.codeHash(userId, purpose, code), expiresAt: new Date(this.now() + OTP_TTL_MINUTES * 60_000) });
    const res = await this.mailer.send(renderOtpEmail(purpose, code, email));
    if (!res.sent) throw new MailUnavailableError();
  }

  /** Same outcome for new and existing emails so the response cannot be used to list accounts. */
  async register(emailIn: string, password: string, nameIn?: string | null): Promise<void> {
    const email = normEmail(emailIn);
    if (!EMAIL.test(email) || email.length > 320) throw new Error('Invalid email');
    checkPassword(password, email);
    if (!this.mailReady()) throw new MailUnavailableError(); // never create an account nobody can verify
    const passwordHash = await hashPassword(password);
    const existing = await this.store.findByEmail(email);
    if (existing) {
      // Unverified: whoever proves the mailbox next owns it, so the latest password wins and a fresh code goes out.
      // Verified: change nothing and send nothing.
      if (!existing.verified && existing.active) {
        const id = await this.store.replaceUnverifiedPassword(email, passwordHash);
        if (id) await this.issue(id, email, 'signup');
      }
      return;
    }
    if (this.cfg.creationGate && !this.cfg.creationGate()) throw new SignupLimitedError();
    const name = (nameIn ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 255) || null;
    const workspaceName = (name ? `${name}'s workspace` : `${email.split('@')[0]}'s workspace`).slice(0, 255);
    const made = await this.store.createPasswordAccount({ email, name, workspaceName, passwordHash });
    if (!made) return; // lost a race with another registration of the same email
    await this.issue(made.userId, email, 'signup');
  }

  /** New signup code for an unverified account. Silent for anything else. */
  async resendVerification(emailIn: string): Promise<void> {
    const email = normEmail(emailIn);
    if (!EMAIL.test(email)) return;
    if (!this.mailReady()) throw new MailUnavailableError();
    const u = await this.store.findByEmail(email);
    if (!u || u.verified || !u.active) return;
    await this.issue(u.id, email, 'signup');
  }

  private async checkCode(email: string, purpose: OtpPurpose, code: string): Promise<PasswordUser> {
    const u = await this.store.findByEmail(email);
    const c = typeof code === 'string' ? code.trim() : '';
    if (!u || !u.active || !/^\d{6}$/.test(c)) throw new InvalidCodeError();
    if (!(await this.store.checkOtp(u.id, purpose, this.codeHash(u.id, purpose, c), MAX_OTP_ATTEMPTS))) throw new InvalidCodeError();
    return u;
  }

  async verifyEmail(emailIn: string, code: string): Promise<void> {
    const u = await this.checkCode(normEmail(emailIn), 'signup', code);
    await this.store.markVerified(u.id);
    await this.store.audit('user.email_verified', u.id);
  }

  async forgotPassword(emailIn: string): Promise<void> {
    const email = normEmail(emailIn);
    if (!EMAIL.test(email)) return;
    if (!this.mailReady()) throw new MailUnavailableError();
    const u = await this.store.findByEmail(email);
    if (!u || !u.active) return; // no signal either way. Unverified accounts may reset: the code proves mailbox control.
    await this.issue(u.id, email, 'reset');
  }

  async resetPassword(emailIn: string, code: string, newPassword: string): Promise<void> {
    const email = normEmail(emailIn);
    checkPassword(newPassword, email); // before the code is spent
    const u = await this.checkCode(email, 'reset', code);
    await this.store.setPassword(u.id, await hashPassword(newPassword));
    await this.store.audit('user.password_reset', u.id);
  }

  /** Provider-proven email (bridge): see store. */
  async claimByProvider(emailIn: string): Promise<void> { await this.store.claimByProvider(normEmail(emailIn)); }

  /** Verifies the stored hash. Unverified, suspended or unknown accounts never get an identity. */
  async authenticate(emailIn: string, password: string): Promise<{ userId: string; workspaceId: string; role: Role; sessionVersion: number }> {
    const email = normEmail(emailIn);
    const u = await this.store.findByEmail(email);
    if (!u || !u.passwordHash) { await verifyPassword(password, DUMMY_HASH); throw new InvalidCredentialsError(); }
    if (!(await verifyPassword(password, u.passwordHash))) throw new InvalidCredentialsError();
    if (!u.verified) throw new EmailNotVerifiedError();
    if (!u.active) throw new AccountInactiveError();
    return { userId: u.id, workspaceId: u.workspaceId, role: u.role, sessionVersion: u.sessionVersion };
  }
}
