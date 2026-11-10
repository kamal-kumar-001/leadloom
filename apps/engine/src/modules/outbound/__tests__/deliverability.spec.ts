import { describe, it, expect } from 'vitest';
import { DeliverabilityService, TxtResolver } from '../deliverability.service';
class MockResolver implements TxtResolver {
  calls: string[] = [];
  constructor(private readonly zone: Record<string, string[]>, private readonly fail = false) {}
  async resolveTxtRecords(hostname: string): Promise<string[]> {
    this.calls.push(hostname);
    if (this.fail) throw new Error('temporary DNS error');
    return this.zone[hostname] ?? [];
  }
}
const zone = {
  'example.com': ['v=spf1 include:_spf.google.com ~all'],
  'default._domainkey.example.com': ['v=DKIM1; k=rsa; p=c3ludGhldGlj'],
  '_dmarc.example.com': ['v=DMARC1; p=quarantine'],
};
const service = (z = zone) => new DeliverabilityService(new MockResolver(z), 1000, ['default']);

describe('DNS record diagnostics, not send-time verification', () => {
  it('checks known selectors and returns explicit scope caveat', async () => {
    const h = await service().checkDomain('Example.COM.');
    expect(h.healthScore).toBe(100);
    expect(h.scope).toBe('dns-record-diagnostics-only');
  });
  it('returns pending when DKIM selectors are not configured', async () => {
    expect((await new DeliverabilityService(new MockResolver(zone)).checkDomain('example.com')).dkimStatus).toBe('pending');
  });
  it('does not call deny-all, bare SPF or +all healthy', async () => {
    for (const spf of ['v=spf1 -all', 'v=spf1', 'v=spf1 +all', 'v=spf1 ip4:192.0.2.1 +all']) {
      expect((await service({ ...zone, 'example.com': [spf] }).checkDomain('example.com')).spfStatus).toBe('failing');
    }
  });
  it('rejects duplicate SPF and DMARC records', async () => {
    const h = await service({ ...zone, 'example.com': [zone['example.com'][0], zone['example.com'][0]],
      '_dmarc.example.com': ['v=DMARC1; p=none', 'v=DMARC1; p=reject'] }).checkDomain('example.com');
    expect(h.spfStatus).toBe('failing'); expect(h.dmarcStatus).toBe('failing');
  });
  it('rejects revoked DKIM public keys', async () => {
    const h = await service({ ...zone, 'default._domainkey.example.com': ['v=DKIM1; p='] }).checkDomain('example.com');
    expect(h.dkimStatus).toBe('failing');
  });
  it('requires a valid DMARC policy', async () => {
    const h = await service({ ...zone, '_dmarc.example.com': ['v=DMARC1; p=invalid'] }).checkDomain('example.com');
    expect(h.dmarcStatus).toBe('failing');
  });
  it('distinguishes DNS failure from absent records', async () => {
    const h = await new DeliverabilityService(new MockResolver({}, true), 1000, ['default']).checkDomain('example.com');
    expect(h.spfStatus).toBe('unknown'); expect(h.dmarcStatus).toBe('unknown'); expect(h.dkimStatus).toBe('unknown');
    const missing = await new DeliverabilityService(new MockResolver({}), 1000, ['default']).checkDomain('example.com');
    expect(missing.spfStatus).toBe('failing');
  });
  it('caches without exposing mutable entries and rechecks on expiry', async () => {
    let now = 1000;
    const resolver = new MockResolver(zone), svc = new DeliverabilityService(resolver, 1000, ['default'], () => now);
    const h = await svc.checkDomain('example.com'); const count = resolver.calls.length;
    h.checkedAt.setTime(0); h.healthScore = 0;
    expect((await svc.checkDomain('example.com')).healthScore).toBe(100);
    expect(resolver.calls.length).toBe(count);
    now = 2001; await svc.checkDomain('example.com'); expect(resolver.calls.length).toBe(count * 2);
  });
  it('rejects invalid DNS names before using resolver', async () => {
    for (const domain of ['localhost', '../bad', '-bad.com', 'http://example.com', 'a..com']) {
      await expect(service().checkDomain(domain)).rejects.toThrow('Invalid sending domain');
    }
  });
});
