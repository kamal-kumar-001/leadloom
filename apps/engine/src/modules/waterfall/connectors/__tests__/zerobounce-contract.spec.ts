import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ZeroBounceConnector } from '../zerobounce.connector';

/** ZeroBounce contract suite over SYNTHETIC doc-derived fixtures
 *  (fixtures/zerobounce/PROVENANCE.md - never recorded provider traffic). */

const fixture = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/zerobounce/${name}`, import.meta.url)), 'utf8'));
const CTX = { apiKey: 'test-zb-key-789' };

function mockFetchWith(body: unknown, status = 200) {
  const calls: { url: string; init: any }[] = [];
  const fn = vi.fn().mockImplementation(async (url: string, init: any) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
  return { fn, calls };
}

describe('ZeroBounceConnector contract (synthetic fixtures)', () => {
  it('emits GET /v2/validate with email, api_key and optional ip_address query params', async () => {
    const { fn, calls } = mockFetchWith(fixture('validate-valid.json'));
    await new ZeroBounceConnector().run(
      { email: 'jordan.blake@northstar.example', ipAddress: '203.0.113.10' },
      { ...CTX, fetch: fn as any },
    );
    const u = new URL(calls[0].url);
    expect(u.origin + u.pathname).toBe('https://api.zerobounce.com/v2/validate');
    expect(u.searchParams.get('email')).toBe('jordan.blake@northstar.example');
    expect(u.searchParams.get('api_key')).toBe('test-zb-key-789');
    expect(u.searchParams.get('ip_address')).toBe('203.0.113.10');
    expect(calls[0].init.method).toBe('GET');
  });

  it('valid maps with confidence 0.98, string mx_found/free_email coerced to booleans', async () => {
    const res = await new ZeroBounceConnector().run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith(fixture('validate-valid.json')).fn as any });
    expect(res.success).toBe(true);
    expect(res.data?.status).toBe('valid');
    expect(res.data?.confidence).toBe(0.98);
    expect(res.data?.subStatus).toBe('alias_address');
    expect((res.data as any)?.mxFound).toBe(true);
    expect((res.data as any)?.freeEmail).toBe(false);
  });

  it('catch-all drops confidence to 0.4', async () => {
    const res = await new ZeroBounceConnector().run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith(fixture('validate-catch-all.json')).fn as any });
    expect(res.data?.status).toBe('catch-all');
    expect(res.data?.confidence).toBe(0.4);
  });

  it('invalid with possible_typo surfaces the did_you_mean correction', async () => {
    const res = await new ZeroBounceConnector().run({ email: 'jordn.blake@northstar.example' }, { ...CTX, fetch: mockFetchWith(fixture('validate-invalid-typo.json')).fn as any });
    expect(res.data?.status).toBe('invalid');
    expect(res.data?.didYouMean).toBe('jordan.blake@northstar.example');
  });

  it('429 retryable RATE_LIMITED; 5xx retryable PROVIDER_ERROR; 4xx non-retryable', async () => {
    const zb = new ZeroBounceConnector();
    expect((await zb.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith({}, 429).fn as any })).error?.retryable).toBe(true);
    const s500 = await zb.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith({}, 500).fn as any });
    expect(s500.error?.code).toBe('PROVIDER_ERROR');
    expect(s500.error?.retryable).toBe(true);
    const s400 = await zb.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith({}, 400).fn as any });
    expect(s400.error?.retryable).toBe(false);
  });

  it('network failure never leaks the API key; missing credential and missing email fail closed', async () => {
    const zb = new ZeroBounceConnector();
    const fn = vi.fn().mockRejectedValue(new Error('socket error auth=test-zb-key-789'));
    const res = await zb.run({ email: 'a@b.example' }, { ...CTX, fetch: fn as any });
    expect(res.error?.code).toBe('NETWORK_ERROR');
    expect(res.error?.message).not.toContain('test-zb-key-789');
    expect((await zb.run({ email: 'a@b.example' }, {})).error?.code).toBe('MISSING_CREDENTIAL');
    expect((await zb.run({}, { ...CTX })).error?.code).toBe('INVALID_INPUT');
  });
});
