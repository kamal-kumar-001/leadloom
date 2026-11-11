import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AtomicDispatchRepository, type SqlConnection, type TransactionalDatabase } from '../atomic-dispatch.repository';
import { CampaignRecipientsRepository } from '../campaign-recipients.repository';

let pg: PGlite, db: TransactionalDatabase, repo: AtomicDispatchRepository;
let now: Date, workspaceId: string, campaignId: string;
const connection = (d: any): SqlConnection => ({
  query: async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    (await d.query(sql, params)).rows as T[],
});
const STEPS = JSON.stringify([{ stepNumber: 1, subject: 'Quick question about {{company}}', bodyTemplate: 'Hi {{name}} from {{company}}' }]);
const status = async (id: string) => (await pg.query<{ status: string }>('SELECT status FROM outbound_jobs WHERE id=$1', [id])).rows[0].status;

beforeEach(async () => {
  pg = new PGlite({ extensions: { vector } });
  for (const migration of ['20261110_init_v2', '20261110_integrity', '20261120_outbound_approval_status', '20261121_outbound_approval_hardening', '20261124_campaign_recipients', '20261125_job_recipient_resolution', '20261126_job_sender_pin'])
    await pg.exec(readFileSync(fileURLToPath(new URL(`../../../../../../packages/database/prisma/migrations/${migration}/migration.sql`, import.meta.url)), 'utf8'));
  db = { ...connection(pg), transaction: (operation) => pg.transaction((tx) => operation(connection(tx))) };
  repo = new AtomicDispatchRepository(db, () => now);
  now = new Date('2026-11-10T08:00:00Z');
  workspaceId = randomUUID(); campaignId = randomUUID();
  await pg.query('INSERT INTO workspaces (id,name,updated_at) VALUES ($1,$2,$3)', [workspaceId, 'Synthetic tenant', now]);
  await pg.query("INSERT INTO campaigns (id,workspace_id,name,status,daily_limit_total,steps,updated_at) VALUES ($1,$2,$3,'active',5,$4,$5)", [campaignId, workspaceId, 'Synthetic campaign', STEPS, now]);
}, 30000);
afterEach(async () => { await pg?.close(); });

describe('G9 resolved-content wiring', () => {
  it('the approval snapshot signs off on the RESOLVED message, not the template', async () => {
    const id = await repo.enqueue({
      workspaceId, campaignId, recipientEmail: 'ada@example.invalid', idempotencyKey: randomUUID(), stepNumber: 1, scheduledAt: now,
      recipient: { firstName: 'Ada', companyName: 'Acme Corp' },
    });
    const [item] = await repo.listPendingApprovals(workspaceId);
    expect(item.id).toBe(id);
    expect(item.subject).toBe('Quick question about Acme Corp');
    expect(item.bodyTemplate).toBe('Hi Ada from Acme Corp');
    expect(item.bodyTemplate).not.toContain('{{');
  });

  it('enqueue fails closed when the template has variables and no recipient fields exist', async () => {
    await expect(repo.enqueue({
      workspaceId, campaignId, recipientEmail: 'ghost@example.invalid', idempotencyKey: randomUUID(), stepNumber: 1, scheduledAt: now,
    })).rejects.toThrow('Message does not resolve');
  });

  it('editing a linked recipient row invalidates a held approval (live fields, not a frozen copy)', async () => {
    const recipients = new CampaignRecipientsRepository(connection(pg));
    await recipients.addRecipients(workspaceId, campaignId, [{ email: 'ada@example.invalid', firstName: 'Ada', companyName: 'Acme Corp' }]);
    const [row] = await recipients.listRecipients(workspaceId, campaignId);
    const id = await repo.enqueue({
      workspaceId, campaignId, recipientEmail: 'ada@example.invalid', idempotencyKey: randomUUID(), stepNumber: 1, scheduledAt: now, recipientId: row.id,
    });
    const res = await repo.approve(workspaceId, { jobIds: [id] });
    expect(res.approvedCount).toBe(1);
    expect(await status(id)).toBe('approved');
    // Recipient's company changes: the approved message no longer matches what would be sent.
    await recipients.addRecipients(workspaceId, campaignId, [{ email: 'ada@example.invalid', firstName: 'Ada', companyName: 'Globex' }]);
    const inv = await repo.invalidateStaleApprovals(workspaceId, campaignId);
    expect(inv.invalidatedCount).toBe(1);
    expect(await status(id)).toBe('pending_approval');
    const [item] = await repo.listPendingApprovals(workspaceId);
    expect(item.stale).toBe(true);
    // Re-approving is the deliberate two-step: first call refreshes the snapshot to the new content, second signs it off.
    const refresh = await repo.approve(workspaceId, { jobIds: [id] });
    expect(refresh.staleCount).toBe(1);
    const again = await repo.approve(workspaceId, { jobIds: [id] });
    expect(again.approvedCount).toBe(1);
    const snap = (await pg.query<{ approval_snapshot: any }>('SELECT approval_snapshot FROM outbound_jobs WHERE id=$1', [id])).rows[0].approval_snapshot;
    expect(snap.subject).toBe('Quick question about Globex');
  });

  it('a recipient row losing a needed value leaves the job held with a named resolution error', async () => {
    const recipients = new CampaignRecipientsRepository(connection(pg));
    await recipients.addRecipients(workspaceId, campaignId, [{ email: 'ada@example.invalid', firstName: 'Ada', companyName: 'Acme Corp' }]);
    const [row] = await recipients.listRecipients(workspaceId, campaignId);
    const id = await repo.enqueue({
      workspaceId, campaignId, recipientEmail: 'ada@example.invalid', idempotencyKey: randomUUID(), stepNumber: 1, scheduledAt: now, recipientId: row.id,
    });
    await recipients.addRecipients(workspaceId, campaignId, [{ email: 'ada@example.invalid', firstName: 'Ada', companyName: null }]);
    const [item] = await repo.listPendingApprovals(workspaceId);
    expect(item.stale).toBe(true);
    expect(item.resolutionErrors?.some((e) => e.includes('company'))).toBe(true);
    const res = await repo.approve(workspaceId, { jobIds: [id] });
    expect(res.approvedCount).toBe(0); // cannot approve an unresolvable message
    expect(await status(id)).toBe('pending_approval');
  });
});
