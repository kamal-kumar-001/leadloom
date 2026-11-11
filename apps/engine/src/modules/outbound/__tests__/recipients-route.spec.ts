import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createApplication } from '../../../main';
import { CampaignRecipientsRepository } from '../campaign-recipients.repository';
import type { SqlConnection } from '../atomic-dispatch.repository';

let pg: PGlite, campaignId: string;
const key = randomBytes(32);
const workspaceId = randomUUID();
const token = (role = 'admin') => {
  const payload = Buffer.from(JSON.stringify({ sub: randomUUID(), workspaceId, role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return payload + '.' + createHmac('sha256', key).update(payload).digest('base64url');
};
const connection = (d: any): SqlConnection => ({
  query: async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    (await d.query(sql, params)).rows as T[],
});
const stubCore = () => ({
  credentials: { save: async () => ({}), list: async () => [], delete: async () => false },
  outbound: { enqueue: async () => randomUUID(), suppress: async () => {}, releaseApproved: async () => ({ released: 0, stale: 0, sendingEnabled: false }) },
  sessionKey: key,
});

beforeEach(async () => {
  pg = new PGlite({ extensions: { vector } });
  for (const migration of ['20261110_init_v2', '20261110_integrity', '20261124_campaign_recipients'])
    await pg.exec(readFileSync(fileURLToPath(new URL(`../../../../../../packages/database/prisma/migrations/${migration}/migration.sql`, import.meta.url)), 'utf8'));
  campaignId = randomUUID();
  const now = new Date();
  await pg.query('INSERT INTO workspaces (id,name,updated_at) VALUES ($1,$2,$3)', [workspaceId, 'Synthetic tenant', now]);
  await pg.query("INSERT INTO campaigns (id,workspace_id,name,status,daily_limit_total,steps,updated_at) VALUES ($1,$2,$3,'active',5,'[]',$4)", [campaignId, workspaceId, 'Synthetic campaign', now]);
}, 30000);
afterEach(async () => { await pg?.close(); });

describe('campaign recipients routes', () => {
  it('enforces auth + role, scopes to the workspace, and round-trips upsert/list', async () => {
    const app = await createApplication({ ...stubCore(), recipients: new CampaignRecipientsRepository(connection(pg)) } as never);
    try {
      const server = app.getHttpAdapter().getInstance();
      const url = `/campaigns/${campaignId}/recipients`;
      const body = { recipients: [{ email: 'Ada@Example.INVALID', firstName: 'Ada', companyName: 'Acme' }, { email: 'bob@example.invalid', title: 'CTO' }] };
      expect((await server.inject({ method: 'POST', url, payload: body })).statusCode).toBe(401);
      expect((await server.inject({ method: 'POST', url, headers: { authorization: 'Bearer ' + token('read_only') }, payload: body })).statusCode).toBe(403);
      expect((await server.inject({ method: 'POST', url, headers: { authorization: 'Bearer ' + token() }, payload: {} })).statusCode).toBe(400);
      expect((await server.inject({ method: 'POST', url: `/campaigns/${randomUUID()}/recipients`, headers: { authorization: 'Bearer ' + token() }, payload: body })).statusCode).toBe(404);
      const add = await server.inject({ method: 'POST', url, headers: { authorization: 'Bearer ' + token() }, payload: body });
      expect(add.statusCode).toBe(200);
      expect(add.json().upserted).toBe(2);
      expect((await server.inject({ method: 'GET', url })).statusCode).toBe(401);
      const list = await server.inject({ method: 'GET', url, headers: { authorization: 'Bearer ' + token('read_only') } });
      expect(list.statusCode).toBe(200);
      const emails = list.json().recipients.map((r: any) => r.email).sort();
      expect(emails).toEqual(['ada@example.invalid', 'bob@example.invalid']); // normalized
    } finally {
      await app.close();
    }
  });
});
