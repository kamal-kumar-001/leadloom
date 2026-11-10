import {
  ConnectorCredentialStore,
  ConnectorCredentialStatus,
  maskApiKey,
  CredentialSecurityError,
} from './credential-store.port';
import {
  EncryptedRecord,
  sealCredential,
  unsealCredential,
} from './credential-sealer';

interface StoredCredentialEntry {
  record: EncryptedRecord;
  maskedKey: string;
}

/**
 * In-memory fixture implementation of ConnectorCredentialStore.
 * Demonstrates write-only API semantics and AES-256-GCM context-bound sealing.
 */
export class InMemoryConnectorCredentialStore implements ConnectorCredentialStore {
  private readonly store = new Map<string, StoredCredentialEntry>();

  constructor(private readonly kekOverride?: Buffer | string) {}

  private makeKey(workspaceId: string, connectorId: string): string {
    return `${workspaceId}::${connectorId}`;
  }

  async set(workspaceId: string, connectorId: string, apiKey: string): Promise<void> {
    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new CredentialSecurityError('workspaceId must be a non-empty string', 'INVALID_WORKSPACE_ID');
    }
    if (!connectorId || typeof connectorId !== 'string') {
      throw new CredentialSecurityError('connectorId must be a non-empty string', 'INVALID_CONNECTOR_ID');
    }
    if (!apiKey || typeof apiKey !== 'string') {
      throw new CredentialSecurityError('apiKey must be a non-empty string', 'INVALID_API_KEY');
    }

    const record = sealCredential(apiKey, workspaceId, connectorId, this.kekOverride);
    const maskedKey = maskApiKey(apiKey);

    this.store.set(this.makeKey(workspaceId, connectorId), { record, maskedKey });
  }

  async delete(workspaceId: string, connectorId: string): Promise<boolean> {
    const key = this.makeKey(workspaceId, connectorId);
    return this.store.delete(key);
  }

  async getStatus(workspaceId: string, connectorId: string): Promise<ConnectorCredentialStatus> {
    const entry = this.store.get(this.makeKey(workspaceId, connectorId));
    if (!entry) {
      return {
        workspaceId,
        connectorId,
        configured: false,
        maskedKey: null,
        updatedAt: null,
      };
    }

    return {
      workspaceId,
      connectorId,
      configured: true,
      maskedKey: entry.maskedKey,
      updatedAt: entry.record.updatedAt,
    };
  }

  async listStatus(workspaceId: string): Promise<ConnectorCredentialStatus[]> {
    const results: ConnectorCredentialStatus[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (entry.record.workspaceId === workspaceId) {
        results.push({
          workspaceId,
          connectorId: entry.record.connectorId,
          configured: true,
          maskedKey: entry.maskedKey,
          updatedAt: entry.record.updatedAt,
        });
      }
    }
    return results;
  }

  async getDecryptedKey(workspaceId: string, connectorId: string): Promise<string | null> {
    const entry = this.store.get(this.makeKey(workspaceId, connectorId));
    if (!entry) {
      return null;
    }

    return unsealCredential(entry.record, workspaceId, connectorId, this.kekOverride);
  }

  /**
   * Clears all in-memory credentials (for test fixtures).
   */
  clear(): void {
    this.store.clear();
  }
}
