import { z } from 'zod';

export const ProjectIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'projectId must be alphanumeric with dashes or underscores');

export const PersistContextRequestSchema = z
  .object({
    expectedRevision:z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:[1-9][0-9]{0,9}$/i).nullable().optional(),
    context: z.record(z.string(), z.unknown()), // Structured decisions, assumptions, scratchpad
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
  })
  .strict();
export type PersistContextRequest = z.infer<typeof PersistContextRequestSchema>;

export const ProjectContextResponseSchema = z.object({
  revision:z.string(),
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  projectId: z.string(),
  context: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProjectContextResponse = z.infer<typeof ProjectContextResponseSchema>;
