import { describe, it, expect } from 'vitest';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createApplication } from '../../../main';
import { mintBridgeToken } from '../nextauth-bridge';
import { SlidingWindowLimiter } from '../rate-limiter';

const key = randomBytes(32), bridgeKey = randomBytes(32);
const ok = { sub: randomUUID(), workspaceId: randomUUID() }, suspended = { sub: randomUUID(), workspaceId: randomUUID() };
const guard = { isActive: async (u: string, w: string) => u === ok.sub && w === ok.workspaceId };
const sessionTok = (c: { sub: string; workspaceId: string }) => {
  const p = Buffer.from(JSON.stringify({ ...c, role: 'member', exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url');
  return 'Bearer ' + p + '.' + createHmac('sha256', key).update(p).digest('base64url');
};
const directory = { findByEmail: async (e: string) => e === 'ok@example.invalid' ? { id: ok.sub, workspaceId: ok.workspaceId, email: e, passwordHash: null, role: 'member' as const } : e === 'susp@example.invalid' ? { id: suspended.sub, workspaceId: suspended.workspaceId, email: e, passwordHash: null, role: 'admin' as const } : null };
const core = (extra: object) => ({
  credentials: { save: async () => ({}), list: async () => [], delete: async () => false },
  outbound: { enqueue: async () => randomUUID(), suppress: async () => {} },
  sessionKey: key, userDirectory: directory, nextAuthBridgeKey: bridgeKey, ...extra,
});

describe('access guard: suspended users and inactive workspaces lose access with a still-valid token', () => {
  it('applies to both engine sessions and bridge tokens; fails closed', async () => {
    const app = await createApplication(core({ accessGuard: guard }) as never);
    const broken = await createApplication(core({ accessGuard: { isActive: async () => { throw new Error('db down'); } } }) as never);
    try {
      const get = (a: typeof app, authorization: string) => a.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/vault/credentials', headers: { authorization } });
      expect((await get(app, sessionTok(ok))).statusCode).toBe(200);
      expect((await get(app, sessionTok(suspended))).statusCode).toBe(401);
      expect((await get(app, 'Bearer ' + mintBridgeToken({ email: 'ok@example.invalid' }, bridgeKey))).statusCode).toBe(200);
      expect((await get(app, 'Bearer ' + mintBridgeToken({ email: 'susp@example.invalid' }, bridgeKey))).statusCode).toBe(401);
      expect((await get(broken, sessionTok(ok))).statusCode).toBe(401);
    } finally { await app.close(); await broken.close(); }
  });
});

describe('sliding window limiter', () => {
  it('allows up to max in the window, then recovers', () => {
    let t = 0; const l = new SlidingWindowLimiter(2, 1000, () => t);
    expect([l.take('k'), l.take('k'), l.take('k')]).toEqual([true, true, false]);
    expect(l.take('other')).toBe(true);
    t = 1001; expect(l.take('k')).toBe(true);
  });
});
