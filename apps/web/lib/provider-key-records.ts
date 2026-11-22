import { MaskedBYOKCredentialSchema, type MaskedBYOKCredential } from '@leadloom/contracts';

/** Preserve the server's native createdAt DESC, id DESC order, including sub-ms precision. */
export function currentProviderKeyRecords(value: unknown): Record<string, MaskedBYOKCredential> | null {
  const parsed = MaskedBYOKCredentialSchema.strict().array().safeParse(value);
  if (!parsed.success) return null;
  const seen = new Set<string>();
  const current: Record<string, MaskedBYOKCredential> = {};
  for (const record of parsed.data) {
    if (seen.has(record.id)) return null;
    seen.add(record.id);
    if (!Object.hasOwn(current, record.provider)) current[record.provider] = record;
  }
  return current;
}
