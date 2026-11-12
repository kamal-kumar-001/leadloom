import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createApplication } from '../../../main';
import { CampaignRecipientsRepository } from '../campaign-recipients.repository';
import type { SqlConnection } from '../atomic-dispatch.repository';

let pg: PGlite, campaignId: string, mailboxA: string, mailboxB: string, foreignMailbox: string;
const key = randomBytes(32);
const workspaceId = randomUUID();
const otherWorkspaceId = randomUUID();
const token = (role = 'admin', ws = workspaceId) => {
  const payload = Buffer.from(JSON.stringify({ sub: randomUUID(), workspaceId: ws, role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
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
  for (const migration of ['20261110_init_v2', '20261110_integrity', '20261118_mailbox_password_auth', '20261124_campaign_recipients'])
    await pg.exec(readFileSync(fileURLToPath(new URL(`../../../../../../packages/database/prisma/migrations/${migration}/migration.sql`, import.meta.url)), 'utf8'));
  campaignId = randomUUID();
  mailboxA = randomUUID(); mailboxB = randomUUID(); foreignMailbox = randomUUID();
  const now = new Date();
  await pg.query('INSERT INTO workspaces (id,name,updated_at) VALUES ($1,$2,$3),($4,$5,$6)', [workspaceId, 'Tenant A', now, otherWorkspaceId, 'Tenant B', now]);
  await pg.query("INSERT INTO campaigns (id,workspace_id,name,status,daily_limit_total,steps,updated_at) VALUES ($1,$2,$3,'draft',25,'[]',$4)", [campaignId, workspaceId, 'Pool campaign', now]);
  await pg.query(
    "INSERT INTO mailboxes (id,workspace_id,email,auth_type,imap_host,smtp_host,updated_at) VALUES ($1,$2,$3,'password','imap.fixture.test','smtp.fixture.test',$4),($5,$6,$7,'password','imap.fixture.test','smtp.fixture.test',$8),($9,$10,$11,'password','imap.fixture.test','smtp.fixture.test',$12)",
    [mailboxA, workspaceId, 'a@fixture.test', now, mailboxB, workspaceId, 'b@fixture.test', now, foreignMailbox, otherWorkspaceId, 'foreign@fixture.test', now],
  );
}, 30000);
afterEach(async () => { await pg?.close(); });

describe('campaign sender pool routes', () => {
  const boot = async () => {
    const app = await createApplication({ ...stubCore(), recipients: new CampaignRecipientsRepository(connection(pg)) } as never);
    return app.getHttpAdapter().getInstance();
  };

  it('enforces auth, role and body validation on writes (fail closed)', async () => {
    const server = await boot();
    try {
      const url = `/campaigns/${campaignId}/mailboxes`;
      expect((await server.inject({ method: 'PUT', url, payload: { mailboxIds: [mailboxA] } })).statusCode).toBe(401);
      expect((await server.inject({ method: 'PUT', url, headers: { authorization: 'Bearer ' + token('read_only') }, payload: { mailboxIds: [mailboxA] } })).statusCode).toBe(403);
      expect((await server.inject({ method: 'PUT', url, headers: { authorization: 'Bearer ' + token() }, payload: {} })).statusCode).toBe(400);
      expect((await server.inject({ method: 'PUT', url, headers: { authorization: 'Bearer ' + token() }, payload: { mailboxIds: ['not-a-uuid'] } })).statusCode).toBe(400);
      expect((await server.inject({ method: 'GET', url })).statusCode).toBe(401);
    } finally { await server.close(); }
  });

  it('sets, lists and replaces the pool, deduping ids', async () => {
    const server = await boot();
    try {
      const url = `/campaigns/${campaignId}/mailboxes`;
      const set = await server.inject({ method: 'PUT', url, headers: { authorization: 'Bearer ' + token() }, payload: { mailboxIds: [mailboxA, mailboxB, mailboxA] } });
      expect(set.statusCode).toBe(200);
      expect(set.json().pool).toHaveLength(2);
      const list = await server.inject({ method: 'GET', url, headers: { authorization: 'Bearer ' + token('read_only') } });
      expect(list.statusCode).toBe(200);
      expect(list.json().pool.map((m: any) => m.email).sort()).toEqual(['a@fixture.test', 'b@fixture.test']);
      const replace = await server.inject({ method: 'PUT', url, headers: { authorization: 'Bearer ' + token() }, payload: { mailboxIds: [mailboxB] } });
      expect(replace.statusCode).toBe(200);
      expect(replace.json().pool).toHaveLength(1);
      expect(replace.json().pool[0].id).toBe(mailboxB);
    } finally { await server.close(); }
  });

  it('404s foreign campaigns and foreign mailboxes without leaking existence', async () => {
    const server = await boot();
    try {
      expect((await server.inject({ method: 'PUT', url: `/campaigns/${randomUUID()}/mailboxes`, headers: { authorization: 'Bearer ' + token() }, payload: { mailboxIds: [mailboxA] } })).statusCode).toBe(404);
      const foreign = await server.inject({ method: 'PUT', url: `/campaigns/${campaignId}/mailboxes`, headers: { authorization: 'Bearer ' + token() }, payload: { mailboxIds: [mailboxA, foreignMailbox] } });
      expect(foreign.statusCode).toBe(404);
      const rows = await pg.query('SELECT count(*)::int AS n FROM campaign_mailboxes WHERE campaign_id=$1', [campaignId]);
      expect((rows.rows[0] as any).n).toBe(0);
      expect((await server.inject({ method: 'GET', url: `/campaigns/${campaignId}/mailboxes`, headers: { authorization: 'Bearer ' + token('read_only', otherWorkspaceId) } })).statusCode).toBe(404);
    } finally { await server.close(); }
  });
});
