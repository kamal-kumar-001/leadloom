import { z } from 'zod';

export const ValidationVerdictEnum = z.enum([
  'high_pull',        // 🔥 High Pull — Build Now
  'pivot_positioning', // ⚠️ Pivot Positioning
  'low_interest',     // ❄️ Low Interest — Kill Idea
  'pending',
]);
export type ValidationVerdict = z.infer<typeof ValidationVerdictEnum>;

export const GenerateValidationRequestSchema = z.object({
  rawHypothesis: z.string().min(10).max(500),
  preferredSlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
});
export type GenerateValidationRequest = z.infer<typeof GenerateValidationRequestSchema>;

export const ValidationICPSpecSchema = z.object({
  targetTitles: z.array(z.string()),
  companyHeadcount: z.string(),
  buyingSignals: z.array(z.string()),
  sampleKeywords: z.array(z.string()),
});
export type ValidationICPSpec = z.infer<typeof ValidationICPSpecSchema>;

export const SurveyQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(['text', 'choice']),
  options: z.array(z.string()).optional(),
});
export type SurveyQuestion = z.infer<typeof SurveyQuestionSchema>;

export const SmokePageConfigSchema = z.object({
  slug: z.string(),
  title: z.string(),
  headline: z.string(),
  subheadline: z.string(),
  heroCtaText: z.string().default('Request Early Access'),
  surveyQuestions: z.array(SurveyQuestionSchema),
  customDomain: z.string().optional(),
});
export type SmokePageConfig = z.infer<typeof SmokePageConfigSchema>;

export const ValidationScorecardMetricsSchema = z.object({
  visitors: z.number().int().nonnegative(),
  pageConversions: z.number().int().nonnegative(),
  pageConversionRate: z.number().min(0).max(1),
  outreachSent: z.number().int().nonnegative(),
  replies: z.number().int().nonnegative(),
  replyRate: z.number().min(0).max(1),
  positiveReplies: z.number().int().nonnegative(),
  positiveResonanceRate: z.number().min(0).max(1),
  waitlistCount: z.number().int().nonnegative(),
});
export type ValidationScorecardMetrics = z.infer<typeof ValidationScorecardMetricsSchema>;

export const ValidationScorecardResponseSchema = z.object({
  experimentId: z.string().uuid(),
  hypothesis: z.string(),
  verdict: ValidationVerdictEnum,
  verdictScore: z.number().min(0).max(100),
  metrics: ValidationScorecardMetricsSchema,
  actionableSummary: z.string(),
  pageUrl: z.string().url(),
  sequenceSubject: z.string(),
  sequenceBody: z.string(),
});
export type ValidationScorecardResponse = z.infer<typeof ValidationScorecardResponseSchema>;

export const SubmitWaitlistLeadRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  company: z.string().optional(),
  surveyResponses: z.record(z.string(), z.string()).default({}),
  referrer: z.string().optional(),
});
export type SubmitWaitlistLeadRequest = z.infer<typeof SubmitWaitlistLeadRequestSchema>;
