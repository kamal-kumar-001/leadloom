import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { auth } from '../../../auth';

const BRIDGE_ISSUER = 'leadloom-web';
const BRIDGE_AUDIENCE = 'leadloom-engine';

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized: valid session required' }, { status: 401 });
  }

  // 1. Fail closed on bridge secret: must exist and be >= 32 bytes base64 decoded
  const rawSecret = process.env.LEADLOOM_NEXTAUTH_BRIDGE_SECRET;
  if (!rawSecret) {
    return NextResponse.json(
      { error: 'Bridge secret not configured (LEADLOOM_NEXTAUTH_BRIDGE_SECRET required)' },
      { status: 500 }
    );
  }

  const key = Buffer.from(rawSecret, 'base64');
  if (key.length < 32) {
    return NextResponse.json(
      { error: 'Bridge secret must be at least 32 bytes (base64 decoded)' },
      { status: 500 }
    );
  }

  // 2. Validate provider evidence from session: MUST be verified Google or GitHub
  const user = session.user as Record<string, unknown> | undefined;
  const idp = user?.idp as string | undefined;
  const emailVerified = user?.email_verified as boolean | undefined;

  if (!idp || (idp !== 'google' && idp !== 'github') || emailVerified !== true) {
    return NextResponse.json(
      { error: 'Engine bridge requires a verified Google or GitHub session' },
      { status: 403 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = 900; // 15 minutes
  const exp = now + ttlSeconds;

  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({
    iss: BRIDGE_ISSUER,
    aud: BRIDGE_AUDIENCE,
    email: session.user.email.trim().toLowerCase(),
    email_verified: true,
    idp,
    iat: now,
    exp,
  });

  const signature = createHmac('sha256', key)
    .update(`${header}.${payload}`)
    .digest('base64url');

  const token = `${header}.${payload}.${signature}`;

  return NextResponse.json({
    token,
    exp,
    issuer: BRIDGE_ISSUER,
    audience: BRIDGE_AUDIENCE,
  });
}
