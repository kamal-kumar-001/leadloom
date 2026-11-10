import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { CredentialSecurityError } from './credential-store.port';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface EncryptedRecord {
  ciphertext: string; // base64
  iv: string;         // base64
  authTag: string;    // base64
  algorithm: typeof ALGORITHM;
  workspaceId: string;
  connectorId: string;
  updatedAt: Date;
}

/**
 * Resolves and validates the Key Encryption Key (KEK).
 * Fails closed if LEADLOOM_CREDENTIAL_KEK is not configured or is invalid.
 */
export function resolveKek(override?: Buffer | string): Buffer {
  const raw = override ?? process.env.LEADLOOM_CREDENTIAL_KEK;
  if (!raw) {
    throw new CredentialSecurityError(
      'LEADLOOM_CREDENTIAL_KEK is not configured; credential encryption fails closed',
      'KEK_DISABLED'
    );
  }

  if (Buffer.isBuffer(raw)) {
    if (raw.length !== KEY_BYTES) {
      throw new CredentialSecurityError('KEK Buffer must be exactly 32 bytes', 'INVALID_KEK_LENGTH');
    }
    return raw;
  }

  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  if (/^(?:[A-Za-z0-9+/]{43}=)$/.test(trimmed)) {
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length === KEY_BYTES) return buf;
  }

  // If raw 32-char string
  if (Buffer.byteLength(trimmed, 'utf8') === KEY_BYTES) {
    return Buffer.from(trimmed, 'utf8');
  }

  throw new CredentialSecurityError(
    'LEADLOOM_CREDENTIAL_KEK must decode to exactly 32 bytes (64-character hex or canonical base64)',
    'INVALID_KEK_FORMAT'
  );
}

/**
 * Derives Authenticated Additional Data (AAD) binding ciphertext to the workspace & connector context.
 */
function buildAad(workspaceId: string, connectorId: string): Buffer {
  if (!workspaceId || !connectorId) {
    throw new CredentialSecurityError('workspaceId and connectorId required for sealing context', 'INVALID_CONTEXT');
  }
  return Buffer.from(JSON.stringify(['leadloom-connector-v1', workspaceId, connectorId]), 'utf8');
}

/**
 * Seals an API key using AES-256-GCM with per-workspace context authentication.
 */
export function sealCredential(
  plaintext: string,
  workspaceId: string,
  connectorId: string,
  kekOverride?: Buffer | string
): EncryptedRecord {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new CredentialSecurityError('Plaintext credential string must be non-empty', 'INVALID_PLAINTEXT');
  }

  const kek = resolveKek(kekOverride);
  const iv = randomBytes(IV_BYTES);
  const aad = buildAad(workspaceId, connectorId);

  const cipher = createCipheriv(ALGORITHM, kek, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    algorithm: ALGORITHM,
    workspaceId,
    connectorId,
    updatedAt: new Date(),
  };
}

/**
 * Unseals an API key using AES-256-GCM, verifying workspace-bound authentication tag.
 * Throws CredentialSecurityError on tampering, corruption, or cross-workspace context mismatch.
 */
export function unsealCredential(
  record: EncryptedRecord,
  workspaceId: string,
  connectorId: string,
  kekOverride?: Buffer | string
): string {
  const kek = resolveKek(kekOverride);

  // Cross-workspace or connector mismatch check
  if (record.workspaceId !== workspaceId || record.connectorId !== connectorId) {
    throw new CredentialSecurityError(
      'Credential context mismatch: stored record does not match requested workspace or connector',
      'CONTEXT_MISMATCH'
    );
  }

  try {
    const iv = Buffer.from(record.iv, 'base64');
    const authTag = Buffer.from(record.authTag, 'base64');
    const ciphertext = Buffer.from(record.ciphertext, 'base64');
    const aad = buildAad(workspaceId, connectorId);

    const decipher = createDecipheriv(ALGORITHM, kek, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (err) {
    throw new CredentialSecurityError(
      `Credential unseal failed: ${err instanceof Error ? err.message : 'tampered or invalid ciphertext'}`,
      'DECRYPTION_FAILED'
    );
  }
}
