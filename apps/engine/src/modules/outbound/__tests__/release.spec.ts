import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AtomicDispatchRepository, type SqlConnection, type TransactionalDatabase } from '../atomic-dispatch.repository';

let pg: PGlite, db: TransactionalDatabase;
let now: Date, workspaceId: string, campaignId: string, mailboxId: string;
const connection = (d: any): SqlConnection => ({
  query: async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    (await d.query(sql, params)).rows as T[],
});
const STEPS = JSON.stringify([{ stepNumber: 1, subject: 'Quick question about {{company}}', bodyTemplate: 'Hi {{name}}' }]);
const status = async (id: string) => (await pg.query<{ status: string }>('SELECT status FROM outbound_jobs WHERE id=$1', [id])).rows[0].status;

beforeEach(async () => {
  pg = new PGlite({ extensions: { vector } });
  for (const migration of ['20261110_init_v2', '20261110_integrity', '20261120_outbound_approval_status', '20261121_outbound_approval_hardening', '20261124_campaign_recipients', '20261125_job_recipient_resolution', '20261126_job_sender_pin'])
    await pg.exec(readFileSync(fileURLToPath(new URL(`../../../../../../packages/database/prisma/migrations/${migration}/migration.sql`, import.meta.url)), 'utf8'));
  db = { ...connection(pg), transaction: (operation) => pg.transaction((tx) => operation(connection(tx))) };
  now = new Date('2026-11-10T08:00:00Z');
  workspaceId = randomUUID(); campaignId = randomUUID(); mailboxId = randomUUID();
  await pg.query('INSERT INTO workspaces (id,name,updated_at) VALUES ($1,$2,$3)', [workspaceId, 'Synthetic tenant', now]);
  await pg.query("INSERT INTO campaigns (id,workspace_id,name,status,daily_limit_total,steps,updated_at) VALUES ($1,$2,$3,'active',5,$4,$5)", [campaignId, workspaceId, 'Synthetic campaign', STEPS, now]);
  await pg.query('INSERT INTO mailboxes (id,workspace_id,email,smtp_host,health_score,daily_send_limit,updated_at) VALUES ($1,$2,$3,$4,100,2,$5)', [mailboxId, workspaceId, 'mailbox@example.invalid', 'smtp.example.invalid', now]);
  await pg.query('INSERT INTO campaign_mailboxes (campaign_id,mailbox_id,workspace_id) VALUES ($1,$2,$3)', [campaignId, mailboxId, workspaceId]);
}, 30000);
afterEach(async () => { await pg?.close(); });

const seedApproved = async (repo: AtomicDispatchRepository, email = 'lead@example.invalid') => {
  const id = await repo.enqueue({ workspaceId, campaignId, recipientEmail: email, idempotencyKey: randomUUID(), stepNumber: 1, scheduledAt: now, recipient: { firstName: 'Ada', companyName: 'Acme' } });
  const res = await repo.approve(workspaceId, { jobIds: [id] });
  expect(res.approvedCount).toBe(1);
  expect(await status(id)).toBe('approved');
  return id;
};

describe('G3 gated release approved->pending', () => {
  it('is an honest no-op when sendingEnabled is not set: nothing becomes send-reservable', async () => {
    const repo = new AtomicDispatchRepository(db, () => now);
    const id = await seedApproved(repo);
    const res = await repo.releaseApproved(workspaceId, campaignId);
    expect(res).toEqual({ released: 0, stale: 0, sendingEnabled: false });
    expect(await status(id)).toBe('approved');
  });

  it('releases only hash-matching approved jobs; claim can then reserve them', async () => {
    const repo = new AtomicDispatchRepository(db, () => now, { sendingEnabled: true });
    const id = await seedApproved(repo);
    const res = await repo.releaseApproved(workspaceId, campaignId);
    expect(res).toEqual({ released: 1, stale: 0, sendingEnabled: true });
    expect(await status(id)).toBe('pending');
    const reservation = await repo.claim({ workspaceId, campaignId, mailboxId, now, nextDispatchAt: new Date(now.getTime() + 45000) });
    expect(reservation?.id).toBe(id);
  });

  it('never releases a job whose content changed since approval - it goes back to pending_approval', async () => {
    const repo = new AtomicDispatchRepository(db, () => now, { sendingEnabled: true });
    const id = await seedApproved(repo);
    await pg.query('UPDATE campaigns SET steps=$2 WHERE id=$1', [campaignId, JSON.stringify([{ stepNumber: 1, subject: 'Changed subject', bodyTemplate: 'Changed body' }])]);
    await repo.invalidateStaleApprovals(workspaceId, campaignId);
    await repo.approve(workspaceId, { jobIds: [id] }); // marks stale: refreshes the snapshot to edit #1, still held
    const reapprove = await repo.approve(workspaceId, { jobIds: [id] }); // deliberate re-approval of the changed content
    expect(reapprove.approvedCount).toBe(1);
    expect(await status(id)).toBe('approved');
    await pg.query('UPDATE campaigns SET steps=$2 WHERE id=$1', [campaignId, JSON.stringify([{ stepNumber: 1, subject: 'Third subject', bodyTemplate: 'Third body' }])]);
    const res = await repo.releaseApproved(workspaceId, campaignId);
    expect(res.released).toBe(0);
    expect(res.stale).toBe(1);
    expect(await status(id)).toBe('pending_approval');
  });

  it('never releases a suppressed recipient', async () => {
    const repo = new AtomicDispatchRepository(db, () => now, { sendingEnabled: true });
    const id = await seedApproved(repo);
    await pg.query('INSERT INTO suppression_list (id,workspace_id,email_hash,reason,source,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [randomUUID(), workspaceId, (await pg.query<{ h: string }>('SELECT recipient_hash AS h FROM outbound_jobs WHERE id=$1', [id])).rows[0].h, 'unsub', 'link', now]);
    await repo.approve(workspaceId, { jobIds: [id] });
    expect(await status(id)).toBe('approved');
    const res = await repo.releaseApproved(workspaceId, campaignId);
    expect(res.released).toBe(0);
    expect(await status(id)).toBe('approved');
  });

  it('lists active campaigns for the worker with no workspace filter (internal only)', async () => {
    const repo = new AtomicDispatchRepository(db, () => now);
    const list = await repo.listActiveCampaigns();
    expect(list).toEqual([{ workspaceId, campaignId }]);
  });
});
