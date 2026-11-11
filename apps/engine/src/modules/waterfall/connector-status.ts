import type { ConnectorCapability } from './connectors/connector.interface';

/**
 * G6 registry endpoint support: reconcile the connector registry with the
 * workspace's stored BYOK credentials. Read-only and safe to expose: the only
 * credential detail returned is the already-masked key written at store time.
 * Live test-connection remains separately gated; `configured` here only means
 * a credential row exists, never that it works.
 */

export interface StoredConnectorCredential {
  provider: string;
  maskedKey: string;
  label: string | null;
  isValid: boolean;
  lastVerifiedAt: Date | null;
  updatedAt: Date;
}

export interface RegisteredConnectorInfo {
  id: string;
  name: string;
  capabilities: ConnectorCapability[];
}

export interface ConnectorStatusRow {
  id: string;
  name: string;
  capabilities: ConnectorCapability[];
  configured: boolean;
  maskedKey: string | null;
  label: string | null;
  /** True only after a successful test-connection; a stored-but-unverified key stays false. */
  verified: boolean;
  lastVerifiedAt: string | null;
  updatedAt: string | null;
}

export function reconcileConnectorStatus(
  connectors: RegisteredConnectorInfo[],
  credentials: StoredConnectorCredential[],
): ConnectorStatusRow[] {
  const byProvider = new Map<string, StoredConnectorCredential>();
  for (const cred of credentials) {
    const existing = byProvider.get(cred.provider);
    if (!existing || cred.updatedAt > existing.updatedAt) byProvider.set(cred.provider, cred);
  }
  return connectors.map((c) => {
    const cred = byProvider.get(c.id);
    return {
      id: c.id,
      name: c.name,
      capabilities: c.capabilities,
      configured: Boolean(cred),
      maskedKey: cred?.maskedKey ?? null,
      label: cred?.label ?? null,
      verified: Boolean(cred?.isValid),
      lastVerifiedAt: cred?.lastVerifiedAt ? cred.lastVerifiedAt.toISOString() : null,
      updatedAt: cred ? cred.updatedAt.toISOString() : null,
    };
  });
}
