import { getToken } from 'next-auth/jwt';
import { auth } from '../../../../auth';
import { engineCall, mintBridgeToken } from '../../../../lib/engine-server';
import { SetupHealthResponse, SetupHealthResponseSchema } from '@leadloom/contracts';

export async function GET(req: Request) {
  // 1. Human session verification - required for viewing project & workspace setup health
  const session = await auth();
  const user = session?.user as (Record<string, unknown> & { email?: string | null }) | undefined;
  if (!user?.email) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 2. Resolve token for engine call to verify role server-side
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
      authTime: user.authTime as number | undefined,
    });
  }

  if (!token) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 3. Query engine /setup-health with administrator credentials
  try {
    const res = await engineCall('/setup-health', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 403) {
      return Response.json({ error: 'Human administrator access required' }, { status: 403 });
    }

    if (res.ok) {
      const data = await res.json();
      const parsed = SetupHealthResponseSchema.safeParse(data);
      if (parsed.success) {
        return Response.json(parsed.data, {
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
      }
    }
  } catch {
    // Engine offline or unreachable
  }

  // 4. Graceful read-only fallback when engine is not actively connected
  const publicApiUrl =
    process.env.LEADLOOM_PUBLIC_API_URL || 'https://leadloom.dmpilot.org/api/agent';
  const publicApiConfigured = Boolean(process.env.LEADLOOM_PUBLIC_API_URL);
  const authSecretConfigured = Boolean(
    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  );
  const bridgeSecretConfigured = Boolean(
    process.env.LEADLOOM_NEXTAUTH_BRIDGE_SECRET
  );

  const fallback: SetupHealthResponse = {
    status: 'degraded',
    database: {
      status: 'unreachable',
      verdict: 'UNREACHABLE',
      verificationMode: 'column-presence-only',
      missingTables: [],
      missingColumnsCount: 0,
      diagnostic:
        'Engine service is not reachable from web proxy. Column-presence-only inspection unavailable.',
    },
    config: {
      publicApiUrl,
      publicApiConfigured,
      authSecretConfigured,
      bridgeSecretConfigured,
    },
    providers: {
      websiteFetcher: 'disabled',
      outboundDispatch: 'unmounted',
      vaultEncryption: 'unconfigured',
      mutationsEnabled: false,
    },
    checkedAt: new Date().toISOString(),
  };

  return Response.json(fallback, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
