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

      // Waitlist submission is public by design: no session header at all.
      const lead = { email: 'founder@example.com', name: 'Syn Thetic', surveyResponses: { budget: 'yes' } };
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
});
