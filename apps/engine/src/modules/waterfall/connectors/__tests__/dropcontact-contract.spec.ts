import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DropcontactConnector } from '../dropcontact.connector';

/** Dropcontact contract suite over SYNTHETIC implementation-derived fixtures
 *  (fixtures/dropcontact/PROVENANCE.md - doc fetch FAILED 2026-11-20, shapes
 *  carried from the connector, unverified; never recorded provider traffic). */

const fixture = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/dropcontact/${name}`, import.meta.url)), 'utf8'));
const CTX = { apiKey: 'test-dc-key-654' };

/** Two-step flow: first call = submit, second = result fetch. */
function mockFlow(submitBody: unknown, resultBody: unknown, submitStatus = 200, resultStatus = 200) {
  const calls: { url: string; init: any }[] = [];
  const fn = vi.fn().mockImplementation(async (url: string, init: any) => {
    calls.push({ url, init });
    const isSubmit = init.method === 'POST';
    const status = isSubmit ? submitStatus : resultStatus;
    return { ok: status >= 200 && status < 300, status, json: async () => (isSubmit ? submitBody : resultBody) };
  });
  return { fn, calls };
}

describe('DropcontactConnector contract (synthetic fixtures)', () => {
  it('emits the two-step flow: POST /v1/enrich/all then GET /v1/enrich/all/{request_id}, X-Access-Token on both', async () => {
    const { fn, calls } = mockFlow(fixture('submit-accepted.json'), fixture('result-nominative.json'));
    const res = await new DropcontactConnector().run(
      { firstName: 'Jordan', lastName: 'Blake', email: 'j@northstar.example', company: 'Northstar Analytics', website: 'northstar.example' },
      { ...CTX, fetch: fn as any },
    );
    expect(res.success).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe('https://api.dropcontact.com/v1/enrich/all');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers['X-Access-Token']).toBe('test-dc-key-654');
    const body = JSON.parse(calls[0].init.body);
    expect(body.data[0]).toMatchObject({ first_name: 'Jordan', last_name: 'Blake', email: 'j@northstar.example', company: 'Northstar Analytics', website: 'northstar.example' });
    expect(calls[1].url).toBe('https://api.dropcontact.com/v1/enrich/all/req_01HXAMPLE000000000000000');
    expect(calls[1].init.method).toBe('GET');
    expect(calls[1].init.headers['X-Access-Token']).toBe('test-dc-key-654');
  });

  it('nominative qualification maps at 0.98 with the primary email and record fields', async () => {
    const { fn } = mockFlow(fixture('submit-accepted.json'), fixture('result-nominative.json'));
    const res = await new DropcontactConnector().run({ email: 'j@northstar.example' }, { ...CTX, fetch: fn as any });
    expect(res.data).toMatchObject({
      email: 'jordan.blake@northstar.example',
      qualification: 'nominative',
      firstName: 'Jordan',
      lastName: 'Blake',
      company: 'Northstar Analytics',
      phone: '+1 555 0100',
      confidence: 0.98,
    });
  });

  it('generic qualification maps at 0.6', async () => {
    const { fn } = mockFlow(fixture('submit-accepted.json'), fixture('result-generic.json'));
    const res = await new DropcontactConnector().run({ email: 'j@northstar.example' }, { ...CTX, fetch: fn as any });
    expect(res.data?.qualification).toBe('generic');
    expect(res.data?.confidence).toBe(0.6);
  });

  it('submit or result success:false maps to retryable NOT_READY, never to a fabricated result', async () => {
    const dc = new DropcontactConnector();
    const queued = await dc.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFlow(fixture('submit-queued.json'), null).fn as any });
    expect(queued.success).toBe(false);
    expect(queued.error?.code).toBe('NOT_READY');
    expect(queued.error?.retryable).toBe(true);
    const notReady = await dc.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFlow(fixture('submit-accepted.json'), fixture('result-not-ready.json')).fn as any });
    expect(notReady.error?.code).toBe('NOT_READY');
    expect(notReady.error?.retryable).toBe(true);
  });

  it('submit without request_id is a non-retryable PROVIDER_ERROR, not a fake id', async () => {
    const { fn } = mockFlow({ success: true }, null);
    const res = await new DropcontactConnector().run({ email: 'a@b.example' }, { ...CTX, fetch: fn as any });
    expect(res.error?.code).toBe('PROVIDER_ERROR');
    expect(res.error?.retryable).toBe(false);
  });

  it('429 on submit is retryable RATE_LIMITED; result 5xx retryable PROVIDER_ERROR', async () => {
    const dc = new DropcontactConnector();
    const r = await dc.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFlow({}, null, 429).fn as any });
    expect(r.error?.code).toBe('RATE_LIMITED');
    expect(r.error?.retryable).toBe(true);
    const r5 = await dc.run({ email: 'a@b.example' }, { ...CTX, fetch: mockFlow(fixture('submit-accepted.json'), {}, 200, 500).fn as any });
    expect(r5.error?.code).toBe('PROVIDER_ERROR');
    expect(r5.error?.retryable).toBe(true);
  });

  it('network failure never leaks the API key; missing credential and empty input fail closed', async () => {
    const dc = new DropcontactConnector();
    const fn = vi.fn().mockRejectedValue(new Error('reset by peer token test-dc-key-654'));
    const res = await dc.run({ email: 'a@b.example' }, { ...CTX, fetch: fn as any });
    expect(res.error?.code).toBe('NETWORK_ERROR');
    expect(res.error?.message).not.toContain('test-dc-key-654');
    expect((await dc.run({ email: 'a@b.example' }, {})).error?.code).toBe('MISSING_CREDENTIAL');
    expect((await dc.run({}, { ...CTX })).error?.code).toBe('INVALID_INPUT');
  });
});
