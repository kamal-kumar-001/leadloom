import { createHmac } from 'node:crypto';
import type { SessionClaims } from './session';
import type { Role } from './rbac';

/**
 * Session issuer: mints HMAC-SHA256 tokens in the exact format consumed by
 * verifySession. Mounting the login route is a separate, explicitly gated
 * decision - this module is the primitive only.
 */
export interface IssuedIdentity {
  userId: string;
  workspaceId: string;
  role: Role;
}

export function issueSession(
  identity: IssuedIdentity,
  key: Buffer,
  ttlSeconds: number,
  now = Date.now(),
): { token: string; claims: SessionClaims } {
  if (key.length < 32) throw new Error('Session signing key must have at least 32 bytes');
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 60 * 60 * 24 * 30) {
    throw new Error('Session TTL must be between 60 seconds and 30 days');
  }
  const claims: SessionClaims = {
    sub: identity.userId,
    workspaceId: identity.workspaceId,
    role: identity.role,
    exp: Math.floor(now / 1000) + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signature = createHmac('sha256', key).update(body).digest().toString('base64url');
  return { token: `${body}.${signature}`, claims };
}
