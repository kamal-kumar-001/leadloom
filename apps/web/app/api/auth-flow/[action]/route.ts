import { NextResponse } from 'next/server';
import { engineCall } from '../../../../lib/engine-server';

// Public, unauthenticated steps of the emailed-code flow. The engine owns every rule
// (codes, limits, anti-enumeration). This route only forwards, same-origin, and never logs bodies.
const ACTIONS = new Set([
  'register',
  'verify-email',
  'resend-verification',
  'forgot-password',
  'reset-password',
]);

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (!ACTIONS.has(action)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const text = await req.text();
  if (text.length > 4096) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) headers['X-Forwarded-For'] = fwd;

  try {
    const res = await engineCall(`/auth/${action}`, { method: 'POST', headers, body: text });
    const body = await res.text();
    return new NextResponse(body || null, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
}
