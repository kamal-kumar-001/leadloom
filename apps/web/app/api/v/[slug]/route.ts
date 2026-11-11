import { NextRequest, NextResponse } from 'next/server';
import { engineBase } from '@/lib/engine-server';

// Public smoke-page content proxy. Fetching the page records one raw page
// load in the engine (visitors counts loads, not unique people). No mock
// fallback: if the engine has no such page, the visitor sees an honest 404.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,128}$/i.test(slug)) {
    return NextResponse.json({ error: 'Smoke test page not found' }, { status: 404 });
  }
  const engineUrl = engineBase();
  try {
    // Forward the client IP so the engine's shared per-IP rate limit keys the
    // real visitor, not this proxy's loopback address.
    const fwd = request.headers.get('x-forwarded-for');
    const engineRes = await fetch(`${engineUrl}/validator/pages/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
      headers: fwd ? { 'X-Forwarded-For': fwd } : undefined,
    });
    if (engineRes.status === 404) {
      return NextResponse.json({ error: 'Smoke test page not found' }, { status: 404 });
    }
    if (engineRes.status === 429) {
      return NextResponse.json({ error: 'Too many requests. Please try again in a few minutes.' }, { status: 429 });
    }
    if (engineRes.status === 503) {
      return NextResponse.json({ error: 'The page could not be loaded right now.' }, { status: 503 });
    }
    if (!engineRes.ok) {
      return NextResponse.json({ error: 'The page could not be loaded right now.' }, { status: 502 });
    }
    const data = await engineRes.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'The page could not be loaded right now.' }, { status: 502 });
  }
}
