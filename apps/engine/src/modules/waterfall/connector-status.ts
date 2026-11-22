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
  /** True only when the engine has a real test-connection probe for this connector. */
  testable: boolean;
}

export interface ConnectorStatusRow {
  id: string;
  name: string;
  capabilities: ConnectorCapability[];
  configured: boolean;
  maskedKey: string | null;
  label: string | null;
  /** Stored successful-test record with a timestamp, never a live connection check. */
  verified: boolean;
  lastVerifiedAt: string | null;
  updatedAt: string | null;
  testable: boolean;
}

export function reconcileConnectorStatus(
  connectors: RegisteredConnectorInfo[],
  /** Canonical native repository order, newest-created first with id DESC ties. */
  credentials: StoredConnectorCredential[],
): ConnectorStatusRow[] {
  const byProvider = new Map<string, StoredConnectorCredential>();
  for (const cred of credentials) {
    // Caller supplies the repository's native createdAt DESC, id DESC order.
    // Never re-rank by updatedAt: rotating an older envelope does not select it.
    if (!byProvider.has(cred.provider)) byProvider.set(cred.provider, cred);
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
      verified: Boolean(cred?.isValid && cred.lastVerifiedAt),
      lastVerifiedAt: cred?.lastVerifiedAt ? cred.lastVerifiedAt.toISOString() : null,
      updatedAt: cred ? cred.updatedAt.toISOString() : null,
      testable: c.testable,
    };
  });
}
