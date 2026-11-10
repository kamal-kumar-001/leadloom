import { NextRequest, NextResponse } from 'next/server';

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
    const { email, survey } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid work email is required' },
        { status: 400 }
      );
    }

    // Try forwarding to engine if available
    const engineUrl = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://127.0.0.1:3001';
    try {
      const engineRes = await fetch(`${engineUrl}/validator/pages/${slug}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, survey, clientIp: ip }),
      });

      if (engineRes.ok) {
        const engineData = await engineRes.json();
        return NextResponse.json({ success: true, ...engineData, isMock: false });
      }
    } catch {
      // Fallback gracefully
    }

    // Deterministic mock preview response
    return NextResponse.json({
      success: true,
      leadId: `lead_${Date.now().toString(16)}`,
      intentScore: 88,
      isMock: true,
      message: 'Demo preview: lead recorded successfully with intent telemetry.',
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request payload' },
      { status: 400 }
    );
  }
}
