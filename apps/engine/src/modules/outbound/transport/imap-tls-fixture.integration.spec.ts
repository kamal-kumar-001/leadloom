import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReadOptions, createImapflowClient, type MailboxClientConfig } from './client-factories';

/**
 * Gated (LEADLOOM_INTEGRATION=1 + LEADLOOM_SMTP_SERVER_MODULE): proves the STRICT poller
 * connection path against a real local TLS IMAP fixture - never a live mailbox.
 * The test hooks remap only the final dial target to loopback; every policy decision
 * (port allow-list, public-only resolve, IP pinning, SNI against the configured host,
 * CA validation, TLS 1.2+, STARTTLS on 143) runs for real. Unprivileged sandboxes cannot
 * bind 993/143, which is why the remap exists.
 */
const MOD = process.env.LEADLOOM_SMTP_SERVER_MODULE;
const RUN = process.env.LEADLOOM_INTEGRATION === '1' && Boolean(MOD);

const HOST = 'mail.example.test';
const PUBLIC_IP = '8.8.8.8'; // stand-in for "a public IP" returned by DNS (never dialed: the hook remaps the dial target)

function raw(n: number) {
  return `Message-ID: <tls${n}@example.test>\r\nFrom: a@example.test\r\nTo: me@example.test\r\nSubject: tls ${n}\r\nDate: Tue, 10 Nov 2026 10:00:00 +0000\r\n\r\nhello tls ${n}\r\n`;
}

function makeCerts(dir: string, cn: string) {
  const key = path.join(dir, `${cn}.key.pem`);
  const cert = path.join(dir, `${cn}.cert.pem`);
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-keyout', key, '-out', cert,
    '-days', '3650', '-nodes', '-subj', `/CN=${cn}`, '-addext', `subjectAltName=DNS:${cn}`,
  ], { stdio: 'ignore' });
  return { key: fs.readFileSync(key, 'utf8'), cert: fs.readFileSync(cert, 'utf8') };
}

function config(port: number): MailboxClientConfig {
  return { host: HOST, port, user: 'u', password: 'p', authType: 'password' } as MailboxClientConfig;
}

describe.runIf(RUN)('strict TLS poller path against a local TLS IMAP fixture (gated)', () => {
  it('993 path: pins IP, validates SNI + CA, fetches read-only over TLS', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leadloom-tls-'));
    const { key, cert } = makeCerts(dir, HOST);
    const hc = createRequire(MOD!)('hoodiecrow-imap');
    const imap = hc({
      secureConnection: true,
      credentials: { key, cert },
      users: { u: { password: 'p' } },
      storage: { INBOX: { messages: [{ raw: raw(1), flags: [] }] } },
    });
    await new Promise<void>((r) => imap.listen(2146, '127.0.0.1', () => r()));
    try {
      const hooks = { resolve: async () => [PUBLIC_IP], ca: cert, connectTo: () => ({ host: '127.0.0.1', port: 2146 }) };
      const opts = await buildReadOptions(config(993), hooks);
      expect(opts.host).toBe('127.0.0.1');
      expect(opts.port).toBe(2146);
      expect(opts.servername).toBe(HOST);
      expect(opts.secure).toBe(true);
      expect((opts.tls as { minVersion: string }).minVersion).toBe('TLSv1.2');

      const client = await createImapflowClient(config(993), {}, hooks);
      const batch = await client.fetchBatch!(0);
      expect(batch.messages.map((m) => m.subject)).toEqual(['tls 1']);
      expect(typeof batch.uidValidity).toBe('number');
    } finally { imap.close?.(); }
  }, 30_000);

  it('rejects the fixture when the CA does not match (rejectUnauthorized stays on)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leadloom-tls-'));
    const { key, cert } = makeCerts(dir, HOST);
    const wrong = makeCerts(dir, 'other.example.test');
    const hc = createRequire(MOD!)('hoodiecrow-imap');
    const imap = hc({
      secureConnection: true,
      credentials: { key, cert },
      users: { u: { password: 'p' } },
      storage: { INBOX: { messages: [{ raw: raw(2), flags: [] }] } },
    });
    await new Promise<void>((r) => imap.listen(2148, '127.0.0.1', () => r()));
    try {
      const hooks = { resolve: async () => [PUBLIC_IP], ca: wrong.cert, connectTo: () => ({ host: '127.0.0.1', port: 2148 }) };
      const client = await createImapflowClient(config(993), {}, hooks);
      await expect(client.fetchBatch!(0)).rejects.toThrow();
    } finally { imap.close?.(); }
  }, 30_000);

  it('143 path: requires STARTTLS and upgrades before login', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leadloom-tls-'));
    const { key, cert } = makeCerts(dir, HOST);
    const hc = createRequire(MOD!)('hoodiecrow-imap');
    const imap = hc({
      plugins: ['STARTTLS'],
      secureConnection: false,
      credentials: { key, cert },
      users: { u: { password: 'p' } },
      storage: { INBOX: { messages: [{ raw: raw(3), flags: [] }] } },
    });
    await new Promise<void>((r) => imap.listen(2147, '127.0.0.1', () => r()));
    try {
      const hooks = { resolve: async () => [PUBLIC_IP], ca: cert, connectTo: () => ({ host: '127.0.0.1', port: 2147 }) };
      const opts = await buildReadOptions(config(143), hooks);
      expect(opts.secure).toBe(false);
      expect(opts.doSTARTTLS).toBe(true);

      const client = await createImapflowClient(config(143), {}, hooks);
      const batch = await client.fetchBatch!(0);
      expect(batch.messages.map((m) => m.subject)).toEqual(['tls 3']);
    } finally { imap.close?.(); }
  }, 30_000);

  it('still refuses a non-public DNS answer even with a socket remap hook', async () => {
    const hooks = { resolve: async () => ['10.0.0.5'], connectTo: () => ({ host: '127.0.0.1', port: 2146 }) };
    await expect(buildReadOptions(config(993), hooks)).rejects.toThrow(/public/i);
  });
});
