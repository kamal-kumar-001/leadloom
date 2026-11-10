export interface ConnectorCredentialStatus {
  workspaceId: string;
  connectorId: string;
  configured: boolean;
  maskedKey: string | null;
  updatedAt: Date | null;
}

export class CredentialSecurityError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CredentialSecurityError';
  }
}

/**
 * Masks an API key for safe presentation over client APIs or logs.
 * Formats as e.g. "sk-••••••••abcd" or "••••••••abcd".
 * Never reveals more than prefix and last 4 characters.
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return '••••••••';
  }
  const prefix = trimmed.startsWith('sk-') ? 'sk-' : '';
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Port interface for workspace-scoped connector credential storage.
 * Enforces write-only semantics on public interfaces:
 * - Credentials can be stored (sealed with AES-256-GCM under workspace context)
 * - Credentials can be deleted
 * - Masked status can be queried
 * - Plaintext keys are NEVER returned via getStatus or listStatus
 */
export interface ConnectorCredentialStore {
  /**
   * Stores a credential, sealing it via AES-256-GCM bound to the workspace context.
   */
  set(workspaceId: string, connectorId: string, apiKey: string): Promise<void>;

  /**
   * Deletes a stored credential for a connector.
   */
  delete(workspaceId: string, connectorId: string): Promise<boolean>;

  /**
   * Returns masked status only. Never reveals plaintext.
   */
  getStatus(workspaceId: string, connectorId: string): Promise<ConnectorCredentialStatus>;

  /**
   * Lists masked statuses for all connectors configured in a workspace.
   */
  listStatus(workspaceId: string): Promise<ConnectorCredentialStatus[]>;

  /**
   * Internal execution-only method for decrypting credentials within worker loops.
   * Authenticated by workspace context.
   */
  getDecryptedKey(workspaceId: string, connectorId: string): Promise<string | null>;
}
