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
  }).optional(),
  trace: z.array(WaterfallStepTraceSchema).default([]),
  error_payload: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }).optional(),
});
export type WaterfallCellPayload = z.infer<typeof WaterfallCellPayloadSchema>;

export const PreFlightEstimateRequestSchema = z.object({
  columnId: z.string().uuid(),
  rowIds: z.array(z.string().uuid()),
});
export type PreFlightEstimateRequest = z.infer<typeof PreFlightEstimateRequestSchema>;

export const PreFlightEstimateResponseSchema = z.object({
  estimatedCostUSD: z.number().nonnegative(),
  estimatedSeconds: z.number().nonnegative(),
  totalRows: z.number().int().positive(),
  tiers: z.array(z.object({
    tierIndex: z.number().int(),
    provider: BYOKProviderEnum,
    unitCostUSD: z.number().nonnegative(),
    estimatedHitRate: z.number().min(0).max(1),
  })),
  guaranteeNotice: z.literal('Zero unnecessary external API calls guaranteed via early-exit short-circuiting'),
});
export type PreFlightEstimateResponse = z.infer<typeof PreFlightEstimateResponseSchema>;

export const DispatchWaterfallRequestSchema = z.object({
  columnId: z.string().uuid(),
  rowIds: z.array(z.string().uuid()),
  priority: z.enum(['standard', 'high']).default('standard'),
});
export type DispatchWaterfallRequest = z.infer<typeof DispatchWaterfallRequestSchema>;

export const DispatchWaterfallResponseSchema = z.object({
  jobId: z.string(),
  totalQueued: z.number().int().nonnegative(),
  estimatedCompletionAt: z.string().datetime(),
});
export type DispatchWaterfallResponse = z.infer<typeof DispatchWaterfallResponseSchema>;
