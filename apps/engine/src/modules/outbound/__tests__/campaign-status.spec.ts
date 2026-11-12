import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createApplication } from '../../../main';
import { CampaignRecipientsRepository } from '../campaign-recipients.repository';
import type { SqlConnection } from '../atomic-dispatch.repository';

let pg: PGlite, campaignId: string, mailboxId: string;
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
const setSteps = async (steps: unknown[]) => {
  await pg.query('UPDATE campaigns SET steps=$1::jsonb WHERE id=$2::uuid', [JSON.stringify(steps), campaignId]);
};

beforeEach(async () => {
  pg = new PGlite({ extensions: { vector } });
  for (const migration of ['20261110_init_v2', '20261110_integrity', '20261118_mailbox_password_auth', '20261124_campaign_recipients'])
    await pg.exec(readFileSync(fileURLToPath(new URL(`../../../../../../packages/database/prisma/migrations/${migration}/migration.sql`, import.meta.url)), 'utf8'));
  campaignId = randomUUID();
  mailboxId = randomUUID();
  const now = new Date();
  await pg.query('INSERT INTO workspaces (id,name,updated_at) VALUES ($1,$2,$3)', [workspaceId, 'Tenant A', now]);
  await pg.query("INSERT INTO campaigns (id,workspace_id,name,status,daily_limit_total,steps,updated_at) VALUES ($1,$2,$3,'draft',25,'[]',$4)", [campaignId, workspaceId, 'Lifecycle campaign', now]);
  await pg.query("INSERT INTO mailboxes (id,workspace_id,email,auth_type,imap_host,smtp_host,updated_at) VALUES ($1,$2,$3,'password','imap.fixture.test','smtp.fixture.test',$4)", [mailboxId, workspaceId, 'sender@fixture.test', now]);
}, 30000);
afterEach(async () => { await pg?.close(); });

describe('campaign lifecycle routes', () => {
  const boot = async () => {
    const app = await createApplication({ ...stubCore(), recipients: new CampaignRecipientsRepository(connection(pg)) } as never);
    return app.getHttpAdapter().getInstance();
  };
  const put = (server: any, body: unknown, role = 'admin') =>
    server.inject({ method: 'PUT', url: `/campaigns/${campaignId}/status`, headers: { authorization: 'Bearer ' + token(role) }, payload: body });

  it('enforces auth, role and body validation (fail closed)', async () => {
    const server = await boot();
    try {
      const url = `/campaigns/${campaignId}/status`;
      expect((await server.inject({ method: 'PUT', url, payload: { status: 'active' } })).statusCode).toBe(401);
      expect((await put(server, { status: 'active' }, 'read_only')).statusCode).toBe(403);
      expect((await put(server, {})).statusCode).toBe(400);
      expect((await put(server, { status: 'archived' })).statusCode).toBe(400);
      expect((await server.inject({ method: 'PUT', url: `/campaigns/not-a-uuid/status`, headers: { authorization: 'Bearer ' + token() }, payload: { status: 'active' } })).statusCode).toBe(400);
    } finally { await server.close(); }
  });

  it('refuses activation without steps or a sender pool, naming the reason', async () => {
    const server = await boot();
    try {
      const noSteps = await put(server, { status: 'active' });
      expect(noSteps.statusCode).toBe(409);
      expect(noSteps.json().error).toMatch(/step/i);
      await setSteps([{ subject: 'Hi {{name}}', body: 'Body' }]);
      const noPool = await put(server, { status: 'active' });
      expect(noPool.statusCode).toBe(409);
      expect(noPool.json().error).toMatch(/sender/i);
      const rows = await pg.query('SELECT status FROM campaigns WHERE id=$1::uuid', [campaignId]);
      expect((rows.rows[0] as any).status).toBe('draft');
    } finally { await server.close(); }
  });

  it('walks draft -> active -> paused -> draft, rejecting illegal jumps', async () => {
    const server = await boot();
    try {
      await setSteps([{ subject: 'Hi', body: 'Body' }]);
      await pg.query('INSERT INTO campaign_mailboxes (campaign_id,mailbox_id,workspace_id) VALUES ($1::uuid,$2::uuid,$3::uuid)', [campaignId, mailboxId, workspaceId]);
      expect((await put(server, { status: 'paused' })).statusCode).toBe(409);
      const activate = await put(server, { status: 'active' });
      expect(activate.statusCode).toBe(200);
      expect(activate.json().status).toBe('active');
      expect((await put(server, { status: 'active' })).statusCode).toBe(200);
      const draftJump = await put(server, { status: 'draft' });
      expect(draftJump.statusCode).toBe(409);
      expect(draftJump.json().error).toMatch(/pause/i);
      expect((await put(server, { status: 'paused' })).json().status).toBe('paused');
      expect((await put(server, { status: 'draft' })).json().status).toBe('draft');
      const rows = await pg.query('SELECT status FROM campaigns WHERE id=$1::uuid', [campaignId]);
      expect((rows.rows[0] as any).status).toBe('draft');
    } finally { await server.close(); }
  });

  it('404s foreign campaigns without leaking existence', async () => {
    const server = await boot();
    try {
      expect((await server.inject({ method: 'PUT', url: `/campaigns/${randomUUID()}/status`, headers: { authorization: 'Bearer ' + token() }, payload: { status: 'active' } })).statusCode).toBe(404);
    } finally { await server.close(); }
  });
});
