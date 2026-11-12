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
  name: z.string().min(1).max(255),
  steps: z.array(CreateWorkspaceCampaignStepSchema).min(1).max(20),
  dailyLimitTotal: z.number().int().min(1).max(10000).default(50),
  scheduleTimezone: z.string().min(1).max(64).default('UTC'),
  tableId: z.string().uuid().optional(),
  mailboxPoolIds: z.array(z.string().uuid()).max(50).default([]),
});
export type CreateWorkspaceCampaign = z.infer<typeof CreateWorkspaceCampaignSchema>;

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
  /** True when the stored approval snapshot matches current campaign content; false means the content changed since queueing and approval will refresh the snapshot and require a second deliberate approval. */
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

export const ApproveOutboundJobRequestSchema = z.object({
  jobIds: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional(),
  campaignId: z.string().uuid().optional(),
});
export type ApproveOutboundJobRequest = z.infer<typeof ApproveOutboundJobRequestSchema>;

export const RejectOutboundJobRequestSchema = z.object({
  jobIds: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional(),
  campaignId: z.string().uuid().optional(),
  reason: z.string().max(255).optional(),
});
export type RejectOutboundJobRequest = z.infer<typeof RejectOutboundJobRequestSchema>;

