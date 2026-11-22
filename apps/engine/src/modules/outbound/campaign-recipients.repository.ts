import { setCampaignStatusAtomic } from './campaign-status.atomic';
import { randomUUID,createHash } from 'node:crypto';
import type { SqlConnection, TransactionalDatabase } from './atomic-dispatch.repository';

export class CampaignCreateConflict extends Error {}
export class CampaignPoolConflict extends Error {}

export interface RecipientInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  title?: string | null;
  customFields?: Record<string, unknown>;
}

export interface CampaignRecipientRow extends RecipientInput {
  id: string;
  campaignId: string;
  workspaceId: string;
}

/**
 * Tenant-scoped recipient store for campaigns. Emails are stored trimmed and
 * lowercased; the (campaign_id, email) unique key makes bulk adds idempotent
 * via upsert. No dedupe across campaigns: each campaign owns its list.
 */
export class CampaignRecipientsRepository {
  constructor(private readonly database: SqlConnection | TransactionalDatabase, private readonly clock = () => new Date()) {}

  /**
   * Atomically verifies the target campaign is in 'draft' status using a row lock (FOR UPDATE)
   * and idempotently upserts recipients within a single transaction to prevent race conditions
   * against concurrent activation.
   */
  async importRecipientsIntoDraft(
    workspaceId: string,
    campaignId: string,
    recipients: RecipientInput[],
  ): Promise<{ ok: true; campaignName: string; upserted: number } | { ok: false; reason: 'not_found' | 'not_draft' }> {
    const execute = async (conn: SqlConnection) => {
      const rows = await conn.query<{ id: string; name: string; status: string }>(
        'SELECT id, name, status FROM campaigns WHERE workspace_id=$1::uuid AND id=$2::uuid FOR UPDATE',
        [workspaceId, campaignId],
      );
      if (rows.length === 0) return { ok: false as const, reason: 'not_found' as const };
      const campaign = rows[0];
      if (campaign.status !== 'draft') {
        return { ok: false as const, reason: 'not_draft' as const };
      }

      let upserted = 0;
      for (const r of recipients) {
        const email = r.email.trim().toLowerCase();
        const now = this.clock();
        const ins = await conn.query<{ id: string }>(
          `INSERT INTO campaign_recipients (id, workspace_id, campaign_id, email, first_name, last_name, company_name, title, custom_fields, updated_at)
           VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9::jsonb,$10)
           ON CONFLICT ("campaign_id","email")
           DO UPDATE SET first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, company_name=EXCLUDED.company_name,
                         title=EXCLUDED.title, custom_fields=EXCLUDED.custom_fields, updated_at=EXCLUDED.updated_at
           RETURNING id`,
          [randomUUID(), workspaceId, campaignId, email, r.firstName ?? null, r.lastName ?? null, r.companyName ?? null, r.title ?? null, JSON.stringify(r.customFields ?? {}), now],
        );
        upserted += ins.length;
      }

      return { ok: true as const, campaignName: String(campaign.name), upserted };
    };

    if (!('transaction' in this.database) || typeof (this.database as TransactionalDatabase).transaction !== 'function') {
      throw new Error('Atomic draft recipient import requires a TransactionalDatabase adapter');
    }
    return (this.database as TransactionalDatabase).transaction(execute);
  }

  async addRecipients(workspaceId: string, campaignId: string, recipients: RecipientInput[]): Promise<{ upserted: number }> {
    let upserted = 0;
    for (const r of recipients) {
      const email = r.email.trim().toLowerCase();
      const now = this.clock();
      const rows = await this.database.query<{ id: string }>(
        `INSERT INTO campaign_recipients (id, workspace_id, campaign_id, email, first_name, last_name, company_name, title, custom_fields, updated_at)
         VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9::jsonb,$10)
         ON CONFLICT ("campaign_id","email")
         DO UPDATE SET first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, company_name=EXCLUDED.company_name,
                       title=EXCLUDED.title, custom_fields=EXCLUDED.custom_fields, updated_at=EXCLUDED.updated_at
         RETURNING id`,
        [randomUUID(), workspaceId, campaignId, email, r.firstName ?? null, r.lastName ?? null, r.companyName ?? null, r.title ?? null, JSON.stringify(r.customFields ?? {}), now],
      );
      upserted += rows.length;
    }
    return { upserted };
  }

