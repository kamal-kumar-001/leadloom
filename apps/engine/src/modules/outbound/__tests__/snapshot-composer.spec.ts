import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SnapshotMessageComposer } from '../transport/snapshot-composer';

const workspaceId = randomUUID();
const jobId = randomUUID();
const campaignId = randomUUID();
const mailboxId = randomUUID();

const SNAPSHOT = { v: 1, campaignId, stepNumber: 1, recipientEmail: 'ada@example.invalid', subject: 'Quick question about Acme', bodyTemplate: 'Hi Ada', mailboxIds: [mailboxId] };

function fakeDb(rows: Array<Record<string, unknown>>) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  return {
    calls,
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return rows as any;
    },
  };
}

describe('SnapshotMessageComposer', () => {
  it('resolves the exact approved snapshot for the reserved job, tenant-scoped', async () => {
    const db = fakeDb([{ recipient_email: 'ada@example.invalid', campaign_id: campaignId, mailbox_id: mailboxId, status: 'reserved', approval_snapshot: SNAPSHOT }]);
    const composer = new SnapshotMessageComposer(db);
    const msg = await composer.resolve(jobId, { workspaceId });
    expect(msg).toEqual({ to: 'ada@example.invalid', subject: 'Quick question about Acme', text: 'Hi Ada', campaignId, mailboxId });
    expect(db.calls[0].params).toEqual([workspaceId, jobId]);
    expect(db.calls[0].sql).toContain('workspace_id');
  });

  it('fails closed when the job is not reserved in this workspace (wrong tenant, stale claim, re-approved)', async () => {
    const composer = new SnapshotMessageComposer(fakeDb([]));
    await expect(composer.resolve(jobId, { workspaceId })).rejects.toThrow('no longer active');
    for (const status of ['pending_approval', 'approved', 'pending', 'accepted', 'cancelled']) {
      const c = new SnapshotMessageComposer(fakeDb([{ recipient_email: 'a@b.c', campaign_id: campaignId, mailbox_id: mailboxId, status, approval_snapshot: SNAPSHOT }]));
      await expect(c.resolve(jobId, { workspaceId })).rejects.toThrow('no longer active');
    }
  });

  it('fails closed without a claimed mailbox or a readable v1 snapshot', async () => {
    const base = { recipient_email: 'a@b.c', campaign_id: campaignId, status: 'reserved' };
    const noMailbox = new SnapshotMessageComposer(fakeDb([{ ...base, mailbox_id: null, approval_snapshot: SNAPSHOT }]));
    await expect(noMailbox.resolve(jobId, { workspaceId })).rejects.toThrow('no longer active');
    for (const snap of [null, { v: 2 }, { v: 1, subject: 's' }, { v: 1, bodyTemplate: 'b' }]) {
      const c = new SnapshotMessageComposer(fakeDb([{ ...base, mailbox_id: mailboxId, approval_snapshot: snap }]));
      await expect(c.resolve(jobId, { workspaceId })).rejects.toThrow('snapshot');
    }
  });

  it('rejects malformed references and scopes without querying', async () => {
    const db = fakeDb([]);
    const composer = new SnapshotMessageComposer(db);
    await expect(composer.resolve('not-a-uuid', { workspaceId })).rejects.toThrow();
    await expect(composer.resolve(jobId, { workspaceId: 'nope' })).rejects.toThrow();
    expect(db.calls).toHaveLength(0);
  });
});
