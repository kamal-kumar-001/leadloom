import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SerperConnector } from '../serper.connector';

/** Serper contract suite over SYNTHETIC implementation-derived fixtures
 *  (fixtures/serper/PROVENANCE.md - serper.dev is login-walled in fetches,
 *  shapes carried from the connector, unverified; never recorded traffic). */

const fixture = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/serper/${name}`, import.meta.url)), 'utf8'));
const CTX = { apiKey: 'test-serper-key-111' };

function mockFetchWith(body: unknown, status = 200) {
  const calls: { url: string; init: any }[] = [];
  const fn = vi.fn().mockImplementation(async (url: string, init: any) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
  return { fn, calls };
}

describe('SerperConnector contract (synthetic fixtures)', () => {
  it('emits POST /search with X-API-KEY and q/num/gl/hl body fields', async () => {
    const { fn, calls } = mockFetchWith(fixture('search-results.json'));
    await new SerperConnector().run({ query: 'northstar analytics pricing', num: 5, country: 'us', language: 'en' }, { ...CTX, fetch: fn as any });
    expect(calls[0].url).toBe('https://google.serper.dev/search');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers['X-API-KEY']).toBe('test-serper-key-111');
    expect(JSON.parse(calls[0].init.body)).toEqual({ q: 'northstar analytics pricing', num: 5, gl: 'us', hl: 'en' });
  });

  it('maps organic results and the knowledge graph; totalResults counts organic only', async () => {
    const res = await new SerperConnector().run({ query: 'northstar analytics pricing' }, { ...CTX, fetch: mockFetchWith(fixture('search-results.json')).fn as any });
    expect(res.success).toBe(true);
    expect(res.data?.organic).toHaveLength(2);
    expect(res.data?.organic[0]).toMatchObject({ title: 'Northstar Analytics - Pricing', link: 'https://northstar.example/pricing' });
    expect(res.data?.knowledgeGraph?.title).toBe('Northstar Analytics');
    expect(res.data?.totalResults).toBe(2);
  });

  it('empty organic is a successful empty result, never an error', async () => {
    const res = await new SerperConnector().run({ query: 'zz-no-such-thing' }, { ...CTX, fetch: mockFetchWith({ organic: [] }).fn as any });
    expect(res.success).toBe(true);
    expect(res.data?.organic).toEqual([]);
    expect(res.data?.totalResults).toBe(0);
  });

  it('429 retryable RATE_LIMITED; 5xx retryable PROVIDER_ERROR; 4xx non-retryable', async () => {
    const s = new SerperConnector();
    expect((await s.run({ query: 'x' }, { ...CTX, fetch: mockFetchWith({}, 429).fn as any })).error?.code).toBe('RATE_LIMITED');
    expect((await s.run({ query: 'x' }, { ...CTX, fetch: mockFetchWith({}, 500).fn as any })).error?.retryable).toBe(true);
    const s400 = await s.run({ query: 'x' }, { ...CTX, fetch: mockFetchWith({}, 400).fn as any });
    expect(s400.error?.retryable).toBe(false);
  });

  it('network failure never leaks the API key; missing credential and empty query fail closed', async () => {
    const s = new SerperConnector();
    const fn = vi.fn().mockRejectedValue(new Error('fail test-serper-key-111'));
    const res = await s.run({ query: 'x' }, { ...CTX, fetch: fn as any });
    expect(res.error?.code).toBe('NETWORK_ERROR');
    expect(res.error?.message).not.toContain('test-serper-key-111');
    expect((await s.run({ query: 'x' }, {})).error?.code).toBe('MISSING_CREDENTIAL');
    expect((await s.run({}, { ...CTX })).error?.code).toBe('INVALID_INPUT');
  });
});
