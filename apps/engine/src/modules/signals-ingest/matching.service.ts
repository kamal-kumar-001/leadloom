import { IncomingPost, MatchedSignal, ProductProfile } from './types';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Phrase match for multi-word terms, word-boundary match for single words. */
export function termMatches(textLower: string, termRaw: string): boolean {
  const term = termRaw.trim().toLowerCase();
  if (!term) return false;
  if (term.includes(' ')) return textLower.includes(term);
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(textLower);
}

export class MatchingService {
  /**
   * Score one post against every profile. A phrase match weighs 2, a keyword
   * match weighs 1; score = 0.3 base + 0.7 * matched/total weight, capped at 1.
   * Posts with no matched term are omitted.
   */
  matchPost(post: IncomingPost, profiles: ProductProfile[]): MatchedSignal[] {
    const haystack = `${post.title}\n${post.text}`.toLowerCase();
    const out: MatchedSignal[] = [];
    for (const profile of profiles) {
      const matchedTerms: string[] = [];
      let weight = 0;
      let matchedWeight = 0;
      for (const phrase of profile.problemPhrases) {
        weight += 2;
        if (termMatches(haystack, phrase)) {
          matchedTerms.push(phrase);
          matchedWeight += 2;
        }
      }
      for (const keyword of profile.keywords) {
        weight += 1;
        if (termMatches(haystack, keyword)) {
          matchedTerms.push(keyword);
          matchedWeight += 1;
        }
      }
      if (matchedTerms.length === 0 || weight === 0) continue;
      const score = Math.min(1, 0.3 + 0.7 * (matchedWeight / weight));
      out.push({ post, productId: profile.productId, score: Number(score.toFixed(3)), matchedTerms });
    }
    return out.sort((a, b) => b.score - a.score);
  }
}
