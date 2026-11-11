import { createHash } from 'node:crypto';

/**
 * G10 reply attribution: decide WHICH outbound job an inbound message answers.
 *
 * Two grounded signals, in precedence order:
 *  1. Thread headers (In-Reply-To / References) naming the provider message id
 *     we stored on the job at dispatch. Exact and recipient-independent.
 *  2. Recipient match: the sender address hashes to a job's recipient_hash for
 *     a campaign that uses the polled mailbox. Weaker: a person writing from a
 *     new thread still attributes to their own sequence, but any recipient can
 *     only ever match their own jobs (hash equality), never another recipient's.
 *
 * Anything else returns null. An unattributed reply is still recorded; it is
 * NEVER guessed onto a job and halts nothing.
 */

export interface ReplyLike {
  inReplyTo?: string;
  references?: string[];
  fromEmail: string;
}

export interface JobThreadRef {
  id: string;
  campaignId: string;
  providerMessageId: string | null;
  recipientHash: string;
  scheduledAt: Date;
}

export type AttributionBasis = 'thread_header' | 'recipient_match';

export interface ReplyAttribution {
  jobId: string;
  campaignId: string;
  basis: AttributionBasis;
}

/**
 * Recipient-hash evidence can name a person but not a campaign: when the same
 * recipient appears in several campaigns reachable from the polled mailbox, any
 * exact-job pick would be arbitrary. We preserve that uncertainty instead of
 * halting a guessed campaign.
 */
export interface AmbiguousAttribution {
  ambiguous: true;
  campaignIds: string[];
}

export type AttributionResult = ReplyAttribution | AmbiguousAttribution | null;

/** Same canonical form as AtomicDispatchRepository.recipientHash. */
export function recipientHashOf(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/** Message-IDs arrive as `<id@host>` possibly with comments/whitespace; compare the bare id. */
export function normalizeMessageId(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/<([^<>\s]+)>/);
  const id = (m ? m[1] : raw.trim()) || '';
  return id.length > 0 ? id.toLowerCase() : null;
}

function headerIds(raw: ReplyLike): string[] {
  const ids: string[] = [];
  const one = normalizeMessageId(raw.inReplyTo);
  if (one) ids.push(one);
  for (const ref of raw.references ?? []) {
    // References is a space-separated list of <id> tokens.
    for (const token of ref.match(/<[^<>\s]+>/g) ?? [ref]) {
      const id = normalizeMessageId(token);
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)];
}

export function attributeReply(raw: ReplyLike, jobs: JobThreadRef[]): AttributionResult {
  const ids = headerIds(raw);
  if (ids.length > 0) {
    for (const job of jobs) {
      const providerId = normalizeMessageId(job.providerMessageId ?? undefined);
      if (providerId && ids.includes(providerId)) {
        return { jobId: job.id, campaignId: job.campaignId, basis: 'thread_header' };
      }
    }
  }
  const fromHash = recipientHashOf(raw.fromEmail);
  const candidates = jobs
    .filter((j) => j.recipientHash === fromHash)
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
  const campaignIds = [...new Set(candidates.map((j) => j.campaignId))];
  if (campaignIds.length > 1) {
    // Same recipient, several campaigns, no thread headers: do not guess.
    return { ambiguous: true, campaignIds };
  }
  const latest = candidates[0];
  return latest ? { jobId: latest.id, campaignId: latest.campaignId, basis: 'recipient_match' } : null;
}
