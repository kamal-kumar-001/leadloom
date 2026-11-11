import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { createImapflowClient } from './client-factories';

/** Gated: LEADLOOM_INTEGRATION=1 and LEADLOOM_SMTP_SERVER_MODULE (package.json path whose node_modules has hoodiecrow-imap). Local plain IMAP fixture only; never a live mailbox. */
const MOD = process.env.LEADLOOM_SMTP_SERVER_MODULE;
const RUN = process.env.LEADLOOM_INTEGRATION === '1' && Boolean(MOD);

function raw(n: number, body = 'hello ' + n) {
  return `Message-ID: <m${n}@example.test>\r\nFrom: a${n}@example.test\r\nTo: me@example.test\r\nSubject: s${n}\r\nDate: Mon, 02 Nov 2026 10:0${n % 10}:00 +0000\r\n\r\n${body}\r\n`;
}

describe.runIf(RUN)('IMAP read-only sync against a local hoodiecrow fixture (gated)', () => {
  it('fetches by uid, bounded, read-only (no \\Seen), body capped, continues from last uid', async () => {
    const hc = createRequire(MOD!)('hoodiecrow-imap');
    const messages = [1, 2, 3, 4, 5].map((n) => ({ raw: raw(n, n === 3 ? 'x'.repeat(500) : undefined), flags: [] as string[] }));
    const imap = hc({ users: { u: { password: 'p' } }, storage: { INBOX: { messages } } });
    await new Promise<void>((r) => imap.listen(2144, '127.0.0.1', () => r()));
    try {
      const client = await createImapflowClient({ host: '127.0.0.1', port: 2143 + 1, user: 'u', password: 'p', authType: 'password', plaintextForTestsOnly: true } as any, { maxBatch: 2, maxBodyChars: 100 });
      const first = await client.fetchSince(0);
      expect(first.map((m) => m.uid)).toEqual([1, 2]);
      const next = await client.fetchSince(2);
      expect(next.map((m) => m.uid)).toEqual([3, 4]);
      expect(next[0].bodyText.length).toBeLessThanOrEqual(100);
      expect((await client.fetchSince(5)).length).toBe(0);
      const { ImapFlow } = await import('imapflow');
      const probe = new ImapFlow({ host: '127.0.0.1', port: 2144, secure: false, auth: { user: 'u', pass: 'p' }, logger: false } as any);
      await probe.connect(); await probe.mailboxOpen('INBOX', { readOnly: true });
      const flags: string[] = [];
      for await (const m of probe.fetch('1:*', { flags: true })) flags.push(...Array.from(m.flags ?? []));
      await probe.logout();
      expect(flags).not.toContain('\\Seen');
    } finally { imap.close?.(); }
  });
});
