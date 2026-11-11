import { describe, expect, it } from 'vitest';
import { buildReadOptions, buildImapOptions, buildSmtpOptions } from './client-factories';

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
