import { describe, it, expect } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaAccessGuard } from '../access-guard';
import { issueSession } from '../issuer';
import { verifySession } from '../session';

const key = randomBytes(32);
const fakePrisma = (ver: number) => ({ $queryRawUnsafe: async () => [{ ok: true, ver }] });
const id = { userId: randomUUID(), workspaceId: randomUUID(), role: 'admin' as const };

describe('engine session version', () => {
  it('issued sessions carry the version and still verify', () => {
    const { token } = issueSession({ ...id, sessionVersion: 3 }, key, 3600);
    expect(verifySession(token, key).ver).toBe(3);
  });
  it('a token at the current version passes; any other version fails, in the same second', async () => {
    const t0 = Date.now();
    const old = verifySession(issueSession({ ...id, sessionVersion: 0 }, key, 3600, t0).token, key, t0);
    const fresh = verifySession(issueSession({ ...id, sessionVersion: 1 }, key, 3600, t0).token, key, t0);
    expect(old.iat).toBe(fresh.iat); // identical timestamps: no clock is involved
    const guard = new PrismaAccessGuard(fakePrisma(1));
    expect(await guard.isActive(id.userId, id.workspaceId, { ver: fresh.ver })).toBe(true);
    expect(await guard.isActive(id.userId, id.workspaceId, { ver: old.ver })).toBe(false);
  });
  it('a legacy token without ver is version 0; bridge callers (no session arg) are unaffected', async () => {
    const guard = new PrismaAccessGuard(fakePrisma(0));
    expect(await guard.isActive(id.userId, id.workspaceId, {})).toBe(true);
    const bumped = new PrismaAccessGuard(fakePrisma(2));
    expect(await bumped.isActive(id.userId, id.workspaceId, {})).toBe(false);
    expect(await bumped.isActive(id.userId, id.workspaceId)).toBe(true);
  });
});
