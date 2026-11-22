import { z } from 'zod';

export const DnsStatusEnum = z.enum(['verified', 'failing', 'pending', 'unknown']);
export type DnsStatus = z.infer<typeof DnsStatusEnum>;

export const MailboxHealthStatusSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  spfStatus: DnsStatusEnum,
  dkimStatus: DnsStatusEnum,
  dmarcStatus: DnsStatusEnum,
  healthScore: z.number().int().min(0).max(100),
  dailySendLimit: z.number().int().positive(),
  sentToday: z.number().int().nonnegative(),
  isPaused: z.boolean(),
  lastHealthCheckAt: z.string().datetime(),
});
export type MailboxHealthStatus = z.infer<typeof MailboxHealthStatusSchema>;

export const CampaignStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  delayHours: z.number().int().nonnegative(),
  subject: z.string(),
  bodyTemplate: z.string(),
});
export type CampaignStep = z.infer<typeof CampaignStepSchema>;

export const CreateWorkspaceCampaignStepSchema = CampaignStepSchema.extend({
  subject: z.string().min(1).max(500),
  bodyTemplate: z.string().min(1).max(20000),
});

/** Workspace UI campaign create: table and mailbox pool optional at creation; pool members must belong to the workspace. */
export const CreateWorkspaceCampaignSchema = z.object({
  requestId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  steps: z.array(CreateWorkspaceCampaignStepSchema).min(1).max(20),
  dailyLimitTotal: z.number().int().min(1).max(10000).default(50),
  scheduleTimezone: z.string().min(1).max(64).default('UTC'),
  tableId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  mailboxPoolIds: z.array(z.string().uuid()).max(50).default([]),
});
export type CreateWorkspaceCampaign = z.infer<typeof CreateWorkspaceCampaignSchema>;

/** Create private project campaign content only. No sender, recipient, source-table or lifecycle controls. */
export const CreateProjectCampaignDraftSchema=z.object({requestId:z.string().uuid(),name:z.string().trim().min(1).max(255),steps:z.array(CreateWorkspaceCampaignStepSchema.strict()).min(1).max(20),dailyLimitTotal:z.number().int().min(1).max(10000).default(50),scheduleTimezone:z.string().min(1).max(64).default('UTC')}).strict().superRefine((v,ctx)=>{if(v.steps.some((s,i)=>s.stepNumber!==i+1))ctx.addIssue({code:'custom',message:'Steps must be numbered consecutively from1',path:['steps']});try{new Intl.DateTimeFormat('en',{timeZone:v.scheduleTimezone});}catch{ctx.addIssue({code:'custom',message:'Valid IANA timezone required',path:['scheduleTimezone']});}});
export type CreateProjectCampaignDraft=z.infer<typeof CreateProjectCampaignDraftSchema>;
export const RevisePrivateCampaignSchema=z.object({expectedRevision:z.string().regex(/^[a-f0-9]{64}$/),name:z.string().trim().min(1).max(255),steps:z.array(CreateWorkspaceCampaignStepSchema.strict()).min(1).max(20),dailyLimitTotal:z.number().int().min(1).max(10000),scheduleTimezone:z.string().min(1).max(64)}).strict().superRefine((v,ctx)=>{if(v.steps.some((s,i)=>s.stepNumber!==i+1))ctx.addIssue({code:'custom',message:'Steps must be consecutive',path:['steps']});try{new Intl.DateTimeFormat('en',{timeZone:v.scheduleTimezone});}catch{ctx.addIssue({code:'custom',message:'Valid timezone required',path:['scheduleTimezone']});}});


export const CampaignStatusEnum = z.enum(['draft', 'active', 'paused', 'completed']);
export type CampaignStatus = z.infer<typeof CampaignStatusEnum>;

export const CreateCampaignRequestSchema = z.object({
  name: z.string().min(1).max(255),
  tableId: z.string().uuid(),
  mailboxPoolIds: z.array(z.string().uuid()).min(1),
  steps: z.array(CampaignStepSchema).min(1),
  dailyLimitTotal: z.number().int().positive(),
  scheduleTimezone: z.string().default('UTC'),
});
export type CreateCampaignRequest = z.infer<typeof CreateCampaignRequestSchema>;

export const OutreachReplyClassificationEnum = z.enum([
  'interested',
  'objection',
  'out_of_office',
  'unsubscribe',
  'neutral',
  // Machine-generated delivery status notification (RFC 3464); detected
  // before keyword classification so quoted original text is never misread.
  'bounce',
]);
export type OutreachReplyClassification = z.infer<typeof OutreachReplyClassificationEnum>;

export const InboundReplyEventSchema = z.object({
  messageId: z.string(),
  campaignId: z.string().uuid(),
  mailboxId: z.string().uuid(),
  fromEmail: z.string().email(),
  subject: z.string(),
  bodyText: z.string(),
  classification: OutreachReplyClassificationEnum,
  confidence: z.number().min(0).max(1),
  receivedAt: z.string().datetime(),
  /** Thread headers used for attribution downstream (never trusted for identity on their own). */
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
});
export type InboundReplyEvent = z.infer<typeof InboundReplyEventSchema>;

