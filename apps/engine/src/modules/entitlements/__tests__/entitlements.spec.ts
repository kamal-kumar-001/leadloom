import { describe, it, expect } from 'vitest';
import { EntitlementService } from '../entitlements.service';
import { DEFAULT_PLANS } from '../default-plans';

const mk = (planId: string | null, status: any = 'active', used = 0, catalog: unknown[] = DEFAULT_PLANS) =>
  new EntitlementService(catalog, { planFor: async () => ({ planId, status }) }, { used: async () => used });

describe('entitlements', () => {
  it('denies by default: no plan, unknown plan, inactive billing', async () => {
    expect((await mk(null).checkFeature('w', 'waterfall')).reason).toBe('no_plan');
    expect((await mk('ghost').checkFeature('w', 'waterfall')).reason).toBe('no_plan');
    expect((await mk('pro', 'past_due').checkFeature('w', 'waterfall')).reason).toBe('billing_inactive');
    expect((await mk('pro', 'canceled').checkLimit('w', 'seats')).reason).toBe('billing_inactive');
  });
  it('gates features by plan data', async () => {
    expect((await mk('free').checkFeature('w', 'outbound_sending')).reason).toBe('feature_not_in_plan');
    expect((await mk('pro').checkFeature('w', 'outbound_sending')).allowed).toBe(true);
    expect((await mk('free', 'trialing').checkFeature('w', 'waterfall')).allowed).toBe(true);
  });
  it('enforces limits including exact boundary and requested size', async () => {
    expect(await mk('free', 'active', 2).checkLimit('w', 'tables')).toMatchObject({ allowed: true, remaining: 0 });
    expect(await mk('free', 'active', 3).checkLimit('w', 'tables')).toMatchObject({ allowed: false, reason: 'limit_reached', remaining: 0 });
    expect((await mk('free', 'active', 90).checkLimit('w', 'enrichment_credits_per_month', 11)).allowed).toBe(false);
    expect((await mk('free', 'active', 90).checkLimit('w', 'enrichment_credits_per_month', 10)).allowed).toBe(true);
    expect((await mk('free').checkLimit('w', 'mailboxes')).allowed).toBe(false); // cap 0
  });
  it('treats missing limit key as deny and null as unlimited; rejects bad catalog and bad requests', async () => {
    const custom = [{ id: 'xx', name: 'X', priceMonthlyUsd: null, features: {}, limits: { seats: null } }];
    expect((await mk('xx', 'active', 99999, custom).checkLimit('w', 'seats')).allowed).toBe(true);
    expect((await mk('xx', 'active', 0, custom).checkLimit('w', 'tables')).allowed).toBe(false);
    expect(() => mk('xx', 'active', 0, [...custom, ...custom])).toThrow();
    expect(() => mk('xx', 'active', 0, [{ id: 'BAD ID' }])).toThrow();
    await expect(mk('free').checkLimit('w', 'seats', 0)).rejects.toThrow();
  });
});
