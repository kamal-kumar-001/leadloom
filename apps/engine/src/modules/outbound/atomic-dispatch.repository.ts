import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { OutboundApprovalItem, ApprovalQueueStats } from '@leadloom/contracts';
import { approvalContentHash, buildApprovalSnapshot } from './approval-snapshot';
import type { DispatchRepository, DispatchSnapshot, SendReservation } from './dispatch.service';

export interface SqlConnection {
  query<T extends Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<T[]>;
}
export interface TransactionalDatabase extends SqlConnection {
  transaction<T>(operation: (connection: SqlConnection) => Promise<T>): Promise<T>;
}

export function recipientHash(email: string): string {
  return createHash('sha256').update(z.string().email().parse(email.trim().toLowerCase())).digest('hex');
}

/**
 * Parameterized PostgreSQL implementation. A campaign row lock followed by a
 * mailbox row lock serializes quota/cooldown reservations across workers and
 * across campaigns using the same mailbox. Never lock in the reverse order.
 * Native multi-connection PostgreSQL concurrency tests are still required.
 */
export class AtomicDispatchRepository implements DispatchRepository {
  constructor(private readonly database: TransactionalDatabase, private readonly clock = () => new Date()) {}

  async snapshot(workspaceId: string, campaignId: string): Promise<DispatchSnapshot | null> {
    const now = this.clock();
    const [campaign] = await this.database.query<{
      workspace_id: string; id: string; status: string; daily_limit_total: number; reserved_count: number;
    }>(`SELECT c.workspace_id,c.id,c.status,c.daily_limit_total,COALESCE(u.reserved_count,0)::int AS reserved_count
      FROM campaigns c LEFT JOIN campaign_daily_usage u ON u.campaign_id=c.id
      AND u.day=to_char($3::timestamptz AT TIME ZONE c.schedule_timezone,'YYYY-MM-DD')
      WHERE c.workspace_id=$1::uuid AND c.id=$2::uuid`, [workspaceId,campaignId,now]);
    if (!campaign) return null;
    const mailboxes = await this.database.query<{
      id: string; is_paused: boolean; health_score: number; daily_send_limit: number; reserved_count: number; last_sent_at: Date | null;
    }>(`SELECT m.id,m.is_paused,m.health_score,m.daily_send_limit,m.last_sent_at,
      COALESCE(u.reserved_count,0)::int AS reserved_count
      FROM campaign_mailboxes pool JOIN mailboxes m ON m.id=pool.mailbox_id AND m.workspace_id=pool.workspace_id
      LEFT JOIN mailbox_daily_usage u ON u.mailbox_id=m.id AND u.day=to_char($3::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD')
      WHERE pool.workspace_id=$1::uuid AND pool.campaign_id=$2::uuid`, [workspaceId,campaignId,now]);
    return {
      workspaceId: campaign.workspace_id, campaignId: campaign.id, active: campaign.status === 'active',
      dailyLimitTotal: campaign.daily_limit_total, sentToday: campaign.reserved_count,
      mailboxes: mailboxes.map(m => ({ id:m.id,isPaused:m.is_paused,healthScore:m.health_score,dailySendLimit:m.daily_send_limit,
        sentToday:m.reserved_count,lastSentAt:m.last_sent_at ? new Date(m.last_sent_at) : null })),
    };
  }

