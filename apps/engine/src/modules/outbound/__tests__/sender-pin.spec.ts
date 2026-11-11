import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AtomicDispatchRepository, type SqlConnection, type TransactionalDatabase } from '../atomic-dispatch.repository';

/**
 * G3 per-job sender identity: a held job may be pinned to one mailbox from the
 * campaign's assigned pool. The pin is part of the signed sender context (the
 * approval snapshot hash), narrows claim() to that mailbox, and fails closed
 * when the pinned mailbox leaves the pool.
 */
let pg: PGlite, repo: AtomicDispatchRepository;
let now: Date, workspaceId: string, campaignId: string, mailboxA: string, mailboxB: string;
const connection = (db: any): SqlConnection => ({
  query: async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    (await db.query(sql, params)).rows as T[],
});

beforeEach(async () => {
  pg = new PGlite({ extensions: { vector } });
  for (const migration of ['20261110_init_v2', '20261110_integrity', '20261120_outbound_approval_status', '20261121_outbound_approval_hardening', '20261124_campaign_recipients', '20261125_job_recipient_resolution', '20261126_job_sender_pin']) {
    await pg.exec(
      readFileSync(
        fileURLToPath(new URL(`../../../../../../packages/database/prisma/migrations/${migration}/migration.sql`, import.meta.url)),
        'utf8'
      )
    );
  }
  const database: TransactionalDatabase = {
    ...connection(pg),
    transaction: (operation) => pg.transaction((tx) => operation(connection(tx))),
  };
  now = new Date('2026-11-10T08:00:00Z');
  workspaceId = randomUUID();
  campaignId = randomUUID();
  mailboxA = randomUUID();
  mailboxB = randomUUID();
  repo = new AtomicDispatchRepository(database, () => now);

  await pg.query('INSERT INTO workspaces (id,name,updated_at) VALUES ($1,$2,$3)', [workspaceId, 'Synthetic tenant', now]);
  const steps = JSON.stringify([
    { stepNumber: 1, subject: 'Quick question about {{company}} infrastructure', bodyTemplate: 'Hi {{name}}, noticed your team is scaling systems...' },
  ]);
  await pg.query(
    "INSERT INTO campaigns (id,workspace_id,name,status,daily_limit_total,steps,updated_at) VALUES ($1,$2,$3,'active',5,$4,$5)",
    [campaignId, workspaceId, 'Sender Pin Campaign', steps, now]
  );
  for (const [id, email] of [[mailboxA, 'sender-a@example.invalid'], [mailboxB, 'sender-b@example.invalid']] as const) {
    await pg.query(
      'INSERT INTO mailboxes (id,workspace_id,email,smtp_host,health_score,daily_send_limit,updated_at) VALUES ($1,$2,$3,$4,100,5,$5)',
      [id, workspaceId, email, 'smtp.example.invalid', now]
    );
    await pg.query('INSERT INTO campaign_mailboxes (campaign_id,mailbox_id,workspace_id) VALUES ($1,$2,$3)', [campaignId, id, workspaceId]);
  }
}, 30000);

afterEach(async () => { await pg?.close(); });

const baseJob = () => ({
  workspaceId,
  campaignId,
  recipientEmail: 'lead@example.invalid',
  idempotencyKey: randomUUID(),
  stepNumber: 1,
  recipient: { firstName: 'Ada', companyName: 'Acme' },
  scheduledAt: now,
});

