import { describe, it, expect,vi } from 'vitest';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createApplication } from './main';
import { WaterfallController } from './modules/waterfall/waterfall.controller';
import { WaterfallService } from './modules/waterfall/waterfall.service';
import { WaterfallJobStatusResponseSchema, WaterfallJobUncertainRowsResponseSchema } from '@leadloom/contracts';
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
      expect((await server.inject({ method: 'GET', url: `/waterfall/jobs/${randomUUID()}`, headers: auth })).statusCode).toBe(404);
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
      expect(preFlight.statusCode).toBe(503);
      expect(preFlight.json().error).toContain('unavailable');expect(preFlight.json().estimatedCostUSD).toBeUndefined();

      // D2 honest posture: no durable queue is mounted, so dispatch is 503
      // unavailable with queued:false - never a fabricated job id.
      const dispatch = await server.inject({ method: 'POST', url: '/waterfall/dispatch', headers: auth, payload: body });
      expect(dispatch.statusCode).toBe(503);
      expect(dispatch.json().error).toContain('No job was queued');expect(dispatch.json().jobId).toBeUndefined();expect(dispatch.json().totalQueued).toBeUndefined();
      expect(dispatch.json().queued).toBe(false);
      expect(dispatch.json().message).toContain('not implemented');
      expect(JSON.stringify(dispatch.json())).not.toContain('job-');

      // Tenant spoofing: a foreign workspaceId in the body is rejected, never preferred.
      const spoof = await server.inject({ method: 'POST', url: '/waterfall/dispatch', headers: auth, payload: { ...body, workspaceId: randomUUID() } });
      expect(spoof.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('D3 status read: auth + id validation + honest 503/404 + schema-valid 200, tenant-fenced', async () => {
    const seen: Array<{ workspaceId: string; jobId: string }> = [];
    const jobId = randomUUID();
    const now = new Date();
    const record = {
      id: jobId,
      status: 'running' as const,
      totalQueued: 5,
      completedRowIds: [randomUUID(), randomUUID()],
      uncertainRowIds: [randomUUID()],
      attempts: 1,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    const queueWithJob = {
      enqueue: async () => ({ jobId }),
      getJob: async (workspaceIdQ: string, jobIdQ: string) => {
        seen.push({ workspaceId: workspaceIdQ, jobId: jobIdQ });
        return record;
      },
    };
    const queueWithoutJob = {
      enqueue: async () => ({ jobId }),
      getJob: async () => null,
    };
    const mount = (queue?: unknown) =>
      createApplication({
        ...stubCore(),
        waterfall: new WaterfallController(new WaterfallService(undefined, undefined, queue as never)),
      } as never);

    // No queue reader at all: the same honest unavailable posture as dispatch.
    const noQueue = await mount();
    try {
      const server = noQueue.getHttpAdapter().getInstance();
      const auth = { authorization: 'Bearer ' + token() };
      const res = await server.inject({ method: 'GET', url: `/waterfall/jobs/${jobId}`, headers: auth });
      expect(res.statusCode).toBe(503);
      expect(res.json().queued).toBe(false);
    } finally {
      await noQueue.close();
    }

    const app = await mount(queueWithJob);
    try {
      const server = app.getHttpAdapter().getInstance();
      const auth = { authorization: 'Bearer ' + token() };
      expect((await server.inject({ method: 'GET', url: `/waterfall/jobs/${jobId}` })).statusCode).toBe(401);
      expect((await server.inject({ method: 'GET', url: `/waterfall/jobs/${jobId}`, headers: { authorization: 'Bearer ' + token('read_only') } })).statusCode).toBe(403);
      expect((await server.inject({ method: 'GET', url: '/waterfall/jobs/not-a-uuid', headers: auth })).statusCode).toBe(400);

      const ok = await server.inject({ method: 'GET', url: `/waterfall/jobs/${jobId}`, headers: auth });
      expect(ok.statusCode).toBe(200);
      const parsed = WaterfallJobStatusResponseSchema.safeParse(ok.json());
      expect(parsed.success).toBe(true);
      expect(ok.json()).toMatchObject({ jobId, status: 'running', totalQueued: 5, completedCount: 2, uncertainCount: 1, attempts: 1, error: null });
      // Tenant fence: the read went through with the SESSION workspace id only.
      expect(seen).toEqual([{ workspaceId, jobId }]);

      // D3 review surface: WHICH rows are uncertain - ids only, same fence.
      const review = await server.inject({ method: 'GET', url: `/waterfall/jobs/${jobId}/uncertain-rows`, headers: auth });
      expect(review.statusCode).toBe(200);
      expect(WaterfallJobUncertainRowsResponseSchema.safeParse(review.json()).success).toBe(true);
      expect(review.json()).toEqual({ jobId, uncertainRowIds: record.uncertainRowIds, uncertainCount: 1 });
      expect(JSON.stringify(review.json())).not.toContain('@'); // no row content leaks
      expect((await server.inject({ method: 'GET', url: `/waterfall/jobs/${jobId}/uncertain-rows` })).statusCode).toBe(401);
      expect((await server.inject({ method: 'GET', url: `/waterfall/jobs/${jobId}/uncertain-rows`, headers: { authorization: 'Bearer ' + token('read_only') } })).statusCode).toBe(403);
      expect((await server.inject({ method: 'GET', url: '/waterfall/jobs/not-a-uuid/uncertain-rows', headers: auth })).statusCode).toBe(400);
    } finally {
      await app.close();
    }

    // A job the store cannot find for this workspace is a 404, never a leak.
    const missing = await mount(queueWithoutJob);
    try {
      const server = missing.getHttpAdapter().getInstance();
      const auth = { authorization: 'Bearer ' + token() };
      expect((await server.inject({ method: 'GET', url: `/waterfall/jobs/${jobId}`, headers: auth })).statusCode).toBe(404);
      expect((await server.inject({ method: 'GET', url: `/waterfall/jobs/${jobId}/uncertain-rows`, headers: auth })).statusCode).toBe(404);
    } finally {
      await missing.close();
    }

    // No reader at all: the review surface shares the unavailable posture.
    const noReader = await mount();
    try {
      const server = noReader.getHttpAdapter().getInstance();
      const auth = { authorization: 'Bearer ' + token() };
      const res = await server.inject({ method: 'GET', url: `/waterfall/jobs/${jobId}/uncertain-rows`, headers: auth });
      expect(res.statusCode).toBe(503);
      expect(res.json().queued).toBe(false);
    } finally {
      await noReader.close();
    }
  });

  it('passes only authenticated workspace to dispatch and never accepts body-claimed tenant authority',async()=>{
    const dispatch=vi.fn(async()=>{throw Object.assign(new Error('synthetic unavailable'),{statusCode:503});});
    const app=await createApplication({...stubCore(),waterfall:{dispatch,getPreFlightEstimate:async()=>{throw Error('private provider token');}}} as never);
    try{const server=app.getHttpAdapter().getInstance(),auth={authorization:'Bearer '+token()},body={columnId:randomUUID(),rowIds:[randomUUID()],workspaceId:randomUUID()};
     expect((await server.inject({method:'POST',url:'/waterfall/dispatch',headers:auth,payload:body})).statusCode).toBe(503);expect(dispatch).toHaveBeenCalledWith(body,workspaceId);
     const failed=await server.inject({method:'POST',url:'/waterfall/pre-flight',headers:auth,payload:body});expect(failed.statusCode).toBe(503);expect(failed.body).not.toContain('private provider token');
     await expect(new WaterfallController(new WaterfallService()).dispatch(body)).rejects.toThrow();
    }finally{await app.close();}
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
      const published = await server.inject({ method: 'POST', url: `/validator/experiments/${experimentId}/publish`, headers: auth,payload:{expectedRevision:(await server.inject({method:'GET',url:`/validator/experiments/${experimentId}/page`,headers:auth})).json().revision} });
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
      return seen.filter((k) => k === key).length <= Math.min(max, 2) ? 'allow' as const : 'deny' as const;
    };
    const app = await createApplication({ ...stubCore(), validator: new ValidatorController(new ValidatorService('https://app.test')), publicRateLimit } as never);
    try {
      const server = app.getHttpAdapter().getInstance();
      const auth = { authorization: 'Bearer ' + token() };
      const created = await server.inject({ method: 'POST', url: '/validator/experiments', headers: auth, payload: { rawHypothesis: 'DevOps teams will pay for zero-markup enrichment' } });
      const { experimentId, pageUrl } = created.json();
      const slug = pageUrl.split('/v/')[1];
      await server.inject({ method: 'POST', url: `/validator/experiments/${experimentId}/publish`, headers: auth,payload:{expectedRevision:(await server.inject({method:'GET',url:`/validator/experiments/${experimentId}/page`,headers:auth})).json().revision} });

      const hit = () => server.inject({ method: 'GET', url: `/validator/pages/${slug}` });
      expect((await hit()).statusCode).toBe(200);
      expect((await hit()).statusCode).toBe(200);
      expect((await hit()).statusCode).toBe(429);
      const perSlug = seen.filter((k) => k.includes(slug));
      expect(perSlug.length).toBe(3);
      expect(perSlug[0]).toContain(`pg:`);
      expect(perSlug[0]).toContain(slug);
    } finally {
      await app.close();
    }
  });

  it('public routes fail closed on limiter store error (503, never open)', async () => {
    const publicRateLimit = async () => 'error' as const;
    const app = await createApplication({ ...stubCore(), validator: new ValidatorController(new ValidatorService('https://app.test')), publicRateLimit } as never);
    try {
      const server = app.getHttpAdapter().getInstance();
      const res = await server.inject({ method: 'GET', url: '/validator/pages/any-slug' });
      expect(res.statusCode).toBe(503);
    } finally {
      await app.close();
    }
  });

  it('limit keys: hashed IPs, XFF trusted only from loopback, global ceiling checked', async () => {
    const seen: string[] = [];
    const publicRateLimit = async (key: string) => { seen.push(key); return 'allow' as const; };
    const app = await createApplication({ ...stubCore(), validator: new ValidatorController(new ValidatorService('https://app.test')), publicRateLimit } as never);
    try {
      const server = app.getHttpAdapter().getInstance();
      const perKey = () => seen.filter((k) => !k.endsWith(':global'));
      // Default inject peer is loopback (the proxy's position): XFF is honored.
      await server.inject({ method: 'GET', url: '/validator/pages/some-slug', headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } });
      await server.inject({ method: 'GET', url: '/validator/pages/some-slug', headers: { 'x-forwarded-for': '203.0.113.8' } });
      const [k1, k2] = perKey();
      // Distinct client IPs map to distinct keys, and keys carry no raw IP.
      expect(k1).not.toBe(k2);
      expect(k1).not.toContain('203.0.113.7');
      expect(k1).toMatch(/^pg:[0-9a-f]{16}:some-slug$/);
      // Every allowed request also hits the global ceiling bucket.
      expect(seen).toContain('pg:global');
      // A direct non-loopback caller cannot change its key with XFF.
      await server.inject({ method: 'GET', url: '/validator/pages/some-slug', remoteAddress: '198.51.100.9', headers: { 'x-forwarded-for': '203.0.113.7' } });
      await server.inject({ method: 'GET', url: '/validator/pages/some-slug', remoteAddress: '198.51.100.9' });
      const [, , k3, k4] = perKey();
      expect(k3).toBe(k4);
    } finally {
      await app.close();
    }
  });
});