  async claim(input: { workspaceId: string; campaignId: string; mailboxId: string; now: Date; nextDispatchAt: Date }): Promise<SendReservation | null> {
    const { workspaceId,campaignId,mailboxId,now,nextDispatchAt }=input;
    const delay=nextDispatchAt.getTime()-now.getTime();
    if (!Number.isFinite(delay) || delay<45000 || delay>180000) throw new Error('Invalid durable cooldown');
    return this.database.transaction(async tx => {
      const [campaign]=await tx.query<{ daily_limit_total:number; next_dispatch_at:Date|null; day:string }>(
        `SELECT daily_limit_total,next_dispatch_at,to_char($3::timestamptz AT TIME ZONE schedule_timezone,'YYYY-MM-DD') AS day
         FROM campaigns WHERE workspace_id=$1::uuid AND id=$2::uuid AND status='active' FOR UPDATE`, [workspaceId,campaignId,now]);
      if (!campaign || (campaign.next_dispatch_at && new Date(campaign.next_dispatch_at)>now)) return null;
      const [mailbox]=await tx.query<{ daily_send_limit:number; next_dispatch_at:Date|null; day:string }>(
        `SELECT m.daily_send_limit,m.next_dispatch_at,to_char($4::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD') AS day
         FROM mailboxes m JOIN campaign_mailboxes p ON p.mailbox_id=m.id AND p.workspace_id=m.workspace_id
         WHERE m.workspace_id=$1::uuid AND p.campaign_id=$2::uuid AND m.id=$3::uuid AND NOT m.is_paused AND m.health_score=100 FOR UPDATE OF m`,
        [workspaceId,campaignId,mailboxId,now]);
      if (!mailbox || (mailbox.next_dispatch_at && new Date(mailbox.next_dispatch_at)>now)) return null;
      const [cu]=await tx.query<{ count:number }>('SELECT reserved_count AS count FROM campaign_daily_usage WHERE campaign_id=$1::uuid AND day=$2',[campaignId,campaign.day]);
      const [mu]=await tx.query<{ count:number }>('SELECT reserved_count AS count FROM mailbox_daily_usage WHERE mailbox_id=$1::uuid AND day=$2',[mailboxId,mailbox.day]);
      if ((cu?.count??0)>=campaign.daily_limit_total || (mu?.count??0)>=mailbox.daily_send_limit) return null;
      const [job]=await tx.query<{ id:string }>(
        `SELECT j.id FROM outbound_jobs j WHERE j.workspace_id=$1::uuid AND j.campaign_id=$2::uuid
         AND j.status='pending' AND j.scheduled_at<=$3::timestamptz
         AND NOT EXISTS (SELECT 1 FROM suppression_list s WHERE s.workspace_id=j.workspace_id AND s.email_hash=j.recipient_hash)
         ORDER BY j.scheduled_at,j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1`,[workspaceId,campaignId,now]);
      if (!job) return null;
      await tx.query(`INSERT INTO campaign_daily_usage (campaign_id,workspace_id,day,reserved_count) VALUES ($1::uuid,$2::uuid,$3,1)
        ON CONFLICT (campaign_id,day) DO UPDATE SET reserved_count=campaign_daily_usage.reserved_count+1 RETURNING reserved_count`,[campaignId,workspaceId,campaign.day]);
      await tx.query(`INSERT INTO mailbox_daily_usage (mailbox_id,workspace_id,day,reserved_count) VALUES ($1::uuid,$2::uuid,$3,1)
        ON CONFLICT (mailbox_id,day) DO UPDATE SET reserved_count=mailbox_daily_usage.reserved_count+1 RETURNING reserved_count`,[mailboxId,workspaceId,mailbox.day]);
      await tx.query(`UPDATE outbound_jobs SET status='reserved',mailbox_id=$2::uuid,reserved_at=$3::timestamptz,attempts=attempts+1,updated_at=$3::timestamptz
        WHERE id=$1::uuid RETURNING id`,[job.id,mailboxId,now]);
      await tx.query('UPDATE campaigns SET next_dispatch_at=$2::timestamptz,updated_at=$3::timestamptz WHERE id=$1::uuid RETURNING id',[campaignId,nextDispatchAt,now]);
      await tx.query('UPDATE mailboxes SET next_dispatch_at=$2::timestamptz,last_sent_at=$3::timestamptz,updated_at=$3::timestamptz WHERE id=$1::uuid RETURNING id',[mailboxId,nextDispatchAt,now]);
      return { id:job.id,workspaceId,campaignId,mailboxId,messageRef:job.id };
    });
  }

  async finish(workspaceId:string,reservationId:string,state:'accepted'|'uncertain',providerMessageId?:string):Promise<void> {
    const rows=await this.database.query(`UPDATE outbound_jobs SET status=$3,provider_message_id=$4,updated_at=$5::timestamptz
      WHERE workspace_id=$1::uuid AND id=$2::uuid AND status='reserved' RETURNING id`,[workspaceId,reservationId,state,providerMessageId??null,this.clock()]);
    if (rows.length!==1) throw new Error('Reservation completion requires reconciliation');
  }

