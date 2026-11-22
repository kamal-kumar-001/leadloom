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


describe.runIf(RUN)('IMAP header fidelity (local fixture only)',()=>{
 it('retains messages without Message-ID and retrieves folded References without mutating flags',async()=>{
  const hc=createRequire(MOD!)('hoodiecrow-imap');const messages=[{raw:'Message-ID: <refs@example.test>\r\nFrom: lead@example.test\r\nTo: me@example.test\r\nReferences: <root@example.test>\r\n <target@example.test>\r\nSubject: references only\r\n\r\nHello\r\n',flags:[]},{raw:'From: lead@example.test\r\nTo: me@example.test\r\nSubject: no message id\r\n\r\nPlease stop\r\n',flags:[]}];const imap=hc({users:{u:{password:'p'}},storage:{INBOX:{messages}}});await new Promise<void>(r=>imap.listen(2152,'127.0.0.1',r));
  try{const client=await createImapflowClient({host:'127.0.0.1',port:2152,user:'u',password:'p',authType:'password',plaintextForTestsOnly:true});const batch=await client.fetchBatch!(0);expect(batch.messages).toHaveLength(2);expect(batch.messages[0].references).toEqual(['<root@example.test> <target@example.test>']);expect(batch.messages[1]).toMatchObject({uid:2,messageId:'',fromEmail:'lead@example.test'});expect((await client.fetchSince(2))).toEqual([]);expect(messages.every(m=>!m.flags.includes('\\Seen'))).toBe(true);}finally{await new Promise<void>(r=>imap.close(r));}
 });
 it('refuses a message with no usable sender instead of silently skipping it and advancing past it',async()=>{
  const hc=createRequire(MOD!)('hoodiecrow-imap');const imap=hc({users:{u:{password:'p'}},storage:{INBOX:{messages:[{raw:'Message-ID: <no-from@example.test>\r\nSubject: missing sender\r\n\r\nUnknown author\r\n',flags:[]},{raw:raw(2),flags:[]}]}}});await new Promise<void>(r=>imap.listen(2153,'127.0.0.1',r));try{const client=await createImapflowClient({host:'127.0.0.1',port:2153,user:'u',password:'p',authType:'password',plaintextForTestsOnly:true});await expect(client.fetchBatch!(0)).rejects.toThrow('usable sender');}finally{await new Promise<void>(r=>imap.close(r));}
 });
});
