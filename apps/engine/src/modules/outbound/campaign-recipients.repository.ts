import { randomUUID } from 'node:crypto';
import type { SqlConnection } from './atomic-dispatch.repository';

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
  constructor(private readonly database: SqlConnection, private readonly clock = () => new Date()) {}

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
    input: { name: string; steps: unknown[]; dailyLimitTotal: number; scheduleTimezone: string; tableId?: string; mailboxPoolIds: string[] },
  ): Promise<{ id: string; name: string; status: string; dailyLimitTotal: number; scheduleTimezone: string; steps: unknown } | null> {
    if (input.tableId) {
      const t = await this.database.query<{ id: string }>(
        'SELECT id FROM tables WHERE workspace_id=$1::uuid AND id=$2::uuid', [workspaceId, input.tableId]);
      if (t.length !== 1) return null;
    }
    if (input.mailboxPoolIds.length > 0) {
      const m = await this.database.query<{ id: string }>(
        'SELECT id FROM mailboxes WHERE workspace_id=$1::uuid AND id = ANY($2::uuid[])', [workspaceId, input.mailboxPoolIds]);
      if (m.length !== input.mailboxPoolIds.length) return null;
    }
    const id = randomUUID();
    const now = this.clock();
    const rows = await this.database.query<Record<string, unknown>>(
      `INSERT INTO campaigns (id, workspace_id, table_id, name, status, steps, daily_limit_total, schedule_timezone, created_at, updated_at)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,'draft',$5::jsonb,$6,$7,$8,$8)
       RETURNING id, name, status, steps, daily_limit_total, schedule_timezone`,
      [id, workspaceId, input.tableId ?? null, input.name.trim(), JSON.stringify(input.steps), input.dailyLimitTotal, input.scheduleTimezone, now],
    );
    for (const mailboxId of input.mailboxPoolIds) {
      await this.database.query(
        'INSERT INTO campaign_mailboxes (campaign_id, mailbox_id, workspace_id) VALUES ($1::uuid,$2::uuid,$3::uuid) ON CONFLICT DO NOTHING',
        [id, mailboxId, workspaceId],
      );
    }
    const r = rows[0];
    return {
      id: String(r.id), name: String(r.name), status: String(r.status),
      steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps,
      dailyLimitTotal: Number(r.daily_limit_total), scheduleTimezone: String(r.schedule_timezone),
    };
  }

  /** True only when the campaign belongs to this workspace (route 404 check, no existence leak). */
  async campaignExists(workspaceId: string, campaignId: string): Promise<boolean> {
    const rows = await this.database.query<{ id: string }>(
      'SELECT id FROM campaigns WHERE workspace_id=$1::uuid AND id=$2::uuid', [workspaceId, campaignId]);
    return rows.length === 1;
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
