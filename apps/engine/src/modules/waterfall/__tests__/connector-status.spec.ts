import { describe, it, expect } from 'vitest';
import { reconcileConnectorStatus, type StoredConnectorCredential } from '../connector-status';
import { createDefaultConnectorRegistry } from '../connectors/registry';

const registry = createDefaultConnectorRegistry();
const connectors = registry.list().map((c: any) => ({ id: c.id, name: c.name, capabilities: c.capabilities }));

describe('G6 connector status reconcile', () => {
  it('marks only connectors with a stored credential as configured, masked key only', () => {
    const creds: StoredConnectorCredential[] = [
      { provider: 'apollo', maskedKey: '••••••••abcd', label: 'work key', isValid: false, lastVerifiedAt: null, updatedAt: new Date('2026-11-10T08:00:00Z') },
    ];
    const rows = reconcileConnectorStatus(connectors, creds);
    expect(rows.length).toBeGreaterThanOrEqual(10);
    const apollo = rows.find((r) => r.id === 'apollo')!;
    expect(apollo.configured).toBe(true);
    expect(apollo.maskedKey).toBe('••••••••abcd');
    expect(apollo.verified).toBe(false);
    const hunter = rows.find((r) => r.id === 'hunter')!;
    expect(hunter.configured).toBe(false);
    expect(hunter.maskedKey).toBeNull();
    // No plaintext anywhere in the output
    expect(JSON.stringify(rows)).not.toContain('sk-live');
  });

  it('reflects verification state only when the credential was verified', () => {
    const creds: StoredConnectorCredential[] = [
      { provider: 'hunter', maskedKey: '••••••••wxyz', label: null, isValid: true, lastVerifiedAt: new Date('2026-11-10T09:00:00Z'), updatedAt: new Date('2026-11-10T09:00:00Z') },
    ];
    const hunter = reconcileConnectorStatus(connectors, creds).find((r) => r.id === 'hunter')!;
    expect(hunter.verified).toBe(true);
    expect(hunter.lastVerifiedAt).toBe('2026-11-10T09:00:00.000Z');
  });

  it('ignores credentials for providers that have no registered connector', () => {
    const creds: StoredConnectorCredential[] = [
      { provider: 'anymail_finder', maskedKey: '••••••••qqqq', label: null, isValid: false, lastVerifiedAt: null, updatedAt: new Date() },
    ];
    const rows = reconcileConnectorStatus(connectors, creds);
    expect(rows.every((r) => !r.configured)).toBe(true);
  });

  it('uses the newest credential row when a provider has several', () => {
    const creds: StoredConnectorCredential[] = [
      { provider: 'apollo', maskedKey: '••••••••old1', label: 'old', isValid: false, lastVerifiedAt: null, updatedAt: new Date('2026-11-01T00:00:00Z') },
      { provider: 'apollo', maskedKey: '••••••••new2', label: 'new', isValid: true, lastVerifiedAt: new Date('2026-11-10T00:00:00Z'), updatedAt: new Date('2026-11-10T00:00:00Z') },
    ];
    const apollo = reconcileConnectorStatus(connectors, creds).find((r) => r.id === 'apollo')!;
    expect(apollo.maskedKey).toBe('••••••••new2');
    expect(apollo.verified).toBe(true);
  });
});