describe('per-job sender pin', () => {
  it('enqueue with a pool mailbox pins the job and narrows the signed sender context to that mailbox', async () => {
    const id = await repo.enqueue({ ...baseJob(), senderMailboxId: mailboxA });
    const row = await pg.query<{ sender_mailbox_id: string | null; approval_snapshot: { mailboxIds: string[] } }>(
      'SELECT sender_mailbox_id, approval_snapshot FROM outbound_jobs WHERE id=$1', [id]);
    expect(row.rows[0].sender_mailbox_id).toBe(mailboxA);
    expect(row.rows[0].approval_snapshot.mailboxIds).toEqual([mailboxA]);
    const items = await repo.listPendingApprovals(workspaceId);
    expect(items[0].senderMailboxId).toBe(mailboxA);
    expect(items[0].senderMailboxIds).toEqual([mailboxA]);
  });

  it('enqueue rejects a sender mailbox outside the campaign pool', async () => {
    await expect(repo.enqueue({ ...baseJob(), senderMailboxId: randomUUID() })).rejects.toThrow('Sender mailbox is not assigned to this campaign');
  });

  it('setSenderMailbox pins, recomputes the approval hash, and clears back to pool rotation', async () => {
    const id = await repo.enqueue(baseJob());
    const before = await pg.query<{ approval_content_hash: string }>('SELECT approval_content_hash FROM outbound_jobs WHERE id=$1', [id]);

    const pinned = await repo.setSenderMailbox(workspaceId, id, mailboxB);
    expect(pinned.ok).toBe(true);
    const mid = await pg.query<{ sender_mailbox_id: string | null; approval_content_hash: string; approval_snapshot: { mailboxIds: string[] } }>(
      'SELECT sender_mailbox_id, approval_content_hash, approval_snapshot FROM outbound_jobs WHERE id=$1', [id]);
    expect(mid.rows[0].sender_mailbox_id).toBe(mailboxB);
    expect(mid.rows[0].approval_snapshot.mailboxIds).toEqual([mailboxB]);
    expect(mid.rows[0].approval_content_hash).not.toBe(before.rows[0].approval_content_hash);

    const cleared = await repo.setSenderMailbox(workspaceId, id, null);
    expect(cleared.ok).toBe(true);
    const after = await pg.query<{ sender_mailbox_id: string | null; approval_content_hash: string }>(
      'SELECT sender_mailbox_id, approval_content_hash FROM outbound_jobs WHERE id=$1', [id]);
    expect(after.rows[0].sender_mailbox_id).toBeNull();
    expect(after.rows[0].approval_content_hash).toBe(before.rows[0].approval_content_hash);
  });

  it('setSenderMailbox refuses a non-pool mailbox, unknown jobs, and jobs not awaiting approval', async () => {
    const id = await repo.enqueue(baseJob());
    const bad = await repo.setSenderMailbox(workspaceId, id, randomUUID());
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('not assigned to this campaign');

    const missing = await repo.setSenderMailbox(workspaceId, randomUUID(), mailboxA);
    expect(missing.ok).toBe(false);

    // Approve (two-step not needed: content unchanged) then pin attempt must refuse.
    await repo.approve(workspaceId, { jobIds: [id] });
    const afterApprove = await repo.setSenderMailbox(workspaceId, id, mailboxA);
    expect(afterApprove.ok).toBe(false);
    if (!afterApprove.ok) expect(afterApprove.error).toContain('not awaiting approval');
  });

  it('claim() only reserves a pinned job for its pinned mailbox', async () => {
    const id = await repo.enqueue({ ...baseJob(), senderMailboxId: mailboxA });
    // Bypass the held states to test claim semantics in isolation (send gating is covered elsewhere).
    await pg.query("UPDATE outbound_jobs SET status='pending' WHERE id=$1", [id]);
    const cooldown = new Date(now.getTime() + 60000);

    const wrongMailbox = await repo.claim({ workspaceId, campaignId, mailboxId: mailboxB, now, nextDispatchAt: cooldown });
    expect(wrongMailbox).toBeNull();

    const reservation = await repo.claim({ workspaceId, campaignId, mailboxId: mailboxA, now, nextDispatchAt: cooldown });
    expect(reservation?.id).toBe(id);
    expect(reservation?.mailboxId).toBe(mailboxA);
  });

  it('a pinned job fails closed when its mailbox leaves the campaign pool', async () => {
    const id = await repo.enqueue({ ...baseJob(), senderMailboxId: mailboxA });
    await pg.query('DELETE FROM campaign_mailboxes WHERE campaign_id=$1 AND mailbox_id=$2', [campaignId, mailboxA]);
    const items = await repo.listPendingApprovals(workspaceId);
    expect(items[0].stale).toBe(true);
    expect(items[0].resolutionErrors?.join(' ')).toContain('no longer assigned');
    const outcome = await repo.approve(workspaceId, { jobIds: [id] });
    expect(outcome.approvedCount).toBe(0);
    expect(outcome.staleCount).toBe(1);
  });
});
