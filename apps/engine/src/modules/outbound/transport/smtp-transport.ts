import type { OutboundTransport, SendReservation } from '../dispatch.service';
import type { MessageComposer } from './message-composer';
import { buildListUnsubscribeHeaders } from './unsubscribe';

/**
 * SMTP client port: the minimal surface a real client (e.g. nodemailer's
 * transporter) must provide. Tests inject doubles; production wiring happens
 * in the worker with vault-decrypted mailbox credentials - never in queue
 * payloads or logs.
 */
export interface SmtpSendInput {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers: Record<string, string>;
}

export interface SmtpClient {
  sendMail(input: SmtpSendInput): Promise<{ messageId: string }>;
}

export interface SmtpTransportOptions {
  composer: MessageComposer;
  /** Envelope sender for the mailbox this transport instance serves. */
  fromAddress: string;
  unsubscribe: {
    baseUrl: string;
    signingKey: Buffer;
  } | null;
}

/**
 * OutboundTransport over SMTP. Sends are AT-MOST-ONCE from the dispatcher's
 * perspective: any client error propagates so DispatchService marks the
 * reservation 'uncertain' rather than retrying into a possible duplicate.
 */
export class SmtpTransport implements OutboundTransport {
  constructor(
    private readonly client: SmtpClient,
    private readonly options: SmtpTransportOptions,
  ) {}

  async send(reservation: SendReservation): Promise<{ providerMessageId: string }> {
    if (reservation.mailboxId.length === 0) throw new Error('Reservation missing mailbox scope');
    const message = await this.options.composer.resolve(reservation.messageRef);
    const headers: Record<string, string> = { ...(this.options.unsubscribe
      ? buildListUnsubscribeHeaders({
          baseUrl: this.options.unsubscribe.baseUrl,
          campaignId: message.campaignId,
          recipientEmail: message.to,
          signingKey: this.options.unsubscribe.signingKey,
        })
      : {}) };
    const result = await this.client.sendMail({
      from: this.options.fromAddress,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers,
    });
    if (!result.messageId) throw new Error('SMTP client returned no message id');
    return { providerMessageId: result.messageId };
  }
}
