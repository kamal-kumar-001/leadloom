import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { auth } from '../../../auth';
import { engineCall, mintBridgeToken } from '../../../lib/engine-server';
import { validateProfileName } from '../../../lib/profile-validation';

/** A profile update counts only after authenticated durable engine confirmation. */
export async function PATCH(req: Request) {
  try {
    if (new URL(req.headers.get('origin') || '').host !== req.headers.get('host')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }); }
  const validated = validateProfileName((body as { name?: unknown } | null)?.name);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const user = session.user as typeof session.user & { idp?: string; email_verified?: boolean; authTime?: number };
  let token: string | null = null;
  if (user.idp === 'credentials') {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    const secure = (req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')) === 'https';
    const jwt = secret ? await getToken({ req, secret, secureCookie: secure }) : null;
    if (typeof jwt?.engineToken === 'string' && typeof jwt.engineExp === 'number' && jwt.engineExp > Date.now() / 1000) token = jwt.engineToken;
  } else { token = mintBridgeToken(user); }
  if (!token) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });
  try {
    const res = await engineCall('/auth/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: validated.name }) });
    const data = await res.json().catch(() => null) as { ok?: boolean; name?: string; error?: string } | null;
    if (!res.ok) return NextResponse.json({ error: res.status < 500 ? (data?.error || 'Profile update rejected') : 'Profile service unavailable' }, { status: res.status >= 400 && res.status < 500 ? res.status : 502 });
    if (data?.ok !== true || typeof data.name !== 'string' || data.name !== validated.name) return NextResponse.json({ error: 'Profile update was not confirmed' }, { status: 502 });
    return NextResponse.json({ ok: true, name: data.name });
  } catch { return NextResponse.json({ error: 'Could not confirm profile update. Reload before retrying.' }, { status: 503 }); }
}
