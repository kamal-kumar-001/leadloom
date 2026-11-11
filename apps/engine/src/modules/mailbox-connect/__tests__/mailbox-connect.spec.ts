import { describe, expect, it } from 'vitest';
import { MailboxConnectService, type MailboxConnectStore } from '../mailbox-connect.service';
import { checkMailHost, isPrivateAddress, resolvePublic } from '../host-policy';
import { classify } from '../verifier';

const pub = ({ _pw, ...r }: any) => r; // like the real store: the secret is never selected
class Mem implements MailboxConnectStore {
  rows = new Map<string, any>();
  async create(w: string, ep: any, at: Date) { const k = w + ep.email; if (this.rows.has(k)) return null; const r = { id: 'm' + this.rows.size, email: ep.email, connectionStatus: 'ok', connectionErrorCode: null, connectionCheckedAt: at, _pw: ep.password }; this.rows.set(k, r); return pub(r); }
  async loadEndpoint(w: string, id: string) { const r = [...this.rows.entries()].find(([k, v]) => k.startsWith(w) && v.id === id)?.[1]; return r ? { email: r.email, password: r._pw, smtpHost: 'smtp.example.test', smtpPort: 587, imapHost: 'imap.example.test', imapPort: 993 } : null; }
  async recordCheck(w: string, id: string, status: any, code: any, at: Date) { const r = [...this.rows.entries()].find(([k, v]) => k.startsWith(w) && v.id === id)?.[1]; if (!r) return null; Object.assign(r, { connectionStatus: status, connectionErrorCode: code, connectionCheckedAt: at }); return pub(r); }
  async remove(w: string, id: string) { for (const [k, v] of this.rows) if (k.startsWith(w) && v.id === id) return this.rows.delete(k); return false; }
}
const good = { verify: async () => ({ smtp: 'ok' as const, imap: 'ok' as const }) };
const input = { email: ' Me@Example.Test ', password: 'abcd efgh ijkl mnop', smtpHost: 'smtp.example.test', smtpPort: 587, imapHost: 'imap.example.test', imapPort: 993 };
const resolver = { allowPrivateHosts: true };

describe('mailbox connect', () => {
  it('stores nothing when the login check fails, and never echoes the password', async () => {
    const st = new Mem(); const svc = new MailboxConnectService(st, { verify: async () => ({ smtp: 'auth_failed', imap: 'ok' }) }, resolver);
    const r = await svc.connect('w1', input);
    expect(r).toMatchObject({ ok: false, reason: 'connection_failed', result: { smtp: 'auth_failed' } });
    expect(JSON.stringify(r)).not.toContain('abcd'); expect(st.rows.size).toBe(0);
  });
  it('connects, lowercases the address, rejects duplicates per workspace', async () => {
    const st = new Mem(); const svc = new MailboxConnectService(st, good, resolver);
    const r = await svc.connect('w1', input); expect(r.ok && r.mailbox.email).toBe('me@example.test');
    expect(JSON.stringify(r)).not.toContain('abcd');
    expect(await svc.connect('w1', input)).toEqual({ ok: false, reason: 'already_connected' });
    expect((await svc.connect('w2', input)).ok).toBe(true);
  });
  it('validates email, password and ports before any network call', async () => {
    let calls = 0; const svc = new MailboxConnectService(new Mem(), { verify: async () => { calls++; return { smtp: 'ok', imap: 'ok' }; } }, resolver);
    expect((await svc.connect('w', { ...input, email: 'nope' }))).toEqual({ ok: false, reason: 'invalid_email' });
    expect((await svc.connect('w', { ...input, password: '' }))).toEqual({ ok: false, reason: 'invalid_password' });
    expect((await svc.connect('w', { ...input, smtpPort: 22 }))).toEqual({ ok: false, reason: 'invalid_port' });
    expect((await svc.connect('w', { ...input, imapPort: 5432 }))).toEqual({ ok: false, reason: 'invalid_port' });
    expect(calls).toBe(0);
  });
  it('test records failure with a fixed code and not_found for another workspace', async () => {
    const st = new Mem(); let v: any = good; const svc = new MailboxConnectService(st, { verify: (e) => v.verify(e) }, resolver);
    const made: any = await svc.connect('w1', input);
    v = { verify: async () => ({ smtp: 'ok', imap: 'timeout' }) };
    const t: any = await svc.test('w1', made.mailbox.id); expect(t.mailbox).toMatchObject({ connectionStatus: 'failed', connectionErrorCode: 'imap_timeout' });
    expect(await svc.test('w2', made.mailbox.id)).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('host policy (no internal network probing)', () => {
  it('flags private ranges', () => { for (const a of ['127.0.0.1', '10.1.2.3', '172.19.0.4', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1']) expect(isPrivateAddress(a), a).toBe(true); expect(isPrivateAddress('8.8.8.8')).toBe(false); });
  it('refuses special IPv6/IPv4 forms and allows public ones', () => { for (const a of ['::ffff:7f00:1', '::ffff:a00:1', '64:ff9b::a00:1', '2002:7f00:1::1', 'fe80::1', 'fec0::1', 'ff02::1', '2001:db8::1', '2001::1', '::', '0:0:0:0:0:ffff:127.0.0.1', '198.18.0.1', '192.0.2.5', 'notanip']) expect(isPrivateAddress(a), a).toBe(true); for (const a of ['2606:4700:4700::1111', '2a00:1450:4001::1', '142.250.1.1']) expect(isPrivateAddress(a), a).toBe(false); });
  it('pins the resolved public address and refuses mixed answers', async () => { expect(await resolvePublic('mail.example.com', async () => ['8.8.8.8', '2606:4700:4700::1111'])).toBe('8.8.8.8'); expect(await resolvePublic('mail.example.com', async () => ['8.8.8.8', '10.0.0.1'])).toBeNull(); expect(await resolvePublic('1.2.3.4')).toBeNull(); });
  it('strict verifier never opens a socket to a private or literal host', async () => { const { RealConnectionVerifier } = await import('../verifier'); const r = await new RealConnectionVerifier().verify({ email: 'a@b.co', password: 'x', smtpHost: '127.0.0.1', smtpPort: 587, imapHost: 'localhost', imapPort: 993 }); expect(r).toEqual({ smtp: 'unreachable', imap: 'unreachable' }); });
  it('refuses IP literals, private resolutions and odd ports in production mode', async () => {
    const pub = async () => ['142.250.1.1']; const priv = async () => ['172.19.0.3'];
    expect(await checkMailHost('127.0.0.1', 587, [587], false, pub)).toEqual({ ok: false, code: 'invalid_host' });
    expect(await checkMailHost('localhost', 587, [587], false, pub)).toEqual({ ok: false, code: 'invalid_host' });
    expect(await checkMailHost('postgres.internal.example', 587, [587], false, priv)).toEqual({ ok: false, code: 'private_host' });
    expect(await checkMailHost('smtp.example.com', 5432, [587], false, pub)).toEqual({ ok: false, code: 'invalid_port' });
    expect(await checkMailHost('smtp.example.com', 587, [587], false, pub)).toEqual({ ok: true });
  });
});

describe('error classification never leaks text', () => {
  it('maps to fixed codes', () => {
    expect(classify({ responseCode: 535, message: 'bad pass hunter2' })).toBe('auth_failed');
    expect(classify({ code: 'ECONNREFUSED' })).toBe('unreachable');
    expect(classify({ code: 'ETIMEDOUT' })).toBe('timeout');
    expect(classify({ message: 'self signed certificate' })).toBe('tls_error');
    expect(classify(new Error('boom'))).toBe('failed');
  });
});