  /**
   * Jobs ALWAYS enter as 'pending_approval' (G9 hardening): there is no caller
   * selectable status, so no API path can enqueue a send-reservable job. The
   * approval snapshot + content hash are computed server-side here; approve()
   * recomputes against current campaign content and refuses a stale approval.
   */
  async enqueue(input: {
    workspaceId: string;
    campaignId: string;
    recipientEmail: string;
    idempotencyKey: string;
    stepNumber: number;
    scheduledAt: Date;
  }): Promise<string> {
    const email = z.string().email().parse(input.recipientEmail.trim().toLowerCase());
    z.string().min(1).max(255).parse(input.idempotencyKey);
    z.number().int().positive().parse(input.stepNumber);
    z.date().parse(input.scheduledAt);
    const hash = recipientHash(email), id = randomUUID();
    const campaignRows = await this.database.query<{ steps: unknown }>(
      'SELECT steps FROM campaigns WHERE workspace_id=$1::uuid AND id=$2::uuid', [input.workspaceId, input.campaignId]);
    if (!campaignRows[0]) throw new Error('Idempotency conflict or unknown campaign');
    const mailboxRows = await this.database.query<{ mailbox_id: string }>(
      'SELECT mailbox_id FROM campaign_mailboxes WHERE workspace_id=$1::uuid AND campaign_id=$2::uuid', [input.workspaceId, input.campaignId]);
    const snapshot = buildApprovalSnapshot({
      campaignId: input.campaignId, stepNumber: input.stepNumber, recipientEmail: email,
      campaignSteps: campaignRows[0].steps, mailboxIds: mailboxRows.map((m) => m.mailbox_id),
    });
    const contentHash = approvalContentHash(snapshot);
    const rows = await this.database.query<{ id: string }>(`INSERT INTO outbound_jobs
      (id,workspace_id,campaign_id,recipient_email,recipient_hash,idempotency_key,step_number,scheduled_at,status,approval_content_hash,approval_snapshot,updated_at)
      SELECT $1::uuid,c.workspace_id,c.id,$4,$5,$6,$7,$8::timestamptz,'pending_approval',$9,$10::jsonb,$11::timestamptz FROM campaigns c WHERE c.workspace_id=$2::uuid AND c.id=$3::uuid
      ON CONFLICT (workspace_id,idempotency_key) DO NOTHING RETURNING id`,
      [id, input.workspaceId, input.campaignId, email, hash, input.idempotencyKey, input.stepNumber, input.scheduledAt, contentHash, JSON.stringify(snapshot), this.clock()]);
    if (rows[0]) return rows[0].id;
    const [existing] = await this.database.query<{ id: string; campaign_id: string; recipient_hash: string; step_number: number; scheduled_at: Date }>(
      'SELECT id,campaign_id,recipient_hash,step_number,scheduled_at FROM outbound_jobs WHERE workspace_id=$1::uuid AND idempotency_key=$2', [input.workspaceId, input.idempotencyKey]);
    if (!existing || existing.campaign_id !== input.campaignId || existing.recipient_hash !== hash || existing.step_number !== input.stepNumber || new Date(existing.scheduled_at).getTime() !== input.scheduledAt.getTime()) throw new Error('Idempotency conflict or unknown campaign');
    return existing.id;
  }

  async suppress(workspaceId: string, email: string): Promise<void> {
    const hash = recipientHash(email);
    await this.database.transaction(async tx => {
      await tx.query(`INSERT INTO suppression_list (id,workspace_id,email_hash,reason,source)
        VALUES ($1::uuid,$2::uuid,$3,'unsubscribe','outbound') ON CONFLICT (workspace_id,email_hash) DO NOTHING RETURNING id`, [randomUUID(), workspaceId, hash]);
      // 'approved' included: an opt-out must also invalidate a held approval, so no
      // future approved->pending release step can resurrect an opted-out recipient.
      await tx.query(`UPDATE outbound_jobs SET status='cancelled',updated_at=$3::timestamptz WHERE workspace_id=$1::uuid AND recipient_hash=$2 AND status IN ('pending','pending_approval','approved') RETURNING id`, [workspaceId, hash, this.clock()]);
    });
  }

