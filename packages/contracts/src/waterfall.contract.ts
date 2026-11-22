import { z } from 'zod';

export const BYOKProviderEnum = z.enum([
  'apollo',
  'hunter',
  'anymail_finder',
  'dropcontact',
  'prospeo',
  'openai',
  'anthropic',
  'deepseek',
  'groq',
  'perplexity',
  // Engine-registered connectors (G6): key storage only; no provider call is
  // implied by accepting the key.
  'pdl',
  'zerobounce',
  'neverbounce',
  'serper',
  'ollama',
]);
export type BYOKProvider = z.infer<typeof BYOKProviderEnum>;

export const WaterfallStepStatusEnum = z.enum(['hit', 'miss', 'skipped', 'rate_limited', 'error']);
export type WaterfallStepStatus = z.infer<typeof WaterfallStepStatusEnum>;

export const WaterfallStepTraceSchema = z.object({
  step: z.number().int().positive(),
  provider: BYOKProviderEnum,
  status: WaterfallStepStatusEnum,
  latency_ms: z.number().int().nonnegative(),
  cost_microcents: z.number().int().nonnegative(),
  reason: z.string().optional(),
  verification: z.enum(['deliverable', 'risky', 'catch_all', 'undeliverable']).optional(),
  score: z.number().min(0).max(100).optional(),
});
export type WaterfallStepTrace = z.infer<typeof WaterfallStepTraceSchema>;

export const WaterfallCellPayloadSchema = z.object({
  value: z.string().nullable(),
  status: z.enum(['idle', 'queued', 'running', 'success', 'fallback_used', 'exhausted', 'error']),
  confidence: z.number().min(0).max(1).optional(),
  telemetry: z.object({
    provider_attributed: BYOKProviderEnum.optional(),
    tier: z.number().int().optional(),
    latency_ms: z.number().int().nonnegative(),
    cost_microcents: z.number().int().nonnegative(),
    /** TRUE when any step's cost is ASSUMED (fail-closed overcount at the
     *  nominal rate because the provider's error/miss billing policy is
     *  unverified), never a measured zero. Consumers must not present such
     *  totals as measured spend. */
    cost_assumed: z.boolean().optional(),
  }).optional(),
  trace: z.array(WaterfallStepTraceSchema).default([]),
  error_payload: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }).optional(),
  /** TRUE marks client-generated DEMO data (the demo canvas's Simulate action
   *  and seeded sample rows). Consumers MUST visibly label it as sample data
   *  and MUST NOT show its telemetry as a real provider result or charge. */
  simulated: z.boolean().optional(),
});
export type WaterfallCellPayload = z.infer<typeof WaterfallCellPayloadSchema>;

export const WaterfallJobStatusResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled', 'needs_review']),
  totalQueued: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  uncertainCount: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WaterfallJobStatusResponse = z.infer<typeof WaterfallJobStatusResponseSchema>;

/** D3 review surface: WHICH rows finished with an uncertain provider outcome.
 *  Ids only - row content stays grid territory. */
export const WaterfallJobUncertainRowsResponseSchema = z.object({
  jobId: z.string().uuid(),
  uncertainRowIds: z.array(z.string().uuid()),
  uncertainCount: z.number().int().nonnegative(),
});
export type WaterfallJobUncertainRowsResponse = z.infer<typeof WaterfallJobUncertainRowsResponseSchema>;

export const PreFlightEstimateRequestSchema = z.object({
  columnId: z.string().uuid(),
  rowIds: z.array(z.string().uuid()).min(1).max(1000),
}).strict();
export type PreFlightEstimateRequest = z.infer<typeof PreFlightEstimateRequestSchema>;

export const PreFlightEstimateResponseSchema = z.object({
  estimatedCostUSD: z.number().nonnegative(),
  // Provenance marker: the estimate is computed from engine-configured tier
  // unit costs and hit rates, not from measured provider prices or observed
  // hit rates. Consumers must label it accordingly, never as measured spend.
  costBasis: z.literal('configured-assumptions'),
  // Actual dispatch behavior, stated without any guarantee about call counts.
  executionNote: z.literal('Providers are tried in tier order; a resolved row is not sent to later tiers.'),
  totalRows: z.number().int().positive(),
  tiers: z.array(z.object({
    tierIndex: z.number().int(),
    provider: BYOKProviderEnum,
    unitCostUSD: z.number().nonnegative(),
    estimatedHitRate: z.number().min(0).max(1),
  })),
  guaranteeNotice: z.string().min(1),
});
export type PreFlightEstimateResponse = z.infer<typeof PreFlightEstimateResponseSchema>;

export const DispatchWaterfallRequestSchema = z.object({
  columnId: z.string().uuid(),
  rowIds: z.array(z.string().uuid()).min(1).max(1000),
  priority: z.enum(['standard', 'high']).default('standard'),
}).strict();
export type DispatchWaterfallRequest = z.infer<typeof DispatchWaterfallRequestSchema>;

export const DispatchWaterfallResponseSchema = z.object({
  jobId: z.string(),
  totalQueued: z.number().int().nonnegative(),
  estimatedCompletionAt: z.string().datetime().optional(),
});
export type DispatchWaterfallResponse = z.infer<typeof DispatchWaterfallResponseSchema>;
