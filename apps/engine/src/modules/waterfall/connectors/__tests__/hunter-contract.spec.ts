import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HunterConnector } from '../hunter.connector';

/**
 * Hunter contract suite over SYNTHETIC doc-derived fixtures (fixtures/hunter/
 * PROVENANCE.md - never recorded provider traffic; 'fixture-tested' stays).
 */

const fixture = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/hunter/${name}`, import.meta.url)), 'utf8'));

const CTX = { apiKey: 'test-hunter-key-456' };

function mockFetchWith(body: unknown, status = 200) {
  const calls: { url: string; init: any }[] = [];
  const fn = vi.fn().mockImplementation(async (url: string, init: any) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
  return { fn, calls };
}

describe('HunterConnector contract (synthetic fixtures)', () => {
  it('emits the documented request: GET /v2/email-finder with snake_case query params and the API key header', async () => {
    const { fn, calls } = mockFetchWith(fixture('finder-not-found.json'));
    await new HunterConnector().run(
      { domain: 'northstar.example', company: 'Northstar Analytics', firstName: 'Jordan', lastName: 'Blake', fullName: 'Jordan Blake' },
      { ...CTX, fetch: fn as any },
    );
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://api.hunter.io/v2/email-finder');
    expect(u.searchParams.get('domain')).toBe('northstar.example');
    expect(u.searchParams.get('company')).toBe('Northstar Analytics');
    expect(u.searchParams.get('first_name')).toBe('Jordan');
    expect(u.searchParams.get('last_name')).toBe('Blake');
    expect(u.searchParams.get('full_name')).toBe('Jordan Blake');
    expect(init.method).toBe('GET');
    // Header auth is doc-verified (Authentication section, fetched
    // 2026-11-20): api_key query param, X-API-KEY header or Bearer all work.
    expect(init.headers['X-API-KEY']).toBe('test-hunter-key-456');
  });

  it('found + valid maps fields and score/100 confidence', async () => {
    const res = await new HunterConnector().run({ domain: 'northstar.example' }, { ...CTX, fetch: mockFetchWith(fixture('finder-found.json')).fn as any });
    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({
      email: 'jordan.blake@northstar.example',
      score: 97,
      verificationStatus: 'valid',
      position: 'VP Engineering',
      company: 'Northstar Analytics',
      confidence: 0.97,
    });
  });

  it('accept_all stays accept_all with its score-based confidence', async () => {
    const res = await new HunterConnector().run({ domain: 'northstar.example' }, { ...CTX, fetch: mockFetchWith(fixture('finder-accept-all.json')).fn as any });
    expect(res.data?.verificationStatus).toBe('accept_all');
    expect(res.data?.confidence).toBe(0.62);
  });

  it('no find is a successful empty result (docs: no credit charged), never an error and never invented data', async () => {
    const res = await new HunterConnector().run({ domain: 'nobody.example' }, { ...CTX, fetch: mockFetchWith(fixture('finder-not-found.json')).fn as any });
    expect(res.success).toBe(true);
    expect(res.data?.email).toBeNull();
    expect(res.data?.confidence).toBe(0);
    expect((res as any).raw?.status).toBe('not_found');
  });

  it('429 retryable RATE_LIMITED; 5xx retryable PROVIDER_ERROR; 4xx non-retryable', async () => {
    const hunter = new HunterConnector();
    const r429 = await hunter.run({ domain: 'x.example' }, { ...CTX, fetch: mockFetchWith({}, 429).fn as any });
    expect(r429.error?.code).toBe('RATE_LIMITED');
    expect(r429.error?.retryable).toBe(true);
    const r500 = await hunter.run({ domain: 'x.example' }, { ...CTX, fetch: mockFetchWith({}, 502).fn as any });
    expect(r500.error?.code).toBe('PROVIDER_ERROR');
    expect(r500.error?.retryable).toBe(true);
    const r401 = await hunter.run({ domain: 'x.example' }, { ...CTX, fetch: mockFetchWith({}, 401).fn as any });
    expect(r401.error?.code).toBe('PROVIDER_ERROR');
    expect(r401.error?.retryable).toBe(false);
  });

  it('network failure maps to NETWORK_ERROR and never leaks the API key', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('dial failed for key test-hunter-key-456'));
    const res = await new HunterConnector().run({ domain: 'x.example' }, { ...CTX, fetch: fn as any });
    expect(res.error?.code).toBe('NETWORK_ERROR');
    expect(res.error?.message).not.toContain('test-hunter-key-456');
  });

  it('fails closed without a credential and without domain/company', async () => {
    const hunter = new HunterConnector();
    const noKey = await hunter.run({ domain: 'x.example' }, {});
    expect(noKey.error?.code).toBe('MISSING_CREDENTIAL');
    const noInput = await hunter.run({}, { ...CTX });
    expect(noInput.error?.code).toBe('INVALID_INPUT');
  });
});
