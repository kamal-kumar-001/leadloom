import type { SeenMessageStore } from './imap-poller';

/**
 * SeenMessageStore over PostgreSQL. Reply markers are outreach_events rows of
 * type 'reply_received' (the model's designed reuse for inbound records);
 * uid checkpoints live in mailbox_sync_state. The dedupe write is
 * INSERT ... ON CONFLICT DO NOTHING against a partial unique index, so the
 * add is atomic rather than check-then-write. Both objects arrive via the
 * additive 20261110_inbound_sync migration.
 */
export class PrismaSeenMessageStore implements SeenMessageStore {
  constructor(private readonly prisma: any) {}

  async has(mailboxId: string, messageId: string): Promise<boolean> {
    const rows: Array<{ x: number }> = await this.prisma.$queryRawUnsafe(
      `SELECT 1 AS x FROM outreach_events WHERE mailbox_id = $1::uuid AND message_id = $2 AND type = 'reply_received' LIMIT 1`,
      mailboxId,
      messageId,
    );
    return rows.length > 0;
  }

  async add(mailboxId: string, messageId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO outreach_events (id, mailbox_id, type, message_id, event_at)
       VALUES (gen_random_uuid(), $1::uuid, 'reply_received', $2, now())
       ON CONFLICT DO NOTHING`,
      mailboxId,
      messageId,
    );
  }

  async lastUid(mailboxId: string): Promise<number> {
    const rows: Array<{ last_inbound_uid: number }> = await this.prisma.$queryRawUnsafe(
      `SELECT last_inbound_uid FROM mailbox_sync_state WHERE mailbox_id = $1::uuid`,
      mailboxId,
    );
    return rows.length ? rows[0].last_inbound_uid : 0;
  }

  async setLastUid(mailboxId: string, uid: number): Promise<void> {
    if (!Number.isInteger(uid) || uid < 0) throw new Error('uid must be a non-negative integer');
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO mailbox_sync_state (mailbox_id, last_inbound_uid, updated_at)
       VALUES ($1::uuid, $2, now())
       ON CONFLICT (mailbox_id) DO UPDATE SET last_inbound_uid = GREATEST(mailbox_sync_state.last_inbound_uid, EXCLUDED.last_inbound_uid), updated_at = now()`,
      mailboxId,
      uid,
    );
  }
}
