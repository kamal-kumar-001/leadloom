import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaProvisioningStore } from '../../provisioning/prisma-provisioning-store';
import { ProvisioningService } from '../../provisioning/provisioning.service';
import { VaultService } from '../../vault/vault.service';
import { MailboxConnectService } from '../mailbox-connect.service';
import { PrismaMailboxConnectStore } from '../prisma-mailbox-connect-store';
import { RealConnectionVerifier } from '../verifier';

/** Gated: LEADLOOM_INTEGRATION=1, LEADLOOM_TEST_DATABASE_URL (migrated, throwaway) and LEADLOOM_SMTP_SERVER_MODULE (path to the smtp-server package). Local SMTP only: no real mail host is contacted. */
const URL = process.env.LEADLOOM_TEST_DATABASE_URL; const SMTP = process.env.LEADLOOM_SMTP_SERVER_MODULE;
const RUN = process.env.LEADLOOM_INTEGRATION === '1' && Boolean(URL) && Boolean(SMTP);
const PASS = 'app-pass-' + randomUUID().slice(0, 8);

describe.runIf(RUN)('mailbox connect on real Postgres + a local SMTP server (gated)', () => {
  let prisma: any, server: any, port = 0; const workspaces: string[] = [];
  beforeAll(async () => {
    const { PrismaClient } = await import('@leadloom/database'); prisma = new PrismaClient({ datasources: { db: { url: URL } } });
    const { SMTPServer } = createRequire(SMTP!)('smtp-server');
    server = new SMTPServer({ authOptional: false, secure: false, disabledCommands: ['STARTTLS'], allowInsecureAuth: true,
      onAuth(a: any, _s: any, cb: any) { a.password === PASS ? cb(null, { user: a.username }) : cb(new Error('Invalid login')); } });
    await new Promise<void>((r) => server.listen(2525, '127.0.0.1', () => r())); port = server.server.address().port;
  });
  afterAll(async () => { server?.close(); await prisma.workspace.deleteMany({ where: { id: { in: workspaces } } }); await prisma.$disconnect(); });

  const vault = () => new VaultService({ currentVersion: 1, keys: new Map([[1, Buffer.alloc(32, 7)]]) } as any);
  const ws = async () => { const o = await new ProvisioningService(new PrismaProvisioningStore(prisma)).provision(`mb-${randomUUID().slice(0, 6)}@example.invalid`, 'T'); workspaces.push(o.workspaceId); return o.workspaceId; };

  it('real SMTP login check: right password ok, wrong password auth_failed, nothing sent', async () => {
    const v = new RealConnectionVerifier({ allowPrivateHosts: true });
    const ok = await v.verify({ email: 'me@example.test', password: PASS, smtpHost: '127.0.0.1', smtpPort: port, imapHost: null, imapPort: null });
    expect(ok).toEqual({ smtp: 'ok', imap: 'skipped' });
    const bad = await v.verify({ email: 'me@example.test', password: 'wrong', smtpHost: '127.0.0.1', smtpPort: port, imapHost: null, imapPort: null });
    expect(bad.smtp).toBe('auth_failed');
  });

  it('seals the password (no plaintext in the row), round-trips through the vault, refuses cross-workspace, and stores nothing on failure', async () => {
    const real = new RealConnectionVerifier({ allowPrivateHosts: true });
    const hybrid = { verify: async (e: any) => ({ ...(await real.verify({ ...e, imapHost: null, imapPort: null })), imap: 'ok' as const }) }; // IMAP not exercised here
    const v = vault(); const svc = new MailboxConnectService(new PrismaMailboxConnectStore(prisma, v), hybrid, { allowPrivateHosts: true });
    const w = await ws(), w2 = await ws();
    const input = { email: 'sales@example.test', password: PASS, smtpHost: '127.0.0.1', smtpPort: port, imapHost: '127.0.0.1', imapPort: 993 };
    const fail = await svc.connect(w, { ...input, password: 'nope' });
    expect(fail).toMatchObject({ ok: false, reason: 'connection_failed' }); expect(await prisma.mailbox.count({ where: { workspaceId: w } })).toBe(0);
    const made: any = await svc.connect(w, input); expect(made.ok).toBe(true); expect(Object.keys(made.mailbox).sort()).toEqual(['connectionCheckedAt', 'connectionErrorCode', 'connectionStatus', 'email', 'id']);
    const row = await prisma.mailbox.findUnique({ where: { id: made.mailbox.id } });
    expect(row.authType).toBe('password'); expect(Buffer.from(row.encryptedAccessToken).toString('utf8')).not.toContain(PASS);
    expect(JSON.stringify(row)).not.toContain(PASS);
    expect(await svc.connect(w, input)).toEqual({ ok: false, reason: 'already_connected' });
    expect(await svc.test(w, made.mailbox.id)).toMatchObject({ ok: true, mailbox: { connectionStatus: 'ok' } });
    expect(await svc.test(w2, made.mailbox.id)).toEqual({ ok: false, reason: 'not_found' });
    expect(await svc.remove(w2, made.mailbox.id)).toBe(false); expect(await svc.remove(w, made.mailbox.id)).toBe(true);
  });
});
