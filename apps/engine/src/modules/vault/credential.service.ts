import { randomUUID } from 'node:crypto';
import { SaveBYOKCredentialRequestSchema, MaskedBYOKCredentialSchema, type MaskedBYOKCredential, type BYOKProvider } from '@leadloom/contracts';
import { type EncryptedPayload, VaultService } from './vault.service';

export interface StoredCredential {
  id: string;
  workspaceId: string;
  provider: BYOKProvider;
  label: string | null;
  maskedKey: string;
  payload: EncryptedPayload;
  createdAt: Date;
  /** Persisted verification state. isValid is true only after a live test-connection succeeded. */
  isValid: boolean;
  lastVerifiedAt: Date | null;
}

/** Every query must include workspace scope from authenticated server context. */
export interface CredentialRepository {
  insert(record: StoredCredential): Promise<void>;
  find(workspaceId: string, credentialId: string): Promise<StoredCredential | null>;
  /** Latest stored credential for a provider, or null. */
  findLatestByProvider(workspaceId: string, provider: BYOKProvider): Promise<StoredCredential | null>;
  list(workspaceId: string): Promise<StoredCredential[]>;
  delete(workspaceId: string, credentialId: string): Promise<boolean>;
  /** Records the outcome of a live test-connection. ok=false marks the key unverified. */
  markTestResult(workspaceId: string, credentialId: string, ok: boolean, at: Date): Promise<void>;
}

/**
 * Server-only service. The eventual HTTP boundary must supply workspaceId from
 * verified auth/RBAC, not an untrusted request body's tenant field.
 * There is no HTTP server or persistence adapter attached at this checkpoint.
 */
export class CredentialService {
  constructor(private readonly repository: CredentialRepository, private readonly vault: VaultService) {}

  async save(workspaceId: string, body: unknown): Promise<MaskedBYOKCredential> {
    this.assertScope(workspaceId);
    const request = SaveBYOKCredentialRequestSchema.parse(body);
    // The request schema uses a JS string. Its original copy cannot be securely
    // erased. Never log the request body; only the temporary buffer is scrubbed.
    const plaintext = Buffer.from(request.apiKey, 'utf8'), id = randomUUID();
    try {
      const record: StoredCredential = {
        id, workspaceId, provider: request.provider, label: request.label ?? null,
        maskedKey: VaultService.maskKey(plaintext), createdAt: new Date(),
        isValid: false, lastVerifiedAt: null,
        payload: this.vault.encrypt(plaintext, { workspaceId, credentialId: id, provider: request.provider }),
      };
      await this.repository.insert(record);
      return this.masked(record);
    } finally {
      plaintext.fill(0);
    }
  }

  async list(workspaceId: string): Promise<MaskedBYOKCredential[]> {
    this.assertScope(workspaceId);
    const records = await this.repository.list(workspaceId);
    // Defend against a broken adapter returning another workspace's rows.
    if (records.some(r => r.workspaceId !== workspaceId)) throw new Error('Credential scope mismatch');
    return records.map(r => this.masked(r));
  }

  async use<T>(workspaceId: string, id: string, consumer: (key: Buffer) => T | Promise<T>): Promise<T> {
    this.assertScope(workspaceId);
    const record = await this.repository.find(workspaceId, id);
    if (!record || record.workspaceId !== workspaceId || record.id !== id) throw new Error('Credential not found');
    return this.vault.decryptAndUse(record.payload, { workspaceId, credentialId: id, provider: record.provider }, consumer);
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    this.assertScope(workspaceId);
    return this.repository.delete(workspaceId, id);
  }

  async findLatestByProvider(workspaceId: string, provider: BYOKProvider): Promise<StoredCredential | null> {
    this.assertScope(workspaceId);
    const record = await this.repository.findLatestByProvider(workspaceId, provider);
    if (record && record.workspaceId !== workspaceId) throw new Error('Credential scope mismatch');
    return record;
  }

  async markTestResult(workspaceId: string, id: string, ok: boolean): Promise<void> {
    this.assertScope(workspaceId);
    await this.repository.markTestResult(workspaceId, id, ok, new Date());
  }

  private assertScope(workspaceId: string): void {
    if (!workspaceId.trim()) throw new Error('Authenticated workspace required');
  }

  private masked(record: StoredCredential): MaskedBYOKCredential {
    return MaskedBYOKCredentialSchema.parse({
      id: record.id, provider: record.provider, label: record.label, maskedKey: record.maskedKey,
      // Persisted verification truth: a saved key is unverified until a live
      // test-connection succeeds; only that boundary may set isValid true.
      isValid: record.isValid, quotaRemaining: null,
      lastVerifiedAt: record.lastVerifiedAt ? record.lastVerifiedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
    });
  }
}
