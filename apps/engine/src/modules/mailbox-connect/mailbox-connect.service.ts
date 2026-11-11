import { checkMailHost, IMAP_PORTS, SMTP_PORTS } from './host-policy';
import type { ConnectionResult, ConnectionVerifier, MailboxEndpoint } from './verifier';

export interface ConnectInput { email: string; password: string; smtpHost: string; smtpPort: number; imapHost: string; imapPort: number }
export interface MailboxStatus { id: string; email: string; connectionStatus: string; connectionErrorCode: string | null; connectionCheckedAt: Date | null }

export interface MailboxConnectStore {
  /** Seals the password and creates the mailbox. Null when the address is already connected in this workspace. */
  create(workspaceId: string, ep: MailboxEndpoint, checkedAt: Date): Promise<MailboxStatus | null>;
  loadEndpoint(workspaceId: string, mailboxId: string): Promise<MailboxEndpoint | null>;
  recordCheck(workspaceId: string, mailboxId: string, status: 'ok' | 'failed', code: string | null, at: Date): Promise<MailboxStatus | null>;
  remove(workspaceId: string, mailboxId: string): Promise<boolean>;
}

export type ConnectResult =
  | { ok: true; mailbox: MailboxStatus; result: ConnectionResult }
  | { ok: false; reason: 'invalid_email' | 'invalid_password' | 'invalid_host' | 'private_host' | 'invalid_port' | 'already_connected' | 'connection_failed'; result?: ConnectionResult };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function worst(r: ConnectionResult): string | null {
  if (r.smtp !== 'ok') return `smtp_${r.smtp}`;
  if (r.imap !== 'ok' && r.imap !== 'skipped') return `imap_${r.imap}`;
  return null;
}

/**
 * Connects a mailbox by IMAP/SMTP password. The password is checked by a real login first and is sealed only
 * if that login works. Nothing is stored on failure. The password never appears in a result, log or error.
 * Sends no mail.
 */
export class MailboxConnectService {
  constructor(
    private readonly store: MailboxConnectStore,
    private readonly verifier: ConnectionVerifier,
    private readonly opts: { allowPrivateHosts?: boolean; now?: () => Date } = {},
  ) {}

  private now() { return this.opts.now ? this.opts.now() : new Date(); }

  async connect(workspaceId: string, input: ConnectInput): Promise<ConnectResult> {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 320) return { ok: false, reason: 'invalid_email' };
    if (!input.password || input.password.length > 512) return { ok: false, reason: 'invalid_password' };
    const smtp = await checkMailHost(input.smtpHost.trim(), input.smtpPort, SMTP_PORTS, this.opts.allowPrivateHosts);
    if (!smtp.ok) return { ok: false, reason: smtp.code };
    const imap = await checkMailHost(input.imapHost.trim(), input.imapPort, IMAP_PORTS, this.opts.allowPrivateHosts);
    if (!imap.ok) return { ok: false, reason: imap.code };
    const ep: MailboxEndpoint = { email, password: input.password, smtpHost: input.smtpHost.trim().toLowerCase(), smtpPort: input.smtpPort, imapHost: input.imapHost.trim().toLowerCase(), imapPort: input.imapPort };
    const result = await this.verifier.verify(ep);
    if (worst(result)) return { ok: false, reason: 'connection_failed', result };
    const made = await this.store.create(workspaceId, ep, this.now());
    return made ? { ok: true, mailbox: made, result } : { ok: false, reason: 'already_connected' };
  }

  /** Re-runs the login-only check on a connected mailbox and records the outcome. */
  async test(workspaceId: string, mailboxId: string): Promise<{ ok: true; mailbox: MailboxStatus; result: ConnectionResult } | { ok: false; reason: 'not_found' }> {
    const ep = await this.store.loadEndpoint(workspaceId, mailboxId);
    if (!ep) return { ok: false, reason: 'not_found' };
    const result = await this.verifier.verify(ep);
    const code = worst(result);
    const mailbox = await this.store.recordCheck(workspaceId, mailboxId, code ? 'failed' : 'ok', code, this.now());
    return mailbox ? { ok: true, mailbox, result } : { ok: false, reason: 'not_found' };
  }

  remove(workspaceId: string, mailboxId: string) { return this.store.remove(workspaceId, mailboxId); }
}
