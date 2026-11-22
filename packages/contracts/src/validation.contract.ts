import { z } from 'zod';

export const ValidationVerdictEnum = z.enum([
  'high_pull',        // 🔥 High Pull — Build Now
  'pivot_positioning', // ⚠️ Pivot Positioning
  'low_interest',     // ❄️ Low Interest — Kill Idea
  'pending',
]);
export type ValidationVerdict = z.infer<typeof ValidationVerdictEnum>;

export const DraftPageCopySchema = z.object({
  title: z.string().trim().min(1).max(160),
  headline: z.string().trim().min(1).max(300),
  subheadline: z.string().trim().min(1).max(1500),
  heroCtaText: z.string().trim().min(1).max(80),
}).strict();
export type DraftPageCopy = z.infer<typeof DraftPageCopySchema>;

export const EditDraftPageCopySchema = z.object({
  expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  pageCopy: DraftPageCopySchema,
}).strict();
export type EditDraftPageCopy = z.infer<typeof EditDraftPageCopySchema>;

export const DraftSurveyQuestionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/),
  text: z.string().trim().min(1).max(300),
  type: z.enum(['text', 'choice']),
  options: z.array(z.string().trim().min(1).max(160)).min(2).max(10).optional(),
}).strict().superRefine((q,ctx)=>{
  if(q.type==='choice'&&!q.options)ctx.addIssue({code:'custom',path:['options'],message:'Choice questions need 2-10 options'});
  if(q.type==='text'&&q.options)ctx.addIssue({code:'custom',path:['options'],message:'Text questions have no options'});
  if(q.options&&new Set(q.options).size!==q.options.length)ctx.addIssue({code:'custom',path:['options'],message:'Options must be distinct'});
});
export const DraftSurveyQuestionsSchema = z.array(DraftSurveyQuestionSchema).max(8).superRefine((questions,ctx)=>{
  if(new Set(questions.map(q=>q.id)).size!==questions.length)ctx.addIssue({code:'custom',message:'Question IDs must be distinct'});
  // The existing capture/export contract keys answers by question text.
  if(new Set(questions.map(q=>q.text)).size!==questions.length)ctx.addIssue({code:'custom',message:'Question text must be distinct'});
});
export type DraftSurveyQuestions = z.infer<typeof DraftSurveyQuestionsSchema>;

export const GenerateValidationRequestSchema = z.object({
  projectId: z.string().uuid().optional(),
  rawHypothesis: z.string().min(10).max(500),
  preferredSlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  pageCopy: DraftPageCopySchema.optional(),
  surveyQuestions: DraftSurveyQuestionsSchema.optional(),
});
export type GenerateValidationRequest = z.infer<typeof GenerateValidationRequestSchema>;

// Private caller-authored page only. Ownership/lifecycle never come from the body.
export const CreateProjectExperimentDraftSchema = z.object({
 requestId:z.string().uuid(),
 rawHypothesis:z.string().min(10).max(500),
 preferredSlug:z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
 pageCopy:DraftPageCopySchema,
 surveyQuestions:DraftSurveyQuestionsSchema,
}).strict();
export type CreateProjectExperimentDraft = z.infer<typeof CreateProjectExperimentDraftSchema>;


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
  /** Null when no observed load denominator exists or signups exceed observed loads. Counts stay raw. */
  pageConversionRate: z.number().min(0).max(1).nullable(),
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

export const WaitlistLeadSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  surveyResponses: z.record(z.string(), z.string()).default({}),
  createdAt: z.union([z.string(), z.date()]),
});
export type WaitlistLead = z.infer<typeof WaitlistLeadSchema>;

export const ValidationLeadsResponseSchema = z.object({
  experimentId: z.string(),
  totalLeads: z.number().int().nonnegative(),
  leads: z.array(WaitlistLeadSchema),
});
export type ValidationLeadsResponse = z.infer<typeof ValidationLeadsResponseSchema>;

export const ImportCapturedLeadsRequestSchema = z.object({
  targetType: z.enum(['campaign', 'table']).default('campaign'),
  expectedTableRevision:z.string().regex(/^[a-f0-9]{64}$/).optional(),
  targetId: z.string().uuid(),
}).strict();
export type ImportCapturedLeadsRequest = z.infer<typeof ImportCapturedLeadsRequestSchema>;

export const ImportCapturedLeadsResponseSchema = z.object({
  success: z.boolean(),
  targetType: z.enum(['campaign', 'table']),
  targetId: z.string().uuid(),
  targetName: z.string(),
  importedCount: z.number().int().nonnegative(),
  status: z.string(),
  message: z.string(),
});
export type ImportCapturedLeadsResponse = z.infer<typeof ImportCapturedLeadsResponseSchema>;



export const PublishReviewedPageSchema = z.object({expectedRevision:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export type PublishReviewedPage = z.infer<typeof PublishReviewedPageSchema>;
