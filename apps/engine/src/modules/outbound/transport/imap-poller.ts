import { InboundReplyEventSchema, type InboundReplyEvent } from '@leadloom/contracts';
import { createHash } from 'node:crypto';
import { classifyReply } from './unsubscribe';
import { detectBounce } from './bounce';

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
  /**
   * Preferred: same window plus the folder's UIDVALIDITY. If UIDVALIDITY changes, stored UIDs no longer
   * identify the same messages and the checkpoint must be reset (see SeenMessageStore.resetCheckpoint).
   */
  fetchBatch?(sinceUid: number): Promise<{ uidValidity: number; messages: RawInboundMessage[] }>;
}

/**
 * Stable per-mailbox dedupe key. Sender-provided Message-IDs can be missing or reused, so the key mixes
 * the sender address, and falls back to uidvalidity:uid when there is no Message-ID. Never raw Message-ID alone.
 */
export function replyDedupeKey(raw: RawInboundMessage, uidValidity: number | undefined): string {
  const base = raw.messageId?.trim()
    ? `mid:${raw.messageId.trim()}|${raw.fromEmail.trim().toLowerCase()}`
    : `uid:${uidValidity ?? 0}:${raw.uid}`;
  return createHash('sha256').update(base).digest('hex');
}

export interface SeenMessageStore {
  has(mailboxId: string, messageId: string): Promise<boolean>;
  add(mailboxId: string, messageId: string): Promise<void>;
  lastUid(mailboxId: string): Promise<number>;
  setLastUid(mailboxId: string, uid: number): Promise<void>;
  /** Optional UIDVALIDITY support. storedValidity returns null when none is recorded yet. */
  storedValidity?(mailboxId: string): Promise<number | null>;
  /** Sets the validity and moves the UID checkpoint to 0 (a plain GREATEST setLastUid cannot lower it). */
  resetCheckpoint?(mailboxId: string, uidValidity: number): Promise<void>;
  /** Optional mutual exclusion so two pollers never run one mailbox at once. Returns null if the lock is held. */
  withLock?<T>(mailboxId: string, fn: () => Promise<T>): Promise<T | null>;
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
    if (this.seen.withLock) {
      const r = await this.seen.withLock(context.mailboxId, () => this.pollLocked(context));
      return r ?? [];
    }
    return this.pollLocked(context);
  }

  private async pollLocked(context: ReplyPollerContext): Promise<InboundReplyEvent[]> {
    let since = await this.seen.lastUid(context.mailboxId);
    let uidValidity: number | undefined;
    let batch: RawInboundMessage[];
    if (this.client.fetchBatch) {
      const stored = this.seen.storedValidity ? await this.seen.storedValidity(context.mailboxId) : null;
      let res = await this.client.fetchBatch(since);
      uidValidity = res.uidValidity;
      if (stored !== null && stored !== res.uidValidity && this.seen.resetCheckpoint) {
        // The server renumbered the folder: old UIDs mean nothing. Restart from 0; dedupe keys protect replays.
        await this.seen.resetCheckpoint(context.mailboxId, res.uidValidity);
        since = 0;
        res = await this.client.fetchBatch(0);
      } else if (stored === null && this.seen.resetCheckpoint && since === 0) {
        await this.seen.resetCheckpoint(context.mailboxId, res.uidValidity);
      }
      batch = res.messages;
    } else {
      batch = await this.client.fetchSince(since);
    }
    const events: InboundReplyEvent[] = [];
    let maxUid = since;
    for (const raw of batch) {
      if (raw.uid <= since) continue;
      maxUid = Math.max(maxUid, raw.uid);
      const key = replyDedupeKey(raw, uidValidity);
      if (await this.seen.has(context.mailboxId, key)) continue;
      // DSNs are machine reports, not replies: classify them before the
      // keyword baseline so quoted original text is never misread.
      const { classification, confidence } = detectBounce(raw)
        ? { classification: 'bounce' as const, confidence: 0.95 }
        : classifyReply(raw.bodyText);
      const event = InboundReplyEventSchema.parse({
        messageId: raw.messageId || key,
        campaignId: context.campaignId,
        mailboxId: context.mailboxId,
        fromEmail: raw.fromEmail,
        subject: raw.subject,
        bodyText: raw.bodyText,
        classification,
        confidence,
        receivedAt: raw.receivedAt.toISOString(),
      });
      await this.seen.add(context.mailboxId, key);
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
  private readonly validity = new Map<string, number>();
  private readonly locks = new Set<string>();
  async storedValidity(mailboxId: string): Promise<number | null> {
    return this.validity.get(mailboxId) ?? null;
  }
  async resetCheckpoint(mailboxId: string, uidValidity: number): Promise<void> {
    this.validity.set(mailboxId, uidValidity);
    this.uids.set(mailboxId, 0);
  }
  async withLock<T>(mailboxId: string, fn: () => Promise<T>): Promise<T | null> {
    if (this.locks.has(mailboxId)) return null;
    this.locks.add(mailboxId);
    try { return await fn(); } finally { this.locks.delete(mailboxId); }
  }
}
