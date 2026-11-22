import 'server-only';
import { getToken } from 'next-auth/jwt';
import { auth } from '../auth';
import { headers } from 'next/headers';
import { engineCall, mintBridgeToken } from './engine-server';

type CurrentWebAccess =
  | { ok: true; email: string; userId: string; workspaceId: string; role: 'admin' | 'member' | 'read_only' }
  | { ok: false; status: 401 | 403 | 503; error: string };
const unauthenticated = (): CurrentWebAccess => ({ ok: false, status: 401, error: 'Authentication required' });
const unavailable = (): CurrentWebAccess => ({ ok: false, status: 503, error: 'Account access could not be verified. Try again shortly.' });

/** Signed web cookies are not current account authority. Verify access before local reads or work. */
export async function currentWebAccess(input?: Request): Promise<CurrentWebAccess> {
  try {
    const req = input ?? new Request('http://localhost', { headers: await headers() });
    const session = await auth();
    const user = session?.user as { email?: string | null; idp?: string; email_verified?: boolean; authTime?: number } | undefined;
    if (!user?.email?.trim()) return unauthenticated();
    let token: string | null = null;
    if (user.idp === 'credentials') {
      const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
      const secure = (req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')) === 'https';
      const jwt = secret ? await getToken({ req, secret, secureCookie: secure }) : null;
      if (typeof jwt?.engineToken === 'string' && jwt.engineToken && typeof jwt.engineExp === 'number' && jwt.engineExp * 1000 > Date.now()) token = jwt.engineToken;
    } else {
      token = mintBridgeToken(user);
    }
    if (!token) return unauthenticated();
    const response = await engineCall('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 401) return unauthenticated();
    if (response.status === 403) return { ok: false, status: 403, error: 'Account access denied' };
    if (!response.ok) return unavailable();
    const data = await response.json() as { userId?: unknown; workspaceId?: unknown; role?: unknown } | null;
    if (!data || typeof data.userId !== 'string' || !data.userId || typeof data.workspaceId !== 'string' || !data.workspaceId || !['admin', 'member', 'read_only'].includes(String(data.role))) return unavailable();
    return { ok: true, email: user.email.trim().toLowerCase(), userId: data.userId, workspaceId: data.workspaceId, role: data.role as 'admin' | 'member' | 'read_only' };
  } catch {
    return unavailable();
  }
}
