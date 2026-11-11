import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { CampaignRecipientsRepository } from '../campaign-recipients.repository';
import type { SqlConnection } from '../atomic-dispatch.repository';
import { resolveRecipientMessage, SUPPORTED_VARIABLES } from '../recipient-resolution';

let pg: PGlite;
let workspaceId: string, campaignId: string;
const connection = (d: any): SqlConnection => ({
  query: async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    (await d.query(sql, params)).rows as T[],
});

beforeEach(async () => {
  pg = new PGlite({ extensions: { vector } });
  for (const migration of ['20261110_init_v2', '20261110_integrity', '20261124_campaign_recipients'])
    await pg.exec(readFileSync(fileURLToPath(new URL(`../../../../../../packages/database/prisma/migrations/${migration}/migration.sql`, import.meta.url)), 'utf8'));
  workspaceId = randomUUID(); campaignId = randomUUID();
  const now = new Date();
  await pg.query('INSERT INTO workspaces (id,name,updated_at) VALUES ($1,$2,$3)', [workspaceId, 'Synthetic tenant', now]);
  await pg.query("INSERT INTO campaigns (id,workspace_id,name,status,daily_limit_total,steps,updated_at) VALUES ($1,$2,$3,'draft',5,'[]',$4)", [campaignId, workspaceId, 'Synthetic campaign', now]);
}, 30000);
afterEach(async () => { await pg?.close(); });

describe('campaign recipients store', () => {
  it('upserts per (campaign, email), normalizes email, and scopes reads to the workspace', async () => {
    const repo = new CampaignRecipientsRepository(connection(pg));
    await repo.addRecipients(workspaceId, campaignId, [
      { email: '  Ada@Example.INVALID ', firstName: 'Ada', companyName: 'Acme', customFields: { plan: 'pro' } },
      { email: 'bob@example.invalid', lastName: 'Bobberson' },
    ]);
    const again = await repo.addRecipients(workspaceId, campaignId, [{ email: 'ada@example.invalid', firstName: 'Ada', companyName: 'Acme Corp', customFields: { plan: 'pro', seats: 5 } }]);
    expect(again.upserted).toBe(1);
    const list = await repo.listRecipients(workspaceId, campaignId);
    expect(list).toHaveLength(2);
    const ada = list.find((r) => r.email === 'ada@example.invalid');
    expect(ada?.companyName).toBe('Acme Corp'); // second add updated the row
    expect(ada?.customFields).toEqual({ plan: 'pro', seats: 5 });
    expect(await repo.listRecipients(randomUUID(), campaignId)).toEqual([]); // cross-tenant: no existence leak
    expect(await repo.listRecipients(workspaceId, randomUUID())).toEqual([]);
  });
});

describe('strict per-recipient resolution', () => {
  const step = { subject: 'Quick question about {{company}}', bodyTemplate: 'Hi {{name}}, saw {{company_name}} is hiring {{title}}. - {{sender_note}}' };
  it('resolves canonical variables and aliases from recipient fields', () => {
    const res = resolveRecipientMessage(step, {
      email: 'ada@example.invalid', firstName: 'Ada', companyName: 'Acme Corp', title: 'CTO', customFields: { sender_note: 'Kamal' },
    });
    expect(res).toEqual({ ok: true, subject: 'Quick question about Acme Corp', body: 'Hi Ada, saw Acme Corp is hiring CTO. - Kamal' });
  });
  it('fails closed on an unknown variable: no silent blanks, no leftover tags sent', () => {
    const res = resolveRecipientMessage({ subject: 'Hi {{naem}}', bodyTemplate: 'Body' }, { email: 'a@b.c' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]).toContain("unknown variable '{{naem}}'");
  });
  it('fails closed on a known variable with no value for this recipient', () => {
    const res = resolveRecipientMessage({ subject: 'Hi {{first_name}}', bodyTemplate: 'Body' }, { email: 'a@b.c', firstName: '  ' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]).toContain("has no value");
  });
  it('documents the supported variable set', () => {
    expect(SUPPORTED_VARIABLES).toContain('first_name');
    expect(SUPPORTED_VARIABLES).toContain('company_name');
  });
});
