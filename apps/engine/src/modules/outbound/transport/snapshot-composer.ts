import { z } from 'zod';
import type { ComposedMessage, ComposerScope, MessageComposer } from './message-composer';

/** Minimal read surface the composer needs (PrismaDispatchDatabase satisfies it). */
export interface SqlQueryable {
  query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

/**
 * Production composer. A reservation's messageRef is the outbound job id (see
 * AtomicDispatchRepository.claim). The sent content is EXACTLY the resolved
 * per-recipient snapshot the approval signed off on - never re-resolved from
 * the template at send time, so a post-approval campaign edit can never slip
 * different content into an already-released send (stale approvals bounce
 * back to pending_approval at release instead).
 *
 * Fails closed: the job must belong to the reservation's workspace, still be
 * in 'reserved' status (claimed by this dispatch), carry its claimed mailbox,
 * and hold a v1 snapshot with resolved subject and body.
 */
export class SnapshotMessageComposer implements MessageComposer {
  constructor(private readonly db: SqlQueryable) {}

  async resolve(messageRef: string, scope: ComposerScope): Promise<ComposedMessage> {
    const jobId = z.string().uuid().parse(messageRef);
    const workspaceId = z.string().uuid().parse(scope.workspaceId);
    const rows = await this.db.query<{
      recipient_email: string;
      campaign_id: string;
      mailbox_id: string | null;
      status: string;
      approval_snapshot: unknown;
    }>(
      `SELECT recipient_email, campaign_id, mailbox_id, status, approval_snapshot
       FROM outbound_jobs WHERE workspace_id = $1::uuid AND id = $2::uuid`,
      [workspaceId, jobId],
    );
    const job = rows[0];
    if (!job || job.status !== 'reserved' || !job.mailbox_id) throw new Error('Reservation is no longer active');
    const snap = job.approval_snapshot as Record<string, unknown> | null;
    if (!snap || snap.v !== 1 || typeof snap.subject !== 'string' || typeof snap.bodyTemplate !== 'string') {
      throw new Error('Approved message snapshot is missing or unreadable');
    }
    return {
      to: job.recipient_email,
      subject: snap.subject,
      text: snap.bodyTemplate,
      campaignId: job.campaign_id,
      mailboxId: job.mailbox_id,
    };
  }
}