export const OutboundApprovalStatusEnum = z.enum([
  'pending_approval',
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);
export type OutboundApprovalStatus = z.infer<typeof OutboundApprovalStatusEnum>;

export const OutboundApprovalItemSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  campaignId: z.string().uuid(),
  campaignName: z.string(),
  recipientEmail: z.string().email(),
  stepNumber: z.number().int().positive(),
  /** Hash of the exact saved snapshot displayed to this reviewer. Null requires refresh, never approval. */
  reviewRevision: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  subject: z.string().optional(),
  bodySnippet: z.string().optional(),
  /** Full body text under review (what the approval signs off on). */
  bodyTemplate: z.string().optional(),
  /** Sender context under review: sorted mailbox ids the campaign may send from. */
  senderMailboxIds: z.array(z.string()).optional(),
  /** Pinned sender mailbox for this job (null/undefined = pool rotation across senderMailboxIds). The pin is signed into the approval hash. */
  senderMailboxId: z.string().uuid().nullable().optional(),
  /** Campaign's CURRENT assigned mailbox pool (choices for pinning a sender). May differ from the signed senderMailboxIds when the pool changed since queueing; approving re-signs current context. */
  availableMailboxIds: z.array(z.string()).optional(),
  /** True when saved review content differs from current campaign/recipient/sender context. Refresh and review again before approval. */
  stale: z.boolean().optional(),
  /** Set when the message can no longer be resolved for this recipient (unknown variable or missing value); the job stays held until the template or recipient is fixed. */
  resolutionErrors: z.array(z.string()).optional(),
  status: OutboundApprovalStatusEnum,
  scheduledAt: z.string(),
  createdAt: z.string(),
});
export type OutboundApprovalItem = z.infer<typeof OutboundApprovalItemSchema>;

export const ApprovalQueueStatsSchema = z.object({
  pendingCount: z.number().int().nonnegative(),
  approvedCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
});
export type ApprovalQueueStats = z.infer<typeof ApprovalQueueStatsSchema>;

export const ApprovalQueueResponseSchema = z.object({
  items: z.array(OutboundApprovalItemSchema),
  stats: ApprovalQueueStatsSchema,
  sendingEnabled: z.literal(false),
});
export type ApprovalQueueResponse = z.infer<typeof ApprovalQueueResponseSchema>;

export const ApprovalReviewRevisionSchema = z.string().regex(/^[a-f0-9]{64}$/).nullable();
export const ApproveOutboundJobRequestSchema = z.object({
  jobIds: z.array(z.string().uuid()).min(1).max(100).refine(ids => new Set(ids).size === ids.length, 'Duplicate jobs are not allowed'),
  expectedRevisions: z.record(z.string().uuid(), ApprovalReviewRevisionSchema),
  campaignId: z.string().uuid().optional(),
}).strict().refine(value => Object.keys(value.expectedRevisions).length === value.jobIds.length && value.jobIds.every(id => Object.prototype.hasOwnProperty.call(value.expectedRevisions, id)), 'Supply the displayed revision for every selected job, with no extra jobs');
export type ApproveOutboundJobRequest = z.infer<typeof ApproveOutboundJobRequestSchema>;

export const RejectOutboundJobRequestSchema = z.object({
  jobIds: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional(),
  campaignId: z.string().uuid().optional(),
  reason: z.string().max(255).optional(),
});
export type RejectOutboundJobRequest = z.infer<typeof RejectOutboundJobRequestSchema>;


/**
 * Per-recipient job drill-down for one campaign (GET /campaigns/:campaignId/jobs).
 * Job metadata only: no step bodies, provider message ids, idempotency keys or hashes.
 */
export const CampaignJobRowSchema = z.object({
  id: z.string().uuid(),
  recipientEmail: z.string().email(),
  stepNumber: z.number().int(),
  status: z.string(),
  scheduledAt: z.string(),
  reservedAt: z.string().nullable(),
  attempts: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CampaignJobRow = z.infer<typeof CampaignJobRowSchema>;

export const CampaignJobsResponseSchema = z.object({
  campaign: z.object({ id: z.string().uuid(), name: z.string(), status: z.string() }),
  jobs: z.array(CampaignJobRowSchema),
});
export type CampaignJobsResponse = z.infer<typeof CampaignJobsResponseSchema>;

/**
 * Delivery-event timeline for one job (GET /campaigns/:campaignId/jobs/:jobId/timeline).
 * Every event maps to a recorded column; nothing is inferred. Status transition
 * times are NOT separately recorded, so the current status is a summary field,
 * never a timestamped event, and statusNote says so. Reply events carry
 * classification only - no subject or body.
 */
export const JobTimelineEventSchema = z.object({
  kind: z.enum(['queued', 'scheduled', 'dispatch_started', 'status_recorded', 'reply']),
  at: z.string(),
  note: z.string().optional(),
  classification: z.string().optional(),
});
export type JobTimelineEvent = z.infer<typeof JobTimelineEventSchema>;

export const JobTimelineResponseSchema = z.object({
  campaign: z.object({ id: z.string().uuid(), name: z.string(), status: z.string() }),
  job: z.object({
    id: z.string().uuid(),
    recipientEmail: z.string().email(),
    stepNumber: z.number().int(),
    status: z.string(),
    attempts: z.number().int(),
  }),
  statusNote: z.string(),
  events: z.array(JobTimelineEventSchema),
});
export type JobTimelineResponse = z.infer<typeof JobTimelineResponseSchema>;
