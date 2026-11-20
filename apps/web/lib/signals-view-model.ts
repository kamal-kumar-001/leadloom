import {
  HnAlgoliaAdapter,
  HnSearchResponse,
  IncomingPost,
  ManualImportAdapter,
  MatchedSignal,
  PRODUCT_PROFILES,
  ProductProfile,
  SignalsIngestService,
} from '@leadloom/engine/src/modules/signals-ingest';
import hnFixture from '@leadloom/engine/src/modules/signals-ingest/__tests__/fixtures/hn-search-comments.json';

/**
 * Server-side view model for the Signals dashboard slice (S2).
 *
 * Provenance is explicit on every row: this slice renders a RECORDED HN
 * Algolia fixture (fetched once on 2026-11-19, stored in the repo) plus a
 * clearly labeled manual-import SAMPLE. Live HN fetches happen only through
 * /api/signals/live-hn on explicit click. Reddit/X/LinkedIn are shown as
 * unavailable states, never as silently empty feeds.
 */

export type SignalProvenance = 'recorded-fixture' | 'manual-sample' | 'live-hn';

export interface SignalMatchView {
  productId: string;
  displayName: string;
  score: number;
  matchedTerms: string[];
  explanation: string;
}

export interface SignalRowView {
  key: string;
  source: IncomingPost['source'];
  externalId: string;
  provenance: SignalProvenance;
  title: string;
  /** Full text, needed so a draft can quote the real post. */
  text: string;
  excerpt: string;
  url: string;
  author: string;
  postedAt: string;
  match: SignalMatchView | null;
}

export interface SourceStatus {
  id: string;
  label: string;
  state: 'fixture' | 'manual-only' | 'not-connected';
  detail: string;
  termsUrl: string | null;
}

/**
 * INTERNAL implementation/legal notes (not user-facing copy):
 * - Hacker News is read through the documented keyless Algolia API
 *   (10,000 req/hr/IP, https://hn.algolia.com/api); the page default is a
 *   fixture recorded 2026-11-19, live fetch is one request per click.
 * - Reddit: official Data API needs a registered OAuth app and commercial
 *   use needs a separate agreement (Data API Terms 2.8 / 3.1,
 *   https://redditinc.com/policies/data-api-terms). We have not built any
 *   import route beyond manual import.
 * - X: official API terms not yet verified by us; nothing built.
 * - LinkedIn: approved-developer APIs exist; we have not evaluated or
 *   connected any route (https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-05).
 */
export const SOURCE_STATUSES: SourceStatus[] = [
  {
    id: 'hackernews',
    label: 'Hacker News',
    state: 'fixture',
    detail:
      'This page shows a recorded snapshot from 2026-11-19. A live check runs only when you click the button, once per click, and results are not stored.',
    termsUrl: 'https://hn.algolia.com/api',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    state: 'manual-only',
    detail:
      'Manual import only: open a post yourself and choose to import it. We have not built an automatic import route.',
    termsUrl: 'https://redditinc.com/policies/data-api-terms',
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    state: 'not-connected',
    detail: 'Not connected yet.',
    termsUrl: null,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    state: 'not-connected',
    detail: 'Not connected yet.',
    termsUrl: 'https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-05',
  },
];

function explain(match: MatchedSignal, profile: ProductProfile): string {
  const phrases = profile.problemPhrases.filter((p) => match.matchedTerms.includes(p));
  const keywords = profile.keywords.filter((k) => match.matchedTerms.includes(k));
  const totalWeight = profile.problemPhrases.length * 2 + profile.keywords.length;
  const hitWeight = phrases.length * 2 + keywords.length;
  const parts: string[] = [];
  if (phrases.length) parts.push(`phrase ${phrases.map((p) => `"${p}"`).join(', ')} (2x weight)`);
  if (keywords.length) parts.push(`keyword ${keywords.map((k) => `"${k}"`).join(', ')}`);
  return `${parts.join(' + ')} -> covers ${hitWeight}/${totalWeight} weighted terms -> score ${match.score.toFixed(2)}`;
}

function toRow(
  post: IncomingPost,
  provenance: SignalProvenance,
  match: MatchedSignal | null,
  profile: ProductProfile | null,
): SignalRowView {
  return {
    key: `${post.source}:${post.externalId}`,
    source: post.source,
    externalId: post.externalId,
    provenance,
    title: post.title,
    text: post.text,
    excerpt: post.text.length > 280 ? `${post.text.slice(0, 277)}...` : post.text,
    url: post.url,
    author: post.author,
    postedAt: post.postedAt,
    match:
      match && profile
        ? {
            productId: profile.productId,
            displayName: profile.displayName,
            score: match.score,
            matchedTerms: match.matchedTerms,
            explanation: explain(match, profile),
          }
        : null,
  };
}

function bestMatchPerPost(
  svc: SignalsIngestService,
  posts: IncomingPost[],
): Map<string, { match: MatchedSignal; profile: ProductProfile }> {
  const out = new Map<string, { match: MatchedSignal; profile: ProductProfile }>();
  const all = svc.matches();
  for (const post of posts) {
    const best = all
      .filter((m) => m.post.source === post.source && m.post.externalId === post.externalId)
      .sort((a, b) => b.score - a.score)[0];
    if (best) {
      const profile = PRODUCT_PROFILES.find((p) => p.productId === best.productId)!;
      out.set(`${post.source}:${post.externalId}`, { match: best, profile });
    }
  }
  return out;
}

export function buildDemoSignalsView(): { rows: SignalRowView[]; profiles: ProductProfile[] } {
  const svc = new SignalsIngestService();
  for (const profile of PRODUCT_PROFILES) svc.registerProfile(profile);

  const hnPosts = new HnAlgoliaAdapter().normalizeHits((hnFixture as unknown as HnSearchResponse).hits);
  const manualPosts = new ManualImportAdapter().parse(
    JSON.stringify([
      {
        title: 'UPI payments for my small SaaS',
        text: 'Looking for a UPI payment gateway that does not need webhook-only confirmation. Razorpay alternative for a tiny merchant?',
        url: 'https://example.com/reddit-style-post-1',
        author: 'sample-user',
        postedAt: '2026-11-18T09:30:00Z',
      },
      {
        title: 'Cafe billing chaos',
        text: 'My cafe billing is chaos and I need ingredient inventory tracking plus a kitchen display before the weekend rush.',
        url: 'https://example.com/reddit-style-post-2',
        author: 'sample-user-2',
        postedAt: '2026-11-18T15:05:00Z',
      },
    ]),
  );

  svc.ingest(hnPosts);
  svc.ingest(manualPosts);
  const best = bestMatchPerPost(svc, [...hnPosts, ...manualPosts]);

  const rows: SignalRowView[] = [
    ...hnPosts.map((p) => {
      const b = best.get(`${p.source}:${p.externalId}`);
      return toRow(p, 'recorded-fixture', b?.match ?? null, b?.profile ?? null);
    }),
    ...manualPosts.map((p) => {
      const b = best.get(`${p.source}:${p.externalId}`);
      return toRow(p, 'manual-sample', b?.match ?? null, b?.profile ?? null);
    }),
  ];
  rows.sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
  return { rows, profiles: PRODUCT_PROFILES };
}