  /**
   * Creates a draft campaign owned by this workspace. Steps are stored as validated JSON
   * (contract CreateWorkspaceCampaignSchema). Optional table and mailbox pool are verified
   * tenant-scoped first; returns null when a referenced table/mailbox is not in this workspace
   * (route maps to 404, no existence leak).
   */
  async createCampaign(
    workspaceId: string,
    input: { requestId?:string; name: string; steps: unknown[]; dailyLimitTotal: number; scheduleTimezone: string; tableId?: string; projectId?: string; mailboxPoolIds: string[] },
  ): Promise<{ id: string; projectId: string | null; name: string; status: string; dailyLimitTotal: number; scheduleTimezone: string; steps: unknown; replayed:boolean } | null> {
    const canonical={name:input.name.trim(),projectId:input.projectId??null,tableId:input.tableId??null,dailyLimitTotal:input.dailyLimitTotal,scheduleTimezone:input.scheduleTimezone,steps:input.steps.map((s:any)=>({stepNumber:s.stepNumber,delayHours:s.delayHours,subject:s.subject,bodyTemplate:s.bodyTemplate})),mailboxPoolIds:Array.from(new Set(input.mailboxPoolIds)).sort()};
    const hash=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
    const result=(r:Record<string,unknown>,replayed:boolean)=>({id:String(r.id),projectId:r.project_id?String(r.project_id):null,name:String(r.name),status:String(r.status),steps:typeof r.steps==='string'?JSON.parse(r.steps):r.steps,dailyLimitTotal:Number(r.daily_limit_total),scheduleTimezone:String(r.schedule_timezone),replayed});
    const execute = async (conn: SqlConnection) => {
      if(input.requestId){
        const ws=await conn.query('SELECT id FROM workspaces WHERE id=$1::uuid FOR UPDATE',[workspaceId]);if(!ws.length)return null;
        const receipts=await conn.query<Record<string,unknown>>('SELECT payload_hash,campaign_id FROM campaign_create_receipts WHERE workspace_id=$1::uuid AND request_id=$2::uuid',[workspaceId,input.requestId]);
        if(receipts.length){
          if(receipts[0].payload_hash!==hash)throw new CampaignCreateConflict('This request ID was used for different campaign input. Retry unchanged input or deliberately start a new draft');
          const rows=await conn.query<Record<string,unknown>>('SELECT id,project_id,name,status,steps,daily_limit_total,schedule_timezone FROM campaigns WHERE workspace_id=$1::uuid AND id=$2::uuid',[workspaceId,receipts[0].campaign_id]);
          if(!rows.length)throw new CampaignCreateConflict('The original campaign was removed. This request ID cannot recreate it');
          return result(rows[0],true);
        }
      }
      if (input.projectId) {
        const projects = await conn.query('SELECT id FROM projects WHERE workspace_id=$1::uuid AND id=$2::uuid FOR KEY SHARE', [workspaceId,input.projectId]);
        if(projects.length!==1)return null;
      }
      if(input.tableId){
        const tables=await conn.query('SELECT id FROM tables WHERE workspace_id=$1::uuid AND id=$2::uuid FOR KEY SHARE',[workspaceId,input.tableId]);
        if(tables.length!==1)return null;
      }
      const mailboxIds=Array.from(new Set(input.mailboxPoolIds));
      if(mailboxIds.length){
        const mailboxes=await conn.query('SELECT id FROM mailboxes WHERE workspace_id=$1::uuid AND id = ANY($2::uuid[]) FOR KEY SHARE',[workspaceId,mailboxIds]);
        if(mailboxes.length!==mailboxIds.length)return null;
      }
      const id=randomUUID(),now=this.clock();
      const rows=await conn.query<Record<string,unknown>>(
        `INSERT INTO campaigns(id,workspace_id,table_id,project_id,name,status,steps,daily_limit_total,schedule_timezone,created_at,updated_at)
         VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,'draft',$6::jsonb,$7,$8,$9,$9)
         RETURNING id,project_id,name,status,steps,daily_limit_total,schedule_timezone`,
        [id,workspaceId,input.tableId??null,input.projectId??null,input.name.trim(),JSON.stringify(input.steps),input.dailyLimitTotal,input.scheduleTimezone,now]);
      for(const mailboxId of mailboxIds)await conn.query('INSERT INTO campaign_mailboxes(campaign_id,mailbox_id,workspace_id)VALUES($1::uuid,$2::uuid,$3::uuid)',[id,mailboxId,workspaceId]);
      if(input.requestId)await conn.query('INSERT INTO campaign_create_receipts(workspace_id,request_id,payload_hash,campaign_id)VALUES($1::uuid,$2::uuid,$3,$4::uuid)',[workspaceId,input.requestId,hash,id]);
      return result(rows[0],false);
    };
    // A missing transaction implementation must not acknowledge a partial draft.
    if(!('transaction' in this.database)||typeof this.database.transaction!=='function')throw new Error('Campaign creation requires transactional storage');
    return this.database.transaction(execute);
  }

