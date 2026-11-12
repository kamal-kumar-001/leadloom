import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createApplication } from '../../../main';
import { CampaignRecipientsRepository } from '../campaign-recipients.repository';
import type { SqlConnection } from '../atomic-dispatch.repository';

let pg: PGlite;
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

const validBody = () => ({
  name: 'Fixture outreach campaign',
  steps: [
    { stepNumber: 1, delayHours: 0, subject: 'Hi {{name}}', bodyTemplate: 'Hello {{name}} from {{company}}' },
    { stepNumber: 2, delayHours: 72, subject: 'Re: Hi {{name}}', bodyTemplate: 'Following up, {{name}}' },
  ],
  dailyLimitTotal: 25,
  scheduleTimezone: 'Asia/Kolkata',
});

beforeEach(async () => {
  pg = new PGlite({ extensions: { vector } });
  for (const migration of ['20261110_init_v2', '20261110_integrity', '20261118_mailbox_password_auth', '20261124_campaign_recipients'])
    await pg.exec(readFileSync(fileURLToPath(new URL(`../../../../../../packages/database/prisma/migrations/${migration}/migration.sql`, import.meta.url)), 'utf8'));
  const now = new Date();
  await pg.query('INSERT INTO workspaces (id,name,updated_at) VALUES ($1,$2,$3),($4,$5,$6)', [workspaceId, 'Tenant A', now, otherWorkspaceId, 'Tenant B', now]);
}, 30000);
afterEach(async () => { await pg?.close(); });

describe('workspace campaign create route', () => {
  const boot = async () => {
    const app = await createApplication({ ...stubCore(), recipients: new CampaignRecipientsRepository(connection(pg)) } as never);
    return app.getHttpAdapter().getInstance();
  };

  it('enforces auth, role, and body validation (fail closed)', async () => {
    const server = await boot();
    try {
      expect((await server.inject({ method: 'POST', url: '/workspace/campaigns', payload: validBody() })).statusCode).toBe(401);
      expect((await server.inject({ method: 'POST', url: '/workspace/campaigns', headers: { authorization: 'Bearer ' + token('read_only') }, payload: validBody() })).statusCode).toBe(403);
      expect((await server.inject({ method: 'POST', url: '/workspace/campaigns', headers: { authorization: 'Bearer ' + token() }, payload: {} })).statusCode).toBe(400);
      expect((await server.inject({ method: 'POST', url: '/workspace/campaigns', headers: { authorization: 'Bearer ' + token() }, payload: { ...validBody(), steps: [] } })).statusCode).toBe(400);
      expect((await server.inject({ method: 'POST', url: '/workspace/campaigns', headers: { authorization: 'Bearer ' + token() }, payload: { ...validBody(), steps: [{ stepNumber: 1, delayHours: 0, subject: '', bodyTemplate: 'x' }] } })).statusCode).toBe(400);
    } finally { await server.close(); }
  });

  it('creates a draft campaign with steps and echoes the row', async () => {
    const server = await boot();
    try {
      const res = await server.inject({ method: 'POST', url: '/workspace/campaigns', headers: { authorization: 'Bearer ' + token() }, payload: validBody() });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.status).toBe('draft');
      expect(body.name).toBe('Fixture outreach campaign');
      expect(body.dailyLimitTotal).toBe(25);
      expect(body.scheduleTimezone).toBe('Asia/Kolkata');
      expect(Array.isArray(body.steps)).toBe(true);
      expect(body.steps).toHaveLength(2);
      expect(body.steps[0].bodyTemplate).toContain('{{name}}');
      const db = await pg.query('SELECT workspace_id, status FROM campaigns WHERE id=$1', [body.id]);
      expect(db.rows).toHaveLength(1);
      expect(String((db.rows[0] as any).workspace_id)).toBe(workspaceId);
      expect((db.rows[0] as any).status).toBe('draft');
    } finally { await server.close(); }
  });

  it('links a mailbox pool only when every mailbox belongs to the workspace', async () => {
    const mailboxId = randomUUID();
    const foreignMailboxId = randomUUID();
    const now = new Date();
    await pg.query(
      "INSERT INTO mailboxes (id,workspace_id,email,auth_type,imap_host,smtp_host,updated_at) VALUES ($1,$2,$3,'password','imap.fixture.test','smtp.fixture.test',$4),($5,$6,$7,'password','imap.fixture.test','smtp.fixture.test',$8)",
      [mailboxId, workspaceId, 'owned@fixture.test', now, foreignMailboxId, otherWorkspaceId, 'foreign@fixture.test', now],
    );
    const server = await boot();
    try {
      const ok = await server.inject({ method: 'POST', url: '/workspace/campaigns', headers: { authorization: 'Bearer ' + token() }, payload: { ...validBody(), mailboxPoolIds: [mailboxId] } });
      expect(ok.statusCode).toBe(201);
      const pool = await pg.query('SELECT mailbox_id FROM campaign_mailboxes WHERE campaign_id=$1', [ok.json().id]);
      expect(pool.rows).toHaveLength(1);
      const foreign = await server.inject({ method: 'POST', url: '/workspace/campaigns', headers: { authorization: 'Bearer ' + token() }, payload: { ...validBody(), mailboxPoolIds: [foreignMailboxId] } });
      expect(foreign.statusCode).toBe(404);
    } finally { await server.close(); }
  });

  it('rejects a table id from another workspace without leaking existence', async () => {
    const foreignTableId = randomUUID();
    const now = new Date();
    await pg.query('INSERT INTO tables (id,workspace_id,name,updated_at) VALUES ($1,$2,$3,$4)', [foreignTableId, otherWorkspaceId, 'Foreign table', now]);
    const server = await boot();
    try {
      const res = await server.inject({ method: 'POST', url: '/workspace/campaigns', headers: { authorization: 'Bearer ' + token() }, payload: { ...validBody(), tableId: foreignTableId } });
      expect(res.statusCode).toBe(404);
      const count = await pg.query('SELECT count(*)::int AS n FROM campaigns WHERE workspace_id=$1', [workspaceId]);
      expect((count.rows[0] as any).n).toBe(0);
    } finally { await server.close(); }
  });
});
