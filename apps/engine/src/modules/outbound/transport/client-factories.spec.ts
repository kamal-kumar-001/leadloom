import { describe, expect, it } from 'vitest';
import { buildReadOptions, buildImapOptions, buildSmtpOptions, buildSendOptions } from './client-factories';

const BASE = { host: 'smtp.provider.test', port: 587, user: 'sales@brand.test' };

describe('client option mapping', () => {
  it('builds generic OAuth2 SMTP options with bounded timeouts', () => {
    const o: any = buildSmtpOptions({ ...BASE, authType: 'oauth2', accessToken: 'tok' });
    expect(o.auth).toEqual({ type: 'OAuth2', user: 'sales@brand.test', accessToken: 'tok' });
    expect(o.secure).toBe(false);
    expect(o.connectionTimeout).toBeGreaterThan(0);
    expect(o.socketTimeout).toBeGreaterThan(0);
  });
  it('builds password SMTP options and marks port 465 secure', () => {
    const o: any = buildSmtpOptions({ ...BASE, port: 465, authType: 'password', password: 'secret' });
    expect(o.auth).toEqual({ user: 'sales@brand.test', pass: 'secret' });
    expect(o.secure).toBe(true);
  });
  it('builds IMAP options without logging credentials', () => {
    const o: any = buildImapOptions({ ...BASE, port: 993, authType: 'oauth2', accessToken: 'tok' });
    expect(o.secure).toBe(true);
    expect(o.logger).toBe(false);
    expect(o.auth.user).toBe('sales@brand.test');
  });
  it('rejects incomplete configs without opening a connection', () => {
    expect(() => buildSmtpOptions({ ...BASE, authType: 'oauth2' })).toThrow('access token');
    expect(() => buildSmtpOptions({ ...BASE, authType: 'password' })).toThrow('password');
    expect(() => buildImapOptions({ ...BASE, host: '', authType: 'oauth2', accessToken: 't' })).toThrow('host');
  });

  it('refuses the plaintext test hook for non-loopback hosts and in production', () => {
    const cfg = { ...BASE, port: 143, authType: 'password' as const, password: 'p', plaintextForTestsOnly: true };
    expect(() => buildImapOptions({ ...cfg, host: 'mail.example.com' })).toThrow('plaintext IMAP is refused');
    const prev = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
    try { expect(() => buildImapOptions({ ...cfg, host: '127.0.0.1' })).toThrow('plaintext IMAP is refused'); } finally { process.env.NODE_ENV = prev; }
    expect((buildImapOptions({ ...cfg, host: '127.0.0.1' }) as any).secure).toBe(false);
  });

  it('poller connection is strict: public-only, pinned IP, SNI, TLS 1.2+, STARTTLS on 143, port allow-list', async () => {
    const cfg = { ...BASE, host: 'mail.example.org', port: 143, authType: 'password' as const, password: 'p' };
    const o: any = await buildReadOptions(cfg, { resolve: async () => ['93.184.216.34'] });
    expect(o.host).toBe('93.184.216.34'); expect(o.servername).toBe('mail.example.org'); expect(o.doSTARTTLS).toBe(true);
    expect(o.secure).toBe(false); expect(o.tls).toMatchObject({ rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: 'mail.example.org' });
    expect(((await buildReadOptions({ ...cfg, port: 993 }, { resolve: async () => ['93.184.216.34'] })) as any).secure).toBe(true);
    await expect(buildReadOptions(cfg, { resolve: async () => ['10.0.0.5'] })).rejects.toThrow('public host');
    await expect(buildReadOptions(cfg, { resolve: async () => ['93.184.216.34', '192.168.1.5'] })).rejects.toThrow('public host');
    await expect(buildReadOptions({ ...cfg, host: '127.0.0.1' }, { resolve: async () => ['93.184.216.34'] })).rejects.toThrow('public host');
    await expect(buildReadOptions({ ...cfg, port: 22 })).rejects.toThrow('port not allowed');
  });
});

describe('buildSendOptions (worker SMTP send path)', () => {
  const cfg = { host: 'smtp.provider.test', port: 587, user: 'sales@brand.test', authType: 'password' as const, password: 'p' };

  it('strict path: port allow-list, pinned public IP, SNI on the original host, TLS 1.2+, STARTTLS required on 587', async () => {
    const o: any = await buildSendOptions(cfg, { resolve: async () => ['93.184.216.34'] });
    expect(o.host).toBe('93.184.216.34');
    expect(o.port).toBe(587);
    expect(o.secure).toBe(false);
    expect(o.requireTLS).toBe(true);
    expect(o.tls.servername).toBe('smtp.provider.test');
    expect(o.tls.rejectUnauthorized).toBe(true);
    expect(o.tls.minVersion).toBe('TLSv1.2');
  });

  it('strict path: implicit TLS on 465, connectTo remap honored, refused port never dials', async () => {
    const o: any = await buildSendOptions({ ...cfg, port: 465 }, { resolve: async () => ['93.184.216.34'], connectTo: (ip) => ({ host: ip, port: 1465 }) });
    expect(o.secure).toBe(true);
    expect(o.port).toBe(1465);
    await expect(buildSendOptions({ ...cfg, port: 2526 }, { resolve: async () => ['93.184.216.34'] })).rejects.toThrow('port');
  });

  it('strict path: private or unresolvable addresses are refused before any socket', async () => {
    await expect(buildSendOptions(cfg, { resolve: async () => ['10.0.0.5'] })).rejects.toThrow('public');
    await expect(buildSendOptions(cfg, { resolve: async () => [] })).rejects.toThrow('public');
    await expect(buildSendOptions({ ...cfg, host: 'not a host' }, {})).rejects.toThrow('public');
  });

  it('plaintext fixture hook: loopback-only and refused in production', async () => {
    const plain = { ...cfg, plaintextForTestsOnly: true };
    await expect(buildSendOptions({ ...plain, host: 'smtp.provider.test' })).rejects.toThrow('plaintext SMTP is refused');
    const prev = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
    try { await expect(buildSendOptions({ ...plain, host: '127.0.0.1' })).rejects.toThrow('plaintext SMTP is refused'); } finally { process.env.NODE_ENV = prev; }
    const o: any = await buildSendOptions({ ...plain, host: '127.0.0.1', port: 2525 });
    expect(o.secure).toBe(false);
    expect(o.ignoreTLS).toBe(true);
  });

  it('dev-only allowPrivateHosts: dials the host directly without TLS requirement, refused in production', async () => {
    const o: any = await buildSendOptions({ ...cfg, host: 'localhost', port: 2525 }, { allowPrivateHosts: true });
    expect(o.host).toBe('127.0.0.1');
    expect(o.requireTLS).toBe(false);
    const prev = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
    try { await expect(buildSendOptions(cfg, { allowPrivateHosts: true })).rejects.toThrow('refused in production'); } finally { process.env.NODE_ENV = prev; }
  });
});
