import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PdlConnector } from '../pdl.connector';

/** PDL contract suite over SYNTHETIC implementation-derived fixtures
 *  (fixtures/pdl/PROVENANCE.md - docs yielded no field reference 2026-11-20,
 *  shapes carried from the connector, unverified; never recorded traffic). */

const fixture = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/pdl/${name}`, import.meta.url)), 'utf8'));
const CTX = { apiKey: 'test-pdl-key-987' };

function mockFetchWith(body: unknown, status = 200) {
  const calls: { url: string; init: any }[] = [];
  const fn = vi.fn().mockImplementation(async (url: string, init: any) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
  return { fn, calls };
}

describe('PdlConnector contract (synthetic fixtures)', () => {
  it('emits POST /v5/person/enrich with X-Api-Key and snake_case identity fields', async () => {
    const { fn, calls } = mockFetchWith(fixture('enrich-found.json'));
    await new PdlConnector().run(
      { email: 'j@northstar.example', linkedinUrl: 'linkedin.com/in/jordan-blake-example', firstName: 'Jordan', lastName: 'Blake', company: 'Northstar Analytics' },
      { ...CTX, fetch: fn as any },
    );
    expect(calls[0].url).toBe('https://api.peopledatalabs.com/v5/person/enrich');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers['X-Api-Key']).toBe('test-pdl-key-987');
    const body = JSON.parse(calls[0].init.body);
    expect(body).toMatchObject({ email: 'j@northstar.example', profile: 'linkedin.com/in/jordan-blake-example', first_name: 'Jordan', last_name: 'Blake', company: 'Northstar Analytics' });
  });

  it('found record maps work email, title, company; work_email drives confidence 0.95', async () => {
    const res = await new PdlConnector().run({ email: 'j@northstar.example' }, { ...CTX, fetch: mockFetchWith(fixture('enrich-found.json')).fn as any });
    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({
      fullName: 'Jordan Blake',
      workEmail: 'jordan.blake@northstar.example',
      personalEmails: ['jordan.blake.personal@mail.example'],
      jobTitle: 'VP Engineering',
      companyName: 'Northstar Analytics',
      confidence: 0.95,
    });
  });

  it('404 is a successful not-found result with nulls, never an error and never invented data', async () => {
    const res = await new PdlConnector().run({ email: 'nobody@x.example' }, { ...CTX, fetch: mockFetchWith({}, 404).fn as any });
    expect(res.success).toBe(true);
    expect(res.data?.workEmail).toBeNull();
    expect(res.data?.fullName).toBeNull();
    expect(res.data?.confidence).toBe(0);
  });

  it('429 retryable RATE_LIMITED; 5xx retryable PROVIDER_ERROR; 4xx (non-404/429) non-retryable', async () => {
    const pdl = new PdlConnector();
    expect((await pdl.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith({}, 429).fn as any })).error?.code).toBe('RATE_LIMITED');
    const s500 = await pdl.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith({}, 500).fn as any });
    expect(s500.error?.retryable).toBe(true);
    const s402 = await pdl.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFetchWith({}, 402).fn as any });
    expect(s402.error?.code).toBe('PROVIDER_ERROR');
    expect(s402.error?.retryable).toBe(false);
  });

  it('network failure never leaks the API key; missing credential and empty input fail closed', async () => {
    const pdl = new PdlConnector();
    const fn = vi.fn().mockRejectedValue(new Error('boom test-pdl-key-987'));
    const res = await pdl.run({ email: 'a@b.example' }, { ...CTX, fetch: fn as any });
    expect(res.error?.code).toBe('NETWORK_ERROR');
    expect(res.error?.message).not.toContain('test-pdl-key-987');
    expect((await pdl.run({ email: 'a@b.example' }, {})).error?.code).toBe('MISSING_CREDENTIAL');
    expect((await pdl.run({}, { ...CTX })).error?.code).toBe('INVALID_INPUT');
  });
});