  /**
   * G9: Lists messages awaiting human review and explicit sign-off before send.
   */
  async listPendingApprovals(workspaceId: string, campaignId?: string): Promise<OutboundApprovalItem[]> {
    const rows = await this.database.query<{
      id: string;
      workspace_id: string;
      campaign_id: string;
      campaign_name: string;
      campaign_steps: any;
      recipient_email: string;
      step_number: number;
      status: string;
      scheduled_at: Date;
      created_at: Date;
      approval_snapshot: any;
      approval_content_hash: string | null;
      mailbox_ids: string[] | null;
    }>(
      `SELECT j.id, j.workspace_id, j.campaign_id, c.name AS campaign_name, c.steps AS campaign_steps,
              j.recipient_email, j.step_number, j.status, j.scheduled_at, j.created_at,
              j.approval_snapshot, j.approval_content_hash,
              (SELECT array_agg(cm.mailbox_id) FROM campaign_mailboxes cm
                WHERE cm.workspace_id = j.workspace_id AND cm.campaign_id = j.campaign_id) AS mailbox_ids
       FROM outbound_jobs j
       JOIN campaigns c ON c.id = j.campaign_id AND c.workspace_id = j.workspace_id
       WHERE j.workspace_id = $1::uuid
         AND j.status = 'pending_approval'
         AND ($2::uuid IS NULL OR j.campaign_id = $2::uuid)
       ORDER BY j.created_at ASC
       LIMIT 100`,
      [workspaceId, campaignId ?? null]
    );

    return rows.map(r => {
      let subject: string | undefined;
      let bodySnippet: string | undefined;
      let bodyTemplate: string | undefined;
      let senderMailboxIds: string[] | undefined;
      let stale = false;
      let steps: any[] = [];
      try {
        steps = Array.isArray(r.campaign_steps) ? r.campaign_steps : JSON.parse(r.campaign_steps || '[]');
      } catch {
        // Fallback gracefully if steps cannot be decoded
      }
      const stored = r.approval_snapshot && typeof r.approval_snapshot === 'object' ? r.approval_snapshot : null;
      if (stored) {
        // Review shows exactly what the stored approval snapshot signs off on.
        subject = typeof stored.subject === 'string' ? stored.subject : undefined;
        bodyTemplate = typeof stored.bodyTemplate === 'string' ? stored.bodyTemplate : undefined;
        senderMailboxIds = Array.isArray(stored.mailboxIds) ? stored.mailboxIds.map(String) : [];
      } else {
        const step = steps.find((s: any) => (s.stepNumber ?? s.step) === r.step_number);
        if (step) {
          subject = step.subject;
          bodyTemplate = step.bodyTemplate || step.body || '';
        }
        senderMailboxIds = (r.mailbox_ids ?? []).map(String);
      }
      if (bodyTemplate) bodySnippet = bodyTemplate.length > 200 ? bodyTemplate.slice(0, 197) + '...' : bodyTemplate;
      // Stale when no snapshot is stored yet, or the stored hash no longer matches
      // the current campaign content + recipient + mailbox context. A stale item's
      // first approval only refreshes the snapshot; a second deliberate approval signs off.
      try {
        if (!r.approval_content_hash || !stored) {
          stale = true;
        } else {
          const current = buildApprovalSnapshot({
            campaignId: r.campaign_id, stepNumber: r.step_number, recipientEmail: r.recipient_email,
            campaignSteps: steps, mailboxIds: (r.mailbox_ids ?? []).map(String),
          });
          stale = approvalContentHash(current) !== r.approval_content_hash;
        }
      } catch {
        stale = true;
      }

      return {
        id: r.id,
        workspaceId: r.workspace_id,
        campaignId: r.campaign_id,
        campaignName: r.campaign_name,
        recipientEmail: r.recipient_email,
        stepNumber: r.step_number,
        subject,
        bodySnippet,
        bodyTemplate,
        senderMailboxIds,
        stale,
        status: 'pending_approval' as const,
        scheduledAt: new Date(r.scheduled_at).toISOString(),
        createdAt: new Date(r.created_at).toISOString(),
      };
    });
  }

