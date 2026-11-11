import { describe, it, expect } from 'vitest';
import { connectorStatuses } from './connector-registry';
describe('connector registry', () => {
  it('never claims sending and reflects the mailbox flag', () => {
    const off = connectorStatuses({});
    expect(off.every((c) => c.sendingEnabled === false)).toBe(true);
    expect(off.find((c) => c.id === 'smtp_imap')?.enabled).toBe(false);
    expect(connectorStatuses({ LEADLOOM_MAILBOX_CONNECT_ENABLED: 'true' }).find((c) => c.id === 'smtp_imap')?.enabled).toBe(true);
    expect(off.find((c) => c.id === 'linkedin')?.state).toBe('partner_limited');
  });
});
