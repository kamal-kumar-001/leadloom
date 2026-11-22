import { PlanDefinitionSchema,FeatureKeySchema,LimitKeySchema, type EntitlementDecision, type FeatureKey, type LimitKey, type PlanDefinition } from '@leadloom/contracts';

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

  async status(workspaceId:string){
    const ref=await this.lookup.planFor(workspaceId),plan=ref.planId?this.plans.get(ref.planId):undefined;
    const reason=!plan?'no_plan':!ACTIVE.has(ref.status)?'billing_inactive':'ok';
    const features=FeatureKeySchema.options.map(key=>({key,allowed:reason==='ok'&&plan!.features[key]===true,reason:reason!=='ok'?reason:plan!.features[key]===true?'ok':'feature_not_in_plan'}));
    const limits=await Promise.all(LimitKeySchema.options.map(async key=>{const used=await this.usage.used(workspaceId,key);if(!Number.isSafeInteger(used)||used<0)throw Error('Invalid usage measurement');const cap=plan?(plan.limits[key]===undefined?0:plan.limits[key]):undefined;return{key,used,cap:cap??null,capKnown:Boolean(plan),available:plan?(cap===null?null:Math.max(0,cap!-used)):null,allowsOneMore:reason==='ok'&&(cap===null||used+1<=cap!),reason:reason!=='ok'?reason:cap!==null&&used+1>cap!?'limit_reached':'ok',measurement:key==='tables'?'saved_rows':'recorded_counter',period:key.endsWith('_per_month')?new Date().toISOString().slice(0,7):'total'};}));
    return{enforcement:'enabled' as const,asOf:new Date().toISOString(),plan:{id:ref.planId,known:Boolean(plan),billingStatus:ref.status},features,limits,notes:['Configured development policy, not approved commercial terms or a billing invoice. No prices or plan changes are offered here.','Only mounted guarded paths enforce these decisions. This is not a claim that every feature or quota is implemented.','Table usage counts current saved workspace tables, including explicit project tables. Other usage values are recorded counters and may be incomplete.','Available means cap minus measured usage now. Allows one more evaluates one additional unit, not a reservation.']};
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
