import type { LimitKey } from '@leadloom/contracts';
import type { PlanLookup, UsageLookup, WorkspacePlanRef } from './entitlements.service';

const MONTHLY: ReadonlySet<LimitKey> = new Set(['enrichment_credits_per_month', 'emails_per_month']);
export const periodFor = (limit: LimitKey, now = new Date()) => (MONTHLY.has(limit) ? now.toISOString().slice(0, 7) : 'total');

/** PostgreSQL adapter over workspace_plans and usage_counters (migration 20261112). */
export class PrismaEntitlementStore implements PlanLookup, UsageLookup {
  constructor(private readonly prisma: any, private readonly clock: () => Date = () => new Date()) {}

  async planFor(workspaceId: string): Promise<WorkspacePlanRef> {
    const rows: Array<{ plan_id: string; status: WorkspacePlanRef['status'] }> = await this.prisma.$queryRawUnsafe(
      `SELECT plan_id, status FROM workspace_plans WHERE workspace_id = $1::uuid`, workspaceId);
    return rows[0] ? { planId: rows[0].plan_id, status: rows[0].status } : { planId: null, status: 'none' };
  }

  async used(workspaceId: string, limit: LimitKey): Promise<number> {
    const rows: Array<{ used: bigint | number }> = await this.prisma.$queryRawUnsafe(
      `SELECT used FROM usage_counters WHERE workspace_id = $1::uuid AND limit_key = $2 AND period = $3`,
      workspaceId, limit, periodFor(limit, this.clock()));
    return rows[0] ? Number(rows[0].used) : 0;
  }

  /** Atomic increment (upsert). Caller must have passed checkLimit first; this does not enforce. */
  async record(workspaceId: string, limit: LimitKey, amount = 1): Promise<void> {
    if (!Number.isInteger(amount) || amount < 1) throw new Error('amount must be a positive integer');
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO usage_counters (workspace_id, limit_key, period, used) VALUES ($1::uuid, $2, $3, $4::bigint)
       ON CONFLICT (workspace_id, limit_key, period) DO UPDATE SET used = usage_counters.used + EXCLUDED.used`,
      workspaceId, limit, periodFor(limit, this.clock()), amount);
  }
}
