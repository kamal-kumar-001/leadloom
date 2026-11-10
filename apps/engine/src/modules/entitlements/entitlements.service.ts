import { PlanDefinitionSchema, type EntitlementDecision, type FeatureKey, type LimitKey, type PlanDefinition } from '@leadloom/contracts';

export interface WorkspacePlanRef { planId: string | null; status: 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' }
export interface PlanLookup { planFor(workspaceId: string): Promise<WorkspacePlanRef> }
export interface UsageLookup { used(workspaceId: string, limit: LimitKey): Promise<number> }

const ACTIVE = new Set(['trialing', 'active']);

/**
 * Server-side entitlement decisions. Pure policy over injected ports; no HTTP,
 * no DB. Deny by default: unknown plan, inactive billing, missing feature key and
 * missing limit key all deny. Real billing integration is not built; today the
 * plan lookup is whatever the workspace row says.
 */
export class EntitlementService {
  private readonly plans = new Map<string, PlanDefinition>();
  constructor(catalog: unknown[], private readonly lookup: PlanLookup, private readonly usage: UsageLookup) {
    for (const raw of catalog) {
      const plan = PlanDefinitionSchema.parse(raw);
      if (this.plans.has(plan.id)) throw new Error(`Duplicate plan id ${plan.id}`);
      this.plans.set(plan.id, plan);
    }
  }

  private async resolve(workspaceId: string): Promise<{ plan?: PlanDefinition; deny?: EntitlementDecision }> {
    const ref = await this.lookup.planFor(workspaceId);
    const plan = ref.planId ? this.plans.get(ref.planId) : undefined;
    if (!plan) return { deny: { allowed: false, reason: 'no_plan' } };
    if (!ACTIVE.has(ref.status)) return { deny: { allowed: false, reason: 'billing_inactive' } };
    return { plan };
  }

  async checkFeature(workspaceId: string, feature: FeatureKey): Promise<EntitlementDecision> {
    const { plan, deny } = await this.resolve(workspaceId);
    if (deny) return deny;
    return plan!.features[feature] === true ? { allowed: true, reason: 'ok' } : { allowed: false, reason: 'feature_not_in_plan' };
  }

  /** `requested` is how many more units the caller wants to consume (default 1). */
  async checkLimit(workspaceId: string, limit: LimitKey, requested = 1): Promise<EntitlementDecision> {
    if (!Number.isInteger(requested) || requested < 1) throw new Error('requested must be a positive integer');
    const { plan, deny } = await this.resolve(workspaceId);
    if (deny) return deny;
    const cap = plan!.limits[limit] === undefined ? 0 : plan!.limits[limit];
    const used = await this.usage.used(workspaceId, limit);
    if (cap === null) return { allowed: true, reason: 'ok', limit: null, used, remaining: null };
    const remaining = Math.max(0, cap - used);
    return used + requested <= cap
      ? { allowed: true, reason: 'ok', limit: cap, used, remaining: remaining - requested }
      : { allowed: false, reason: 'limit_reached', limit: cap, used, remaining };
  }
}
