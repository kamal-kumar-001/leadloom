import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NeverBounceConnector } from '../neverbounce.connector';

/** NeverBounce contract suite over SYNTHETIC doc-derived fixtures
 *  (fixtures/neverbounce/PROVENANCE.md - never recorded provider traffic). */

const fixture = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/neverbounce/${name}`, import.meta.url)), 'utf8'));
const CTX = { apiKey: 'test-nb-key-321' };

function mockFetchWith(body: unknown, status = 200) {
  const calls: { url: string; init: any }[] = [];
  const fn = vi.fn().mockImplementation(async (url: string, init: any) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
  return { fn, calls };
}

describe('NeverBounceConnector contract (synthetic fixtures)', () => {
  it('emits GET /v4.2/single/check with email and key query params', async () => {
    const { fn, calls } = mockFetchWith(fixture('check-valid.json'));
    await new NeverBounceConnector().run({ email: 'jordan@northstar.example' }, { ...CTX, fetch: fn as any });
    const u = new URL(calls[0].url);
    expect(u.origin + u.pathname).toBe('https://api.neverbounce.com/v4.2/single/check');
    expect(u.searchParams.get('email')).toBe('jordan@northstar.example');
    expect(u.searchParams.get('key')).toBe('test-nb-key-321');
  });

  it('valid maps with documented flags preserved and confidence 0.95', async () => {
    const res = await new NeverBounceConnector().run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith(fixture('check-valid.json')).fn as any });
    expect(res.success).toBe(true);
    expect(res.data?.result).toBe('valid');
    expect(res.data?.confidence).toBe(0.95);
    expect(res.data?.flags).toEqual(['has_dns', 'has_dns_mx', 'smtp_connectable']);
  });

  it('disposable maps at 0.99; catchall drops to 0.4; unknown result code maps to unknown at 0.3', async () => {
    const nb = new NeverBounceConnector();
    const dis = await nb.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith(fixture('check-disposable.json')).fn as any });
    expect(dis.data?.result).toBe('disposable');
    expect(dis.data?.confidence).toBe(0.99);
    const cat = await nb.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith(fixture('check-catchall.json')).fn as any });
    expect(cat.data?.result).toBe('catchall');
    expect(cat.data?.confidence).toBe(0.4);
    const unk = await nb.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith({ status: 'success', result: 'something_new' }).fn as any });
    expect(unk.data?.result).toBe('unknown');
    expect(unk.data?.confidence).toBe(0.3);
  });

  it('429 retryable RATE_LIMITED; 5xx retryable PROVIDER_ERROR; 4xx non-retryable', async () => {
    const nb = new NeverBounceConnector();
    expect((await nb.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith({}, 429).fn as any })).error?.code).toBe('RATE_LIMITED');
    const s503 = await nb.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith({}, 503).fn as any });
    expect(s503.error?.retryable).toBe(true);
    const s422 = await nb.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith({}, 422).fn as any });
    expect(s422.error?.retryable).toBe(false);
  });

  it('network failure never leaks the API key; missing credential and missing email fail closed', async () => {
    const nb = new NeverBounceConnector();
    const fn = vi.fn().mockRejectedValue(new Error('timeout key=test-nb-key-321'));
    const res = await nb.run({ email: 'a@b.example' }, { ...CTX, fetch: fn as any });
    expect(res.error?.code).toBe('NETWORK_ERROR');
    expect(res.error?.message).not.toContain('test-nb-key-321');
    expect((await nb.run({ email: 'a@b.example' }, {})).error?.code).toBe('MISSING_CREDENTIAL');
    expect((await nb.run({}, { ...CTX })).error?.code).toBe('INVALID_INPUT');
  });
});
