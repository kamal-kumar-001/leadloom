import { describe, it, expect } from 'vitest';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createApplication } from '../../../main';
import { WebsiteSignalService, deriveIcpHints, deriveRelevanceReasons } from '../website-signals.service';
import { SafeWebsiteFetcher } from '../website-fetcher';

const key = randomBytes(32);
const token = (role = 'admin') => {
  const payload = Buffer.from(JSON.stringify({ sub: randomUUID(), workspaceId: randomUUID(), role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return payload + '.' + createHmac('sha256', key).update(payload).digest('base64url');
};
const stubCore = () => ({
  credentials: { save: async () => ({}), list: async () => [], delete: async () => false },
  outbound: { enqueue: async () => randomUUID(), suppress: async () => {} },
  sessionKey: key,
});
const PAGE = 'Acme builds a developer API and SDK for Kubernetes cost management. We are hiring engineers - see careers. Pricing starts at $49 per seat. Built for B2B SaaS startups scaling on Docker and PostgreSQL.';

describe('research route integration', () => {
  it('is default-off: 404 unless the service is mounted', async () => {
    const app = await createApplication(stubCore() as never);
    try {
      const server = app.getHttpAdapter().getInstance();
      expect((await server.inject({ method: 'POST', url: '/research/website-signals', headers: { authorization: 'Bearer ' + token() }, payload: { domain: 'acme.test', pageText: PAGE } })).statusCode).toBe(404);
      const health = await server.inject({ method: 'GET', url: '/health' });
      expect(health.json().routes.research).toBe('unmounted');
    } finally {
      await app.close();
    }
  });

  it('analyzes pasted text with honest keyword-only output; no egress exists', async () => {
    const app = await createApplication({ ...stubCore(), websiteSignals: new WebsiteSignalService() } as never);
    try {
      const server = app.getHttpAdapter().getInstance();
      expect((await server.inject({ method: 'POST', url: '/research/website-signals', payload: { domain: 'acme.test', pageText: PAGE } })).statusCode).toBe(401);
      const res = await server.inject({ method: 'POST', url: '/research/website-signals', headers: { authorization: 'Bearer ' + token() }, payload: { domain: 'acme.test', pageText: PAGE } });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.input).toBe('pasted_text');
      expect(body.signals.source).toBe('heuristic_keywords');
      expect(body.signals.summary).toBeNull();
      expect(body.signals.confidence).toBeNull();
      expect(body.signals.techKeywords).toContain('Kubernetes');
      expect(body.signals.mentionsHiring).toBe(true);
      expect(body.icpHints.map((h: { category: string }) => h.category)).toContain('developer tools');
      expect(body.relevanceReasons.join(' ')).toContain('Kubernetes');
      // URL fetch stays disabled without a mounted fetcher.
      const blocked = await server.inject({ method: 'POST', url: '/research/website-signals', headers: { authorization: 'Bearer ' + token() }, payload: { url: 'https://acme.test' } });
      expect(blocked.statusCode).toBe(200);
      expect(blocked.json().status).toBe('DISABLED');
      expect(blocked.json().fetchEnabled).toBe(false);
      const health = await server.inject({ method: 'GET', url: '/health' });
      expect(health.json().routes.research).toBe('mounted:session-required:pasted-text-only');
    } finally {
      await app.close();
    }
  });

  it('fetch path uses the injected fetcher and reports truncation honestly', async () => {
    const stubFetch = (async () => new Response('<html><body>' + PAGE + '</body></html>', { status: 200 })) as unknown as typeof fetch;
    const app = await createApplication({ ...stubCore(), websiteSignals: new WebsiteSignalService(), websiteFetcher: new SafeWebsiteFetcher({ allowPrivateHosts: true }, stubFetch) } as never);
    try {
      const server = app.getHttpAdapter().getInstance();
      const res = await server.inject({ method: 'POST', url: '/research/website-signals', headers: { authorization: 'Bearer ' + token() }, payload: { url: 'https://acme.test/' } });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.input).toBe('fetched_url');
      expect(body.signals.companyDomain).toBe('acme.test');
      expect(body.signals.techKeywords).toContain('Docker');
      expect(body.relevanceReasons.some((r: string) => r.includes('Hiring/careers language'))).toBe(true);
      const health = await server.inject({ method: 'GET', url: '/health' });
      expect(health.json().routes.research).toBe('mounted:session-required:fetch-enabled');
    } finally {
      await app.close();
    }
  });

  it('thin pages and no-match text stay honest', () => {
    const svc = new WebsiteSignalService();
    const thin = svc.analyzeText('empty.test', 'Hello world');
    const reasons = deriveRelevanceReasons(thin, deriveIcpHints('Hello world'));
    expect(reasons.some((r) => r.includes('No tracked keywords matched'))).toBe(true);
    expect(reasons.some((r) => r.includes('Thin page text'))).toBe(true);
  });
});
