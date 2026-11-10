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

  let key: Buffer;
  if (process.env.LEADLOOM_NEXTAUTH_BRIDGE_SECRET) {
    // Engine in apps/engine/src/main.ts decodes this as base64
    const b64Buf = Buffer.from(process.env.LEADLOOM_NEXTAUTH_BRIDGE_SECRET, 'base64');
    if (b64Buf.length >= 32) {
      key = b64Buf;
    } else {
      key = Buffer.from(process.env.LEADLOOM_NEXTAUTH_BRIDGE_SECRET, 'utf-8');
    }
  } else {
    const rawSecret =
      process.env.NEXTAUTH_SECRET ||
      'leadloom-insecure-dev-secret-key-at-least-32-chars-long-0123456789';
    key = Buffer.from(rawSecret, 'utf-8');
  }

  // Ensure bridge secret has at least 32 bytes
  if (key.length < 32) {
    key = Buffer.concat([key, Buffer.alloc(32 - key.length, 0)]);
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
