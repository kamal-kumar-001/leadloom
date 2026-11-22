import { describe, it, expect } from 'vitest';
import { reconcileConnectorStatus, type StoredConnectorCredential } from '../connector-status';
import { createDefaultConnectorRegistry } from '../connectors/registry';
import { TESTABLE_CONNECTOR_IDS } from '../connectors/test-connection.service';

const registry = createDefaultConnectorRegistry();
const connectors = registry.list().map((c: any) => ({ id: c.id, name: c.name, capabilities: c.capabilities, testable: TESTABLE_CONNECTOR_IDS.has(c.id) }));

describe('G6 connector status reconcile', () => {
  it('surfaces testable only for connectors with a real probe, and every default-registry connector has one', () => {
    for (const c of registry.list()) expect(TESTABLE_CONNECTOR_IDS.has(c.id)).toBe(true);
    const rows = reconcileConnectorStatus(connectors, []);
    expect(rows.every((r) => r.testable)).toBe(true);
  });

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

  it('preserves native selected-key order rather than promoting a later-updated older key', () => {
    const creds: StoredConnectorCredential[] = [
      { provider: 'apollo', maskedKey: 'new2', label: 'new', isValid: false, lastVerifiedAt: null, updatedAt: new Date('2026-11-10T00:00:00Z') },
      { provider: 'apollo', maskedKey: 'old1', label: 'old', isValid: true, lastVerifiedAt: new Date('2026-11-11T00:00:00Z'), updatedAt: new Date('2026-11-11T00:00:00Z') },
    ];
    const apollo = reconcileConnectorStatus(connectors, creds).find((r) => r.id === 'apollo')!;
    expect(apollo.maskedKey).toBe('new2');
    expect(apollo.verified).toBe(false);
    expect(apollo.lastVerifiedAt).toBeNull();
  });
  it('does not call a flag without a test timestamp verified', () => {
    const rows = reconcileConnectorStatus(connectors, [{provider:'apollo',maskedKey:'masked',label:null,isValid:true,lastVerifiedAt:null,updatedAt:new Date()}]);
    expect(rows.find(row=>row.id==='apollo')?.verified).toBe(false);
  });
});
