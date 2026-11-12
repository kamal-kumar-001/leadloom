import * as crypto from 'crypto';
import { BYOKProvider } from '@leadloom/contracts';
import type { PrismaClient } from '@leadloom/database';

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

/**
 * Minimal Prisma delegate interface for the enrichment_cache table (ADR-003 §2).
 */
export interface EnrichmentCacheRepository {
  findUnique(args: { where: { cacheKey: string } }): Promise<any>;
  upsert(args: { where: { cacheKey: string }; create: any; update: any }): Promise<any>;
  update(args: { where: { cacheKey: string }; data: any }): Promise<any>;
  deleteMany(args?: { where?: any }): Promise<{ count: number }>;
  count?(args?: { where?: any }): Promise<number>;
}

export interface DomainCacheClient {
  enrichmentCache: EnrichmentCacheRepository;
}

export class DomainCacheService {
  private inMemoryCache = new Map<string, CacheEntry>();
  private readonly defaultTtlMs: number;
  private readonly repository?: EnrichmentCacheRepository;

  constructor(
    prismaOrRepo?: PrismaClient | DomainCacheClient | EnrichmentCacheRepository,
    options?: { defaultTtlMs?: number }
  ) {
    this.defaultTtlMs = options?.defaultTtlMs ?? (30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds

    if (prismaOrRepo) {
      if ('enrichmentCache' in prismaOrRepo && prismaOrRepo.enrichmentCache) {
        this.repository = prismaOrRepo.enrichmentCache;
      } else if ('findUnique' in prismaOrRepo && 'upsert' in prismaOrRepo) {
        this.repository = prismaOrRepo as EnrichmentCacheRepository;
      }
    }
  }

  /**
   * Returns true if this service instance is backed by a database repository.
   */
  public isDbBacked(): boolean {
    return Boolean(this.repository);
  }

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
   * Generates deterministic SHA-256 hash: SHA256(provider + ":" + normalized_domain + ":" + scope)
   */
  public computeHash(provider: BYOKProvider, domain: string, scope = 'domain-only'): string {
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
  public async get<T>(provider: BYOKProvider, domain: string, scope?: string): Promise<CacheEntry<T> | null> {
    const hash = this.computeHash(provider, domain, scope);
    const now = new Date();

    if (this.repository) {
      const row = await this.repository.findUnique({ where: { cacheKey: hash } });
      if (!row) return null;

      const expiresAt = new Date(row.expiresAt);
      if (now > expiresAt) {
        // Expired row: delete and treat as cache miss
        await this.repository.deleteMany({ where: { cacheKey: hash } }).catch(() => {});
        return null;
      }

      // Increment hit count atomically
      let updatedHitCount = (row.hitCount ?? 0) + 1;
      try {
        const updated = await this.repository.update({
          where: { cacheKey: hash },
          data: { hitCount: { increment: 1 } },
        });
        if (updated && typeof updated.hitCount === 'number') {
          updatedHitCount = updated.hitCount;
        }
      } catch {
        // Silently tolerate concurrent update races
      }

      // Unpack response payload and saved cost
      let responsePayload: T;
      let costSavedMicrocents = 0;
      const rawPayload = row.payload;

      if (rawPayload && typeof rawPayload === 'object' && ('responsePayload' in rawPayload || 'costSavedMicrocents' in rawPayload)) {
        const wrapped = rawPayload as { responsePayload?: T; costSavedMicrocents?: number };
        responsePayload = (wrapped.responsePayload !== undefined ? wrapped.responsePayload : (rawPayload as unknown as T));
        costSavedMicrocents = Number(wrapped.costSavedMicrocents ?? 0);
      } else {
        responsePayload = rawPayload as unknown as T;
        costSavedMicrocents = 0;
      }

      return {
        id: row.id,
        lookupHash: row.cacheKey,
        provider: row.provider as BYOKProvider,
        targetIdentifier: row.domain,
        responsePayload,
        costSavedMicrocents,
        hitCount: updatedHitCount,
        createdAt: new Date(row.createdAt),
        expiresAt,
      };
    }

    // In-Memory Fallback
    const entry = this.inMemoryCache.get(hash);
    if (!entry) return null;

    if (now > entry.expiresAt) {
      this.inMemoryCache.delete(hash);
      return null;
    }

    entry.hitCount += 1;
    return structuredClone(entry) as CacheEntry<T>;
  }

  /**
   * Sets cache entry with 30-day TTL (or custom ttlMs).
   */
  public async set<T>(
    provider: BYOKProvider,
    domain: string,
    payload: T,
    costSavedMicrocents: number,
    ttlMs: number = this.defaultTtlMs,
    scope?: string
  ): Promise<CacheEntry<T>> {
    const hash = this.computeHash(provider, domain, scope);
    const normalized = this.normalizeDomain(domain);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    const entryId = crypto.randomUUID();

    if (this.repository) {
      const jsonPayload = {
        responsePayload: payload,
        costSavedMicrocents: costSavedMicrocents ?? 0,
      };

      const row = await this.repository.upsert({
        where: { cacheKey: hash },
        create: {
          id: entryId,
          cacheKey: hash,
          domain: normalized,
          provider,
          payload: jsonPayload,
          hitCount: 1,
          expiresAt,
          createdAt: now,
        },
        update: {
          domain: normalized,
          provider,
          payload: jsonPayload,
          expiresAt,
        },
      });

      return {
        id: row.id ?? entryId,
        lookupHash: hash,
        provider,
        targetIdentifier: normalized,
        responsePayload: payload,
        costSavedMicrocents: costSavedMicrocents ?? 0,
        hitCount: row.hitCount ?? 1,
        createdAt: row.createdAt ? new Date(row.createdAt) : now,
        expiresAt: row.expiresAt ? new Date(row.expiresAt) : expiresAt,
      };
    }

    // In-Memory Fallback
    const entry: CacheEntry<T> = {
      id: entryId,
      lookupHash: hash,
      provider,
      targetIdentifier: normalized,
      responsePayload: payload,
      costSavedMicrocents,
      hitCount: 1,
      createdAt: now,
      expiresAt,
    };

    if (this.inMemoryCache.size >= 10000 && !this.inMemoryCache.has(hash)) {
      this.inMemoryCache.delete(this.inMemoryCache.keys().next().value!);
    }
    this.inMemoryCache.set(hash, entry as CacheEntry);
    return structuredClone(entry);
  }

  public async has(provider: BYOKProvider, domain: string, scope?: string): Promise<boolean> {
    const hash = this.computeHash(provider, domain, scope);
    const now = new Date();

    if (this.repository) {
      const row = await this.repository.findUnique({ where: { cacheKey: hash } });
      if (!row) return false;
      if (now > new Date(row.expiresAt)) {
        await this.repository.deleteMany({ where: { cacheKey: hash } }).catch(() => {});
        return false;
      }
      return true;
    }

    const entry = this.inMemoryCache.get(hash);
    if (!entry) return false;
    if (now > entry.expiresAt) {
      this.inMemoryCache.delete(hash);
      return false;
    }
    return true;
  }

  public async delete(provider: BYOKProvider, domain: string, scope?: string): Promise<boolean> {
    const hash = this.computeHash(provider, domain, scope);
    if (this.repository) {
      const result = await this.repository.deleteMany({ where: { cacheKey: hash } });
      return result.count > 0;
    }
    return this.inMemoryCache.delete(hash);
  }

  public async clear(): Promise<void> {
    if (this.repository) {
      await this.repository.deleteMany({});
      return;
    }
    this.inMemoryCache.clear();
  }

  public async size(): Promise<number> {
    if (this.repository) {
      if (typeof this.repository.count === 'function') {
        return await this.repository.count({ where: { expiresAt: { gt: new Date() } } });
      }
      return 0;
    }
    return this.inMemoryCache.size;
  }

  /**
   * Prunes all expired cache entries from the backing store.
   * Useful for periodic maintenance / cron jobs to reclaim storage.
   */
  public async pruneExpired(now = new Date()): Promise<number> {
    if (this.repository) {
      const result = await this.repository.deleteMany({ where: { expiresAt: { lte: now } } });
      return result.count;
    }

    let deleted = 0;
    for (const [hash, entry] of this.inMemoryCache.entries()) {
      if (now > entry.expiresAt) {
        this.inMemoryCache.delete(hash);
        deleted += 1;
      }
    }
    return deleted;
  }
}
