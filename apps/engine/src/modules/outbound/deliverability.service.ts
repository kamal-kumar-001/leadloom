import { resolveTxt } from 'node:dns/promises';
import { domainToASCII } from 'node:url';
import type { DnsStatus } from '@leadloom/contracts';

export interface TxtResolver {
  /** Empty array means DNS answered with no TXT record. Temporary failures throw. */
  resolveTxtRecords(hostname: string): Promise<string[]>;
}

export class NodeTxtResolver implements TxtResolver {
  async resolveTxtRecords(hostname: string): Promise<string[]> {
    try {
      return (await resolveTxt(hostname)).map(parts => parts.join(''));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENODATA' || code === 'ENOTFOUND') return [];
      throw error;
    }
  }
}

export interface DomainHealth {
  domain: string;
  spfStatus: DnsStatus;
  dkimStatus: DnsStatus;
  dmarcStatus: DnsStatus;
  healthScore: number;
  checkedAt: Date;
  /** Always retained: DNS configuration alone does not prove sending readiness. */
  scope: 'dns-record-diagnostics-only';
}

function normalizeDomain(value: string): string {
  const domain = domainToASCII(value.trim().toLowerCase().replace(/\.$/, ''));
  if (domain.length > 253 || !domain.includes('.') || domain.split('.').some(label =>
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('Invalid sending domain');
  }
  return domain;
}

function recordTags(record: string): Map<string, string> | null {
  const result = new Map<string, string>();
  for (const raw of record.split(';')) {
    if (!raw.trim()) continue;
    const match = /^\s*([a-z][a-z0-9_]*)\s*=\s*(.*?)\s*$/i.exec(raw);
    if (!match || result.has(match[1].toLowerCase())) return null;
    result.set(match[1].toLowerCase(), match[2]);
  }
  return result;
}

/**
 * DNS record diagnostics, NOT an SPF evaluator or a DKIM signature verifier.
 * No SMTP source IP, signed message or alignment evidence is available here.
 * "verified" means the expected record was found and passed basic checks only.
 * A sequencer must not treat a score as permission or proof of deliverability.
 */
export class DeliverabilityService {
  private readonly cache = new Map<string, { health: DomainHealth; expiresAt: number }>();

  constructor(
    private readonly resolver: TxtResolver = new NodeTxtResolver(),
    private readonly cacheTtlMs = 3_600_000,
    /** Configure selectors from the mailbox provider. DKIM selectors cannot be enumerated. */
    private readonly dkimSelectors: string[] = [],
    private readonly clock: () => number = Date.now,
    private readonly maxEntries = 1000,
  ) {
    if (cacheTtlMs < 0 || !Number.isFinite(cacheTtlMs) || maxEntries < 1) throw new Error('Invalid cache limits');
    if (dkimSelectors.some(s => !/^[a-zA-Z0-9_-]{1,63}$/.test(s))) throw new Error('Invalid DKIM selector');
  }

  async checkDomain(rawDomain: string): Promise<DomainHealth> {
    const domain = normalizeDomain(rawDomain), now = this.clock();
    const cached = this.cache.get(domain);
    if (cached && now < cached.expiresAt) return this.clone(cached.health);
    const safely = async (check: () => Promise<DnsStatus>): Promise<DnsStatus> => {
      try { return await check(); } catch { return 'unknown'; }
    };
    const [spfStatus, dkimStatus, dmarcStatus] = await Promise.all([
      safely(() => this.checkSpf(domain)), safely(() => this.checkDkim(domain)), safely(() => this.checkDmarc(domain)),
    ]);
    const health: DomainHealth = {
      domain, spfStatus, dkimStatus, dmarcStatus,
      healthScore: (spfStatus === 'verified' ? 34 : 0) + (dkimStatus === 'verified' ? 33 : 0) + (dmarcStatus === 'verified' ? 33 : 0),
      checkedAt: new Date(now), scope: 'dns-record-diagnostics-only',
    };
    // Do not hold transient lookup failures for the full hour.
    const ttl = [spfStatus, dkimStatus, dmarcStatus].includes('unknown') ? Math.min(this.cacheTtlMs, 30_000) : this.cacheTtlMs;
    this.cache.delete(domain);
    if (this.cache.size >= this.maxEntries) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(domain, { health, expiresAt: now + ttl });
    return this.clone(health);
  }

  private clone(health: DomainHealth): DomainHealth {
    return { ...health, checkedAt: new Date(health.checkedAt) };
  }

  private async checkSpf(domain: string): Promise<DnsStatus> {
    const records = (await this.resolver.resolveTxtRecords(domain)).filter(r => /^v=spf1(?:\s|$)/i.test(r));
    if (records.length !== 1) return 'failing';
    const terms = records[0].trim().split(/\s+/).slice(1);
    // A deny-all-only record explicitly authorizes nobody. A bare or +all
    // record is not healthy. Full recursive SPF evaluation belongs to send-time checks.
    const mechanisms = terms.filter(t => !t.includes('='));
    const allowsSomeSource = mechanisms.some(t => !/^[~-]/.test(t) && /^(?:\+)?(?:include:|ip4:|ip6:|a(?:$|[:/])|mx(?:$|[:/]))/i.test(t));
    if (!allowsSomeSource || mechanisms.some(t => /^\+?all$/i.test(t))) return 'failing';
    return 'verified';
  }

  private async checkDkim(domain: string): Promise<DnsStatus> {
    if (this.dkimSelectors.length === 0) return 'pending';
    let unknown = false;
    for (const selector of this.dkimSelectors) {
      try {
        const records = await this.resolver.resolveTxtRecords(`${selector}._domainkey.${domain}`);
        if (records.length !== 1) continue;
        const tags = recordTags(records[0]);
        const key = tags?.get('p');
        if (tags && key && /^[A-Za-z0-9+/]+={0,2}$/.test(key) && (!tags.has('v') || tags.get('v')?.toUpperCase() === 'DKIM1')) return 'verified';
      } catch { unknown = true; }
    }
    return unknown ? 'unknown' : 'failing';
  }

  private async checkDmarc(domain: string): Promise<DnsStatus> {
    const records = (await this.resolver.resolveTxtRecords(`_dmarc.${domain}`)).filter(r => /^v=DMARC1;/i.test(r));
    if (records.length !== 1) return 'failing';
    const tags = recordTags(records[0]);
    return tags && ['none', 'quarantine', 'reject'].includes(tags.get('p') ?? '') ? 'verified' : 'failing';
  }
}
