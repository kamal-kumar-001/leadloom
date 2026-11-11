import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AtomicDispatchRepository, type SqlConnection, type TransactionalDatabase } from '../atomic-dispatch.repository';

let pg: PGlite, repo: AtomicDispatchRepository;
let now: Date, workspaceId: string, campaignId: string, mailboxId: string;
const connection = (db: any): SqlConnection => ({
  query: async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    (await db.query(sql, params)).rows as T[],
});

beforeEach(async () => {
  pg = new PGlite({ extensions: { vector } });
  for (const migration of ['20261110_init_v2', '20261110_integrity', '20261120_outbound_approval_status']) {
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
  mailboxId = randomUUID();
  repo = new AtomicDispatchRepository(database, () => now);

  await pg.query('INSERT INTO workspaces (id,name,updated_at) VALUES ($1,$2,$3)', [workspaceId, 'Synthetic tenant', now]);
  const steps = JSON.stringify([
    {
      stepNumber: 1,
      subject: 'Quick question about {{company}} infrastructure',
      bodyTemplate: 'Hi {{name}}, noticed your team is scaling systems...',
    },
    {
      stepNumber: 2,
      subject: 'Follow-up regarding infrastructure',
      bodyTemplate: 'Checking in on node optimization...',
    },
  ]);
  await pg.query(
    "INSERT INTO campaigns (id,workspace_id,name,status,daily_limit_total,steps,updated_at) VALUES ($1,$2,$3,'active',5,$4,$5)",
    [campaignId, workspaceId, 'Cloud Infrastructure Outreach', steps, now]
  );
  await pg.query(
    'INSERT INTO mailboxes (id,workspace_id,email,smtp_host,health_score,daily_send_limit,updated_at) VALUES ($1,$2,$3,$4,100,5,$5)',
    [mailboxId, workspaceId, 'sender@example.invalid', 'smtp.example.invalid', now]
  );
  await pg.query(
    'INSERT INTO campaign_mailboxes (campaign_id,mailbox_id,workspace_id) VALUES ($1,$2,$3)',
    [campaignId, mailboxId, workspaceId]
  );
}, 30000);

afterEach(async () => {
  await pg?.close();
});

describe('G9 Approval-before-send queue behavior', () => {
  it('enqueues in pending_approval by default and claim strictly ignores unapproved jobs', async () => {
    const id = await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'lead-approval@example.invalid',
      idempotencyKey: 'key-1',
      stepNumber: 1,
      scheduledAt: now,
      status: 'pending_approval',
    });

    const jobRow = await pg.query<{ status: string }>('SELECT status FROM outbound_jobs WHERE id=$1', [id]);
    expect(jobRow.rows[0].status).toBe('pending_approval');

    // claim() must find nothing because the message has not been approved by a human
    const reservation = await repo.claim({
      workspaceId,
      campaignId,
      mailboxId,
      now,
      nextDispatchAt: new Date(now.getTime() + 45000),
    });
    expect(reservation).toBeNull();
  });

  it('lists pending approvals with decoded campaign step preview', async () => {
    await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'lead-1@example.invalid',
      idempotencyKey: 'key-1',
      stepNumber: 1,
      scheduledAt: now,
      status: 'pending_approval',
    });
    await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'lead-2@example.invalid',
      idempotencyKey: 'key-2',
      stepNumber: 2,
      scheduledAt: now,
      status: 'pending_approval',
    });

    const approvals = await repo.listPendingApprovals(workspaceId);
    expect(approvals).toHaveLength(2);
    expect(approvals[0].recipientEmail).toBe('lead-1@example.invalid');
    expect(approvals[0].campaignName).toBe('Cloud Infrastructure Outreach');
    expect(approvals[0].subject).toBe('Quick question about {{company}} infrastructure');
    expect(approvals[0].bodySnippet).toContain('Hi {{name}}');

    expect(approvals[1].recipientEmail).toBe('lead-2@example.invalid');
    expect(approvals[1].stepNumber).toBe(2);
    expect(approvals[1].subject).toBe('Follow-up regarding infrastructure');

    const stats = await repo.getApprovalStats(workspaceId);
    expect(stats.pendingCount).toBe(2);
    expect(stats.approvedCount).toBe(0);
    expect(stats.rejectedCount).toBe(0);
  });

  it('approving a job makes it claimable for dispatch', async () => {
    const id = await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'approved-lead@example.invalid',
      idempotencyKey: 'key-app',
      stepNumber: 1,
      scheduledAt: now,
      status: 'pending_approval',
    });

    // Before approval: claim returns null
    expect(
      await repo.claim({
        workspaceId,
        campaignId,
        mailboxId,
        now,
        nextDispatchAt: new Date(now.getTime() + 45000),
      })
    ).toBeNull();

    // Human approves the message
    const { approvedCount } = await repo.approve(workspaceId, { jobIds: [id] });
    expect(approvedCount).toBe(1);

    const stats = await repo.getApprovalStats(workspaceId);
    expect(stats.pendingCount).toBe(0);
    expect(stats.approvedCount).toBe(1);

    // After approval: claim reserves the job
    const reservation = await repo.claim({
      workspaceId,
      campaignId,
      mailboxId,
      now,
      nextDispatchAt: new Date(now.getTime() + 45000),
    });
    expect(reservation?.id).toBe(id);
  });

  it('rejecting a job transitions status to rejected and prevents send forever', async () => {
    const id = await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'rejected-lead@example.invalid',
      idempotencyKey: 'key-rej',
      stepNumber: 1,
      scheduledAt: now,
      status: 'pending_approval',
    });

    const { rejectedCount } = await repo.reject(workspaceId, { jobIds: [id] });
    expect(rejectedCount).toBe(1);

    const row = await pg.query<{ status: string }>('SELECT status FROM outbound_jobs WHERE id=$1', [id]);
    expect(row.rows[0].status).toBe('rejected');

    const stats = await repo.getApprovalStats(workspaceId);
    expect(stats.rejectedCount).toBe(1);
    expect(stats.pendingCount).toBe(0);

    // Cannot be claimed
    expect(
      await repo.claim({
        workspaceId,
        campaignId,
        mailboxId,
        now,
        nextDispatchAt: new Date(now.getTime() + 45000),
      })
    ).toBeNull();
  });

  it('batch approves all pending messages for a workspace or campaign', async () => {
    await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'batch-1@example.invalid',
      idempotencyKey: 'batch-1',
      stepNumber: 1,
      scheduledAt: now,
      status: 'pending_approval',
    });
    await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'batch-2@example.invalid',
      idempotencyKey: 'batch-2',
      stepNumber: 1,
      scheduledAt: now,
      status: 'pending_approval',
    });

    const { approvedCount } = await repo.approve(workspaceId, { all: true, campaignId });
    expect(approvedCount).toBe(2);

    const pending = await repo.listPendingApprovals(workspaceId);
    expect(pending).toHaveLength(0);
  });

  it('suppression cancels pending_approval jobs so replies halt unapproved sequences', async () => {
    const id = await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'stop-sequence@example.invalid',
      idempotencyKey: 'key-stop',
      stepNumber: 1,
      scheduledAt: now,
      status: 'pending_approval',
    });

    await repo.suppress(workspaceId, 'stop-sequence@example.invalid');

    const row = await pg.query<{ status: string }>('SELECT status FROM outbound_jobs WHERE id=$1', [id]);
    expect(row.rows[0].status).toBe('cancelled');

    const pending = await repo.listPendingApprovals(workspaceId);
    expect(pending).toHaveLength(0);
  });

  it('enforces tenant boundary on approvals and rejections', async () => {
    const foreignWs = randomUUID();
    const id = await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'tenant-test@example.invalid',
      idempotencyKey: 'key-tenant',
      stepNumber: 1,
      scheduledAt: now,
      status: 'pending_approval',
    });

    // Foreign workspace cannot see, approve or reject
    const foreignList = await repo.listPendingApprovals(foreignWs);
    expect(foreignList).toHaveLength(0);

    const foreignApprove = await repo.approve(foreignWs, { jobIds: [id] });
    expect(foreignApprove.approvedCount).toBe(0);

    const foreignReject = await repo.reject(foreignWs, { jobIds: [id] });
    expect(foreignReject.rejectedCount).toBe(0);

    const row = await pg.query<{ status: string }>('SELECT status FROM outbound_jobs WHERE id=$1', [id]);
    expect(row.rows[0].status).toBe('pending_approval');
  });
});