  /** Pool members for a campaign: mailbox id + email, tenant-scoped; [] for another workspace's campaign. */
  async listMailboxPool(workspaceId: string, campaignId: string): Promise<{ id: string; email: string }[]> {
    const rows = await this.database.query<Record<string, unknown>>(
      `SELECT m.id, m.email FROM campaign_mailboxes cm JOIN mailboxes m ON m.id = cm.mailbox_id AND m.workspace_id = cm.workspace_id
       WHERE cm.workspace_id=$1::uuid AND cm.campaign_id=$2::uuid ORDER BY m.email ASC`,
      [workspaceId, campaignId],
    );
    return rows.map((r) => ({ id: String(r.id), email: String(r.email) }));
  }

  /**
   * Replaces a campaign's sender pool. Every id must belong to this workspace; returns null
   * when the campaign or any mailbox is foreign (route maps to 404, no existence leak).
   * Held approvals go stale on pool change by design: the approval snapshot covers sender
   * scope, so a changed pool forces a fresh review before sign-off.
   */
  async setMailboxPool(workspaceId:string,campaignId:string,mailboxIds:string[],expectedMailboxIds?:string[]):Promise<{pool:{id:string;email:string}[];invalidatedCount:number;reservedCount:number;unchanged:boolean}|null>{
    if(!('transaction' in this.database)||typeof this.database.transaction!=='function')throw new Error('Sender-pool replacement requires transactional storage');
    const ids=Array.from(new Set(mailboxIds)).sort(),expected=expectedMailboxIds?Array.from(new Set(expectedMailboxIds)).sort():undefined;
    return this.database.transaction(async tx=>{
      // Same lock order as approve/release/claim: campaign first, mailbox rows second.
      const campaigns=await tx.query('SELECT id FROM campaigns WHERE workspace_id=$1::uuid AND id=$2::uuid FOR UPDATE',[workspaceId,campaignId]);if(!campaigns.length)return null;
      const current=await tx.query<{id:string;email:string}>('SELECT m.id,m.email FROM campaign_mailboxes p JOIN mailboxes m ON m.id=p.mailbox_id AND m.workspace_id=p.workspace_id WHERE p.workspace_id=$1::uuid AND p.campaign_id=$2::uuid ORDER BY m.id',[workspaceId,campaignId]);
      const currentIds=current.map(m=>m.id).sort(),unchanged=JSON.stringify(currentIds)===JSON.stringify(ids);
      if(!unchanged&&expected&&JSON.stringify(currentIds)!==JSON.stringify(expected))throw new CampaignPoolConflict('Sender pool changed since you loaded it. Your selection was not applied. Reload the saved pool and reconcile before saving');
      const reserved=await tx.query<{n:number}>("SELECT count(*)::int AS n FROM outbound_jobs WHERE workspace_id=$1::uuid AND campaign_id=$2::uuid AND status='reserved'",[workspaceId,campaignId]);
      if(unchanged)return{pool:current.sort((a,b)=>a.email.localeCompare(b.email)),invalidatedCount:0,reservedCount:Number(reserved[0]?.n??0),unchanged:true};
      const verified=ids.length?await tx.query<{id:string;email:string}>('SELECT id,email FROM mailboxes WHERE workspace_id=$1::uuid AND id=ANY($2::uuid[]) ORDER BY id FOR KEY SHARE',[workspaceId,ids]):[];
      if(verified.length!==ids.length)return null;
      await tx.query('DELETE FROM campaign_mailboxes WHERE workspace_id=$1::uuid AND campaign_id=$2::uuid',[workspaceId,campaignId]);
      for(const id of ids)await tx.query('INSERT INTO campaign_mailboxes(campaign_id,mailbox_id,workspace_id)VALUES($1::uuid,$2::uuid,$3::uuid)',[campaignId,id,workspaceId]);
      // A released pending job must not retain approval after sender scope changes.
      // Reserved jobs may already be in flight, so they cannot be represented as recalled.
      const invalidated=await tx.query("UPDATE outbound_jobs SET status='pending_approval',approved_at=NULL,updated_at=$3::timestamptz WHERE workspace_id=$1::uuid AND campaign_id=$2::uuid AND status IN ('approved','pending') RETURNING id",[workspaceId,campaignId,this.clock()]);
      return{pool:verified.sort((a,b)=>a.email.localeCompare(b.email)),invalidatedCount:invalidated.length,reservedCount:Number(reserved[0]?.n??0),unchanged:false};
    });
  }

