import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isPlatformAdmin } from '@/lib/platform-admin';

/**
 * Explicit server-side API guard verifying the platform administrator session.
 * Requires:
 * 1. Active cryptographically verified session
 * 2. Provider-verified email (email_verified === true)
 * 3. Exact match with configured LEADLOOM_PLATFORM_ADMIN_EMAIL
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }

  const authorized = isPlatformAdmin(session.user);
  if (!authorized) {
    return NextResponse.json(
      { ok: false, error: 'Forbidden: Platform admin privileges required' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    admin: true,
    email: session.user.email,
    verified: Boolean((session.user as { email_verified?: boolean }).email_verified),
  });
}
