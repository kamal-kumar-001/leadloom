import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { APOLLO_BASIC_LOOKUP_OPTIONS } from '../../apollo-evidence';
import { ApolloConnector } from '../apollo.connector';

/**
 * Apollo contract suite over the SYNTHETIC doc-derived fixtures in
 * fixtures/apollo/ (see PROVENANCE.md there - never recorded provider
 * traffic; the connector stays 'fixture-tested', not live-verified).
 * Covers the request contract the connector emits and every response branch
 * it maps. Live Apollo behavior remains unverified until Kamal approves
 * provider calls with his own keys.
 */

const fixture = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/apollo/${name}`, import.meta.url)), 'utf8'));

const PERSON = {firstName:'Jordan',lastName:'Blake'};
const CTX = { apiKey: 'test-apollo-key-123' };

function mockFetchWith(body: unknown, status = 200) {
  const calls: { url: string; init: any }[] = [];
  const fn = vi.fn().mockImplementation(async (url: string, init: any) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
  return { fn, calls };
}

describe('ApolloConnector contract (synthetic fixtures)', () => {
  it('emits the documented request: POST /api/v1/people/match, X-Api-Key header, snake_case body', async () => {
    const { fn, calls } = mockFetchWith(fixture('match-none.json'));
    const apollo = new ApolloConnector();
    await apollo.run(
      { domain: 'northstar.example', firstName: 'Jordan', lastName: 'Blake', organizationName: 'Northstar Analytics', email: 'j@northstar.example' },
      { ...CTX, fetch: fn as any },
    );
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toBe('https://api.apollo.io/api/v1/people/match');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Api-Key']).toBe('test-apollo-key-123');
    expect(JSON.parse(init.body)).toEqual({
      domain: 'northstar.example',
      first_name: 'Jordan',
      last_name: 'Blake',
      organization_name: 'Northstar Analytics',
      email: 'j@northstar.example',
      ...APOLLO_BASIC_LOOKUP_OPTIONS,
    });
    // Recorded contract state (2026-11-20 docs): no reveal flags are sent, so
    // PERSONAL emails are withheld by default; whether work emails return by
    // default is not established by the fetched page and is not inferred.
    // Reveal flags stay disabled (credit spend is Kamal's call). PROVENANCE.md.
    expect(JSON.parse(init.body).reveal_personal_emails).toBe(false);
    expect(JSON.parse(init.body).run_waterfall_email).toBe(false);
  });

  it('verified email maps fields but missing identity-match evidence is not invented', async () => {
    const { fn } = mockFetchWith(fixture('match-verified.json'));
    const res = await new ApolloConnector().run({ domain: 'northstar.example', ...PERSON }, { ...CTX, fetch: fn as any });
    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({
      email: 'jordan.blake@northstar.example',
      emailStatus: 'verified',
      firstName: 'Jordan',
      lastName: 'Blake',
      title: 'VP Engineering',
      organizationName: 'Northstar Analytics',
      linkedinUrl: 'https://www.linkedin.com/in/jordan-blake-example',
      confidence: 0,
      matchConfidence:'unknown',
    });
  });

  it('email status is preserved without inventing absent match confidence', async () => {
    const apollo = new ApolloConnector();
    const ext = await apollo.run({ domain: 'x.example', ...PERSON }, { ...CTX, fetch: mockFetchWith(fixture('match-extrapolated.json')).fn as any });
    expect(ext.data?.emailStatus).toBe('extrapolated');
    expect(ext.data?.confidence).toBe(0);
    const cat = await apollo.run({ domain: 'x.example', ...PERSON }, { ...CTX, fetch: mockFetchWith(fixture('match-catchall.json')).fn as any });
    expect(cat.data?.emailStatus).toBe('catchall');
    expect(cat.data?.confidence).toBe(0);
  });

  it('no match (person null) is a successful empty result, never an error and never invented data', async () => {
    const res = await new ApolloConnector().run({ domain: 'nobody.example', ...PERSON }, { ...CTX, fetch: mockFetchWith(fixture('match-none.json')).fn as any });
    expect(res.success).toBe(true);
    expect(res.data?.email).toBeNull();
    expect(res.data?.emailStatus).toBeNull();
    expect(res.data?.confidence).toBe(0);
  });

  it('person without email (one documented possible shape: personal-email-only record) maps names but null email', async () => {
    const res = await new ApolloConnector().run({ domain: 'northstar.example', ...PERSON }, { ...CTX, fetch: mockFetchWith(fixture('match-no-email.json')).fn as any });
    expect(res.success).toBe(true);
    expect(res.data?.email).toBeNull();
    expect(res.data?.firstName).toBe('Jordan');
    expect(res.data?.organizationName).toBe('Northstar Analytics');
    expect(res.data?.confidence).toBe(0);
  });

  it('429 maps to retryable RATE_LIMITED', async () => {
    const res = await new ApolloConnector().run({ domain: 'x.example', ...PERSON }, { ...CTX, fetch: mockFetchWith({}, 429).fn as any });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('RATE_LIMITED');
    expect(res.error?.retryable).toBe(true);
  });

  it('5xx retryable PROVIDER_ERROR; 4xx (non-429) non-retryable', async () => {
    const apollo = new ApolloConnector();
    const s500 = await apollo.run({ domain: 'x.example', ...PERSON }, { ...CTX, fetch: mockFetchWith({}, 500).fn as any });
    expect(s500.error?.code).toBe('PROVIDER_ERROR');
    expect(s500.error?.retryable).toBe(true);
    const s403 = await apollo.run({ domain: 'x.example', ...PERSON }, { ...CTX, fetch: mockFetchWith({}, 403).fn as any });
    expect(s403.error?.code).toBe('PROVIDER_ERROR');
    expect(s403.error?.retryable).toBe(false);
  });

  it('network failure maps to NETWORK_ERROR and never leaks the API key into the message', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED using key test-apollo-key-123'));
    const res = await new ApolloConnector().run({ domain: 'x.example', ...PERSON }, { ...CTX, fetch: fn as any });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('NETWORK_ERROR');
    expect(res.error?.retryable).toBe(false);
    expect(res.error?.message).not.toContain('test-apollo-key-123');
  });

  it('fails closed without a credential and on empty input', async () => {
    const apollo = new ApolloConnector();
    const noKey = await apollo.run({ domain: 'x.example', ...PERSON }, {});
    expect(noKey.error?.code).toBe('MISSING_CREDENTIAL');
    expect(noKey.error?.retryable).toBe(false);
    const noInput = await apollo.run({}, { ...CTX });
    expect(noInput.error?.code).toBe('INVALID_INPUT');
  });
});
