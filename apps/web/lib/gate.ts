import type { EntitlementDecision } from '@leadloom/contracts';
import type { GateState } from '@leadloom/ui';

const REASONS: Record<EntitlementDecision['reason'], string> = {
  ok: '',
  no_plan: 'No plan on this workspace',
  billing_inactive: 'Billing is not active',
  feature_not_in_plan: 'Not included in your plan',
  limit_reached: 'Plan limit reached',
};

/** Maps the engine's decision to what the UI shows. Null means no decision is available: treat as unknown, never as allowed by default for a gated action. */
export function gateFromDecision(decision: EntitlementDecision | null | undefined): GateState {
  if (!decision) return { kind: 'unavailable', reason: 'Plan check not available yet' };
  if (decision.allowed) return { kind: 'available' };
  return { kind: 'locked', reason: REASONS[decision.reason] || 'Not allowed on your plan' };
}

/** For features that are not built yet. Not a plan lock: no lock icon, no upgrade wording. */
export const NOT_BUILT: GateState = { kind: 'unavailable', reason: 'Not available yet' };
