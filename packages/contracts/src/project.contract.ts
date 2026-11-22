import { z } from 'zod';

export const ProjectSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'slug must be alphanumeric with dashes or underscores')
  .refine(
    (s) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
    'slug cannot be formatted as a UUID',
  );

export const CreateProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(120),
    slug: ProjectSlugSchema.optional(),
    description: z.string().max(500).nullish(),
  })
  .strict();
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const ProjectResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;

export const SetupHealthDatabaseSchema = z.object({
  status: z.enum(['connected', 'unconfigured', 'auth_failed', 'unreachable']),
  verdict: z.enum(['READY', 'DEGRADED', 'MISSING_TABLES', 'UNCONFIGURED', 'AUTH_FAILED', 'UNREACHABLE']),
  verificationMode: z.literal('column-presence-only').default('column-presence-only'),
  missingTables: z.array(z.string()),
  missingColumnsCount: z.number(),
  diagnostic: z.string(),
});
export type SetupHealthDatabase = z.infer<typeof SetupHealthDatabaseSchema>;

export const SetupHealthConfigSchema = z.object({
  publicApiUrl: z.string(),
  publicApiConfigured: z.boolean(),
  authSecretConfigured: z.boolean(),
  bridgeSecretConfigured: z.boolean(),
});
export type SetupHealthConfig = z.infer<typeof SetupHealthConfigSchema>;

export const SetupHealthProvidersSchema = z.object({
  websiteFetcher: z.enum(['active', 'pasted-text-only', 'disabled']),
  outboundDispatch: z.enum(['live', 'dry-run-safe', 'unmounted']),
  vaultEncryption: z.enum(['active-aes-256-gcm', 'unconfigured']),
  mutationsEnabled: z.boolean(),
});
export type SetupHealthProviders = z.infer<typeof SetupHealthProvidersSchema>;

export const SetupHealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  database: SetupHealthDatabaseSchema,
  config: SetupHealthConfigSchema,
  providers: SetupHealthProvidersSchema,
  checkedAt: z.string().datetime(),
});
export type SetupHealthResponse = z.infer<typeof SetupHealthResponseSchema>;

