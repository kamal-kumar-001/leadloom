import 'server-only';
import { createHmac } from 'node:crypto';

/** Server-only engine address. Never exposed to the browser. */
export function engineBase(): string {
  return (process.env.ENGINE_URL || 'http://127.0.0.1:4010').replace(/\/+$/, '');
}

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

/**
 * Mint a short-lived bridge token. Only for a session whose email was proven by Google or GitHub.
 * Returns null when the session is not eligible or the secret is missing/short (fail closed).
 */
export function mintBridgeToken(user: { email?: string | null; idp?: string; email_verified?: boolean }): string | null {
  if (!user.email || (user.idp !== 'google' && user.idp !== 'github') || user.email_verified !== true) return null;
  const raw = process.env.LEADLOOM_NEXTAUTH_BRIDGE_SECRET;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length < 32) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({
    iss: 'leadloom-web',
    aud: 'leadloom-engine',
    email: user.email.trim().toLowerCase(),
    email_verified: true,
    idp: user.idp,
    iat: now,
    exp: now + 900,
  });
  const sig = createHmac('sha256', key).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

/** Fetch with a hard timeout. */
export async function engineCall(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), init.timeoutMs ?? 8000);
  try {
    return await fetch(`${engineBase()}${path}`, { ...init, signal: c.signal, cache: 'no-store' });
  } finally {
    clearTimeout(t);
  }
}