  /**
   * G9 hardened: explicit human approval transitions 'pending_approval' to
   * 'approved' - a HELD state that claim() never picks up, so approval alone
   * can never make a job send-reservable. Before flipping, the approval hash
   * is recomputed from CURRENT campaign content + recipient + mailbox context:
   * a mismatch (content edited after queueing, or a concurrent edit/approve
   * race) leaves the job in 'pending_approval', refreshes the stored snapshot
   * to the current content, and counts it as stale so the reviewer must
   * deliberately approve the changed content. 'approved' -> send-reservable
   * 'pending' does not exist in code while dispatch is disabled; adding it is
   * a separate gated release decision.
   */
  async approve(workspaceId: string, input: { jobIds?: string[]; all?: boolean; campaignId?: string }): Promise<{ approvedCount: number; staleCount: number }> {
    const jobIds = input.jobIds ?? [];
    if (!input.all && !jobIds.length) return { approvedCount: 0, staleCount: 0 };
    for (const id of jobIds) z.string().uuid().parse(id);
    // Candidate read is outside the per-job transaction (cheap filter only). Each decision
    // below re-locks its campaign row FOR UPDATE inside one transaction, so a concurrent
    // campaign edit either happens-before the decision (and is seen) or after (and flips
    // the row back via invalidateStaleApprovals on the edit path, once that route exists).
    const candidates = await this.database.query<{
      id: string; campaign_id: string;
    }>(
      `SELECT j.id, j.campaign_id
       FROM outbound_jobs j JOIN campaigns c ON c.id = j.campaign_id AND c.workspace_id = j.workspace_id
       WHERE j.workspace_id = $1::uuid AND j.status = 'pending_approval'
         AND ($2::uuid IS NULL OR j.campaign_id = $2::uuid)
         AND ($3::bool OR j.id = ANY($4::uuid[]))`,
      [workspaceId, input.campaignId ?? null, input.all === true, jobIds]);
    let approvedCount = 0, staleCount = 0;
    for (const cand of candidates) {
      const outcome = await this.database.transaction(async (tx) => {
        const locked = await tx.query<{ id: string; recipient_email: string; step_number: number; approval_content_hash: string | null; steps: unknown }>(
          `SELECT j.id, j.recipient_email, j.step_number, j.approval_content_hash, c.steps
           FROM outbound_jobs j JOIN campaigns c ON c.id = j.campaign_id AND c.workspace_id = j.workspace_id
           WHERE j.workspace_id = $1::uuid AND j.id = $2::uuid AND j.status = 'pending_approval'
             AND c.id = (SELECT id FROM campaigns WHERE workspace_id=$1::uuid AND id=$3::uuid FOR UPDATE)`,
          [workspaceId, cand.id, cand.campaign_id]);
        const job = locked[0];
        if (!job) return 'skipped' as const; // raced with reject/suppress/another approve
        const mailboxRows = await tx.query<{ mailbox_id: string }>(
          'SELECT mailbox_id FROM campaign_mailboxes WHERE workspace_id=$1::uuid AND campaign_id=$2::uuid', [workspaceId, cand.campaign_id]);
        const current = buildApprovalSnapshot({
          campaignId: cand.campaign_id, stepNumber: job.step_number, recipientEmail: job.recipient_email,
          campaignSteps: job.steps, mailboxIds: mailboxRows.map((m) => m.mailbox_id),
        });
        const currentHash = approvalContentHash(current);
        if (job.approval_content_hash === currentHash) {
          await tx.query(
            `UPDATE outbound_jobs SET status='approved', approved_at=$3::timestamptz, updated_at=$3::timestamptz
             WHERE workspace_id=$1::uuid AND id=$2::uuid AND status='pending_approval'`,
            [workspaceId, job.id, this.clock()]);
          return 'approved' as const;
        }
        // Content changed since queueing: refresh the snapshot and require a deliberate re-approval.
        await tx.query(
          `UPDATE outbound_jobs SET approval_content_hash=$3, approval_snapshot=$4::jsonb, updated_at=$5::timestamptz
           WHERE workspace_id=$1::uuid AND id=$2::uuid AND status='pending_approval'`,
          [workspaceId, job.id, currentHash, JSON.stringify(current), this.clock()]);
        return 'stale' as const;
      });
      if (outcome === 'approved') approvedCount++;
      else if (outcome === 'stale') staleCount++;
    }
    return { approvedCount, staleCount };
  }

