import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { auth } from '../../../../auth';
import { engineCall, mintBridgeToken } from '../../../../lib/engine-server';
import { validatePasswordUpdate } from '../../../../lib/profile-validation';

/** Never report a password change unless the authenticated engine confirms it. */
export async function POST(req: Request) {
  let sameOrigin = false;
  try { sameOrigin = new URL(req.headers.get('origin') || '').host === req.headers.get('host'); } catch {}
  if (!sameOrigin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }); }
  const { currentPassword, newPassword, confirmPassword } = (body as {
    currentPassword?: unknown; newPassword?: unknown; confirmPassword?: unknown;
  }) || {};
  const validated = validatePasswordUpdate({ currentPassword, newPassword, confirmPassword, email: session.user.email });
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const user = session.user as typeof session.user & {
    engineToken?: string; engineExp?: number; idp?: string; email_verified?: boolean;
  };
  const now = Math.floor(Date.now() / 1000);
  let token: string | null = null;
  if (user.idp === 'credentials') {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    const secure = (req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')) === 'https';
    const jwt = secret ? await getToken({ req, secret, secureCookie: secure }) : null;
    if (typeof jwt?.engineToken === 'string' && typeof jwt.engineExp === 'number' && jwt.engineExp > now) token = jwt.engineToken;
  } else {
    token = mintBridgeToken(user);
  }
  if (!token) return NextResponse.json({ error: 'Please sign in again before changing your password' }, { status: 401 });
  try {
    const res = await engineCall('/auth/password/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword: typeof currentPassword === 'string' ? currentPassword : '', newPassword }),
    });
    const data = await res.json().catch(() => null) as { ok?: boolean; error?: string; message?: string } | null;
    if (!res.ok) {
      const status = res.status >= 400 && res.status < 500 ? res.status : 502;
      return NextResponse.json({ error: status === 502 ? 'Password service unavailable. Your password was not confirmed changed.' : (data?.error || data?.message || 'Password update rejected') }, { status });
    }
    if (data?.ok !== true) return NextResponse.json({ error: 'Password change was not confirmed by the server' }, { status: 502 });
    return NextResponse.json({ ok: true, message: 'Password updated. Please sign in again.' });
  } catch {
    return NextResponse.json({ error: 'Could not confirm the password change. Sign in again to check before retrying.' }, { status: 503 });
  }
}