  /**
   * Lifecycle transitions with fail-closed validation: activating requires at
   * least one step and one pool sender (an active campaign without both could
   * never send), pausing requires active, returning to draft requires paused.
   * Same-status requests are idempotent no-ops. Returns null when the campaign
   * is not in this workspace (route answers 404), otherwise ok/reason.
   */
  async setCampaignStatus(workspaceId: string, campaignId: string, target: 'draft' | 'active' | 'paused') {
    return setCampaignStatusAtomic(this.database, workspaceId, campaignId, target, this.clock);
  }

  /** True only when the campaign belongs to this workspace (route 404 check, no existence leak). */
  async campaignExists(workspaceId: string, campaignId: string): Promise<boolean> {
    const rows = await this.database.query<{ id: string }>(
      'SELECT id FROM campaigns WHERE workspace_id=$1::uuid AND id=$2::uuid', [workspaceId, campaignId]);
    return rows.length === 1;
  }

  async getCampaign(workspaceId: string, campaignId: string): Promise<{ id: string; name: string; status: string } | null> {
    const rows = await this.database.query<{ id: string; name: string; status: string }>(
      'SELECT id, name, status FROM campaigns WHERE workspace_id=$1::uuid AND id=$2::uuid', [workspaceId, campaignId]);
    return rows[0] || null;
  }


  /** Tenant-scoped read; returns [] for another workspace's campaign (no existence leak). */
  async listRecipients(workspaceId: string, campaignId: string): Promise<CampaignRecipientRow[]> {
    const rows = await this.database.query<Record<string, unknown>>(
      'SELECT id, campaign_id, workspace_id, email, first_name, last_name, company_name, title, custom_fields FROM campaign_recipients WHERE workspace_id=$1::uuid AND campaign_id=$2::uuid ORDER BY created_at ASC',
      [workspaceId, campaignId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      campaignId: String(r.campaign_id),
      workspaceId: String(r.workspace_id),
      email: String(r.email),
      firstName: (r.first_name as string) ?? null,
      lastName: (r.last_name as string) ?? null,
      companyName: (r.company_name as string) ?? null,
      title: (r.title as string) ?? null,
      customFields: (r.custom_fields as Record<string, unknown>) ?? {},
    }));
  }
}
