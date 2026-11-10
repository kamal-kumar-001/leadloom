import { describe, it, expect } from 'vitest';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createApplication } from './main';
import { WaterfallController } from './modules/waterfall/waterfall.controller';
import { WaterfallService } from './modules/waterfall/waterfall.service';
import { EntitlementService } from './modules/entitlements/entitlements.service';
import { DEFAULT_PLANS } from './modules/entitlements/default-plans';

const key = randomBytes(32);
const wsFree = randomUUID(), wsPro = randomUUID(), wsNone = randomUUID(), wsLapsed = randomUUID();
const plans: Record<string, { planId: string | null; status: any }> = {
  [wsFree]: { planId: 'free', status: 'active' }, [wsPro]: { planId: 'pro', status: 'active' },
  [wsLapsed]: { planId: 'pro', status: 'past_due' },
};
const entitlements = new EntitlementService(DEFAULT_PLANS, { planFor: async (w) => plans[w] ?? { planId: null, status: 'none' } }, { used: async () => 0 });
const tok = (workspaceId: string) => {
  const p = Buffer.from(JSON.stringify({ sub: randomUUID(), workspaceId, role: 'member', exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url');
  return 'Bearer ' + p + '.' + createHmac('sha256', key).update(p).digest('base64url');
};
const base = (extra: object) => ({
  credentials: { save: async () => ({}), list: async () => [], delete: async () => false },
  outbound: { enqueue: async () => randomUUID(), suppress: async () => {} },
  sessionKey: key, ...extra,
});
const job = { campaignId: randomUUID(), recipientEmail: 'x@example.invalid', idempotencyKey: 'k1', stepNumber: 1, scheduledAt: new Date().toISOString() };

describe('server-side entitlement enforcement', () => {
  it('is not enforced when no entitlement service is configured (current deployed posture)', async () => {
    const app = await createApplication(base({}) as never);
    try {
      const server = app.getHttpAdapter().getInstance();
      expect((await server.inject({ method: 'POST', url: '/outbound/jobs', headers: { authorization: tok(wsNone) }, payload: job })).statusCode).toBe(202);
      expect((await server.inject({ method: 'GET', url: '/health' })).json().routes.entitlements).toBe('not_enforced');
    } finally { await app.close(); }
  });
  it('denies by plan, billing state and missing plan; allows only entitled workspaces', async () => {
    const app = await createApplication(base({ entitlements, waterfall: new WaterfallController(new WaterfallService()) }) as never);
    try {
      const server = app.getHttpAdapter().getInstance();
      const post = (url: string, ws: string, payload: object) => server.inject({ method: 'POST', url, headers: { authorization: tok(ws) }, payload });
      const free = await post('/outbound/jobs', wsFree, job);
      expect(free.statusCode).toBe(403); expect(free.json()).toMatchObject({ reason: 'feature_not_in_plan', feature: 'outbound_sending' });
      expect((await post('/outbound/jobs', wsNone, job)).json().reason).toBe('no_plan');
      expect((await post('/outbound/jobs', wsLapsed, job)).json().reason).toBe('billing_inactive');
      expect((await post('/outbound/jobs', wsPro, job)).statusCode).toBe(202);
      expect((await post('/waterfall/dispatch', wsNone, {})).statusCode).toBe(403);
      expect((await post('/waterfall/dispatch', wsFree, {})).statusCode).toBe(400); // entitled (free has waterfall), body invalid
      expect((await server.inject({ method: 'GET', url: '/health' })).json().routes.entitlements).toBe('enforced');
    } finally { await app.close(); }
  });
});
