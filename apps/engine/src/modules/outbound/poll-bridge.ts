import type { InboundReplyEvent } from '@leadloom/contracts';
import type { AtomicDispatchRepository } from './atomic-dispatch.repository';
import { isImapPollEnabled } from './transport/poll-enablement';

/**
 * G10 bridge between the (fixture-only today) IMAP reply poller and the
 * persistence layer. The poller classifies raw messages; this bridge hands
 * each event to recordInboundReply, which re-derives attribution from thread
 * headers / recipient scope - the event's campaignId is poll context only and
 * is deliberately NOT trusted for attribution here.
 *
 * Live gating is structural: pollMailboxReplies refuses to run unless the
 * operator set LEADLOOM_IMAP_POLL_ENABLED=true. Fixture tests call
 * recordPollEvents directly with synthetic events and never need the flag.
 */

export interface PollRecordSummary {
  fetched: number;
  recorded: number;
  duplicates: number;
  haltedJobIds: string[];
  ambiguous: number;
  unattributed: number;
}

export async function recordPollEvents(
  repo: Pick<AtomicDispatchRepository, 'recordInboundReply'>,
  workspaceId: string,
  mailboxId: string,
  events: InboundReplyEvent[],
): Promise<PollRecordSummary> {
  const summary: PollRecordSummary = { fetched: events.length, recorded: 0, duplicates: 0, haltedJobIds: [], ambiguous: 0, unattributed: 0 };
  for (const event of events) {
    const res = await repo.recordInboundReply(workspaceId, {
      mailboxId,
      messageId: event.messageId,
      fromEmail: event.fromEmail,
      subject: event.subject,
      inReplyTo: event.inReplyTo,
      references: event.references,
      classification: event.classification,
      confidence: event.confidence,
      receivedAt: new Date(event.receivedAt),
    });
    if (!res.recorded) {
      summary.duplicates += 1;
      continue;
    }
    summary.recorded += 1;
    summary.haltedJobIds.push(...res.haltedJobIds);
    if (res.attribution === 'ambiguous_recipient') summary.ambiguous += 1;
    if (res.attribution === 'unattributed') summary.unattributed += 1;
  }
  return summary;
}

export interface MailboxReplyPoller {
  pollOnce(context: { mailboxId: string; campaignId: string }): Promise<InboundReplyEvent[]>;
}

/**
 * One gated poll-and-record pass for a mailbox. Returns null when live polling
 * is not enabled so callers cannot accidentally run it. `pollCampaignId` is the
 * poller context value only (see note above); attribution is re-derived per event.
 */
export async function pollMailboxReplies(
  repo: Pick<AtomicDispatchRepository, 'recordInboundReply'>,
  poller: MailboxReplyPoller,
  workspaceId: string,
  mailboxId: string,
  pollCampaignId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<PollRecordSummary | null> {
  if (!isImapPollEnabled(env)) return null;
  const events = await poller.pollOnce({ mailboxId, campaignId: pollCampaignId });
  return recordPollEvents(repo, workspaceId, mailboxId, events);
}
