import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

/**
 * Gated end-to-end worker loop on real infrastructure:
 *   LEADLOOM_INTEGRATION=1
 *   LEADLOOM_TEST_DATABASE_URL=postgres://... (throwaway DB, migrations applied)
 *   LEADLOOM_SMTP_SERVER_MODULE=path to a package.json whose node_modules has smtp-server
 * Local fixture SMTP only: no real mail host is contacted. Seeds a mailbox
 * through the REAL sealed-credential store (vault round-trip), then runs
 * enqueue -> approve -> gated release -> mounted worker tick and asserts the
 * fixture server received the approved per-recipient message exactly once.
 */
const DATABASE_URL = process.env.LEADLOOM_TEST_DATABASE_URL;
const SMTP = process.env.LEADLOOM_SMTP_SERVER_MODULE;
const RUN = process.env.LEADLOOM_INTEGRATION === '1' && Boolean(DATABASE_URL) && Boolean(SMTP);
const PASS = 'fixture-pass';

describe.runIf(RUN)('worker loop integration (gated: LEADLOOM_INTEGRATION=1)', () => {
  let prisma: import('@leadloom/database').PrismaClient;
  let server: any;
  let port: number;
  const captured: string[] = [];
  let workspaceId: string;
  let campaignId: string;
  let mailboxId: string;

  beforeAll(async () => {
    const { SMTPServer } = createRequire(SMTP!)('smtp-server');
    server = new SMTPServer({
      authOptional: false, secure: false, disabledCommands: ['STARTTLS'], allowInsecureAuth: true,
      onAuth(a: any, _s: any, cb: any) { a.password === PASS ? cb(null, { user: a.username }) : cb(new Error('Invalid login')); },
      onData(stream: any, _s: any, cb: any) {
        const chunks: Buffer[] = [];
        stream.on('data', (c: Buffer) => chunks.push(c));
        stream.on('end', () => { captured.push(Buffer.concat(chunks).toString('utf8')); cb(); });
      },
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    port = server.server.address().port;

    const { PrismaClient } = await import('@leadloom/database');
    const { VaultService } = await import('../../vault/vault.service');
    const { PrismaMailboxConnectStore } = await import('../../mailbox-connect/prisma-mailbox-connect-store');
    const { AtomicDispatchRepository } = await import('../atomic-dispatch.repository');
    const { PrismaDispatchDatabase } = await import('../prisma-database');
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

    workspaceId = randomUUID();
    campaignId = randomUUID();
    await prisma.workspace.create({ data: { id: workspaceId, name: 'worker-loop-gated' } });
    const vault = new VaultService({ currentVersion: 1, keys: new Map([[1, Buffer.alloc(32, 7)]]) } as any);
    const store = new PrismaMailboxConnectStore(prisma, vault);
    const mailbox = await store.create(workspaceId, {
      email: 'sender@fixture.test', password: PASS, smtpHost: '127.0.0.1', smtpPort: port, imapHost: null, imapPort: null,
    }, new Date());
    if (!mailbox) throw new Error('mailbox fixture create failed');
    mailboxId = mailbox.id;
    await prisma.mailbox.update({ where: { id: mailboxId }, data: { healthScore: 100, dailySendLimit: 50 } });
    await prisma.campaign.create({
      data: {
        id: campaignId, workspaceId, name: 'worker-loop', status: 'active', dailyLimitTotal: 5,
        steps: [{ stepNumber: 1, subject: 'Quick question about {{company}}', bodyTemplate: 'Hi {{name}}' }],
      },
    });
    await prisma.campaignMailbox.create({ data: { campaignId, mailboxId, workspaceId } });

    const db = new PrismaDispatchDatabase(prisma);
    const repo = new AtomicDispatchRepository(db, undefined, { sendingEnabled: true });
    const jobId = await repo.enqueue({
      workspaceId, campaignId, recipientEmail: 'ada@example.invalid', idempotencyKey: randomUUID(),
      stepNumber: 1, scheduledAt: new Date(Date.now() - 60_000), recipient: { firstName: 'Ada', companyName: 'Acme' },
    });
    const approval = await repo.approve(workspaceId, { jobIds: [jobId] });
    expect(approval.approvedCount).toBe(1);
    const release = await repo.releaseApproved(workspaceId, campaignId);
    expect(release).toEqual({ released: 1, stale: 0, sendingEnabled: true });

    const { DispatchService } = await import('../dispatch.service');
    const { OutboundWorker } = await import('../worker');
    const { SnapshotMessageComposer } = await import('../transport/snapshot-composer');
    const { MailboxTransportRouter } = await import('../transport/mailbox-transport-router');
    const router = new MailboxTransportRouter({
      endpoints: store,
      composer: new SnapshotMessageComposer(db),
      unsubscribe: null,
      hooks: { allowPrivateHosts: true },
    });
    const worker = new OutboundWorker(new DispatchService(repo, router), {
      listActiveCampaigns: async () => [{ workspaceId, campaignId }],
    });
    (globalThis as any).__worker = worker;
    (globalThis as any).__jobId = jobId;
  }, 60000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it('the mounted worker sends the approved snapshot through the mailbox identity exactly once', async () => {
    const worker = (globalThis as any).__worker as import('../worker').OutboundWorker;
    const jobId = (globalThis as any).__jobId as string;
    const tick = await worker.tick();
    expect(tick).toMatchObject({ campaigns: 1, accepted: 1, uncertain: 0, errors: 0 });
    expect(captured).toHaveLength(1);
    expect(captured[0]).toContain('Hi Ada'); // resolved per-recipient body from the approved snapshot
    expect(captured[0]).toContain('Quick question about Acme');
    expect(captured[0].toLowerCase()).toContain('from: sender@fixture.test');
    const job = await prisma.outboundJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe('accepted');
    expect(job.providerMessageId).toBeTruthy();

    // Second tick: cooldown + reserved daily quota leave nothing claimable; no duplicate send.
    const again = await worker.tick();
    expect(again).toMatchObject({ campaigns: 1, accepted: 0, uncertain: 0, errors: 0 });
    expect(captured).toHaveLength(1);
  }, 60000);
});
