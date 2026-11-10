import { describe, it, expect } from 'vitest';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createApplication } from '../../../main';
import { mintBridgeToken, verifyBridgeToken } from '../nextauth-bridge';

const bridgeKey = randomBytes(32);
const wsA = randomUUID(), wsB = randomUUID();
const members: Record<string, { id: string; workspaceId: string; email: string; passwordHash: null; role: 'admin' | 'member' | 'read_only' }> = {
  'rw@example.invalid': { id: randomUUID(), workspaceId: wsA, email: 'rw@example.invalid', passwordHash: null, role: 'member' },
  'ro@example.invalid': { id: randomUUID(), workspaceId: wsB, email: 'ro@example.invalid', passwordHash: null, role: 'read_only' },
};
const directory = { findByEmail: async (e: string) => members[e.trim().toLowerCase()] ?? null };
const seenWorkspaces: string[] = [];
const core = (extra: object = {}) => ({
  credentials: { save: async () => ({}), list: async (w: string) => { seenWorkspaces.push(w); return []; }, delete: async () => false },
  outbound: { enqueue: async () => randomUUID(), suppress: async () => {} },
  sessionKey: randomBytes(32),
  userDirectory: directory,
  ...extra,
});
const signRaw = (payload: object) => {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${head}.${body}.${createHmac('sha256', bridgeKey).update(`${head}.${body}`).digest('base64url')}`;
};
const exp = () => Math.floor(Date.now() / 1000) + 60;

describe('nextauth bridge token', () => {
  it('round-trips a verified email only', () => {
    expect(verifyBridgeToken(mintBridgeToken({ email: 'RW@Example.invalid' }, bridgeKey), bridgeKey).email).toBe('rw@example.invalid');
  });
  it('rejects expired, wrong key, tampered, alg none, unverified email and any extra identity claims', () => {
    const t = mintBridgeToken({ email: 'rw@example.invalid' }, bridgeKey);
    expect(() => verifyBridgeToken(mintBridgeToken({ email: 'a@b.co' }, bridgeKey, 10, Date.now() - 60_000), bridgeKey)).toThrow();
    expect(() => verifyBridgeToken(t, randomBytes(32))).toThrow();
    const p = t.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p[1], 'base64url').toString()), email: 'ro@example.invalid' })).toString('base64url');
    expect(() => verifyBridgeToken(`${p[0]}.${forged}.${p[2]}`, bridgeKey)).toThrow();
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    expect(() => verifyBridgeToken(`${none}.${p[1]}.`, bridgeKey)).toThrow();
    const base = { iss: 'leadloom-web', aud: 'leadloom-engine', email: 'rw@example.invalid', exp: exp() };
    expect(() => verifyBridgeToken(signRaw({ ...base, email_verified: false }), bridgeKey)).toThrow();
    expect(() => verifyBridgeToken(signRaw({ ...base, email_verified: true, role: 'admin' }), bridgeKey)).toThrow();
    expect(() => verifyBridgeToken(signRaw({ ...base, email_verified: true, workspaceId: wsB }), bridgeKey)).toThrow();
  });
});

describe('bridge in runtime (default off, membership from server)', () => {
  it('rejects unless configured; derives workspace and role from the directory; unknown email gets 401', async () => {
    const off = await createApplication(core() as never);
    const on = await createApplication(core({ nextAuthBridgeKey: bridgeKey }) as never);
    try {
      const get = (app: typeof on, t: string) => app.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/vault/credentials', headers: { authorization: 'Bearer ' + t } });
      const rw = mintBridgeToken({ email: 'rw@example.invalid' }, bridgeKey);
      expect((await get(off, rw)).statusCode).toBe(401);
      seenWorkspaces.length = 0;
      expect((await get(on, rw)).statusCode).toBe(200);
      expect(seenWorkspaces).toEqual([wsA]);
      expect((await get(on, mintBridgeToken({ email: 'nobody@example.invalid' }, bridgeKey))).statusCode).toBe(401);
      const ro = mintBridgeToken({ email: 'ro@example.invalid' }, bridgeKey);
      const res = await on.getHttpAdapter().getInstance().inject({ method: 'POST', url: '/vault/credentials', headers: { authorization: 'Bearer ' + ro }, payload: {} });
      expect(res.statusCode).toBe(403);
    } finally { await off.close(); await on.close(); }
  });
});
