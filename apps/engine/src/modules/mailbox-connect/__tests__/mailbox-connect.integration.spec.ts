import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaProvisioningStore } from '../../provisioning/prisma-provisioning-store';
import { ProvisioningService } from '../../provisioning/provisioning.service';
import { VaultService } from '../../vault/vault.service';
import { MailboxConnectService } from '../mailbox-connect.service';
import { PrismaMailboxConnectStore } from '../prisma-mailbox-connect-store';
import { RealConnectionVerifier } from '../verifier';

/** Gated: LEADLOOM_INTEGRATION=1, LEADLOOM_TEST_DATABASE_URL (migrated, throwaway) and LEADLOOM_SMTP_SERVER_MODULE (path to a package.json whose node_modules has smtp-server and hoodiecrow-imap). Local SMTP only: no real mail host is contacted. */
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

  it('real IMAP login check against a local hoodiecrow IMAP server (plain, local only): right and wrong password', async () => {
    const hc = createRequire(SMTP!)('hoodiecrow-imap'); const imap = hc({ users: { imapuser: { password: 'imappass' } } });
    await new Promise<void>((r) => imap.listen(2143, '127.0.0.1', () => r()));
    try {
      const v = new RealConnectionVerifier({ allowPrivateHosts: true });
      const ep = { email: 'imapuser', password: 'imappass', smtpHost: '127.0.0.1', smtpPort: 1, imapHost: '127.0.0.1', imapPort: 2143 };
      expect((await v.verify(ep)).imap).toBe('ok');
      expect((await v.verify({ ...ep, password: 'wrong' })).imap).toBe('auth_failed');
      expect((await v.verify({ ...ep, imapPort: 2144 })).imap).toBe('unreachable');
    } finally { imap.close?.(); }
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

  it('STRICT path (public-address policy, pinned IP, SNI, required STARTTLS, cert validation) against local TLS servers with a test CA', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mbtls-')); const HOST = 'mail.example.test';
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem'), '-days', '2', '-subj', `/CN=${HOST}`, '-addext', `subjectAltName=DNS:${HOST}`], { stdio: 'ignore' });
    const cert = readFileSync(join(dir, 'c.pem'), 'utf8'), key = readFileSync(join(dir, 'k.pem'), 'utf8');
    const { SMTPServer } = createRequire(SMTP!)('smtp-server'); const hc = createRequire(SMTP!)('hoodiecrow-imap');
    const smtp = new SMTPServer({ authOptional: false, secure: false, key, cert, onAuth(a: any, _s: any, cb: any) { a.password === PASS ? cb(null, { user: a.username }) : cb(new Error('Invalid login')); } });
    const plain = new SMTPServer({ authOptional: false, secure: false, disabledCommands: ['STARTTLS'], allowInsecureAuth: true, onAuth(a: any, _s: any, cb: any) { cb(null, { user: a.username }); } });
    const imap = hc({ plugins: ['STARTTLS'], secureConnection: false, credentials: { key, cert }, users: { u: { password: PASS } } });
    await Promise.all([new Promise<void>((r) => smtp.listen(2526, '127.0.0.1', () => r())), new Promise<void>((r) => plain.listen(2527, '127.0.0.1', () => r())), new Promise<void>((r) => imap.listen(2144, '127.0.0.1', () => r()))]);
    const mk = (over: any = {}) => new RealConnectionVerifier({ tls: { resolve: async () => ['93.184.216.34'], ca: cert, connectTo: () => '127.0.0.1', ...over } });
    const base = { email: 'u', password: PASS, smtpHost: HOST, smtpPort: 2526, imapHost: HOST, imapPort: 2144 };
    try {
      const good = await mk().verify({ ...base, password: PASS });
      expect(good.smtp).toBe('ok');
      expect((await mk().verify({ ...base, password: 'bad' })).smtp).toBe('auth_failed');
      expect((await mk({ ca: undefined }).verify(base)).smtp).toBe('tls_error'); // untrusted self-signed cert is refused
      expect((await mk().verify({ ...base, smtpHost: 'other.example.test' })).smtp).toBe('tls_error'); // SNI/hostname mismatch is refused
      expect((await mk().verify({ ...base, smtpPort: 2527 })).smtp).not.toBe('ok'); // server without STARTTLS: password is never sent in clear
      expect((await mk({ resolve: async () => ['10.0.0.5'] }).verify(base))).toEqual({ smtp: 'unreachable', imap: 'unreachable' }); // private resolution refused, no socket opened
      expect((await mk({ resolve: async () => ['8.8.8.8', '127.0.0.1'] }).verify(base)).smtp).toBe('unreachable'); // mixed answers refused
      expect(good.imap).toBe('ok'); // IMAP over mandatory STARTTLS with a trusted cert
      expect((await mk({ ca: undefined }).verify(base)).imap).toBe('tls_error');
      expect((await mk().verify({ ...base, imapHost: 'other.example.test' })).imap).toBe('tls_error');
      expect((await mk().verify({ ...base, password: 'bad' })).imap).toBe('auth_failed');
    } finally { smtp.close(); plain.close(); imap.close?.(); }
  });
});
