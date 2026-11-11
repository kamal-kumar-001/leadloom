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

  async storedValidity(mailboxId: string): Promise<number | null> {
    const rows: Array<{ uid_validity: bigint | number | null }> = await this.prisma.$queryRawUnsafe(
      `SELECT uid_validity FROM mailbox_sync_state WHERE mailbox_id = $1::uuid`,
      mailboxId,
    );
    return rows.length && rows[0].uid_validity !== null ? Number(rows[0].uid_validity) : null;
  }

  /** Unlike setLastUid (monotone), this may lower the checkpoint: the server renumbered the folder. */
  async resetCheckpoint(mailboxId: string, uidValidity: number): Promise<void> {
    if (!Number.isInteger(uidValidity) || uidValidity < 0) throw new Error('uidValidity must be a non-negative integer');
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO mailbox_sync_state (mailbox_id, last_inbound_uid, uid_validity, updated_at)
       VALUES ($1::uuid, 0, $2, now())
       ON CONFLICT (mailbox_id) DO UPDATE SET last_inbound_uid = 0, uid_validity = EXCLUDED.uid_validity, updated_at = now()`,
      mailboxId,
      uidValidity,
    );
  }

  /**
   * Per-mailbox mutual exclusion for the whole poll. A transaction-scoped advisory lock is held for the
   * duration of fn, so a crashed worker releases it automatically. Returns null when another poll holds it.
   * Bounded by a transaction timeout so a hung IMAP server cannot hold the lock forever.
   */
  async withLock<T>(mailboxId: string, fn: () => Promise<T>): Promise<T | null> {
    return this.prisma.$transaction(
      async (tx: any) => {
        const rows: Array<{ ok: boolean }> = await tx.$queryRawUnsafe(
          `SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS ok`,
          'leadloom:imap-poll:' + mailboxId,
        );
        if (!rows[0]?.ok) return null;
        return fn();
      },
      { timeout: 120_000, maxWait: 5_000 },
    );
  }
}
