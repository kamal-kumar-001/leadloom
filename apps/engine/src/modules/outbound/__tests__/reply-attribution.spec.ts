import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AtomicDispatchRepository, recipientHash, type SqlConnection, type TransactionalDatabase } from '../atomic-dispatch.repository';

const MIGRATIONS = [
  '20261110_init_v2',
  '20261110_integrity',
  '20261120_outbound_approval_status',
  '20261121_outbound_approval_hardening',
  '20261122_inbound_replies',
  '20261123_inbound_replies_ambiguity',
  '20261124_campaign_recipients',
  '20261125_job_recipient_resolution',
  '20261126_job_sender_pin',
];

let pg: PGlite, repo: AtomicDispatchRepository;
let now: Date, workspaceId: string, otherWorkspaceId: string, campaignId: string, mailboxId: string;
const connection = (db: any): SqlConnection => ({
  query: async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    (await db.query(sql, params)).rows as T[],
});

async function addJob(opts: { recipient: string; key: string; step?: number; providerMessageId?: string; campaign?: string; workspace?: string }) {
  const ws = opts.workspace ?? workspaceId;
  const camp = opts.campaign ?? campaignId;
  const id = await repo.enqueue({
    workspaceId: ws, campaignId: camp, recipientEmail: opts.recipient,
    idempotencyKey: opts.key, stepNumber: opts.step ?? 1, scheduledAt: now,
  });
  if (opts.providerMessageId) {
    await pg.query('UPDATE outbound_jobs SET provider_message_id=$1 WHERE id=$2', [opts.providerMessageId, id]);
  }
  return id;
}

