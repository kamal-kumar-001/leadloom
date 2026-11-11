import { NextRequest, NextResponse } from 'next/server';
import { engineBase } from '@/lib/engine-server';

// In-memory sliding-window bucket for rate-limiting public waitlist submissions
interface WindowEntry {
  timestamps: number[];
}

const rateLimitMap = new Map<string, WindowEntry>();
const MAX_REQUESTS = 5;
const WINDOW_MS = 600_000; // 10 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { timestamps: [] };

  // Remove timestamps older than WINDOW_MS
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);

  if (entry.timestamps.length >= MAX_REQUESTS) {
    rateLimitMap.set(ip, entry);
    return true;
  }

  entry.timestamps.push(now);
  rateLimitMap.set(ip, entry);
  return false;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Extract client IP (handle proxies & dev loopback)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      {
        error: 'Too many submissions from your IP. Please try again in 10 minutes.',
        retryAfterSeconds: 600,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email, survey, name, company, referrer } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid work email is required' },
        { status: 400 }
      );
    }

    // Forward to the engine using its contract field names. No mock success:
    // if the engine is unreachable or rejects the submission, the visitor
    // gets an honest error instead of a fake confirmation.
    const engineUrl = engineBase();
    let engineRes: Response;
    try {
      engineRes = await fetch(`${engineUrl}/validator/pages/${encodeURIComponent(slug)}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, company, surveyResponses: survey ?? {}, referrer }),
      });
    } catch {
      return NextResponse.json({ error: 'Your response could not be saved right now. Please try again.' }, { status: 502 });
    }
    if (engineRes.status === 404) {
      return NextResponse.json({ error: 'This smoke test page is no longer available.' }, { status: 404 });
    }
    if (!engineRes.ok) {
      return NextResponse.json({ error: 'Your response could not be saved right now. Please try again.' }, { status: 502 });
    }
    const engineData = await engineRes.json();
    return NextResponse.json({ success: true, totalWaitlist: engineData.totalWaitlist });
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request payload' },
      { status: 400 }
    );
  }
}
