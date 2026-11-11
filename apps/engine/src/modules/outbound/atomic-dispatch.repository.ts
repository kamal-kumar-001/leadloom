import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { OutboundApprovalItem, ApprovalQueueStats } from '@leadloom/contracts';
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

  async enqueue(input: {
    workspaceId: string;
    campaignId: string;
    recipientEmail: string;
    idempotencyKey: string;
    stepNumber: number;
    scheduledAt: Date;
    status?: string;
  }): Promise<string> {
    const email = z.string().email().parse(input.recipientEmail.trim().toLowerCase());
    z.string().min(1).max(255).parse(input.idempotencyKey);
    z.number().int().positive().parse(input.stepNumber);
    z.date().parse(input.scheduledAt);
    const status = input.status ?? 'pending';
    const hash = recipientHash(email), id = randomUUID();
    const rows = await this.database.query<{ id: string }>(`INSERT INTO outbound_jobs
      (id,workspace_id,campaign_id,recipient_email,recipient_hash,idempotency_key,step_number,scheduled_at,status,updated_at)
      SELECT $1::uuid,c.workspace_id,c.id,$4,$5,$6,$7,$8::timestamptz,$9,$10::timestamptz FROM campaigns c WHERE c.workspace_id=$2::uuid AND c.id=$3::uuid
      ON CONFLICT (workspace_id,idempotency_key) DO NOTHING RETURNING id`,
      [id, input.workspaceId, input.campaignId, email, hash, input.idempotencyKey, input.stepNumber, input.scheduledAt, status, this.clock()]);
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
      await tx.query(`UPDATE outbound_jobs SET status='cancelled',updated_at=$3::timestamptz WHERE workspace_id=$1::uuid AND recipient_hash=$2 AND status IN ('pending','pending_approval') RETURNING id`, [workspaceId, hash, this.clock()]);
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
    }>(
      `SELECT j.id, j.workspace_id, j.campaign_id, c.name AS campaign_name, c.steps AS campaign_steps,
              j.recipient_email, j.step_number, j.status, j.scheduled_at, j.created_at
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
      try {
        const steps = Array.isArray(r.campaign_steps) ? r.campaign_steps : JSON.parse(r.campaign_steps || '[]');
        const step = steps.find((s: any) => (s.stepNumber ?? s.step) === r.step_number);
        if (step) {
          subject = step.subject;
          const body = step.bodyTemplate || step.bodySnippet || step.body || '';
          bodySnippet = body.length > 200 ? body.slice(0, 197) + '...' : body;
        }
      } catch {
        // Fallback gracefully if steps cannot be decoded
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
        status: 'pending_approval' as const,
        scheduledAt: new Date(r.scheduled_at).toISOString(),
        createdAt: new Date(r.created_at).toISOString(),
      };
    });
  }

  /**
   * G9: Explicit human approval transitions queued messages from 'pending_approval' to 'pending',
   * making them schedulable. Dispatch remains disabled system-wide.
   */
  async approve(workspaceId: string, input: { jobIds?: string[]; all?: boolean; campaignId?: string }): Promise<{ approvedCount: number }> {
    if (input.all) {
      const rows = await this.database.query<{ id: string }>(
        `UPDATE outbound_jobs SET status='pending', updated_at=$3::timestamptz
         WHERE workspace_id=$1::uuid AND status='pending_approval'
           AND ($2::uuid IS NULL OR campaign_id=$2::uuid)
         RETURNING id`,
        [workspaceId, input.campaignId ?? null, this.clock()]
      );
      return { approvedCount: rows.length };
    }
    const jobIds = input.jobIds ?? [];
    if (!jobIds.length) return { approvedCount: 0 };
    for (const id of jobIds) z.string().uuid().parse(id);
    const rows = await this.database.query<{ id: string }>(
      `UPDATE outbound_jobs SET status='pending', updated_at=$3::timestamptz
       WHERE workspace_id=$1::uuid AND id = ANY($2::uuid[]) AND status='pending_approval'
       RETURNING id`,
      [workspaceId, jobIds, this.clock()]
    );
    return { approvedCount: rows.length };
  }

  /**
   * G9: Rejection transitions queued messages to 'rejected', permanently preventing dispatch.
   */
  async reject(workspaceId: string, input: { jobIds?: string[]; all?: boolean; campaignId?: string; reason?: string }): Promise<{ rejectedCount: number }> {
    if (input.all) {
      const rows = await this.database.query<{ id: string }>(
        `UPDATE outbound_jobs SET status='rejected', updated_at=$3::timestamptz
         WHERE workspace_id=$1::uuid AND status='pending_approval'
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
       WHERE workspace_id=$1::uuid AND id = ANY($2::uuid[]) AND status='pending_approval'
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
