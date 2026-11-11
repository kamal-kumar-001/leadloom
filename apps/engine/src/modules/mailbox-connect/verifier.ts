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

/** Real login-only check. Sends no mail and reads no mail. */
export class RealConnectionVerifier implements ConnectionVerifier {
  async verify(ep: MailboxEndpoint): Promise<ConnectionResult> {
    const smtpCfg: MailboxClientConfig = { host: ep.smtpHost, port: ep.smtpPort, user: ep.email, authType: 'password', password: ep.password };
    let smtp: CheckCode = 'ok';
    try {
      const nodemailer = await import('nodemailer');
      const t = nodemailer.createTransport({ ...(buildSmtpOptions(smtpCfg) as any), logger: false, debug: false });
      await t.verify(); t.close();
    } catch (e) { smtp = classify(e); }
    let imap: CheckCode | 'skipped' = 'skipped';
    if (ep.imapHost && ep.imapPort) {
      imap = 'ok';
      try {
        const { ImapFlow } = await import('imapflow');
        const c = new ImapFlow(buildImapOptions({ host: ep.imapHost, port: ep.imapPort, user: ep.email, authType: 'password', password: ep.password }) as any);
        c.on('error', () => undefined);
        await c.connect(); await c.logout();
      } catch (e) { imap = classify(e); }
    }
    return { smtp, imap };
  }
}
