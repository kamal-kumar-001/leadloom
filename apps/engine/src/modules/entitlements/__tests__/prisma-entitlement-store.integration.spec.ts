import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaEntitlementStore, periodFor } from '../prisma-entitlement-store';
import { EntitlementService } from '../entitlements.service';
import { DEFAULT_PLANS } from '../default-plans';

/** Gated like postgres.integration.spec: LEADLOOM_INTEGRATION=1 + LEADLOOM_TEST_DATABASE_URL on a migrated DB. */
const URL = process.env.LEADLOOM_TEST_DATABASE_URL;
const RUN = process.env.LEADLOOM_INTEGRATION === '1' && Boolean(URL);

describe.runIf(RUN)('entitlement store on real Postgres (gated)', () => {
  let prisma: any; const ws = randomUUID(), other = randomUUID();
  beforeAll(async () => {
    const { PrismaClient } = await import('@leadloom/database');
    prisma = new PrismaClient({ datasources: { db: { url: URL } } });
    await prisma.workspace.create({ data: { id: ws, name: 'ent-a' } });
    await prisma.workspace.create({ data: { id: other, name: 'ent-b' } });
  });
  afterAll(async () => { await prisma.workspace.deleteMany({ where: { id: { in: [ws, other] } } }); await prisma.$disconnect(); });

  it('no row means no plan; plan row and status drive decisions', async () => {
    const store = new PrismaEntitlementStore(prisma);
    const svc = new EntitlementService(DEFAULT_PLANS, store, store);
    expect((await svc.checkFeature(ws, 'waterfall')).reason).toBe('no_plan');
    await prisma.$executeRawUnsafe(`INSERT INTO workspace_plans (workspace_id, plan_id, status) VALUES ($1::uuid,'free','active')`, ws);
    expect((await svc.checkFeature(ws, 'waterfall')).allowed).toBe(true);
    expect((await svc.checkFeature(ws, 'outbound_sending')).reason).toBe('feature_not_in_plan');
    await prisma.$executeRawUnsafe(`UPDATE workspace_plans SET status='past_due' WHERE workspace_id=$1::uuid`, ws);
    expect((await svc.checkFeature(ws, 'waterfall')).reason).toBe('billing_inactive');
    await expect(prisma.$executeRawUnsafe(`UPDATE workspace_plans SET status='bogus' WHERE workspace_id=$1::uuid`, ws)).rejects.toThrow();
  });
  it('usage increments atomically, is per workspace, and enforces the cap at the boundary', async () => {
    const store = new PrismaEntitlementStore(prisma);
    const svc = new EntitlementService(DEFAULT_PLANS, store, store);
    await Promise.all(Array.from({ length: 20 }, () => store.record(ws, 'tables')));
    expect(await store.used(ws, 'tables')).toBe(20);
    expect(await store.used(other, 'tables')).toBe(0);
    await prisma.$executeRawUnsafe(`UPDATE workspace_plans SET status='active' WHERE workspace_id=$1::uuid`, ws);
    expect((await svc.checkLimit(ws, 'tables')).reason).toBe('limit_reached'); // free cap is 3
    await expect(store.record(ws, 'tables', 0)).rejects.toThrow();
  });
  it('monthly keys use a UTC month period; others use total', () => {
    expect(periodFor('emails_per_month', new Date('2026-11-30T23:59:59Z'))).toBe('2026-11');
    expect(periodFor('seats')).toBe('total');
  });
});
