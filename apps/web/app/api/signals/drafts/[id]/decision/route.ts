import { NextResponse } from 'next/server';
import { auth } from '../../../../../../auth';
import { getDraftStoreForUser } from '../../../../../../lib/signals-drafts-store';
import { checkRateLimit } from '../../../../../../lib/signals-rate-limit';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const rl = checkRateLimit(`decisions:${email}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit reached. Slow down.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } });
  }

  const { id } = await ctx.params;
  let payload: { decision?: string; body?: string; destinationUrl?: string; identity?: string | null };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (payload.decision !== 'approved' && payload.decision !== 'rejected') {
    return NextResponse.json({ error: 'Decision must be approved or rejected' }, { status: 400 });
  }
  if (typeof payload.body !== 'string' || typeof payload.destinationUrl !== 'string') {
    return NextResponse.json({ error: 'Reviewed body and destinationUrl are required' }, { status: 400 });
  }
  try {
    const draft = getDraftStoreForUser(email).decide(id, payload.decision, {
      body: payload.body,
      destinationUrl: payload.destinationUrl,
      identity: payload.identity ?? null,
    });
    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Decision failed' }, { status: 422 });
  }
}
