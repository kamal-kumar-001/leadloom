import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { OutboundApprovalItem, ApprovalQueueStats } from '@leadloom/contracts';
import { approvalContentHash, buildResolvedApprovalSnapshot, type ApprovalSnapshot } from './approval-snapshot';
import type { RecipientFields } from './recipient-resolution';
import { attributeReply, recipientHashOf } from './reply-attribution';
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
  constructor(
    private readonly database: TransactionalDatabase,
    private readonly clock = () => new Date(),
    /**
     * sendingEnabled is the release gate: without it NO code path moves a held
     * 'approved' job to send-reservable 'pending'. main sets it only from the
     * LEADLOOM_OUTBOUND_SENDING_ENABLED env flag; every current deployment
     * leaves it unset, so release() is an honest no-op.
     */
    private readonly options: { sendingEnabled?: boolean } = {},
  ) {}

  /** Live recipient fields: from the campaign_recipients row when linked, else inline fields fixed at enqueue, else email-only. */
  private async recipientFieldsFor(db: SqlConnection, workspaceId: string, job: { recipient_email: string; recipient_id: string | null; recipient_fields: unknown }): Promise<RecipientFields> {
    if (job.recipient_id) {
      const rows = await db.query<Record<string, unknown>>(
        'SELECT email, first_name, last_name, company_name, title, custom_fields FROM campaign_recipients WHERE workspace_id=$1::uuid AND id=$2::uuid',
        [workspaceId, job.recipient_id]);
      const r = rows[0];
      if (r) {
        return {
          email: String(r.email),
          firstName: (r.first_name as string) ?? null,
          lastName: (r.last_name as string) ?? null,
          companyName: (r.company_name as string) ?? null,
          title: (r.title as string) ?? null,
          customFields: (r.custom_fields as Record<string, unknown>) ?? {},
        };
      }
    }
    const stored = job.recipient_fields && typeof job.recipient_fields === 'object' ? (job.recipient_fields as Record<string, unknown>) : {};
    return {
      email: job.recipient_email,
      firstName: (stored.firstName as string) ?? null,
      lastName: (stored.lastName as string) ?? null,
      companyName: (stored.companyName as string) ?? null,
      title: (stored.title as string) ?? null,
      customFields: (stored.customFields as Record<string, unknown>) ?? {},
    };
  }

  /**
   * Recomputes the approval snapshot from CURRENT campaign steps, mailbox scope
   * and LIVE recipient fields, with strict per-recipient resolution: the hash
   * signs off on the actual message a person would receive. Fails closed:
   * unresolvable templates return errors instead of a snapshot.
   */
  private async currentApproval(db: SqlConnection, workspaceId: string, campaignId: string, job: {
    recipient_email: string; recipient_id: string | null; recipient_fields: unknown; step_number: number; steps: unknown;
  }): Promise<{ ok: true; snapshot: ApprovalSnapshot; hash: string } | { ok: false; errors: string[] }> {
    const mailboxRows = await db.query<{ mailbox_id: string }>(
      'SELECT mailbox_id FROM campaign_mailboxes WHERE workspace_id=$1::uuid AND campaign_id=$2::uuid', [workspaceId, campaignId]);
    const fields = await this.recipientFieldsFor(db, workspaceId, job);
    const res = buildResolvedApprovalSnapshot({
      campaignId, stepNumber: job.step_number, recipientEmail: job.recipient_email,
      campaignSteps: job.steps, mailboxIds: mailboxRows.map((m) => m.mailbox_id), recipientFields: fields,
    });
    if (!res.ok) return { ok: false, errors: res.errors };
    return { ok: true, snapshot: res.snapshot, hash: approvalContentHash(res.snapshot) };
  }

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
    /** Links the job to its campaign_recipients row: live fields, so an edit invalidates the approval hash. */
    recipientId?: string;
    /** Inline fields fixed at enqueue (no row to edit later). One of recipientId/recipient is required when the step template uses variables. */
    recipient?: Omit<RecipientFields, 'email'>;
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
    let fields: RecipientFields;
    if (input.recipientId) {
      z.string().uuid().parse(input.recipientId);
      const rows0 = await this.database.query<Record<string, unknown>>(
        'SELECT email, first_name, last_name, company_name, title, custom_fields FROM campaign_recipients WHERE workspace_id=$1::uuid AND campaign_id=$2::uuid AND id=$3::uuid',
        [input.workspaceId, input.campaignId, input.recipientId]);
      const r = rows0[0];
      if (!r || String(r.email).toLowerCase() !== email) throw new Error('Unknown recipient for this campaign');
      fields = {
        email,
        firstName: (r.first_name as string) ?? null,
        lastName: (r.last_name as string) ?? null,
        companyName: (r.company_name as string) ?? null,
        title: (r.title as string) ?? null,
        customFields: (r.custom_fields as Record<string, unknown>) ?? {},
      };
    } else {
      fields = { email, ...(input.recipient ?? {}) };
    }
    const resolved = buildResolvedApprovalSnapshot({
      campaignId: input.campaignId, stepNumber: input.stepNumber, recipientEmail: email,
      campaignSteps: campaignRows[0].steps, mailboxIds: mailboxRows.map((m) => m.mailbox_id), recipientFields: fields,
    });
    if (!resolved.ok) throw new Error(`Message does not resolve for this recipient: ${resolved.errors.join('; ')}`);
    const snapshot = resolved.snapshot;
    const contentHash = approvalContentHash(snapshot);
    const inlineFields = input.recipientId ? null : input.recipient ? JSON.stringify(input.recipient) : null;
    const rows = await this.database.query<{ id: string }>(`INSERT INTO outbound_jobs
      (id,workspace_id,campaign_id,recipient_email,recipient_hash,idempotency_key,step_number,scheduled_at,status,approval_content_hash,approval_snapshot,recipient_id,recipient_fields,updated_at)
      SELECT $1::uuid,c.workspace_id,c.id,$4,$5,$6,$7,$8::timestamptz,'pending_approval',$9,$10::jsonb,$12::uuid,$13::jsonb,$11::timestamptz FROM campaigns c WHERE c.workspace_id=$2::uuid AND c.id=$3::uuid
      ON CONFLICT (workspace_id,idempotency_key) DO NOTHING RETURNING id`,
      [id, input.workspaceId, input.campaignId, email, hash, input.idempotencyKey, input.stepNumber, input.scheduledAt, contentHash, JSON.stringify(snapshot), this.clock(), input.recipientId ?? null, inlineFields]);
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
      recipient_id: string | null;
      recipient_fields: unknown;
    }>(
      `SELECT j.id, j.workspace_id, j.campaign_id, c.name AS campaign_name, c.steps AS campaign_steps,
              j.recipient_email, j.step_number, j.status, j.scheduled_at, j.created_at,
              j.approval_snapshot, j.approval_content_hash, j.recipient_id, j.recipient_fields,
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

    return Promise.all(rows.map(async r => {
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
      let resolutionErrors: string[] | undefined;
      try {
        if (!r.approval_content_hash || !stored) {
          stale = true;
        } else {
          const cur = await this.currentApproval(this.database, workspaceId, r.campaign_id, {
            recipient_email: r.recipient_email, recipient_id: r.recipient_id, recipient_fields: r.recipient_fields,
            step_number: r.step_number, steps,
          });
          if (!cur.ok) {
            stale = true;
            resolutionErrors = cur.errors;
          } else {
            stale = cur.hash !== r.approval_content_hash;
          }
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
        resolutionErrors,
        status: 'pending_approval' as const,
        scheduledAt: new Date(r.scheduled_at).toISOString(),
        createdAt: new Date(r.created_at).toISOString(),
      };
    }));
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
        const locked = await tx.query<{ id: string; recipient_email: string; recipient_id: string | null; recipient_fields: unknown; step_number: number; approval_content_hash: string | null; steps: unknown }>(
          `SELECT j.id, j.recipient_email, j.recipient_id, j.recipient_fields, j.step_number, j.approval_content_hash, c.steps
           FROM outbound_jobs j JOIN campaigns c ON c.id = j.campaign_id AND c.workspace_id = j.workspace_id
           WHERE j.workspace_id = $1::uuid AND j.id = $2::uuid AND j.status = 'pending_approval'
             AND c.id = (SELECT id FROM campaigns WHERE workspace_id=$1::uuid AND id=$3::uuid FOR UPDATE)`,
          [workspaceId, cand.id, cand.campaign_id]);
        const job = locked[0];
        if (!job) return 'skipped' as const; // raced with reject/suppress/another approve
        const cur = await this.currentApproval(tx, workspaceId, cand.campaign_id, job);
        if (!cur.ok) return 'stale' as const; // no longer resolvable: keep held, reviewer sees the resolution error
        const current = cur.snapshot;
        const currentHash = cur.hash;
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
   * G3 gated release: 'approved' (held) -> 'pending' (send-reservable). This is
   * THE send-enablement step, so it is hard-gated on options.sendingEnabled;
   * when disabled it is an honest no-op. When enabled it releases only jobs
   * whose approval hash still matches current campaign content (a stale job
   * goes back to 'pending_approval' for deliberate re-review) and never
   * releases a suppressed recipient. claim() still re-checks quota, cooldown,
   * due time and suppression atomically.
   */
  async releaseApproved(workspaceId: string, campaignId: string): Promise<{ released: number; stale: number; sendingEnabled: boolean }> {
    z.string().uuid().parse(campaignId);
    if (!this.options.sendingEnabled) return { released: 0, stale: 0, sendingEnabled: false };
    return this.database.transaction(async (tx) => {
      // Campaign row lock serializes release against approve/edit races.
      const jobs = await tx.query<{
        id: string; campaign_id: string; recipient_email: string; recipient_id: string | null; recipient_fields: unknown; step_number: number; steps: unknown; approval_content_hash: string | null;
      }>(
        `SELECT j.id, j.campaign_id, j.recipient_email, j.recipient_id, j.recipient_fields, j.step_number, c.steps, j.approval_content_hash
         FROM outbound_jobs j JOIN campaigns c ON c.id = j.campaign_id AND c.workspace_id = j.workspace_id
         WHERE j.workspace_id = $1::uuid AND j.campaign_id = $2::uuid AND j.status = 'approved'
           AND c.id = (SELECT id FROM campaigns WHERE workspace_id=$1::uuid AND id=$2::uuid FOR UPDATE)
           AND NOT EXISTS (SELECT 1 FROM suppression_list s WHERE s.workspace_id=j.workspace_id AND s.email_hash=j.recipient_hash)`,
        [workspaceId, campaignId]);
      let released = 0, stale = 0;
      for (const job of jobs) {
        const cur = await this.currentApproval(tx, workspaceId, job.campaign_id, job);
        if (cur.ok && job.approval_content_hash === cur.hash) {
          const updated = await tx.query(
            `UPDATE outbound_jobs SET status='pending', updated_at=$3::timestamptz
             WHERE workspace_id=$1::uuid AND id=$2::uuid AND status='approved' RETURNING id`,
            [workspaceId, job.id, this.clock()]);
          if (updated.length === 1) released++;
        } else {
          // Content changed (or no longer resolves) since approval: never release; require deliberate re-approval.
          if (cur.ok) {
            await tx.query(
              `UPDATE outbound_jobs SET status='pending_approval', approved_at=NULL, approval_content_hash=$3, approval_snapshot=$4::jsonb, updated_at=$5::timestamptz
               WHERE workspace_id=$1::uuid AND id=$2::uuid AND status='approved'`,
              [workspaceId, job.id, cur.hash, JSON.stringify(cur.snapshot), this.clock()]);
          } else {
            await tx.query(
              `UPDATE outbound_jobs SET status='pending_approval', approved_at=NULL, updated_at=$3::timestamptz
               WHERE workspace_id=$1::uuid AND id=$2::uuid AND status='approved'`,
              [workspaceId, job.id, this.clock()]);
          }
          stale++;
        }
      }
      return { released, stale, sendingEnabled: true };
    });
  }

  /** Worker-facing: every active campaign, no workspace filter. Internal only - never exposed on a route. */
  async listActiveCampaigns(): Promise<Array<{ workspaceId: string; campaignId: string }>> {
    const rows = await this.database.query<{ workspace_id: string; id: string }>(
      "SELECT workspace_id, id FROM campaigns WHERE status='active'");
    return rows.map((r) => ({ workspaceId: r.workspace_id, campaignId: r.id }));
  }

  /**
   * Invalidation hook for any future campaign-edit path: reverts 'approved'
   * jobs whose recomputed hash no longer matches back to 'pending_approval'.
   * There is currently no campaign-edit endpoint; that path MUST call this.
   */
  async invalidateStaleApprovals(workspaceId: string, campaignId: string): Promise<{ invalidatedCount: number }> {
    const jobs = await this.database.query<{
      id: string; campaign_id: string; recipient_email: string; recipient_id: string | null; recipient_fields: unknown; step_number: number; steps: unknown; approval_content_hash: string | null;
    }>(
      `SELECT j.id, j.campaign_id, j.recipient_email, j.recipient_id, j.recipient_fields, j.step_number, c.steps, j.approval_content_hash
       FROM outbound_jobs j JOIN campaigns c ON c.id = j.campaign_id AND c.workspace_id = j.workspace_id
       WHERE j.workspace_id = $1::uuid AND j.campaign_id = $2::uuid AND j.status = 'approved'`,
      [workspaceId, campaignId]);
    let invalidatedCount = 0;
    for (const job of jobs) {
      const cur = await this.currentApproval(this.database, workspaceId, job.campaign_id, job);
      if (!cur.ok || job.approval_content_hash !== cur.hash) {
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
  /**
   * G10: record one inbound reply (from the fixture-backed IMAP poller today) and
   * halt the answered sequence. Attribution is computed from thread headers or a
   * recipient-hash match only; unattributed replies are stored but halt nothing.
   * Any attributed reply (human or bounce) cancels every still-actionable job for
   * that recipient in that campaign, including held 'approved' ones: a reply means
   * no further message in the sequence may ever be released for that recipient.
   * Idempotent on (workspace_id, message_id): replays after a crash record nothing twice.
   */
  async recordInboundReply(workspaceId: string, input: {
    mailboxId: string;
    messageId: string;
    fromEmail: string;
    subject?: string;
    inReplyTo?: string;
    references?: string[];
    classification: 'interested' | 'objection' | 'out_of_office' | 'unsubscribe' | 'neutral' | 'bounce';
    confidence: number;
    receivedAt: Date;
  }): Promise<{ recorded: boolean; attribution: 'thread_header' | 'recipient_match' | 'ambiguous_recipient' | 'unattributed'; haltedJobIds: string[] }> {
    z.string().uuid().parse(workspaceId);
    z.string().min(1).parse(input.messageId);
    const fromEmail = z.string().email().parse(input.fromEmail.trim().toLowerCase());
    return this.database.transaction(async (tx) => {
      const jobs = await tx.query<{ id: string; campaign_id: string; provider_message_id: string | null; recipient_hash: string; scheduled_at: Date }>(
        `SELECT j.id, j.campaign_id, j.provider_message_id, j.recipient_hash, j.scheduled_at
         FROM outbound_jobs j
         JOIN campaign_mailboxes cm ON cm.campaign_id = j.campaign_id AND cm.workspace_id = j.workspace_id
         WHERE j.workspace_id = $1::uuid AND cm.mailbox_id = $2::uuid`,
        [workspaceId, input.mailboxId]);
      const result = attributeReply(
        { inReplyTo: input.inReplyTo, references: input.references, fromEmail },
        jobs.map((j) => ({ id: j.id, campaignId: j.campaign_id, providerMessageId: j.provider_message_id, recipientHash: j.recipient_hash, scheduledAt: new Date(j.scheduled_at) })),
      );
      const match = result && !('ambiguous' in result) ? result : null;
      const basis = result ? ('ambiguous' in result ? 'ambiguous_recipient' as const : result.basis) : 'unattributed' as const;
      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO inbound_replies
           (id, workspace_id, outbound_job_id, campaign_id, mailbox_id, message_id, from_email, subject, classification, confidence, attribution, received_at, created_at)
         VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13::timestamptz)
         ON CONFLICT (workspace_id, message_id) DO NOTHING RETURNING id`,
        [randomUUID(), workspaceId, match?.jobId ?? null, match?.campaignId ?? null, input.mailboxId,
         input.messageId, fromEmail, input.subject ?? null, input.classification, input.confidence,
         basis, input.receivedAt, this.clock()]);
      if (!inserted[0]) return { recorded: false, attribution: basis, haltedJobIds: [] as string[] };
      if (!match) return { recorded: true, attribution: basis, haltedJobIds: [] as string[] };
      const halted = await tx.query<{ id: string }>(
        `UPDATE outbound_jobs SET status='cancelled', updated_at=$4::timestamptz
         WHERE workspace_id=$1::uuid AND campaign_id=$2::uuid AND recipient_hash=$3
           AND status IN ('pending_approval','pending','approved') RETURNING id`,
        [workspaceId, match.campaignId, recipientHashOf(fromEmail), this.clock()]);
      return { recorded: true, attribution: match.basis, haltedJobIds: halted.map((h) => h.id) };
    });
  }
  /** G10: read-only reply reporting for the workspace, newest first. */
  async listInboundReplies(workspaceId: string, campaignId?: string): Promise<Array<{
    id: string; campaignId: string | null; mailboxId: string | null; messageId: string;
    fromEmail: string; subject: string | null; classification: string; confidence: number;
    attribution: string; receivedAt: string;
  }>> {
    const rows = await this.database.query<{
      id: string; campaign_id: string | null; mailbox_id: string | null; message_id: string;
      from_email: string; subject: string | null; classification: string; confidence: number;
      attribution: string; received_at: Date;
    }>(
      `SELECT id, campaign_id, mailbox_id, message_id, from_email, subject, classification, confidence, attribution, received_at
       FROM inbound_replies
       WHERE workspace_id = $1::uuid AND ($2::uuid IS NULL OR campaign_id = $2::uuid)
       ORDER BY received_at DESC LIMIT 200`,
      [workspaceId, campaignId ?? null]);
    return rows.map((r) => ({
      id: r.id, campaignId: r.campaign_id, mailboxId: r.mailbox_id, messageId: r.message_id,
      fromEmail: r.from_email, subject: r.subject, classification: r.classification,
      confidence: Number(r.confidence), attribution: r.attribution,
      receivedAt: new Date(r.received_at).toISOString(),
    }));
  }
}
