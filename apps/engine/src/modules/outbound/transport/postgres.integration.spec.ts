import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Environment-gated PostgreSQL 16 integration tests. These run ONLY when
 *   LEADLOOM_INTEGRATION=1
 *   LEADLOOM_TEST_DATABASE_URL=postgres://user:pass@host:5432/leadloom_test
 * are set, against a throwaway database that already has `prisma migrate
 * deploy` applied (PG16 + pgvector per ADR-003, matching docker-compose).
 * The default suite stays hermetic: with the gate unset the whole file
 * collapses to one passing skip marker, so `npm test` never needs Docker.
 *
 *   docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=test pgvector/pgvector:pg16
 *   (when running inside a pre-built image, bind-mount packages/database/prisma too: atomic-dispatch.spec reads migration SQL from disk)
 *   LEADLOOM_INTEGRATION=1 LEADLOOM_TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/postgres npx vitest run
 */
const DATABASE_URL = process.env.LEADLOOM_TEST_DATABASE_URL;
const RUN = process.env.LEADLOOM_INTEGRATION === '1' && Boolean(DATABASE_URL);

describe.runIf(RUN)('postgres integration (gated: LEADLOOM_INTEGRATION=1)', () => {
  let prisma: import('@leadloom/database').PrismaClient;
  let workspaceId: string;
  let mailboxId: string;

  beforeAll(async () => {
    const { PrismaClient } = await import('@leadloom/database');
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    workspaceId = randomUUID();
    mailboxId = randomUUID();
    await prisma.workspace.create({ data: { id: workspaceId, name: 'integration-gated' } });
    await prisma.mailbox.create({
      data: { id: mailboxId, workspaceId, email: 'gated@example.com', smtpHost: 'smtp.example.com' },
    });
  });

  afterAll(async () => {
    // Workspace cascade purges mailbox, outreach_events, mailbox_sync_state,
    // and suppression_list in one transaction (PRD 6.4 cascade deletion).
    if (prisma && workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma?.$disconnect();
  });

  it('PrismaSeenMessageStore: UIDVALIDITY reset may lower the checkpoint, and the poll lock is exclusive', async () => {
    const { PrismaSeenMessageStore } = await import('./prisma-seen-store');
    const store = new PrismaSeenMessageStore(prisma);
    expect(await store.storedValidity(mailboxId)).toBeNull();
    await store.setLastUid(mailboxId, 50);
    await store.resetCheckpoint(mailboxId, 4294967295);
    expect(await store.storedValidity(mailboxId)).toBe(4294967295);
    expect(await store.lastUid(mailboxId)).toBe(0);
    let release!: () => void; const gate = new Promise<void>((r) => (release = r));
    const first = store.withLock(mailboxId, async () => { await gate; return 'a'; });
    await new Promise((r) => setTimeout(r, 150));
    expect(await store.withLock(mailboxId, async () => 'b')).toBeNull();
    release();
    expect(await first).toBe('a');
    expect(await store.withLock(mailboxId, async () => 'c')).toBe('c');
  });

  it('PrismaSeenMessageStore dedupes replies and keeps monotone UID checkpoints', async () => {
    const { PrismaSeenMessageStore } = await import('./prisma-seen-store');
    const store = new PrismaSeenMessageStore(prisma);

    expect(await store.has(mailboxId, '<m1@example.com>')).toBe(false);
    await store.add(mailboxId, '<m1@example.com>');
    await store.add(mailboxId, '<m1@example.com>'); // atomic ON CONFLICT DO NOTHING
    expect(await store.has(mailboxId, '<m1@example.com>')).toBe(true);

    const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS n FROM outreach_events WHERE mailbox_id = $1::uuid AND type = 'reply_received'`,
      mailboxId,
    );
    expect(Number(rows[0].n)).toBe(1);

    expect(await store.lastUid(mailboxId)).toBe(0);
    await store.setLastUid(mailboxId, 41);
    await store.setLastUid(mailboxId, 17); // GREATEST keeps the high-water mark
    expect(await store.lastUid(mailboxId)).toBe(41);
    await expect(store.setLastUid(mailboxId, -1)).rejects.toThrow(/non-negative/);
  });

  it('RFC 8058 POST suppresses with a one-way hash and never stores the raw email', async () => {
    const { createApplication } = await import('../../../main');
    const { AtomicDispatchRepository, recipientHash } = await import('../atomic-dispatch.repository');
    const { PrismaDispatchDatabase } = await import('../prisma-database');
    const { buildListUnsubscribeHeaders } = await import('./unsubscribe');

    const signingKey = Buffer.alloc(32, 7);
    const campaignId = randomUUID();
    const email = 'Gated.User@Example.com';
    const app = await createApplication({
      outbound: new AtomicDispatchRepository(new PrismaDispatchDatabase(prisma)),
      unsubscribeKey: signingKey,
      sessionKey: Buffer.alloc(32, 1),
      credentials: { save: async () => ({}), list: async () => [], delete: async () => false },
    } as never);

    const headers = buildListUnsubscribeHeaders({
      baseUrl: 'https://app.test/outbound/unsubscribe',
      workspaceId,
      campaignId,
      recipientEmail: email,
      signingKey,
    });
    const token = headers['List-Unsubscribe'].match(/t=([^>&]+)/)![1];
    const q = `w=${workspaceId}&c=${campaignId}&e=${encodeURIComponent(email)}&t=${token}`;

    const first = await app.inject({
      method: 'POST',
      url: `/outbound/unsubscribe?${q}`,
      payload: 'List-Unsubscribe=One-Click',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(first.statusCode).toBe(200);
    // Idempotent: ON CONFLICT DO NOTHING keeps one row.
    const second = await app.inject({
      method: 'POST',
      url: `/outbound/unsubscribe?${q}`,
      payload: 'List-Unsubscribe=One-Click',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(second.statusCode).toBe(200);

    const rows = await prisma.suppressionList.findMany({ where: { workspaceId } });
    expect(rows).toHaveLength(1);
    const expectedHash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    expect(rows[0].emailHash).toBe(expectedHash);
    expect(rows[0].emailHash).toBe(recipientHash(email));
    expect(rows[0].emailHash).not.toContain('@');
    expect(JSON.stringify(rows[0])).not.toContain(email);

    await app.close();
  });
});

describe.skipIf(RUN)('postgres integration (gated: LEADLOOM_INTEGRATION=1)', () => {
  it('skipped: set LEADLOOM_INTEGRATION=1 and LEADLOOM_TEST_DATABASE_URL to run PG16 integration tests', () => {
    expect(RUN).toBe(false);
  });
});
