import { isIP } from 'node:net';
import { resolvePublic } from './host-policy';
import { buildImapOptions, buildSmtpOptions, type MailboxClientConfig } from '../outbound/transport/client-factories';

export type CheckCode = 'ok' | 'auth_failed' | 'unreachable' | 'timeout' | 'tls_error' | 'failed';
export interface ConnectionResult { smtp: CheckCode; imap: CheckCode | 'skipped' }
export interface MailboxEndpoint { email: string; password: string; smtpHost: string; smtpPort: number; imapHost: string | null; imapPort: number | null }
export interface ConnectionVerifier { verify(endpoint: MailboxEndpoint): Promise<ConnectionResult> }

/** Maps a library error to a fixed code. Never returns the error text: it can echo server banners or credentials. */
export function classify(e: any): CheckCode {
  const code = String(e?.code ?? ''); const resp = Number(e?.responseCode ?? 0);
  if (e?.authenticationFailed || code === 'EAUTH' || resp === 535 || resp === 534 || resp === 530) return 'auth_failed';
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || code === 'ETIMEOUT') return 'timeout';
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || code === 'ECONNRESET') return 'unreachable';
  if (/CERT|TLS|SSL|ERR_TLS/i.test(code) || /certificate|self.signed|tls/i.test(String(e?.message ?? ''))) return 'tls_error';
  return 'failed';
}

const OVERALL_MS = 20_000;
const withDeadline = <T>(p: Promise<T>): Promise<T> => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(Object.assign(new Error('deadline'), { code: 'ETIMEDOUT' })), OVERALL_MS).unref())]);

/**
 * Real login-only check. Sends no mail and reads no mail.
 * Enforced at connect time: each host is resolved once, every address must be public, and the socket goes to that
 * address with the hostname kept for TLS (SNI + certificate validation). TLS is required before any password is
 * sent (implicit TLS on 465/993, mandatory STARTTLS otherwise). `allowPrivateHosts` (non-production tests only)
 * skips the address policy and TLS requirement so a local test server can be used.
 */
export class RealConnectionVerifier implements ConnectionVerifier {
  constructor(private readonly opts: { allowPrivateHosts?: boolean } = {}) {}

  private async pin(host: string): Promise<string | null> {
    if (this.opts.allowPrivateHosts) return isIP(host) ? host : host === 'localhost' ? '127.0.0.1' : host;
    return resolvePublic(host);
  }

  async verify(ep: MailboxEndpoint): Promise<ConnectionResult> {
    const strict = !this.opts.allowPrivateHosts;
    let smtp: CheckCode = 'ok';
    try {
      const ip = await this.pin(ep.smtpHost); if (!ip) throw Object.assign(new Error('host'), { code: 'ENOTFOUND' });
      const nodemailer = await import('nodemailer');
      const base = buildSmtpOptions({ host: ip, port: ep.smtpPort, user: ep.email, authType: 'password', password: ep.password }) as any;
      const t = nodemailer.createTransport({ ...base, name: 'leadloom', requireTLS: strict && ep.smtpPort !== 465, tls: { servername: ep.smtpHost, rejectUnauthorized: true, minVersion: 'TLSv1.2' }, greetingTimeout: 10_000, logger: false, debug: false });
      try { await withDeadline(t.verify()); } finally { t.close(); }
    } catch (e) { smtp = classify(e); }
    let imap: CheckCode | 'skipped' = 'skipped';
    if (ep.imapHost && ep.imapPort) {
      imap = 'ok';
      try {
        const ip = await this.pin(ep.imapHost); if (!ip) throw Object.assign(new Error('host'), { code: 'ENOTFOUND' });
        const { ImapFlow } = await import('imapflow');
        const base = buildImapOptions({ host: ip, port: ep.imapPort, user: ep.email, authType: 'password', password: ep.password }) as any;
        const c = new ImapFlow({ ...base, secure: ep.imapPort === 993, servername: ep.imapHost, doSTARTTLS: strict && ep.imapPort === 143 ? true : undefined, tls: { servername: ep.imapHost, rejectUnauthorized: true, minVersion: 'TLSv1.2' }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000, disableAutoIdle: true } as any);
        c.on('error', () => undefined);
        try { await withDeadline(c.connect()); await withDeadline(c.logout()); } finally { c.close(); }
      } catch (e) { imap = classify(e); }
    }
    return { smtp, imap };
  }
}
