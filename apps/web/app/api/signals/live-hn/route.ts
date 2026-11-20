import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import {
  HnAlgoliaAdapter,
  PRODUCT_PROFILES,
  SignalsIngestService,
} from '@leadloom/engine/src/modules/signals-ingest';
import { acquireInFlight, checkRateLimit, releaseInFlight } from '../../../../lib/signals-rate-limit';

/**
 * Bounded live request to the documented HN Algolia API.
 * Server-side protections (the UI button alone is not protection):
 * - authenticated session required
 * - query validated (1-120 chars, no control characters)
 * - per-user sliding window: 6 requests/minute
 * - per-user concurrency: 1 in-flight fetch
 * Results are returned and forgotten; nothing is stored.
 */
export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const rl = checkRateLimit(`live-hn:${email}`, 6, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit reached. Live HN fetch allows 6 requests per minute.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }
  if (!acquireInFlight(`live-hn:${email}`, 1)) {
    return NextResponse.json({ error: 'A live fetch is already running. Wait for it to finish.' }, { status: 409 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') ?? '').trim();
    if (!q || q.length > 120 || /[\u0000-\u001F\u007F]/.test(q)) {
      return NextResponse.json({ error: 'Query must be 1-120 characters without control characters.' }, { status: 400 });
    }
    const posts = await new HnAlgoliaAdapter(fetch).search(q, { hitsPerPage: 10 });
    const svc = new SignalsIngestService();
    for (const profile of PRODUCT_PROFILES) svc.registerProfile(profile);
    svc.ingest(posts);
    const all = svc.matches();
    const rows = posts.map((post) => {
      const best = all
        .filter((m) => m.post.externalId === post.externalId)
        .sort((a, b) => b.score - a.score)[0];
      const profile = best ? PRODUCT_PROFILES.find((p) => p.productId === best.productId) : null;
      return {
        key: `${post.source}:${post.externalId}`,
        source: post.source,
        externalId: post.externalId,
        title: post.title,
        text: post.text,
        excerpt: post.text.length > 280 ? `${post.text.slice(0, 277)}...` : post.text,
        url: post.url,
        author: post.author,
        postedAt: post.postedAt,
        match:
          best && profile
            ? {
                productId: profile.productId,
                displayName: profile.displayName,
                score: best.score,
                matchedTerms: best.matchedTerms,
                explanation: `matched ${best.matchedTerms.map((t) => `"${t}"`).join(', ')} -> score ${best.score.toFixed(2)}`,
              }
            : null,
      };
    });
    return NextResponse.json({ rows, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'HN fetch failed.' },
      { status: 502 },
    );
  } finally {
    releaseInFlight(`live-hn:${email}`);
  }
}
