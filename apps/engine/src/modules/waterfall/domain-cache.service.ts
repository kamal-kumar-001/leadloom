import * as crypto from 'crypto';
import { BYOKProvider } from '@leadloom/contracts';

export interface CacheEntry<T = unknown> {
  id: string;
  lookupHash: string;
  provider: BYOKProvider;
  targetIdentifier: string;
  responsePayload: T;
  costSavedMicrocents: number;
  hitCount: number;
  createdAt: Date;
  expiresAt: Date;
}

export class DomainCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTtlMs = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  /**
   * Normalizes a domain (strips protocol, www, trailing slashes, whitespace, and lowercases).
   */
  public normalizeDomain(domainOrUrl: string): string {
    let clean = domainOrUrl.trim().toLowerCase();
    clean = clean.replace(/^https?:\/\//, '');
    clean = clean.replace(/^www\./, '');
    clean = clean.split('/')[0];
    clean = clean.split('?')[0];
    clean = clean.split('#')[0];
    return clean;
  }

  /**
   * Generates deterministic SHA-256 hash: SHA256(provider + ":" + normalized_domain)
   */
  public computeHash(provider: BYOKProvider, domain: string, scope = "domain-only"): string {
    const normalized = this.normalizeDomain(domain);
    return crypto
      .createHash('sha256')
      .update(JSON.stringify([provider, normalized, scope]))
      .digest('hex');
  }

  /**
   * Retrieves entry from cache if present and unexpired.
   * Increments hitCount on cache hit.
   */
  public get<T>(provider: BYOKProvider, domain: string, scope?: string): CacheEntry<T> | null {
    const hash = this.computeHash(provider, domain, scope);
    const entry = this.cache.get(hash);

    if (!entry) {
      return null;
    }

    const now = new Date();
    if (now > entry.expiresAt) {
      this.cache.delete(hash);
      return null;
    }

    entry.hitCount += 1;
    return structuredClone(entry) as CacheEntry<T>;
  }

  /**
   * Sets cache entry with 30-day TTL.
   */
  public set<T>(
    provider: BYOKProvider,
    domain: string,
    payload: T,
    costSavedMicrocents: number,
    ttlMs: number = this.defaultTtlMs,
    scope?: string
  ): CacheEntry<T> {
    const hash = this.computeHash(provider, domain, scope);
    const normalized = this.normalizeDomain(domain);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    const entry: CacheEntry<T> = {
      id: crypto.randomUUID(),
      lookupHash: hash,
      provider,
      targetIdentifier: normalized,
      responsePayload: payload,
      costSavedMicrocents,
      hitCount: 1,
      createdAt: now,
      expiresAt,
    };

    if (this.cache.size >= 10000 && !this.cache.has(hash)) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(hash, entry as CacheEntry);
    return structuredClone(entry);
  }

  public has(provider: BYOKProvider, domain: string, scope?: string): boolean {
    const hash = this.computeHash(provider, domain, scope);
    const entry = this.cache.get(hash);
    if (!entry) return false;
    if (new Date() > entry.expiresAt) {
      this.cache.delete(hash);
      return false;
    }
    return true;
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}
