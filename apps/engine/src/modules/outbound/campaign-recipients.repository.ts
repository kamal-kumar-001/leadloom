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
