import { InboundReplyEventSchema, type InboundReplyEvent } from '@leadloom/contracts';
import { classifyReply } from './unsubscribe';

/**
 * IMAP inbound polling: fetches new messages for a mailbox and converts them
 * to contract-valid InboundReplyEvents with deterministic baseline
 * classification. Real IMAP clients (imapflow) plug into the ImapClient port;
 * tests use in-memory doubles. Deduplication is by RFC 5322 Message-ID via a
 * SeenMessageStore port so crash-restarts never double-record a reply.
 */
export interface RawInboundMessage {
  uid: number;
  messageId: string;
  fromEmail: string;
  subject: string;
  bodyText: string;
  inReplyTo?: string;
  receivedAt: Date;
}

export interface ImapClient {
  /** Returns messages with uid > sinceUid, ascending by uid. */
  fetchSince(sinceUid: number): Promise<RawInboundMessage[]>;
}

export interface SeenMessageStore {
  has(mailboxId: string, messageId: string): Promise<boolean>;
  add(mailboxId: string, messageId: string): Promise<void>;
  lastUid(mailboxId: string): Promise<number>;
  setLastUid(mailboxId: string, uid: number): Promise<void>;
}

export interface ReplyPollerContext {
  mailboxId: string;
  campaignId: string;
}

export class ImapReplyPoller {
  constructor(
    private readonly client: ImapClient,
    private readonly seen: SeenMessageStore,
  ) {}

  /**
   * Poll once. Returns contract-valid reply events in uid order. The last
   * processed uid advances ONLY after every fetched message is recorded, so a
   * mid-batch failure replays the batch (dedupe keeps that idempotent).
   */
  async pollOnce(context: ReplyPollerContext): Promise<InboundReplyEvent[]> {
    const since = await this.seen.lastUid(context.mailboxId);
    const batch = await this.client.fetchSince(since);
    const events: InboundReplyEvent[] = [];
    let maxUid = since;
    for (const raw of batch) {
      if (raw.uid <= since) continue;
      maxUid = Math.max(maxUid, raw.uid);
      if (await this.seen.has(context.mailboxId, raw.messageId)) continue;
      const { classification, confidence } = classifyReply(raw.bodyText);
      const event = InboundReplyEventSchema.parse({
        messageId: raw.messageId,
        campaignId: context.campaignId,
        mailboxId: context.mailboxId,
        fromEmail: raw.fromEmail,
        subject: raw.subject,
        bodyText: raw.bodyText,
        classification,
        confidence,
        receivedAt: raw.receivedAt.toISOString(),
      });
      await this.seen.add(context.mailboxId, raw.messageId);
      events.push(event);
    }
    if (maxUid > since) await this.seen.setLastUid(context.mailboxId, maxUid);
    return events;
  }
}

/** Test double store. */
export class InMemorySeenMessageStore implements SeenMessageStore {
  private readonly ids = new Set<string>();
  private readonly uids = new Map<string, number>();

  async has(mailboxId: string, messageId: string): Promise<boolean> {
    return this.ids.has(`${mailboxId}${messageId}`);
  }
  async add(mailboxId: string, messageId: string): Promise<void> {
    this.ids.add(`${mailboxId}${messageId}`);
  }
  async lastUid(mailboxId: string): Promise<number> {
    return this.uids.get(mailboxId) ?? 0;
  }
  async setLastUid(mailboxId: string, uid: number): Promise<void> {
    this.uids.set(mailboxId, uid);
  }
}