beforeEach(async () => {
  pg = new PGlite({ extensions: { vector } });
  for (const migration of MIGRATIONS) {
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
  otherWorkspaceId = randomUUID();
  campaignId = randomUUID();
  mailboxId = randomUUID();
  repo = new AtomicDispatchRepository(database, () => now);

  await pg.query('INSERT INTO workspaces (id,name,updated_at) VALUES ($1,$2,$3),($4,$5,$6)', [workspaceId, 'Tenant A', now, otherWorkspaceId, 'Tenant B', now]);
  const steps = JSON.stringify([{ stepNumber: 1, subject: 's1', bodyTemplate: 'b1' }, { stepNumber: 2, subject: 's2', bodyTemplate: 'b2' }]);
  await pg.query(
    "INSERT INTO campaigns (id,workspace_id,name,status,daily_limit_total,steps,updated_at) VALUES ($1,$2,$3,'active',5,$4,$5)",
    [campaignId, workspaceId, 'Campaign A', steps, now]
  );
  await pg.query(
    'INSERT INTO mailboxes (id,workspace_id,email,smtp_host,health_score,daily_send_limit,updated_at) VALUES ($1,$2,$3,$4,100,5,$5)',
    [mailboxId, workspaceId, 'sender@example.invalid', 'smtp.example.invalid', now]
  );
  await pg.query('INSERT INTO campaign_mailboxes (campaign_id,mailbox_id,workspace_id) VALUES ($1,$2,$3)', [campaignId, mailboxId, workspaceId]);
}, 30000);

afterEach(async () => {
  await pg?.close();
});

describe('G10 reply attribution and sequence halt', () => {
  it('attributes via In-Reply-To to the exact job and halts its remaining sequence', async () => {
    const step1 = await addJob({ recipient: 'lead@example.invalid', key: 'k1', providerMessageId: 'msg-step1@smtp.invalid' });
    const step2 = await addJob({ recipient: 'lead@example.invalid', key: 'k2', step: 2, providerMessageId: 'msg-step2@smtp.invalid' });
    const other = await addJob({ recipient: 'other@example.invalid', key: 'k3' });

    const res = await repo.recordInboundReply(workspaceId, {
      mailboxId, messageId: 'reply-1@x.invalid', fromEmail: 'lead@example.invalid',
      inReplyTo: '<msg-step1@smtp.invalid>', classification: 'interested', confidence: 0.9, receivedAt: now,
    });
    expect(res).toEqual({ recorded: true, attribution: 'thread_header', haltedJobIds: expect.arrayContaining([step1, step2]) });
    const rows = (await pg.query('SELECT id,status FROM outbound_jobs ORDER BY id')).rows as any[];
    expect(rows.find((r) => r.id === step1).status).toBe('cancelled');
    expect(rows.find((r) => r.id === step2).status).toBe('cancelled');
    expect(rows.find((r) => r.id === other).status).toBe('pending_approval');
  });

  it('attributes via References list containing the provider message id', async () => {
    const job = await addJob({ recipient: 'lead@example.invalid', key: 'k1', providerMessageId: 'abc@def.invalid' });
    const res = await repo.recordInboundReply(workspaceId, {
      mailboxId, messageId: 'reply-2@x.invalid', fromEmail: 'lead@example.invalid',
      references: ['<root@x.invalid> <abc@def.invalid>'], classification: 'neutral', confidence: 0.5, receivedAt: now,
    });
    expect(res.attribution).toBe('thread_header');
    expect(res.haltedJobIds).toContain(job);
  });

  it('falls back to recipient match when no thread headers exist', async () => {
    const job = await addJob({ recipient: 'lead@example.invalid', key: 'k1' });
    const res = await repo.recordInboundReply(workspaceId, {
      mailboxId, messageId: 'reply-3@x.invalid', fromEmail: 'Lead@Example.Invalid',
      subject: 'not interested', classification: 'objection', confidence: 0.8, receivedAt: now,
    });
    expect(res.attribution).toBe('recipient_match');
    expect(res.haltedJobIds).toContain(job);
  });

  it('records but halts nothing when the sender matches no job in this mailbox scope', async () => {
    await addJob({ recipient: 'lead@example.invalid', key: 'k1' });
    const res = await repo.recordInboundReply(workspaceId, {
      mailboxId, messageId: 'reply-4@x.invalid', fromEmail: 'stranger@example.invalid',
      classification: 'neutral', confidence: 0.4, receivedAt: now,
    });
    expect(res).toEqual({ recorded: true, attribution: 'unattributed', haltedJobIds: [] });
    const stored = (await pg.query("SELECT attribution FROM inbound_replies WHERE message_id='reply-4@x.invalid'")).rows as any[];
    expect(stored[0].attribution).toBe('unattributed');
  });

  it('never attributes across workspaces even when the provider message id matches', async () => {
    await pg.query(
      "INSERT INTO campaigns (id,workspace_id,name,status,daily_limit_total,steps,updated_at) VALUES ($1,$2,$3,'active',5,'[]',$4)",
      [randomUUID(), otherWorkspaceId, 'Campaign B', now]
    );
    const res = await repo.recordInboundReply(workspaceId, {
      mailboxId, messageId: 'reply-5@x.invalid', fromEmail: 'lead@example.invalid',
      inReplyTo: '<foreign@elsewhere.invalid>', classification: 'neutral', confidence: 0.4, receivedAt: now,
    });
    expect(res.attribution).toBe('unattributed');
  });

  it('is idempotent on message_id: a replayed poll records nothing twice and halts nothing twice', async () => {
    await addJob({ recipient: 'lead@example.invalid', key: 'k1' });
    const input = {
      mailboxId, messageId: 'reply-6@x.invalid', fromEmail: 'lead@example.invalid',
      classification: 'interested' as const, confidence: 0.9, receivedAt: now,
    };
    const first = await repo.recordInboundReply(workspaceId, input);
    const second = await repo.recordInboundReply(workspaceId, input);
    expect(first.recorded).toBe(true);
    expect(second).toEqual({ recorded: false, attribution: 'recipient_match', haltedJobIds: [] });
    const count = (await pg.query("SELECT count(*)::int AS c FROM inbound_replies WHERE message_id='reply-6@x.invalid'")).rows as any[];
    expect(count[0].c).toBe(1);
  });

  it('a reply also cancels a held approved job so it can never be released', async () => {
    const job = await addJob({ recipient: 'lead@example.invalid', key: 'k1' });
    await repo.approve(workspaceId, { jobIds: [job] });
    const res = await repo.recordInboundReply(workspaceId, {
      mailboxId, messageId: 'reply-7@x.invalid', fromEmail: 'lead@example.invalid',
      classification: 'unsubscribe', confidence: 0.95, receivedAt: now,
    });
    expect(res.haltedJobIds).toContain(job);
    const row = (await pg.query('SELECT status FROM outbound_jobs WHERE id=$1', [job])).rows as any[];
    expect(row[0].status).toBe('cancelled');
  });

  it('recipient fallback spanning multiple campaigns is ambiguous: recorded, halts nothing', async () => {
    const campaign2 = randomUUID();
    await pg.query(
      "INSERT INTO campaigns (id,workspace_id,name,status,daily_limit_total,steps,updated_at) VALUES ($1,$2,$3,'active',5,'[]',$4)",
      [campaign2, workspaceId, 'Campaign A2', now]
    );
    await pg.query('INSERT INTO campaign_mailboxes (campaign_id,mailbox_id,workspace_id) VALUES ($1,$2,$3)', [campaign2, mailboxId, workspaceId]);
    const j1 = await addJob({ recipient: 'lead@example.invalid', key: 'k1' });
    const j2 = await addJob({ recipient: 'lead@example.invalid', key: 'k2', campaign: campaign2 });

    const res = await repo.recordInboundReply(workspaceId, {
      mailboxId, messageId: 'reply-amb@x.invalid', fromEmail: 'lead@example.invalid',
      classification: 'interested', confidence: 0.9, receivedAt: now,
    });
    expect(res).toEqual({ recorded: true, attribution: 'ambiguous_recipient', haltedJobIds: [] });
    const rows = (await pg.query('SELECT id,status FROM outbound_jobs')).rows as any[];
    expect(rows.find((r) => r.id === j1).status).toBe('pending_approval');
    expect(rows.find((r) => r.id === j2).status).toBe('pending_approval');
    const stored = (await pg.query("SELECT attribution, outbound_job_id FROM inbound_replies WHERE message_id='reply-amb@x.invalid'")).rows as any[];
    expect(stored[0].attribution).toBe('ambiguous_recipient');
    expect(stored[0].outbound_job_id).toBeNull();
  });

  it('thread headers resolve attribution even when the recipient spans campaigns', async () => {
    const campaign2 = randomUUID();
    await pg.query(
      "INSERT INTO campaigns (id,workspace_id,name,status,daily_limit_total,steps,updated_at) VALUES ($1,$2,$3,'active',5,'[]',$4)",
      [campaign2, workspaceId, 'Campaign A2', now]
    );
    await pg.query('INSERT INTO campaign_mailboxes (campaign_id,mailbox_id,workspace_id) VALUES ($1,$2,$3)', [campaign2, mailboxId, workspaceId]);
    const j1 = await addJob({ recipient: 'lead@example.invalid', key: 'k1', providerMessageId: 'unique@msg.invalid' });
    const j2 = await addJob({ recipient: 'lead@example.invalid', key: 'k2', campaign: campaign2 });

    const res = await repo.recordInboundReply(workspaceId, {
      mailboxId, messageId: 'reply-amb2@x.invalid', fromEmail: 'lead@example.invalid',
      inReplyTo: '<unique@msg.invalid>', classification: 'interested', confidence: 0.9, receivedAt: now,
    });
    expect(res.attribution).toBe('thread_header');
    expect(res.haltedJobIds).toEqual([j1]);
    const row = (await pg.query('SELECT status FROM outbound_jobs WHERE id=$1', [j2])).rows as any[];
    expect(row[0].status).toBe('pending_approval');
  });

  it('same-campaign multi-step recipient fallback stays a match and halts only that campaign', async () => {
    const j1 = await addJob({ recipient: 'lead@example.invalid', key: 'k1', step: 1 });
    const j2 = await addJob({ recipient: 'lead@example.invalid', key: 'k2', step: 2 });
    const res = await repo.recordInboundReply(workspaceId, {
      mailboxId, messageId: 'reply-single@x.invalid', fromEmail: 'lead@example.invalid',
      classification: 'neutral', confidence: 0.5, receivedAt: now,
    });
    expect(res.attribution).toBe('recipient_match');
    expect(res.haltedJobIds).toEqual(expect.arrayContaining([j1, j2]));
  });

  it('listInboundReplies returns newest first, scoped to workspace and campaign', async () => {
    await addJob({ recipient: 'lead@example.invalid', key: 'k1' });
    await repo.recordInboundReply(workspaceId, {
      mailboxId, messageId: 'rl-1@x.invalid', fromEmail: 'lead@example.invalid',
      classification: 'interested', confidence: 0.9, receivedAt: new Date('2026-11-10T09:00:00Z'),
    });
    await repo.recordInboundReply(workspaceId, {
      mailboxId, messageId: 'rl-2@x.invalid', fromEmail: 'stranger@example.invalid',
      classification: 'neutral', confidence: 0.3, receivedAt: new Date('2026-11-10T10:00:00Z'),
    });
    const all = await repo.listInboundReplies(workspaceId);
    expect(all.map((r) => r.messageId)).toEqual(['rl-2@x.invalid', 'rl-1@x.invalid']);
    expect(all[1].campaignId).toBe(campaignId);
    expect(all[0].attribution).toBe('unattributed');
    const filtered = await repo.listInboundReplies(workspaceId, campaignId);
    expect(filtered.map((r) => r.messageId)).toEqual(['rl-1@x.invalid']);
    const otherTenant = await repo.listInboundReplies(randomUUID());
    expect(otherTenant).toEqual([]);
  });

  it('persists classification and confidence for later reporting', async () => {
    await addJob({ recipient: 'lead@example.invalid', key: 'k1' });
    await repo.recordInboundReply(workspaceId, {
      mailboxId, messageId: 'reply-8@x.invalid', fromEmail: 'lead@example.invalid',
      subject: 'Timing is bad', classification: 'objection', confidence: 0.77, receivedAt: now,
    });
    const row = (await pg.query("SELECT classification, confidence FROM inbound_replies WHERE message_id='reply-8@x.invalid'")).rows as any[];
    expect(row[0].classification).toBe('objection');
    expect(Number(row[0].confidence)).toBeCloseTo(0.77);
  });
});
