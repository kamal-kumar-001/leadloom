import { IncomingPost } from '../types';

export interface HnSearchHit {
  objectID: string;
  title?: string | null;
  story_title?: string | null;
  comment_text?: string | null;
  url?: string | null;
  story_url?: string | null;
  author?: string | null;
  created_at?: string | null;
}

export interface HnSearchResponse {
  hits: HnSearchHit[];
}

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Adapter for the documented public HN Algolia search API
 * (https://hn.algolia.com/api). The official page states one bound: at most
 * 10,000 requests/hour from a single IP. Callers decide cadence; this adapter
 * issues exactly one request per search() call and never polls in a loop.
 */
export class HnAlgoliaAdapter {
  static readonly API_BASE = 'https://hn.algolia.com/api/v1';
  static readonly DOCUMENTED_RATE_LIMIT_PER_HOUR = 10_000;

  constructor(private readonly fetchImpl?: FetchLike) {}

  normalizeHits(hits: HnSearchHit[]): IncomingPost[] {
    const out: IncomingPost[] = [];
    for (const hit of hits) {
      if (!hit.objectID) continue;
      const isComment = typeof hit.comment_text === 'string' && hit.comment_text.length > 0;
      const title = isComment ? hit.story_title ?? '' : hit.title ?? '';
      const text = isComment ? stripHtml(hit.comment_text ?? '') : '';
      const linkUrl = isComment
        ? `https://news.ycombinator.com/item?id=${hit.objectID}`
        : hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`;
      out.push({
        source: 'hackernews',
        externalId: hit.objectID,
        title: stripHtml(title),
        text,
        url: linkUrl,
        author: hit.author ?? '',
        postedAt: hit.created_at ?? '',
      });
    }
    return out;
  }

  async search(query: string, opts: { tags?: string; hitsPerPage?: number } = {}): Promise<IncomingPost[]> {
    if (!this.fetchImpl) {
      throw new Error('HnAlgoliaAdapter.search needs a fetch implementation; tests must inject one.');
    }
    const url =
      `${HnAlgoliaAdapter.API_BASE}/search?query=${encodeURIComponent(query)}` +
      `&tags=${encodeURIComponent(opts.tags ?? 'comment')}` +
      `&hitsPerPage=${opts.hitsPerPage ?? 20}`;
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`HN Algolia request failed: HTTP ${res.status}`);
    const body = (await res.json()) as HnSearchResponse;
    return this.normalizeHits(body.hits ?? []);
  }
}
