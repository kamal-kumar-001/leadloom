import type { SmtpClient, SmtpSendInput } from './smtp-transport';
import type { ImapClient, RawInboundMessage } from './imap-poller';

/**
 * Generic real-client factories mapping mailbox config to nodemailer/imapflow
 * options. Works with any SMTP/IMAP provider (Gmail, Microsoft 365, custom);
 * provider selection is a user decision and only supplies these config values.
 * No connections are opened in unit tests: option mapping is pure, and the
 * libraries load lazily inside the async factories.
 */
export interface MailboxClientConfig {
  host: string;
  port: number;
  user: string;
  authType: 'oauth2' | 'password';
  accessToken?: string;
  password?: string;
  /** Fixtures only: connect without TLS. Production callers must never set this. */
  plaintextForTestsOnly?: boolean;
}

export function buildSmtpOptions(config: MailboxClientConfig): Record<string, unknown> {
  if (!config.host || !config.user) throw new Error('SMTP host and user are required');
  if (config.authType === 'oauth2') {
    if (!config.accessToken) throw new Error('OAuth2 SMTP auth requires an access token');
    return {
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      connectionTimeout: 10_000,
      socketTimeout: 30_000,
      auth: { type: 'OAuth2', user: config.user, accessToken: config.accessToken },
    };
  }
  if (!config.password) throw new Error('Password SMTP auth requires a password');
  return {
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    connectionTimeout: 10_000,
    socketTimeout: 30_000,
    auth: { user: config.user, pass: config.password },
  };
}

export function buildImapOptions(config: MailboxClientConfig): Record<string, unknown> {
  if (!config.host || !config.user) throw new Error('IMAP host and user are required');
  if (config.plaintextForTestsOnly) {
    // Refused outside a loopback fixture under a non-production runtime, whatever the caller passes.
    const loopback = ['127.0.0.1', '::1', 'localhost'].includes(config.host);
    if (process.env.NODE_ENV === 'production' || !loopback) throw new Error('plaintext IMAP is refused outside local test fixtures');
  }
  const auth = config.authType === 'oauth2'
    ? (() => {
        if (!config.accessToken) throw new Error('OAuth2 IMAP auth requires an access token');
        return { user: config.user, accessToken: config.accessToken };
      })()
    : (() => {
        if (!config.password) throw new Error('Password IMAP auth requires a password');
        return { user: config.user, pass: config.password };
      })();
  return {
    host: config.host,
    port: config.port,
    secure: config.plaintextForTestsOnly ? false : config.port !== 143,
    ...(config.plaintextForTestsOnly ? { disableAutoEnable: true } : {}),
    auth,
    logger: false, // never log credentials or message content
  };
}

/** Real SMTP client via nodemailer. Call only inside the authorized worker. */
export async function createNodemailerSmtpClient(config: MailboxClientConfig): Promise<SmtpClient> {
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport(buildSmtpOptions(config) as any);
  return {
    async sendMail(input: SmtpSendInput): Promise<{ messageId: string }> {
      const result = await transporter.sendMail({
        from: input.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        headers: input.headers,
      });
      return { messageId: result.messageId ?? '' };
    },
  };
}

export interface ImapReadLimits {
  /** Max messages returned per poll; the next poll continues from the last uid. */
  maxBatch?: number;
  /** Max retained characters of each message body. */
  maxBodyChars?: number;
}

/**
 * Real IMAP client via imapflow. Call only inside the authorized worker.
 * Read-only by construction: the mailbox is opened with EXAMINE (readOnly), so messages are
 * never marked read, moved or deleted. Fetch is by UID and bounded per poll. Message content is
 * untrusted data: it is returned to the caller, never executed or acted on here.
 */
export async function createImapflowClient(config: MailboxClientConfig, limits: ImapReadLimits = {}): Promise<ImapClient> {
  const maxBatch = Math.max(1, limits.maxBatch ?? 100);
  const maxBodyChars = Math.max(0, limits.maxBodyChars ?? 20000);
  const { ImapFlow } = await import('imapflow');
  const self: ImapClient = {
    async fetchSince(sinceUid: number): Promise<RawInboundMessage[]> {
      return (await self.fetchBatch!(sinceUid)).messages;
    },
    async fetchBatch(sinceUid: number): Promise<{ uidValidity: number; messages: RawInboundMessage[] }> {
      let uidValidity = 0;
      const client = new ImapFlow(buildImapOptions(config) as any);
      const out: RawInboundMessage[] = [];
      try {
        await client.connect();
        const mailbox = await client.mailboxOpen('INBOX', { readOnly: true });
        uidValidity = Number(mailbox.uidValidity ?? 0);
        if (mailbox.exists > 0) {
          const found = (await client.search({ uid: `${Math.max(0, sinceUid) + 1}:*` }, { uid: true })) || [];
          const uids = found.filter((u: number) => u > sinceUid).sort((a: number, b: number) => a - b).slice(0, maxBatch);
          if (uids.length === 0) return { uidValidity, messages: out };
          for await (const msg of client.fetch(uids.join(','), { uid: true, envelope: true, bodyParts: ['text'] }, { uid: true })) {
            const envelope = msg.envelope;
            if (!msg.uid || msg.uid <= sinceUid) continue; // '*' always yields the newest message
            if (!envelope?.messageId || !envelope.from?.[0]?.address) continue;
            out.push({
              uid: msg.uid,
              messageId: envelope.messageId,
              fromEmail: envelope.from[0].address,
              subject: (envelope.subject ?? '').slice(0, 998),
              bodyText: (msg.bodyParts?.get('text')?.toString('utf8') ?? '').slice(0, maxBodyChars),
              inReplyTo: envelope.inReplyTo || undefined,
              receivedAt: envelope.date ? new Date(envelope.date) : new Date(),
            });
          }
        }
      } finally {
        await client.logout().catch(() => undefined);
      }
      out.sort((a, b) => a.uid - b.uid);
      return { uidValidity, messages: out.slice(0, maxBatch) };
    },
  };
  return self;
}
