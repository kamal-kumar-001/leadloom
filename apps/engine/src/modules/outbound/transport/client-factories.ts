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
    secure: config.port !== 143,
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

/** Real IMAP client via imapflow. Call only inside the authorized worker. */
export async function createImapflowClient(config: MailboxClientConfig): Promise<ImapClient> {
  const { ImapFlow } = await import('imapflow');
  return {
    async fetchSince(sinceUid: number): Promise<RawInboundMessage[]> {
      const client = new ImapFlow(buildImapOptions(config) as any);
      const out: RawInboundMessage[] = [];
      try {
        await client.connect();
        const mailbox = await client.mailboxOpen('INBOX');
        if (mailbox.exists > 0) {
          const range = sinceUid > 0 ? `${sinceUid + 1}:*` : '1:*';
          for await (const msg of client.fetch(range, { uid: true, envelope: true, bodyParts: ['text'] })) {
            const envelope = msg.envelope;
            if (!msg.uid || !envelope?.messageId || !envelope.from?.[0]?.address) continue;
            out.push({
              uid: msg.uid,
              messageId: envelope.messageId,
              fromEmail: envelope.from[0].address,
              subject: envelope.subject ?? '',
              bodyText: msg.bodyParts?.get('text')?.toString('utf8') ?? '',
              inReplyTo: envelope.inReplyTo || undefined,
              receivedAt: envelope.date ? new Date(envelope.date) : new Date(),
            });
          }
        }
      } finally {
        await client.logout().catch(() => undefined);
      }
      return out.sort((a, b) => a.uid - b.uid);
    },
  };
}
