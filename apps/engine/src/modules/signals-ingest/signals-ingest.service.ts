import { MatchingService } from './matching.service';
import { IncomingPost, MatchedSignal, ProductProfile } from './types';

/**
 * In-memory orchestration for the discovery slice: registered product
 * profiles, deduped incoming posts, and on-demand matching. Persistence is a
 * later, schema-approved step; this baseline follows the DomainCacheService
 * in-memory pattern.
 */
export class SignalsIngestService {
  private readonly posts = new Map<string, IncomingPost>();
  private readonly profiles = new Map<string, ProductProfile>();

  constructor(private readonly matching = new MatchingService()) {}

  registerProfile(profile: ProductProfile): void {
    if (!profile.productId) throw new Error('Product profile needs a productId.');
    this.profiles.set(profile.productId, profile);
  }

  listProfiles(): ProductProfile[] {
    return Array.from(this.profiles.values());
  }

  /** Dedupes on source + externalId. Returns what happened. */
  ingest(posts: IncomingPost[]): { added: number; duplicates: number } {
    let added = 0;
    let duplicates = 0;
    for (const post of posts) {
      const key = `${post.source}:${post.externalId}`;
      if (this.posts.has(key)) {
        duplicates += 1;
        continue;
      }
      this.posts.set(key, post);
      added += 1;
    }
    return { added, duplicates };
  }

  /** All matches across stored posts and profiles, best score first. */
  matches(): MatchedSignal[] {
    const profiles = this.listProfiles();
    const out: MatchedSignal[] = [];
    for (const post of Array.from(this.posts.values())) {
      out.push(...this.matching.matchPost(post, profiles));
    }
    return out.sort((a, b) => b.score - a.score);
  }

  countPosts(): number {
    return this.posts.size;
  }

  clear(): void {
    this.posts.clear();
  }
}
