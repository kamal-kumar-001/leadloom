import { CredentialSecurityError } from './credential-store.port';
import { VaultService, type EncryptedPayload } from '../../vault/vault.service';

const KEY_BYTES = 32;

/**
 * C2: the waterfall connector sealer is a THIN FACADE over modules/vault.
 * All encryption is the vault's ADR-001 envelope scheme (fresh DEK per record,
 * DEK wrapped with the versioned KEK, GCM AAD binding) - there is no second
 * key system. This file only adapts the connector-store API (base64 record
 * shape, workspace+connector context) and keeps fail-closed KEK resolution.
 * The only consumer is the in-memory store: no persisted ciphertext exists,
 * so the format change migrates and rewrites nothing.
 */
export interface EncryptedRecord {
  ciphertext: string; // base64
  iv: string;         // base64
  authTag: string;    // base64
  wrappedDekCiphertext: string; // base64
  wrappedDekIv: string;         // base64
  wrappedDekAuthTag: string;    // base64
  keyVersion: number;
  algorithm: 'aes-256-gcm';
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

/** Single-version keyring over the resolved KEK; rotation arrives with the vault's versioned ring. */
function vaultFor(kekOverride?: Buffer | string): VaultService {
  return new VaultService({ currentVersion: 1, keys: new Map([[1, resolveKek(kekOverride)]]) });
}

/** Vault context for connector credentials: credentialId = connectorId, provider fixed. */
function contextOf(workspaceId: string, connectorId: string) {
  if (!workspaceId || !connectorId) {
    throw new CredentialSecurityError('workspaceId and connectorId required for sealing context', 'INVALID_CONTEXT');
  }
  return { workspaceId, credentialId: connectorId, provider: 'waterfall-connector' };
}

function toRecord(payload: EncryptedPayload, workspaceId: string, connectorId: string): EncryptedRecord {
  return {
    ciphertext: payload.ciphertext.toString('base64'),
    iv: payload.iv.toString('base64'),
    authTag: payload.authTag.toString('base64'),
    wrappedDekCiphertext: payload.wrappedDek.ciphertext.toString('base64'),
    wrappedDekIv: payload.wrappedDek.iv.toString('base64'),
    wrappedDekAuthTag: payload.wrappedDek.authTag.toString('base64'),
    keyVersion: payload.keyVersion,
    algorithm: 'aes-256-gcm',
    workspaceId,
    connectorId,
    updatedAt: new Date(),
  };
}

function toPayload(record: EncryptedRecord): EncryptedPayload {
  return {
    ciphertext: Buffer.from(record.ciphertext, 'base64'),
    iv: Buffer.from(record.iv, 'base64'),
    authTag: Buffer.from(record.authTag, 'base64'),
    wrappedDek: {
      ciphertext: Buffer.from(record.wrappedDekCiphertext, 'base64'),
      iv: Buffer.from(record.wrappedDekIv, 'base64'),
      authTag: Buffer.from(record.wrappedDekAuthTag, 'base64'),
    },
    keyVersion: record.keyVersion,
    algorithm: 'aes-256-gcm',
  };
}

/**
 * Seals an API key via the vault envelope, context-bound to workspace & connector.
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
  const context = contextOf(workspaceId, connectorId);
  const buffer = Buffer.from(plaintext, 'utf8');
  try {
    return toRecord(vaultFor(kekOverride).encrypt(buffer, context), workspaceId, connectorId);
  } finally {
    buffer.fill(0);
  }
}

/**
 * Unseals an API key via the vault, verifying workspace-bound authentication.
 * Throws CredentialSecurityError on tampering, corruption, or cross-workspace mismatch.
 */
export function unsealCredential(
  record: EncryptedRecord,
  workspaceId: string,
  connectorId: string,
  kekOverride?: Buffer | string
): string {
  resolveKek(kekOverride); // fail closed before touching ciphertext
  if (record.workspaceId !== workspaceId || record.connectorId !== connectorId) {
    throw new CredentialSecurityError(
      'Credential context mismatch: stored record does not match requested workspace or connector',
      'CONTEXT_MISMATCH'
    );
  }
  try {
    const buf = vaultFor(kekOverride).decrypt(toPayload(record), contextOf(workspaceId, connectorId));
    try {
      return buf.toString('utf8');
    } finally {
      buf.fill(0);
    }
  } catch (err) {
    if (err instanceof CredentialSecurityError) throw err;
    throw new CredentialSecurityError(
      `Credential unseal failed: ${err instanceof Error ? err.message : 'tampered or invalid ciphertext'}`,
      'DECRYPTION_FAILED'
    );
  }
}
