import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { auth } from '../../../../auth';
import { engineCall, mintBridgeToken } from '../../../../lib/engine-server';

// Authenticated same-origin proxy to the engine. The browser never sees or sends an engine token:
// this route attaches it from the server-side session. Fail closed on every doubt.
const BLOCKED_PREFIXES = ['auth/login', 'auth/register', 'auth/verify-email', 'auth/resend-verification', 'auth/forgot-password', 'auth/reset-password'];

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (!path?.length || path.some((s) => !s || s === '.' || s === '..' || /[\\/%\0]/.test(s))) {
    return NextResponse.json({ error: 'Bad path' }, { status: 400 });
  }
  const joined = path.join('/');
  if (BLOCKED_PREFIXES.some((p) => joined === p || joined.startsWith(`${p}/`))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (req.method !== 'GET') {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    if (!origin || !host || new URL(origin).host !== host) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const session = await auth();
  const user = session?.user as (Record<string, unknown> & { email?: string | null }) | undefined;
  if (!user?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  // Credentials sessions carry an engine session token server-side; provider sessions get a bridge token.
  let token: string | null = null;
  if (user.idp === 'credentials') {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    const secure = (req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')) === 'https';
    const jwt = secret ? await getToken({ req, secret, secureCookie: secure }) : null;
    const et = jwt?.engineToken as string | undefined;
    const ee = jwt?.engineExp as number | undefined;
    if (et && ee && ee * 1000 > Date.now()) token = et;
  } else {
    token = mintBridgeToken({
      email: user.email,
      idp: user.idp as string | undefined,
      email_verified: user.email_verified as boolean | undefined,
    });
  }
  if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const url = new URL(req.url);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const ct = req.headers.get('content-type');
  if (ct) headers['Content-Type'] = ct;
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) headers['X-Forwarded-For'] = fwd;

  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();
  if (body && body.length > 1_000_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });

  try {
    const res = await engineCall(`/${joined}${url.search}`, { method: req.method, headers, body });
    const out = await res.text();
    return new NextResponse(out || null, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Engine unavailable' }, { status: 503 });
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
