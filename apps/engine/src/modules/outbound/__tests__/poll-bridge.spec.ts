import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AtomicDispatchRepository, type SqlConnection, type TransactionalDatabase } from '../atomic-dispatch.repository';
import { ImapReplyPoller, InMemorySeenMessageStore, type RawInboundMessage } from '../transport/imap-poller';
import { pollMailboxReplies, recordPollEvents } from '../poll-bridge';

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
let now: Date, workspaceId: string, campaignId: string, mailboxId: string;
const connection = (db: any): SqlConnection => ({
  query: async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    (await db.query(sql, params)).rows as T[],
});

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
  campaignId = randomUUID();
  mailboxId = randomUUID();
  repo = new AtomicDispatchRepository(database, () => now);

  await pg.query('INSERT INTO workspaces (id,name,updated_at) VALUES ($1,$2,$3)', [workspaceId, 'Tenant A', now]);
  const steps = JSON.stringify([{ stepNumber: 1, subject: 's1', bodyTemplate: 'b1' }]);
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

function fixtureClient(messages: RawInboundMessage[]) {
  return { fetchSince: async (since: number) => messages.filter((m) => m.uid > since) };
}

describe('G10 poll bridge (fixture pipeline)', () => {
  it('poller events flow into persistence: attribution, halt, and headers survive', async () => {
    const job = await repo.enqueue({
      workspaceId, campaignId, recipientEmail: 'lead@example.invalid',
      idempotencyKey: 'k1', stepNumber: 1, scheduledAt: now,
    });
    await pg.query('UPDATE outbound_jobs SET provider_message_id=$1 WHERE id=$2', ['orig@smtp.invalid', job]);

    const messages: RawInboundMessage[] = [
      { uid: 1, messageId: 'r1@x.invalid', fromEmail: 'lead@example.invalid', subject: 'Re: s1', bodyText: 'sounds interesting, tell me more', inReplyTo: '<orig@smtp.invalid>', references: ['<orig@smtp.invalid>'], receivedAt: now },
      { uid: 2, messageId: 'r2@x.invalid', fromEmail: 'nobody@example.invalid', subject: 'hello', bodyText: 'hi there', receivedAt: now },
    ];
    const poller = new ImapReplyPoller(fixtureClient(messages), new InMemorySeenMessageStore());
    const events = await poller.pollOnce({ mailboxId, campaignId });
    expect(events).toHaveLength(2);
    expect(events[0].inReplyTo).toBe('<orig@smtp.invalid>');

    const summary = await recordPollEvents(repo, workspaceId, mailboxId, events);
    expect(summary.fetched).toBe(2);
    expect(summary.recorded).toBe(2);
    expect(summary.haltedJobIds).toEqual([job]);
    expect(summary.unattributed).toBe(1);
    const stored = (await pg.query('SELECT attribution FROM inbound_replies ORDER BY message_id')).rows as any[];
    expect(stored.map((r) => r.attribution).sort()).toEqual(['thread_header', 'unattributed']);
    const jobRow = (await pg.query('SELECT status FROM outbound_jobs WHERE id=$1', [job])).rows as any[];
    expect(jobRow[0].status).toBe('cancelled');
  });

  it('a repeated poll records nothing twice', async () => {
    const job = await repo.enqueue({
      workspaceId, campaignId, recipientEmail: 'lead@example.invalid',
      idempotencyKey: 'k1', stepNumber: 1, scheduledAt: now,
    });
    const store = new InMemorySeenMessageStore();
    const messages: RawInboundMessage[] = [
      { uid: 1, messageId: 'r1@x.invalid', fromEmail: 'lead@example.invalid', subject: 'Re: s1', bodyText: 'not right now', receivedAt: now },
    ];
    const poller = new ImapReplyPoller(fixtureClient(messages), store);
    const first = await recordPollEvents(repo, workspaceId, mailboxId, await poller.pollOnce({ mailboxId, campaignId }));
    // Poller dedupe drops seen messages, so the second poll returns nothing new.
    const second = await recordPollEvents(repo, workspaceId, mailboxId, await poller.pollOnce({ mailboxId, campaignId }));
    expect(first.recorded).toBe(1);
    expect(second.fetched).toBe(0);
    expect(second.recorded).toBe(0);
    const count = (await pg.query('SELECT count(*)::int AS c FROM inbound_replies')).rows as any[];
    expect(count[0].c).toBe(1);
    void job;
  });

  it('pollMailboxReplies refuses to run unless LEADLOOM_IMAP_POLL_ENABLED=true', async () => {
    const poller = new ImapReplyPoller(fixtureClient([]), new InMemorySeenMessageStore());
    const off = await pollMailboxReplies(repo, poller, workspaceId, mailboxId, campaignId, {});
    expect(off).toBeNull();
    const on = await pollMailboxReplies(repo, poller, workspaceId, mailboxId, campaignId, { LEADLOOM_IMAP_POLL_ENABLED: 'true' } as NodeJS.ProcessEnv);
    expect(on).toEqual({ fetched: 0, recorded: 0, duplicates: 0, haltedJobIds: [], ambiguous: 0, unattributed: 0 });
  });
});
