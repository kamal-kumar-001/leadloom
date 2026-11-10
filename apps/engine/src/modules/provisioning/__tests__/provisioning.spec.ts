import { describe, it, expect } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { ProvisioningService, AccountSuspendedError, SignupLimitedError, type ProvisioningStore } from '../provisioning.service';
import { createApplication } from '../../../main';
import { mintBridgeToken } from '../../auth/nextauth-bridge';

function memStore(): ProvisioningStore & { users: Map<string, any>; workspaces: string[] } {
  const users = new Map<string, any>(), workspaces: string[] = [];
  return {
    users, workspaces,
    findByEmail: async (e) => users.get(e) ?? null,
    createWorkspaceWithAdmin: async ({ email }) => {
      if (users.has(email)) return null;
      const u = { userId: randomUUID(), workspaceId: randomUUID(), role: 'admin' as const, active: true };
      users.set(email, u); workspaces.push(u.workspaceId); return { userId: u.userId, workspaceId: u.workspaceId };
    },
  };
}

describe('provisioning service', () => {
  it('creates a brand-new workspace with the user as its only admin', async () => {
    const store = memStore(); const svc = new ProvisioningService(store);
    const a = await svc.provision(' New@Example.invalid ', 'New Person');
    expect(a).toMatchObject({ role: 'admin', created: true });
    const b = await svc.provision('other@example.invalid');
    expect(b.workspaceId).not.toBe(a.workspaceId);
    expect(store.workspaces).toHaveLength(2);
  });
  it('is idempotent and never changes an existing user (role, workspace)', async () => {
    const store = memStore(); const svc = new ProvisioningService(store);
    store.users.set('member@example.invalid', { userId: randomUUID(), workspaceId: randomUUID(), role: 'read_only', active: true });
    const r = await svc.provision('MEMBER@example.invalid');
    expect(r).toMatchObject({ role: 'read_only', created: false });
    expect(store.workspaces).toHaveLength(0);
  });
  it('converges when a concurrent sign-in wins the race', async () => {
    const store = memStore(); const svc = new ProvisioningService(store);
    const results = await Promise.all(Array.from({ length: 8 }, () => svc.provision('race@example.invalid')));
    expect(new Set(results.map((r) => r.workspaceId)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
  });
  it('never provisions or revives a suspended identity, and caps new-account creation', async () => {
    const store = memStore(); const svc = new ProvisioningService(store);
    store.users.set('gone@example.invalid', { userId: randomUUID(), workspaceId: randomUUID(), role: 'admin', active: false });
    await expect(svc.provision('gone@example.invalid')).rejects.toBeInstanceOf(AccountSuspendedError);
    expect(store.workspaces).toHaveLength(0);
    let n = 0; const capped = new ProvisioningService(memStore(), () => ++n <= 2);
    await capped.provision('a1@example.invalid'); await capped.provision('a2@example.invalid');
    await expect(capped.provision('a3@example.invalid')).rejects.toBeInstanceOf(SignupLimitedError);
    expect(await capped.provision('a1@example.invalid')).toMatchObject({ created: false }); // existing users are not blocked by the cap
  });
  it('rejects invalid emails', async () => {
    await expect(new ProvisioningService(memStore()).provision('not-an-email')).rejects.toThrow();
  });
});

describe('POST /auth/provision (default off, bridge token only)', () => {
  const bridgeKey = randomBytes(32);
  const core = (extra: object) => ({
    credentials: { save: async () => ({}), list: async () => [], delete: async () => false },
    outbound: { enqueue: async () => randomUUID(), suppress: async () => {} },
    sessionKey: randomBytes(32), ...extra,
  });
  it('is unmounted unless enabled; ignores workspace and role in the body; rejects non-bridge tokens', async () => {
    const off = await createApplication(core({ nextAuthBridgeKey: bridgeKey }) as never);
    const store = memStore();
    const on = await createApplication(core({ nextAuthBridgeKey: bridgeKey, provisioning: new ProvisioningService(store) }) as never);
    try {
      const t = mintBridgeToken({ email: 'fresh@example.invalid' }, bridgeKey);
      const h = { authorization: 'Bearer ' + t };
      expect((await off.getHttpAdapter().getInstance().inject({ method: 'POST', url: '/auth/provision', headers: h, payload: {} })).statusCode).toBe(404);
      const srv = on.getHttpAdapter().getInstance();
      const victim = randomUUID();
      const res = await srv.inject({ method: 'POST', url: '/auth/provision', headers: h, payload: { name: 'Fresh', workspaceId: victim, role: 'admin', email: 'boss@example.invalid' } });
      expect(res.statusCode).toBe(201);
      expect(res.json().workspaceId).not.toBe(victim);
      expect(store.users.has('fresh@example.invalid')).toBe(true);
      expect(store.users.has('boss@example.invalid')).toBe(false);
      expect((await srv.inject({ method: 'POST', url: '/auth/provision', headers: h, payload: {} })).statusCode).toBe(200);
      expect((await srv.inject({ method: 'POST', url: '/auth/provision', headers: { authorization: 'Bearer junk' }, payload: {} })).statusCode).toBe(401);
      for (let i = 0; i < 6; i++) await srv.inject({ method: 'POST', url: '/auth/provision', headers: h, payload: {} });
      expect((await srv.inject({ method: 'POST', url: '/auth/provision', headers: h, payload: {} })).statusCode).toBe(429);
      expect((await srv.inject({ method: 'GET', url: '/health' })).json().routes.provisioning).toBe('mounted:bridge-token-required');
    } finally { await off.close(); await on.close(); }
  });
});