  /**
   * Invalidation hook for any future campaign-edit path: reverts 'approved'
   * jobs whose recomputed hash no longer matches back to 'pending_approval'.
   * There is currently no campaign-edit endpoint; that path MUST call this.
   */
  async invalidateStaleApprovals(workspaceId: string, campaignId: string): Promise<{ invalidatedCount: number }> {
    const jobs = await this.database.query<{
      id: string; campaign_id: string; recipient_email: string; step_number: number; steps: unknown; approval_content_hash: string | null;
    }>(
      `SELECT j.id, j.campaign_id, j.recipient_email, j.step_number, c.steps, j.approval_content_hash
       FROM outbound_jobs j JOIN campaigns c ON c.id = j.campaign_id AND c.workspace_id = j.workspace_id
       WHERE j.workspace_id = $1::uuid AND j.campaign_id = $2::uuid AND j.status = 'approved'`,
      [workspaceId, campaignId]);
    let invalidatedCount = 0;
    for (const job of jobs) {
      const mailboxRows = await this.database.query<{ mailbox_id: string }>(
        'SELECT mailbox_id FROM campaign_mailboxes WHERE workspace_id=$1::uuid AND campaign_id=$2::uuid', [workspaceId, job.campaign_id]);
      const currentHash = approvalContentHash(buildApprovalSnapshot({
        campaignId: job.campaign_id, stepNumber: job.step_number, recipientEmail: job.recipient_email,
        campaignSteps: job.steps, mailboxIds: mailboxRows.map((m) => m.mailbox_id),
      }));
      if (job.approval_content_hash !== currentHash) {
        await this.database.query(
          `UPDATE outbound_jobs SET status='pending_approval', approved_at=NULL, updated_at=$3::timestamptz
           WHERE workspace_id=$1::uuid AND id=$2::uuid AND status='approved'`,
          [workspaceId, job.id, this.clock()]);
        invalidatedCount++;
      }
    }
    return { invalidatedCount };
  }

  /**
   * G9: Rejection transitions queued messages to 'rejected', permanently preventing dispatch.
   */
  async reject(workspaceId: string, input: { jobIds?: string[]; all?: boolean; campaignId?: string; reason?: string }): Promise<{ rejectedCount: number }> {
    if (input.all) {
      const rows = await this.database.query<{ id: string }>(
        `UPDATE outbound_jobs SET status='rejected', updated_at=$3::timestamptz
         WHERE workspace_id=$1::uuid AND status IN ('pending_approval','approved')
           AND ($2::uuid IS NULL OR campaign_id=$2::uuid)
         RETURNING id`,
        [workspaceId, input.campaignId ?? null, this.clock()]
      );
      return { rejectedCount: rows.length };
    }
    const jobIds = input.jobIds ?? [];
    if (!jobIds.length) return { rejectedCount: 0 };
    for (const id of jobIds) z.string().uuid().parse(id);
    const rows = await this.database.query<{ id: string }>(
      `UPDATE outbound_jobs SET status='rejected', updated_at=$3::timestamptz
       WHERE workspace_id=$1::uuid AND id = ANY($2::uuid[]) AND status IN ('pending_approval','approved')
       RETURNING id`,
      [workspaceId, jobIds, this.clock()]
    );
    return { rejectedCount: rows.length };
  }

  /**
   * G9: Summary counts for the approval queue.
   */
  async getApprovalStats(workspaceId: string): Promise<ApprovalQueueStats> {
    const rows = await this.database.query<{ status: string; count: string | number }>(
      `SELECT status, count(*)::int AS count
       FROM outbound_jobs
       WHERE workspace_id = $1::uuid
         AND status IN ('pending_approval', 'pending', 'approved', 'rejected')
       GROUP BY status`,
      [workspaceId]
    );
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    for (const r of rows) {
      const c = Number(r.count) || 0;
      if (r.status === 'pending_approval') pendingCount += c;
      else if (r.status === 'pending' || r.status === 'approved') approvedCount += c;
      else if (r.status === 'rejected') rejectedCount += c;
    }
    return { pendingCount, approvedCount, rejectedCount };
  }
}
