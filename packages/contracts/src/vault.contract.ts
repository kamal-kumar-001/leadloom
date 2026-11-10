import { z } from 'zod';
import { BYOKProviderEnum } from './waterfall.contract';

export const SaveBYOKCredentialRequestSchema = z.object({
  provider: BYOKProviderEnum,
  apiKey: z.string().min(10),
  label: z.string().max(100).optional(),
});
export type SaveBYOKCredentialRequest = z.infer<typeof SaveBYOKCredentialRequestSchema>;

export const MaskedBYOKCredentialSchema = z.object({
  id: z.string().uuid(),
  provider: BYOKProviderEnum,
  label: z.string().nullable(),
  maskedKey: z.string(), // e.g. "sk-••••••••abcd"
  isValid: z.boolean(),
  quotaRemaining: z.number().int().nullable(),
  lastVerifiedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type MaskedBYOKCredential = z.infer<typeof MaskedBYOKCredentialSchema>;
