import { describe, it, expect } from 'vitest';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createApplication } from './main';
import { WaterfallController } from './modules/waterfall/waterfall.controller';
import { WaterfallService } from './modules/waterfall/waterfall.service';
import { ValidatorController } from './modules/validator/validator.controller';
import { ValidatorService } from './modules/validator/validator.service';

const key = randomBytes(32);
const workspaceId = randomUUID();
function token(role = 'member', exp = Math.floor(Date.now() / 1000) + 60) {
  const payload = Buffer.from(JSON.stringify({ sub: randomUUID(), workspaceId, role, exp })).toString('base64url');
  return payload + '.' + createHmac('sha256', key).update(payload).digest('base64url');
}
const stubCore = () => ({
  credentials: { save: async () => ({}), list: async () => [], delete: async () => false },
  outbound: { enqueue: async () => randomUUID(), suppress: async () => {} },
  sessionKey: key,
});

describe('waterfall/validator route integration', () => {
  it('is default-off: routes are 404 unless the services are provided', async () => {
    const app = await createApplication(stubCore() as never);
    try {
      const server = app.getHttpAdapter().getInstance();
      const auth = { authorization: 'Bearer ' + token() };
      expect((await server.inject({ method: 'POST', url: '/waterfall/pre-flight', headers: auth, payload: {} })).statusCode).toBe(404);
      expect((await server.inject({ method: 'POST', url: '/waterfall/dispatch', headers: auth, payload: {} })).statusCode).toBe(404);
      expect((await server.inject({ method: 'POST', url: '/validator/experiments', headers: auth, payload: {} })).statusCode).toBe(404);
      expect((await server.inject({ method: 'POST', url: '/validator/pages/x/leads', payload: {} })).statusCode).toBe(404);
      const health = await server.inject({ method: 'GET', url: '/health' });
      expect(health.json().routes.waterfall).toBe('unmounted');
      expect(health.json().routes.validator).toBe('unmounted');
    } finally {
      await app.close();
    }
  });

  it('mounts waterfall pre-flight and dispatch behind session + write role', async () => {
    const app = await createApplication({ ...stubCore(), waterfall: new WaterfallController(new WaterfallService()) } as never);
    try {
      const server = app.getHttpAdapter().getInstance();
      const body = { columnId: randomUUID(), rowIds: [randomUUID(), randomUUID()] };

      expect((await server.inject({ method: 'POST', url: '/waterfall/pre-flight', payload: body })).statusCode).toBe(401);
      expect((await server.inject({ method: 'POST', url: '/waterfall/dispatch', headers: { authorization: 'Bearer ' + token('read_only') }, payload: body })).statusCode).toBe(403);
      expect(
        (await server.inject({ method: 'POST', url: '/waterfall/pre-flight', headers: { authorization: 'Bearer ' + token() }, payload: { columnId: 'nope' } })).statusCode,
      ).toBe(400);

      const auth = { authorization: 'Bearer ' + token() };
      const preFlight = await server.inject({ method: 'POST', url: '/waterfall/pre-flight', headers: auth, payload: body });
      expect(preFlight.statusCode).toBe(200);
      expect(preFlight.json().totalRows).toBe(2);
      expect(preFlight.json().estimatedCostUSD).toBeGreaterThanOrEqual(0);

      const dispatch = await server.inject({ method: 'POST', url: '/waterfall/dispatch', headers: auth, payload: body });
      expect(dispatch.statusCode).toBe(200);
      expect(dispatch.json().jobId).toMatch(/^job-/);
      expect(dispatch.json().totalQueued).toBe(2);
    } finally {
      await app.close();
    }
  });

  it('mounts validator generation behind write role with a public lead endpoint', async () => {
    const app = await createApplication({ ...stubCore(), validator: new ValidatorController(new ValidatorService('https://app.test')) } as never);
    try {
      const server = app.getHttpAdapter().getInstance();
      const auth = { authorization: 'Bearer ' + token() };
      const hypothesis = { rawHypothesis: 'DevOps teams will pay for zero-markup enrichment' };

      expect((await server.inject({ method: 'POST', url: '/validator/experiments', payload: hypothesis })).statusCode).toBe(401);
      expect((await server.inject({ method: 'POST', url: '/validator/experiments', headers: { authorization: 'Bearer ' + token('read_only') }, payload: hypothesis })).statusCode).toBe(403);
      expect((await server.inject({ method: 'POST', url: '/validator/experiments', headers: auth, payload: { rawHypothesis: 'short' } })).statusCode).toBe(400);

      const created = await server.inject({ method: 'POST', url: '/validator/experiments', headers: auth, payload: hypothesis });
      expect(created.statusCode).toBe(200);
      const { experimentId, pageUrl } = created.json();
      expect(experimentId).toBeTruthy();
      expect(pageUrl).toContain('https://app.test/v/');
      const slug = pageUrl.split('/v/')[1];

      const scorecard = await server.inject({ method: 'GET', url: `/validator/experiments/${experimentId}/scorecard`, headers: auth });
      expect(scorecard.statusCode).toBe(200);
      expect((await server.inject({ method: 'GET', url: `/validator/experiments/${randomUUID()}/scorecard`, headers: auth })).statusCode).toBe(404);

      // Draft pages are owner-only: public lead submission is 404 before publish.
      const lead = { email: 'founder@example.com', name: 'Syn Thetic', surveyResponses: { budget: 'yes' } };
      expect((await server.inject({ method: 'POST', url: `/validator/pages/${slug}/leads`, payload: lead })).statusCode).toBe(404);
      expect((await server.inject({ method: 'GET', url: `/validator/pages/${slug}` })).statusCode).toBe(404);

      // Owner records observed outreach numbers; invalid shapes are rejected.
      expect((await server.inject({ method: 'POST', url: `/validator/experiments/${experimentId}/outreach`, headers: auth, payload: { outreachSent: 10, replies: 12, positiveReplies: 2 } })).statusCode).toBe(400);
      expect((await server.inject({ method: 'POST', url: `/validator/experiments/${experimentId}/outreach`, headers: auth, payload: { outreachSent: -5, replies: 0, positiveReplies: 0 } })).statusCode).toBe(400);
      expect((await server.inject({ method: 'POST', url: `/validator/experiments/${experimentId}/outreach`, headers: auth, payload: { outreachSent: 10, replies: 4, positiveReplies: 5 } })).statusCode).toBe(400);
      const outreach = await server.inject({ method: 'POST', url: `/validator/experiments/${experimentId}/outreach`, headers: auth, payload: { outreachSent: 25, replies: 4, positiveReplies: 1 } });
      expect(outreach.statusCode).toBe(200);
      expect(outreach.json().metrics).toMatchObject({ outreachSent: 25, replies: 4, positiveReplies: 1 });

      // Owner publishes explicitly, then waitlist submission works with no session header.
      const published = await server.inject({ method: 'POST', url: `/validator/experiments/${experimentId}/publish`, headers: auth });
      expect(published.statusCode).toBe(200);
      expect(published.json()).toMatchObject({ status: 'published', slug });
      const submitted = await server.inject({ method: 'POST', url: `/validator/pages/${slug}/leads`, payload: lead });
      expect(submitted.statusCode).toBe(200);
      expect(submitted.json()).toMatchObject({ success: true, totalWaitlist: 1 });
      // Duplicate email is idempotent.
      const again = await server.inject({ method: 'POST', url: `/validator/pages/${slug}/leads`, payload: lead });
      expect(again.json().totalWaitlist).toBe(1);
      expect((await server.inject({ method: 'POST', url: '/validator/pages/unknown-slug/leads', payload: lead })).statusCode).toBe(404);
      expect((await server.inject({ method: 'POST', url: `/validator/pages/${slug}/leads`, payload: { email: 'not-an-email' } })).statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('public validator routes use the shared-store limiter when wired (429 on deny)', async () => {
    // Shared stub: allows 2 hits per key, then denies; records the keys it saw
    // so the test proves the route called the shared store, not the fallback.
    const seen: string[] = [];
    const publicRateLimit = async (key: string, max: number) => {
      seen.push(key);
      return seen.filter((k) => k === key).length <= Math.min(max, 2);
    };
    const app = await createApplication({ ...stubCore(), validator: new ValidatorController(new ValidatorService('https://app.test')), publicRateLimit } as never);
    try {
      const server = app.getHttpAdapter().getInstance();
      const auth = { authorization: 'Bearer ' + token() };
      const created = await server.inject({ method: 'POST', url: '/validator/experiments', headers: auth, payload: { rawHypothesis: 'DevOps teams will pay for zero-markup enrichment' } });
      const { experimentId, pageUrl } = created.json();
      const slug = pageUrl.split('/v/')[1];
      await server.inject({ method: 'POST', url: `/validator/experiments/${experimentId}/publish`, headers: auth });

      const hit = () => server.inject({ method: 'GET', url: `/validator/pages/${slug}` });
      expect((await hit()).statusCode).toBe(200);
      expect((await hit()).statusCode).toBe(200);
      expect((await hit()).statusCode).toBe(429);
      expect(seen.length).toBe(3);
      expect(seen[0]).toContain(`pg:`);
      expect(seen[0]).toContain(slug);
    } finally {
      await app.close();
    }
  });
});
