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
});
export type InboundReplyEvent = z.infer<typeof InboundReplyEventSchema>;
