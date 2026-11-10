import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { SessionClaims } from './session';

/**
 * Verifies an HS256 JWT minted by the web app (NextAuth server side, route
 * /api/engine-token) for the engine. Default-off: main.ts only enables it when
 * LEADLOOM_NEXTAUTH_BRIDGE_ENABLED=true and LEADLOOM_NEXTAUTH_BRIDGE_SECRET is set.
 * The web app must put engine user and workspace UUIDs in the claims; the engine
 * never trusts an email or provider id from the browser.
 */
export const BRIDGE_ISSUER = 'leadloom-web';
export const BRIDGE_AUDIENCE = 'leadloom-engine';
const Claims = z.object({
  iss: z.literal(BRIDGE_ISSUER),
  aud: z.literal(BRIDGE_AUDIENCE),
  sub: z.string().uuid(),
  workspaceId: z.string().uuid(),
  role: z.enum(['admin', 'member', 'read_only']),
  exp: z.number().int().positive(),
  iat: z.number().int().positive().optional(),
}).strict();

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

export function verifyBridgeToken(token: string, key: Buffer, now = Date.now()): SessionClaims {
  if (key.length < 32) throw new Error('Bridge key must have at least 32 bytes');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => p.length > 4096)) throw new Error('Invalid session');
  const [head, body, sig] = parts;
  const header = JSON.parse(Buffer.from(head, 'base64url').toString('utf8'));
  if (header?.alg !== 'HS256' || (header.typ && header.typ !== 'JWT')) throw new Error('Invalid session');
  const expected = createHmac('sha256', key).update(`${head}.${body}`).digest();
  const actual = Buffer.from(sig, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid session');
  const c = Claims.parse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
  if (c.exp * 1000 <= now) throw new Error('Session expired');
  return { sub: c.sub, workspaceId: c.workspaceId, role: c.role, exp: c.exp };
}

/** Test and web-side reference minting; the production minter lives in apps/web. */
export function mintBridgeToken(input: { sub: string; workspaceId: string; role: 'admin' | 'member' | 'read_only' }, key: Buffer, ttlSeconds = 900, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ iss: BRIDGE_ISSUER, aud: BRIDGE_AUDIENCE, ...input, iat, exp: iat + ttlSeconds });
  return `${head}.${body}.${createHmac('sha256', key).update(`${head}.${body}`).digest('base64url')}`;
}
