import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const VAULT_ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;

/** Supplied by the authenticated server boundary, never trusted from a client body. */
export interface CredentialContext {
  workspaceId: string;
  credentialId: string;
  provider: string;
}

export interface CipherBlock {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/** Data encrypted with a fresh DEK; DEK wrapped separately with the versioned KEK. */
export interface EncryptedPayload extends CipherBlock {
  wrappedDek: CipherBlock;
  keyVersion: number;
  algorithm: typeof VAULT_ALGORITHM;
}

export interface VaultKeyRing {
  currentVersion: number;
  keys: Map<number, Buffer>;
}

export class VaultKeyError extends Error {}
export class VaultDecryptionError extends Error {
  constructor() {
    super('Credential authentication failed');
    this.name = 'VaultDecryptionError';
  }
}

function decodeMasterKey(raw: string): Buffer {
  const value = raw.trim();
  if (!/^(?:[0-9a-fA-F]{64}|[A-Za-z0-9+/]{43}=)$/.test(value)) {
    throw new VaultKeyError('Master key must be 64 hex characters or canonical base64 encoding of 32 bytes');
  }
  const key = Buffer.from(value, /^[0-9a-fA-F]{64}$/.test(value) ? 'hex' : 'base64');
  if (key.length !== KEY_BYTES) throw new VaultKeyError('Master key must decode to 32 bytes');
  return key;
}

function aad(context: CredentialContext, purpose: string): Buffer {
  if (!context.workspaceId || !context.credentialId || !context.provider) {
    throw new VaultKeyError('Credential context is required');
  }
  return Buffer.from(JSON.stringify(['leadloom-v1', context.workspaceId, context.credentialId, context.provider, purpose]));
}

function encryptBlock(key: Buffer, plaintext: Buffer, additionalData: Buffer): CipherBlock {
  const iv = randomBytes(12);
  const cipher = createCipheriv(VAULT_ALGORITHM, key, iv, { authTagLength: 16 });
  cipher.setAAD(additionalData);
  return {
    ciphertext: Buffer.concat([cipher.update(plaintext), cipher.final()]),
    iv,
    authTag: cipher.getAuthTag(),
  };
}

function decryptBlock(key: Buffer, block: CipherBlock, additionalData: Buffer): Buffer {
  if (block.iv.length !== 12 || block.authTag.length !== 16) throw new VaultDecryptionError();
  const decipher = createDecipheriv(VAULT_ALGORITHM, key, block.iv, { authTagLength: 16 });
  decipher.setAAD(additionalData);
  decipher.setAuthTag(block.authTag);
  // Do not expose unauthenticated intermediate plaintext, even internally to callers.
  const intermediate = decipher.update(block.ciphertext);
  try {
    const final = decipher.final();
    return Buffer.concat([intermediate, final]);
  } finally {
    intermediate.fill(0);
  }
}

/**
 * ADR-001 envelope encryption with tenant/record binding via GCM AAD.
 * Buffers under our control are overwritten on completion. JS strings, copies
 * made by consumers, GC and crypto-library internals cannot be reliably erased.
 * This primitive does not replace authenticated access control at the API/DB boundary.
 */
export class VaultService {
  private readonly keyRing: VaultKeyRing;

  constructor(ring: VaultKeyRing) {
    if (!Number.isSafeInteger(ring.currentVersion) || ring.currentVersion < 1 || !ring.keys.has(ring.currentVersion)) {
      throw new VaultKeyError('Current KEK version must identify a registered positive integer version');
    }
    for (const [version, key] of ring.keys) {
      if (!Number.isSafeInteger(version) || version < 1 || key.length !== KEY_BYTES) {
        throw new VaultKeyError('Each KEK must have a positive integer version and 32 bytes');
      }
    }
    this.keyRing = { currentVersion: ring.currentVersion, keys: new Map([...ring.keys].map(([v, k]) => [v, Buffer.from(k)])) };
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): VaultService {
    if (!env.LEADLOOM_MASTER_KEY) throw new VaultKeyError('LEADLOOM_MASTER_KEY is not set');
    const rawVersion = env.LEADLOOM_MASTER_KEY_VERSION ?? '1';
    if (!/^[1-9]\d*$/.test(rawVersion)) throw new VaultKeyError('Master key version must be a positive integer');
    const version = Number(rawVersion);
    const keys = new Map([[version, decodeMasterKey(env.LEADLOOM_MASTER_KEY)]]);
    try {
      if (env.LEADLOOM_MASTER_KEY_PREVIOUS) {
        if (version < 2) throw new VaultKeyError('A previous key requires current version >= 2');
        keys.set(version - 1, decodeMasterKey(env.LEADLOOM_MASTER_KEY_PREVIOUS));
      }
      return new VaultService({ currentVersion: version, keys });
    } finally {
      for (const key of keys.values()) key.fill(0);
    }
  }

  encrypt(plaintext: Buffer, context: CredentialContext): EncryptedPayload {
    const dek = randomBytes(KEY_BYTES);
    try {
      const data = encryptBlock(dek, plaintext, aad(context, 'credential'));
      const keyVersion = this.keyRing.currentVersion;
      const wrappedDek = encryptBlock(this.keyRing.keys.get(keyVersion)!, dek, aad(context, `dek:${keyVersion}`));
      return { ...data, wrappedDek, keyVersion, algorithm: VAULT_ALGORITHM };
    } finally {
      dek.fill(0);
    }
  }

  private unwrap(payload: EncryptedPayload, context: CredentialContext): Buffer {
    const key = this.keyRing.keys.get(payload.keyVersion);
    if (!key || payload.algorithm !== VAULT_ALGORITHM) throw new VaultDecryptionError();
    return decryptBlock(key, payload.wrappedDek, aad(context, `dek:${payload.keyVersion}`));
  }

  decrypt(payload: EncryptedPayload, context: CredentialContext): Buffer {
    let dek: Buffer | undefined;
    try {
      dek = this.unwrap(payload, context);
      return decryptBlock(dek, payload, aad(context, 'credential'));
    } catch {
      throw new VaultDecryptionError();
    } finally {
      dek?.fill(0);
    }
  }

  async decryptAndUse<T>(payload: EncryptedPayload, context: CredentialContext, fn: (plaintext: Buffer) => T | Promise<T>): Promise<T> {
    const plaintext = this.decrypt(payload, context);
    try {
      return await fn(plaintext);
    } finally {
      plaintext.fill(0);
    }
  }

  /** Rewrap the DEK only. Credential plaintext is not decrypted during rotation. */
  rotate(payload: EncryptedPayload, context: CredentialContext): EncryptedPayload {
    let dek: Buffer | undefined;
    try {
      dek = this.unwrap(payload, context);
      const keyVersion = this.keyRing.currentVersion;
      return { ...payload, keyVersion, wrappedDek: encryptBlock(this.keyRing.keys.get(keyVersion)!, dek, aad(context, `dek:${keyVersion}`)) };
    } catch {
      throw new VaultDecryptionError();
    } finally {
      dek?.fill(0);
    }
  }

  destroy(): void {
    for (const key of this.keyRing.keys.values()) key.fill(0);
    this.keyRing.keys.clear();
  }

  static maskKey(key: Buffer): string {
    // Only the last four bytes are intentionally exposed. No plaintext prefix.
    return key.length > 7 ? `••••••••${key.subarray(-4).toString('utf8')}` : '••••••••';
  }
}
