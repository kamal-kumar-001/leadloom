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

function isValidHttpUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return false;
    }
    if (u.username || u.password) {
      return false;
    }
    if (!u.hostname) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
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
  static readonly MAX_TITLE_LENGTH = 1_000;
  static readonly MAX_TEXT_LENGTH = 20_000;
  static readonly MAX_AUTHOR_LENGTH = 255;

  constructor(private readonly fetchImpl?: FetchLike) {}

  normalizeHits(hits: HnSearchHit[]): IncomingPost[] {
    if (!Array.isArray(hits)) return [];
    const out: IncomingPost[] = [];
    const seenIds = new Set<string>();

    for (const hit of hits) {
      if (!hit || typeof hit !== 'object' || Array.isArray(hit)) continue;

      // Require numeric-string IDs
      const rawId = hit.objectID;
      if (typeof rawId !== 'string' || !/^\d+$/.test(rawId)) continue;

      // Deduplicate IDs
      if (seenIds.has(rawId)) continue;
      seenIds.add(rawId);

      const isComment = typeof hit.comment_text === 'string' && hit.comment_text.length > 0;

      // Determine URL: canonical HN item URL for comments or stories without URL;
      // for stories with URL, require valid HTTP(S) URL without embedded credentials
      let linkUrl: string;
      if (isComment) {
        linkUrl = `https://news.ycombinator.com/item?id=${rawId}`;
      } else if (typeof hit.url === 'string' && hit.url.trim().length > 0) {
        linkUrl = hit.url.trim();
      } else if (hit.url === null || hit.url === undefined || hit.url === '') {
        linkUrl = `https://news.ycombinator.com/item?id=${rawId}`;
      } else {
        // Malformed url field (e.g. number, boolean, array, object)
        continue;
      }

      // Allow only HTTP(S) URLs without embedded credentials
      if (!isValidHttpUrl(linkUrl)) continue;

      // Bound text lengths
      const rawTitle = isComment ? hit.story_title : hit.title;
      const titleStr = typeof rawTitle === 'string' ? stripHtml(rawTitle) : '';
      const title = titleStr.slice(0, HnAlgoliaAdapter.MAX_TITLE_LENGTH);

      const rawText = isComment ? stripHtml(hit.comment_text ?? '') : '';
      const text = rawText.slice(0, HnAlgoliaAdapter.MAX_TEXT_LENGTH);

      // Don't invent missing authors or dates
      let author = '';
      if (typeof hit.author === 'string') {
        author = hit.author.trim().slice(0, HnAlgoliaAdapter.MAX_AUTHOR_LENGTH);
      }

      let postedAt = '';
      if (typeof hit.created_at === 'string' && hit.created_at.trim().length > 0) {
        const trimmed = hit.created_at.trim();
        if (!Number.isNaN(Date.parse(trimmed))) {
          postedAt = trimmed;
        }
      }

      out.push({
        source: 'hackernews',
        externalId: rawId,
        title,
        text,
        url: linkUrl,
        author,
        postedAt,
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
    const body = (await res.json()) as unknown;

    // Reject invalid response structure
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Invalid HN Algolia response: expected JSON object');
    }
    const hits = (body as Record<string, unknown>).hits;
    if (!Array.isArray(hits)) {
      throw new Error('Invalid HN Algolia response: hits must be an array');
    }

    return this.normalizeHits(hits as HnSearchHit[]);
  }
}
