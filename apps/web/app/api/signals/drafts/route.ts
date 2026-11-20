import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { PRODUCT_PROFILES, type IncomingPost } from '@leadloom/engine/src/modules/signals-ingest';
import { getDraftStoreForUser } from '../../../../lib/signals-drafts-store';
import { checkRateLimit } from '../../../../lib/signals-rate-limit';

const SOURCES = new Set(['hackernews', 'manual']);

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  return NextResponse.json({ drafts: getDraftStoreForUser(session.user.email).list(), sessionOnly: true });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const rl = checkRateLimit(`drafts:${email}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit reached. Slow down.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } });
  }

  let payload: { post?: Partial<IncomingPost>; productId?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const p = payload.post;
  const profile = PRODUCT_PROFILES.find((x) => x.productId === payload.productId);
  if (
    !profile ||
    !p ||
    typeof p.source !== 'string' ||
    !SOURCES.has(p.source) ||
    typeof p.externalId !== 'string' ||
    !p.externalId ||
    p.externalId.length > 200 ||
    typeof p.url !== 'string' ||
    !/^https:\/\//.test(p.url) ||
    p.url.length > 2000 ||
    typeof p.title !== 'string' ||
    typeof p.text !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid post or product' }, { status: 400 });
  }
  const post: IncomingPost = {
    source: p.source as IncomingPost['source'],
    externalId: p.externalId,
    title: p.title.slice(0, 300),
    text: p.text.slice(0, 5000),
    url: p.url,
    author: typeof p.author === 'string' ? p.author.slice(0, 120) : '',
    postedAt: typeof p.postedAt === 'string' ? p.postedAt.slice(0, 40) : '',
  };
  try {
    const draft = getDraftStoreForUser(email).create(post, profile);
    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not create draft' }, { status: 422 });
  }
}
