import { describe, it, expect } from 'vitest';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { createApplication } from '../../../main';
import { mintBridgeToken, verifyBridgeToken } from '../nextauth-bridge';

const bridgeKey = randomBytes(32);
const ident = () => ({ sub: randomUUID(), workspaceId: randomUUID(), role: 'member' as const });
const core = (extra: object = {}) => ({
  credentials: { save: async () => ({}), list: async () => [], delete: async () => false },
  outbound: { enqueue: async () => randomUUID(), suppress: async () => {} },
  sessionKey: randomBytes(32),
  ...extra,
});

describe('nextauth bridge token', () => {
  it('round-trips valid claims', () => {
    const id = ident();
    const c = verifyBridgeToken(mintBridgeToken(id, bridgeKey), bridgeKey);
    expect(c.sub).toBe(id.sub); expect(c.workspaceId).toBe(id.workspaceId); expect(c.role).toBe('member');
  });
  it('rejects expired, wrong key, tampered, alg none and extra claims', () => {
    const id = ident();
    expect(() => verifyBridgeToken(mintBridgeToken(id, bridgeKey, 10, Date.now() - 60_000), bridgeKey)).toThrow();
    expect(() => verifyBridgeToken(mintBridgeToken(id, bridgeKey), randomBytes(32))).toThrow();
    const t = mintBridgeToken(id, bridgeKey).split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(t[1], 'base64url').toString()), role: 'admin' })).toString('base64url');
    expect(() => verifyBridgeToken(`${t[0]}.${forged}.${t[2]}`, bridgeKey)).toThrow();
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    expect(() => verifyBridgeToken(`${none}.${t[1]}.`, bridgeKey)).toThrow();
    const body = Buffer.from(JSON.stringify({ iss: 'leadloom-web', aud: 'leadloom-engine', ...id, exp: Math.floor(Date.now() / 1000) + 60, extra: 1 })).toString('base64url');
    const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const sig = createHmac('sha256', bridgeKey).update(`${head}.${body}`).digest('base64url');
    expect(() => verifyBridgeToken(`${head}.${body}.${sig}`, bridgeKey)).toThrow();
  });
});

describe('bridge in runtime (default off)', () => {
  it('bridge token is rejected unless the bridge key is configured', async () => {
    const token = mintBridgeToken(ident(), bridgeKey);
    const off = await createApplication(core() as never);
    const on = await createApplication(core({ nextAuthBridgeKey: bridgeKey }) as never);
    try {
      const h = { authorization: 'Bearer ' + token };
      expect((await off.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/vault/credentials', headers: h })).statusCode).toBe(401);
      expect((await on.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/vault/credentials', headers: h })).statusCode).toBe(200);
      const ro = mintBridgeToken({ ...ident(), role: 'read_only' }, bridgeKey);
      expect((await on.getHttpAdapter().getInstance().inject({ method: 'POST', url: '/outbound/suppressions', headers: { authorization: 'Bearer ' + ro }, payload: {} })).statusCode).toBe(403);
    } finally { await off.close(); await on.close(); }
  });
});
