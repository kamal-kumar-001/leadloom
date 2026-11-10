import { z } from 'zod';

/**
 * Shared entitlement contract (Alpha, Beta, Gamma all import this; nobody
 * hard-codes plan checks in UI or workers). The server decides; the UI only
 * renders a decision. Plan contents are data (see apps/engine config), so
 * routine pricing/feature changes are config edits, not code rewrites.
 */
export const TenantRoleSchema = z.enum(['admin', 'member', 'read_only']);
/** Operator-level roles, separate from any tenant role. Not yet in the DB schema. */
export const PlatformRoleSchema = z.enum(['platform_admin', 'platform_support']);

export const FeatureKeySchema = z.enum([
  'waterfall', 'validator', 'ai_researcher', 'csv_import', 'mailbox_connect',
  'outbound_sending', 'api_access', 'team_members',
]);
export const LimitKeySchema = z.enum([
  'seats', 'mailboxes', 'tables', 'enrichment_credits_per_month', 'emails_per_month',
]);
export type FeatureKey = z.infer<typeof FeatureKeySchema>;
export type LimitKey = z.infer<typeof LimitKeySchema>;

export const PlanDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{2,32}$/),
  name: z.string().min(1).max(60),
  /** null = price not decided yet; never displayed as a real price. */
  priceMonthlyUsd: z.number().nonnegative().nullable(),
  features: z.partialRecord(FeatureKeySchema, z.boolean()),
  /** number = cap; null = unlimited. A missing key means 0 (deny). */
  limits: z.partialRecord(LimitKeySchema, z.number().int().nonnegative().nullable()),
}).strict();
export type PlanDefinition = z.infer<typeof PlanDefinitionSchema>;

export const BillingStatusSchema = z.enum(['none', 'trialing', 'active', 'past_due', 'canceled']);

export const EntitlementDecisionSchema = z.object({
  allowed: z.boolean(),
  reason: z.enum(['ok', 'no_plan', 'billing_inactive', 'feature_not_in_plan', 'limit_reached']),
  limit: z.number().int().nonnegative().nullable().optional(),
  used: z.number().int().nonnegative().optional(),
  remaining: z.number().int().nonnegative().nullable().optional(),
});
export type EntitlementDecision = z.infer<typeof EntitlementDecisionSchema>;
