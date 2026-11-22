import { z } from 'zod';

export const IssueAgentTokenRequestSchema = z.object({
  name: z.string().min(1).max(100),
  projectId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'projectId must be alphanumeric with dashes or underscores').optional(),
  scopes: z.array(z.string().min(1).max(50)).min(1).max(20).default(['*']),
  expiresInDays: z.number().int().min(1).max(365).nullish(),
}).strict();
export type IssueAgentTokenRequest = z.infer<typeof IssueAgentTokenRequestSchema>;

export const AgentTokenResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  projectId: z.string().nullable().optional(),
  token: z.string(), // raw lld_agt_... token, returned once
  tokenPrefix: z.string(),
  scope: z.string(),
  scopes: z.array(z.string()),
  expiry: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  revoked: z.boolean(),
  createdAt: z.string().datetime(),
});
export type AgentTokenResponse = z.infer<typeof AgentTokenResponseSchema>;

export const AgentTokenListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  projectId: z.string().nullable().optional(),
  tokenPrefix: z.string(),
  scope: z.string(),
  scopes: z.array(z.string()),
  expiry: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  revoked: z.boolean(),
  createdAt: z.string().datetime(),
});
export type AgentTokenListItem = z.infer<typeof AgentTokenListItemSchema>;
