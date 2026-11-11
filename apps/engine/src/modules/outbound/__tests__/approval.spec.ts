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
  for (const migration of ['20261110_init_v2', '20261110_integrity', '20261120_outbound_approval_status', '20261121_outbound_approval_hardening']) {
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
    });
    await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'lead-2@example.invalid',
      idempotencyKey: 'key-2',
      stepNumber: 2,
      scheduledAt: now,
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

  it('approving a job holds it as approved and NEVER makes it claimable', async () => {
    const id = await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'approved-lead@example.invalid',
      idempotencyKey: 'key-app',
      stepNumber: 1,
      scheduledAt: now,
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

    // Human approves the message: it becomes 'approved', a HELD state
    const { approvedCount, staleCount } = await repo.approve(workspaceId, { jobIds: [id] });
    expect(approvedCount).toBe(1);
    expect(staleCount).toBe(0);

    const row = await pg.query<{ status: string; approved_at: Date | null }>('SELECT status, approved_at FROM outbound_jobs WHERE id=$1', [id]);
    expect(row.rows[0].status).toBe('approved');
    expect(row.rows[0].approved_at).not.toBeNull();

    const stats = await repo.getApprovalStats(workspaceId);
    expect(stats.pendingCount).toBe(0);
    expect(stats.approvedCount).toBe(1);

    // Approval NEVER makes a job claimable: claim only picks 'pending' and no
    // code path moves approved->pending while dispatch is disabled.
    const reservation = await repo.claim({
      workspaceId,
      campaignId,
      mailboxId,
      now,
      nextDispatchAt: new Date(now.getTime() + 45000),
    });
    expect(reservation).toBeNull();
  });

  it('refuses a stale approval after content edit and requires deliberate re-approval', async () => {
    const id = await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'stale-lead@example.invalid',
      idempotencyKey: 'key-stale',
      stepNumber: 1,
      scheduledAt: now,
    });

    // Content edited after queueing (concurrent edit/approve race)
    const edited = JSON.stringify([{ stepNumber: 1, subject: 'EDITED subject', bodyTemplate: 'EDITED body' }]);
    await pg.query('UPDATE campaigns SET steps=$3 WHERE id=$1 AND workspace_id=$2', [campaignId, workspaceId, edited]);

    const first = await repo.approve(workspaceId, { jobIds: [id] });
    expect(first.approvedCount).toBe(0);
    expect(first.staleCount).toBe(1);
    let row = await pg.query<{ status: string }>('SELECT status FROM outbound_jobs WHERE id=$1', [id]);
    expect(row.rows[0].status).toBe('pending_approval');

    // Snapshot was refreshed to the edited content; a second deliberate click approves it
    const second = await repo.approve(workspaceId, { jobIds: [id] });
    expect(second.approvedCount).toBe(1);
    expect(second.staleCount).toBe(0);
    row = await pg.query<{ status: string }>('SELECT status FROM outbound_jobs WHERE id=$1', [id]);
    expect(row.rows[0].status).toBe('approved');
  });

  it('invalidateStaleApprovals reverts approved jobs whose content changed', async () => {
    const id = await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'invalidate-lead@example.invalid',
      idempotencyKey: 'key-inv',
      stepNumber: 1,
      scheduledAt: now,
    });
    expect((await repo.approve(workspaceId, { jobIds: [id] })).approvedCount).toBe(1);

    const edited = JSON.stringify([{ stepNumber: 1, subject: 'CHANGED', bodyTemplate: 'CHANGED body' }]);
    await pg.query('UPDATE campaigns SET steps=$3 WHERE id=$1 AND workspace_id=$2', [campaignId, workspaceId, edited]);

    const { invalidatedCount } = await repo.invalidateStaleApprovals(workspaceId, campaignId);
    expect(invalidatedCount).toBe(1);
    const row = await pg.query<{ status: string; approved_at: Date | null }>('SELECT status, approved_at FROM outbound_jobs WHERE id=$1', [id]);
    expect(row.rows[0].status).toBe('pending_approval');
    expect(row.rows[0].approved_at).toBeNull();

    // Nothing stale left: a second pass invalidates nothing
    expect((await repo.invalidateStaleApprovals(workspaceId, campaignId)).invalidatedCount).toBe(0);
  });

  it('rejecting a job transitions status to rejected and prevents send forever', async () => {
    const id = await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'rejected-lead@example.invalid',
      idempotencyKey: 'key-rej',
      stepNumber: 1,
      scheduledAt: now,
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
    });
    await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'batch-2@example.invalid',
      idempotencyKey: 'batch-2',
      stepNumber: 1,
      scheduledAt: now,
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
    });

    await repo.suppress(workspaceId, 'stop-sequence@example.invalid');

    const row = await pg.query<{ status: string }>('SELECT status FROM outbound_jobs WHERE id=$1', [id]);
    expect(row.rows[0].status).toBe('cancelled');

    const pending = await repo.listPendingApprovals(workspaceId);
    expect(pending).toHaveLength(0);
  });

  it('suppression cancels held approved jobs so an opt-out cannot be resurrected by a future release', async () => {
    const id = await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'approved-optout@example.invalid',
      idempotencyKey: 'key-optout',
      stepNumber: 1,
      scheduledAt: now,
    });
    expect((await repo.approve(workspaceId, { jobIds: [id] })).approvedCount).toBe(1);

    await repo.suppress(workspaceId, 'approved-optout@example.invalid');
    const row = await pg.query<{ status: string }>('SELECT status FROM outbound_jobs WHERE id=$1', [id]);
    expect(row.rows[0].status).toBe('cancelled');
  });

  it('rejection also invalidates held approved jobs', async () => {
    const id = await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'approved-reject@example.invalid',
      idempotencyKey: 'key-arej',
      stepNumber: 1,
      scheduledAt: now,
    });
    expect((await repo.approve(workspaceId, { jobIds: [id] })).approvedCount).toBe(1);

    const { rejectedCount } = await repo.reject(workspaceId, { jobIds: [id] });
    expect(rejectedCount).toBe(1);
    const row = await pg.query<{ status: string }>('SELECT status FROM outbound_jobs WHERE id=$1', [id]);
    expect(row.rows[0].status).toBe('rejected');
  });

  it('an approval racing a rejection wins nothing: the job stays rejected', async () => {
    const id = await repo.enqueue({
      workspaceId,
      campaignId,
      recipientEmail: 'race-lead@example.invalid',
      idempotencyKey: 'key-race',
      stepNumber: 1,
      scheduledAt: now,
    });
    await repo.reject(workspaceId, { jobIds: [id] });
    const { approvedCount, staleCount } = await repo.approve(workspaceId, { jobIds: [id] });
    expect(approvedCount).toBe(0);
    expect(staleCount).toBe(0);
    const row = await pg.query<{ status: string }>('SELECT status FROM outbound_jobs WHERE id=$1', [id]);
    expect(row.rows[0].status).toBe('rejected');
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
