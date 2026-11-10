import { describe, expect, it } from 'vitest';
import { buildImapOptions, buildSmtpOptions } from './client-factories';

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
});
