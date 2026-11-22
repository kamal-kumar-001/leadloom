import { describe, expect, it, beforeEach } from 'vitest';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { createApplication } from '../../../main';
import { issueSession } from '../issuer';
import {
  AgentTokenService,
  InMemoryAgentTokenStore,
  PrismaAgentTokenStore,
} from '../agent-token.service';
import type { Role } from '../rbac';

describe('AgentTokenService & Routes (Slice A: Agent API Tokens)', () => {
  const sessionKey = randomBytes(32);

  const setupTestApp = async (options: {
    role?: Role;
    isSuspended?: boolean;
    workspaceActive?: boolean;
    workspaceId?: string;
    userId?: string;
  } = {}) => {
    const wid = options.workspaceId ?? randomUUID();
    const uid = options.userId ?? randomUUID();
    const role = options.role ?? 'member';
    const store = new InMemoryAgentTokenStore();

    store.users.set(uid, {
      role,
      disabledAt: options.isSuspended ? new Date() : null,
    });
    store.workspaces.set(wid, {
      active: options.workspaceActive !== false,
    });

    const agentTokens = new AgentTokenService(store);

    const app = await createApplication({
      sessionKey,
      credentials: { save: async () => ({}) as any, list: async () => [], delete: async () => false } as any,
      outbound: { enqueue: async () => 'job_1', suppress: async () => {} } as any,
      agentTokens,
      reads: { listExperiments: async () => [{ id: '1', hypothesis: 'Test' }] } as any,
      accessGuard: {
        isActive: async (uId, wId) => {
          if (options.isSuspended && uId === uid) return false;
          if (options.workspaceActive === false && wId === wid) return false;
          return true;
        },
      },
    } as any);

    const { token: sessionToken } = issueSession({ userId: uid, workspaceId: wid, role }, sessionKey, 3600);
    const server = app.getHttpAdapter().getInstance();

    return {
      app,
      server,
      store,
      agentTokens,
      workspaceId: wid,
      userId: uid,
      role,
      sessionHeader: { authorization: `Bearer ${sessionToken}` },
    };
  };

  it('issues an agent token with custom scopes, returns raw token once, and hashes at rest', async () => {
    const { server, store, sessionHeader, app, workspaceId, userId } = await setupTestApp();
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/agent-tokens',
        headers: sessionHeader,
        payload: {
          name: 'Cursor Assistant',
          scopes: ['validator:read', 'validator:write'],
          expiresInDays: 14,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();

      // Verified exact issuance response shape
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.name).toBe('Cursor Assistant');
      expect(body.scopes).toEqual(['validator:read', 'validator:write']);
      expect(body.scope).toBe('validator:read validator:write');
      expect(body.revoked).toBe(false);
      expect(body.expiresAt).toBeTruthy();
      expect(body.expiry).toBeTruthy();
      expect(body.createdAt).toBeTruthy();

      // Raw token format: lld_agt_ prefix + 64 hex chars = 72 chars total
      expect(body.token).toMatch(/^lld_agt_[0-9a-f]{64}$/);
      expect(body.tokenPrefix).toBe(`${body.token.slice(0, 12)}...`);

      // Verify raw secret is NEVER stored in database/store
      const stored = store.tokens.find((t) => t.id === body.id);
      expect(stored).toBeDefined();
      expect(stored?.name).toBe('Cursor Assistant');
      expect(stored?.workspaceId).toBe(workspaceId);
      expect(stored?.userId).toBe(userId);
      // Stored tokenHash must be SHA-256 of rawToken, NOT the rawToken itself
      const expectedHash = createHash('sha256').update(body.token).digest('hex');
      expect(stored?.tokenHash).toBe(expectedHash);
      expect(JSON.stringify(stored)).not.toContain(body.token);
    } finally {
      await app.close();
    }
  });

  it('supports optional expiry (null expiresInDays = never expires)', async () => {
    const { server, sessionHeader, app } = await setupTestApp();
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/agent-tokens',
        headers: sessionHeader,
        payload: {
          name: 'Indefinite Token',
          scopes: ['*'],
          expiresInDays: null,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.expiresAt).toBeNull();
      expect(body.expiry).toBeNull();
      expect(body.revoked).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('lists agent tokens without exposing secret tokens or hashes', async () => {
    const { server, sessionHeader, app, workspaceId } = await setupTestApp();
    try {
      // Create two tokens
      const createRes1 = await server.inject({
        method: 'POST',
        url: '/agent-tokens',
        headers: sessionHeader,
        payload: { name: 'Token 1' },
      });
      const createRes2 = await server.inject({
        method: 'POST',
        url: '/agent-tokens',
        headers: sessionHeader,
        payload: { name: 'Token 2' },
      });

      const tokenSecret1 = createRes1.json().token;
      const tokenSecret2 = createRes2.json().token;

      // GET /agent-tokens
      const listRes = await server.inject({
        method: 'GET',
        url: '/agent-tokens',
        headers: sessionHeader,
      });

      expect(listRes.statusCode).toBe(200);
      const list = listRes.json();
      expect(list.length).toBe(2);

      // Verify secrets are strictly omitted
      const listJson = JSON.stringify(list);
      expect(listJson).not.toContain(tokenSecret1);
      expect(listJson).not.toContain(tokenSecret2);

      for (const item of list) {
        expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(item.name).toBeTruthy();
        expect(item.tokenPrefix).toMatch(/^lld_agt_[0-9a-f]{4}\.\.\.$/);
        expect(item.token).toBeUndefined();
        expect(item.tokenHash).toBeUndefined();
        expect(item.revoked).toBe(false);
      }
    } finally {
      await app.close();
    }
  });

  it('enforces cross-tenant isolation on listing and revoking', async () => {
    const ws1 = randomUUID();
    const ws2 = randomUUID();
    const { server, sessionHeader: h1, app } = await setupTestApp({ workspaceId: ws1 });

    const { token: s2 } = issueSession({ userId: randomUUID(), workspaceId: ws2, role: 'member' }, sessionKey, 3600);
    const h2 = { authorization: `Bearer ${s2}` };

    try {
      // Issue token in ws1
      const created = await server.inject({
        method: 'POST',
        url: '/agent-tokens',
        headers: h1,
        payload: { name: 'WS1 Token' },
      });
      const tokenId = created.json().id;

      // Query ws2 tokens -> must be empty
      const listWs2 = await server.inject({
        method: 'GET',
        url: '/agent-tokens',
        headers: h2,
      });
      expect(listWs2.json()).toEqual([]);

      // Attempt to revoke ws1 token from ws2 session -> 404
      const revokeForeign = await server.inject({
        method: 'POST',
        url: `/agent-tokens/${tokenId}/revoke`,
        headers: h2,
      });
      expect(revokeForeign.statusCode).toBe(404);
      expect(revokeForeign.json().error).toBe('Agent token not found');

      // Revoke from ws1 -> 200
      const revokeOwn = await server.inject({
        method: 'POST',
        url: `/agent-tokens/${tokenId}/revoke`,
        headers: h1,
      });
      expect(revokeOwn.statusCode).toBe(200);
      expect(revokeOwn.json()).toEqual({ id: tokenId, revoked: true });
    } finally {
      await app.close();
    }
  });

  it('authenticates routes using Bearer lld_agt_... with tenant and entitlement mapping', async () => {
    const { server, sessionHeader, app, workspaceId, userId } = await setupTestApp();
    try {
      const created = await server.inject({
        method: 'POST',
        url: '/agent-tokens',
        headers: sessionHeader,
        payload: { name: 'Worker Agent', scopes: ['*'] },
      });
      const rawToken = created.json().token;

      // Access /workspace/experiments with Bearer lld_agt_... (annotated route)
      const expRes = await server.inject({
        method: 'GET',
        url: '/workspace/experiments',
        headers: { authorization: `Bearer ${rawToken}` },
      });
      expect(expRes.statusCode).toBe(200);

      // Unannotated route /auth/me returns 403 (fail closed default)
      const unannotatedRes = await server.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${rawToken}` },
      });
      expect(unannotatedRes.statusCode).toBe(403);
      expect(unannotatedRes.json().error).toMatch(/unannotated route/i);
    } finally {
      await app.close();
    }
  });

  // ─── Mandatory Negative Tests ──────────────────────────────────────────────

  describe('Negative Security Tests', () => {
    it('revoked token returns 401', async () => {
      const { server, sessionHeader, app } = await setupTestApp();
      try {
        const created = await server.inject({
          method: 'POST',
          url: '/agent-tokens',
          headers: sessionHeader,
          payload: { name: 'Revocable Token' },
        });
        const { id: tokenId, token: rawToken } = created.json();

        // Valid before revocation
        const preCheck = await server.inject({
          method: 'GET',
          url: '/workspace/experiments',
          headers: { authorization: `Bearer ${rawToken}` },
        });
        expect(preCheck.statusCode).toBe(200);

        // Revoke token
        const revokeRes = await server.inject({
          method: 'POST',
          url: `/agent-tokens/${tokenId}/revoke`,
          headers: sessionHeader,
        });
        expect(revokeRes.statusCode).toBe(200);

        // Subsequent call with revoked token returns 401
        const postCheck = await server.inject({
          method: 'GET',
          url: '/workspace/experiments',
          headers: { authorization: `Bearer ${rawToken}` },
        });
        expect(postCheck.statusCode).toBe(401);
        expect(postCheck.json().error).toBe('Authentication required');
      } finally {
        await app.close();
      }
    });

    it('expired token returns 401', async () => {
      const { server, sessionHeader, store, app } = await setupTestApp();
      try {
        const created = await server.inject({
          method: 'POST',
          url: '/agent-tokens',
          headers: sessionHeader,
          payload: { name: 'Expiring Token', expiresInDays: 1 },
        });
        const { id: tokenId, token: rawToken } = created.json();

        // Manually manipulate expiry in store to the past
        const record = store.tokens.find((t) => t.id === tokenId);
        expect(record).toBeDefined();
        record!.expiresAt = new Date(Date.now() - 1000); // 1 second ago

        // Request with expired token returns 401
        const res = await server.inject({
          method: 'GET',
          url: '/workspace/experiments',
          headers: { authorization: `Bearer ${rawToken}` },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('Authentication required');
      } finally {
        await app.close();
      }
    });

    it('malformed token returns 401 (wrong prefix, bad length, corrupted hash)', async () => {
      const { server, app } = await setupTestApp();
      try {
        const malformedTokens = [
          'lld_agt_', // Missing entropy
          'lld_agt_short', // Too short
          'lld_agt_' + '0'.repeat(63), // 63 chars (expected 64)
          'lld_agt_' + '0'.repeat(65), // 65 chars (expected 64)
          'lld_agt_' + 'g'.repeat(64), // Invalid non-hex characters
          'not_lld_agt_' + 'a'.repeat(64), // Wrong prefix
          'Bearer lld_agt_' + 'a'.repeat(64), // Nested Bearer prefix
          'lld_agt_' + '1234567890abcdef'.repeat(4), // Non-existent token hash
        ];

        for (const badToken of malformedTokens) {
          const res = await server.inject({
            method: 'GET',
            url: '/workspace/experiments',
            headers: { authorization: `Bearer ${badToken}` },
          });
          expect(res.statusCode).toBe(401);
          expect(res.json().error).toBe('Authentication required');
        }
      } finally {
        await app.close();
      }
    });

    it('blocks agent token recursion (agent token calling POST /agent-tokens returns 403)', async () => {
      const { server, sessionHeader, app } = await setupTestApp();
      try {
        const created = await server.inject({
          method: 'POST',
          url: '/agent-tokens',
          headers: sessionHeader,
          payload: { name: 'Root Agent' },
        });
        const agentToken = created.json().token;

        // Agent token attempts to issue another agent token
        const nestedAttempt = await server.inject({
          method: 'POST',
          url: '/agent-tokens',
          headers: { authorization: `Bearer ${agentToken}` },
          payload: { name: 'Nested Agent' },
        });

        expect(nestedAttempt.statusCode).toBe(403);
        expect(nestedAttempt.json().error).toMatch(/Agent tokens cannot issue agent tokens|unannotated route/i);
      } finally {
        await app.close();
      }
    });

    it('blocks unauthenticated requests and read-only role issuance', async () => {
      const { server, app } = await setupTestApp({ role: 'read_only' });
      const { token: roToken } = issueSession(
        { userId: randomUUID(), workspaceId: randomUUID(), role: 'read_only' },
        sessionKey,
        3600,
      );

      try {
        // Unauthenticated
        const unauth = await server.inject({
          method: 'POST',
          url: '/agent-tokens',
          payload: { name: 'Unauth Token' },
        });
        expect(unauth.statusCode).toBe(401);

        // Read-only member attempting write operation
        const roAttempt = await server.inject({
          method: 'POST',
          url: '/agent-tokens',
          headers: { authorization: `Bearer ${roToken}` },
          payload: { name: 'RO Token' },
        });
        expect(roAttempt.statusCode).toBe(403);
        expect(roAttempt.json().error).toBe('Read-only workspace role');
      } finally {
        await app.close();
      }
    });

    it('accessGuard blocks agent token if issuing user is suspended or workspace deactivated', async () => {
      const wid = randomUUID();
      const uid = randomUUID();
      const { server, sessionHeader, app, store } = await setupTestApp({
        workspaceId: wid,
        userId: uid,
      });

      try {
        const created = await server.inject({
          method: 'POST',
          url: '/agent-tokens',
          headers: sessionHeader,
          payload: { name: 'Active Agent' },
        });
        const agentToken = created.json().token;

        // Verify working initially
        const ok = await server.inject({
          method: 'GET',
          url: '/workspace/experiments',
          headers: { authorization: `Bearer ${agentToken}` },
        });
        expect(ok.statusCode).toBe(200);

        // Suspend the issuing user
        store.users.set(uid, { role: 'member', disabledAt: new Date() });

        const suspendedRes = await server.inject({
          method: 'GET',
          url: '/workspace/experiments',
          headers: { authorization: `Bearer ${agentToken}` },
        });
        expect(suspendedRes.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    });
  });

  // ─── Database Integration Test (Disposable Local Postgres: PGlite) ──────────

  describe('Disposable Local Postgres Integration (PGlite)', () => {
    let pg: PGlite;
    const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../../../packages/database/prisma/migrations');

    beforeEach(async () => {
      pg = new PGlite({ extensions: { vector } });
      for (const migration of ['20261110_init_v2', '20261114_user_suspension', '20261201_agent_tokens']) {
        const sql = readFileSync(path.join(MIGRATIONS_DIR, migration, 'migration.sql'), 'utf8');
        await pg.exec(sql);
      }
    });

    it('applies agent_tokens migration and executes full PrismaAgentTokenStore lifecycle in local Postgres', async () => {
      // Seed test workspace and user
      const wsId = randomUUID();
      const uId = randomUUID();
      await pg.query(
        `INSERT INTO workspaces (id, name, is_active, updated_at) VALUES ($1::uuid, 'Test Workspace', true, now())`,
        [wsId],
      );
      await pg.query(
        `INSERT INTO users (id, workspace_id, email, role, updated_at) VALUES ($1::uuid, $2::uuid, 'user@test.org', 'member', now())`,
        [uId, wsId],
      );

      // Wrap pg in a mock Prisma object with $queryRawUnsafe
      const mockPrisma = {
        $queryRawUnsafe: async (sql: string, ...params: any[]) => {
          const res = await pg.query(sql, params);
          return res.rows;
        },
      };

      const store = new PrismaAgentTokenStore(mockPrisma);
      const service = new AgentTokenService(store);

      // 1. Issue token
      const issued = await service.issue(wsId, uId, {
        name: 'PGlite Test Agent',
        scopes: ['validator:read', 'outbound:write'],
        expiresInDays: 30,
      });

      expect(issued.token).toMatch(/^lld_agt_[0-9a-f]{64}$/);
      expect(issued.tokenPrefix).toBe(`${issued.token.slice(0, 12)}...`);

      // 2. Verify SQL storage
      const dbRows = await pg.query<{ id: string; name: string; token_hash: string }>(
        `SELECT id::text, name, token_hash FROM agent_tokens WHERE id = $1::uuid`,
        [issued.id],
      );
      expect(dbRows.rows.length).toBe(1);
      expect(dbRows.rows[0].name).toBe('PGlite Test Agent');
      // Secret token is NOT stored; only hash
      expect(dbRows.rows[0].token_hash).toBe(createHash('sha256').update(issued.token).digest('hex'));

      // 3. Verify token lookup
      const verified = await service.verify(issued.token);
      expect(verified).not.toBeNull();
      expect(verified?.workspaceId).toBe(wsId);
      expect(verified?.userId).toBe(uId);
      expect(verified?.role).toBe('member');
      expect(verified?.scopes).toEqual(['validator:read', 'outbound:write']);

      // 4. List tokens
      const list = await service.list(wsId);
      expect(list.length).toBe(1);
      expect(list[0].name).toBe('PGlite Test Agent');
      expect((list[0] as any).token).toBeUndefined();

      // 5. Revoke token
      const revoked = await service.revoke(wsId, issued.id);
      expect(revoked).toBe(true);

      // Verify immediate rejection after revocation
      const postRevoke = await service.verify(issued.token);
      expect(postRevoke).toBeNull();
    });

    it('verifies unique token_hash constraint in PostgreSQL', async () => {
      const wsId = randomUUID();
      const uId = randomUUID();
      await pg.query(`INSERT INTO workspaces (id, name, is_active, updated_at) VALUES ($1::uuid, 'WS', true, now())`, [wsId]);
      await pg.query(`INSERT INTO users (id, workspace_id, email, role, updated_at) VALUES ($1::uuid, $2::uuid, 'u@test.org', 'member', now())`, [uId, wsId]);

      const mockPrisma = {
        $queryRawUnsafe: async (sql: string, ...params: any[]) => {
          const res = await pg.query(sql, params);
          return res.rows;
        },
      };

      const store = new PrismaAgentTokenStore(mockPrisma);
      const hash = createHash('sha256').update('duplicate_test').digest('hex');

      await store.create({
        workspaceId: wsId,
        userId: uId,
        name: 'Token A',
        tokenHash: hash,
        tokenPrefix: 'lld_agt_test...',
        scopes: ['*'],
        expiresAt: null,
      });

      // Inserting duplicate hash must be rejected by PostgreSQL unique constraint
      await expect(
        store.create({
          workspaceId: wsId,
          userId: uId,
          name: 'Token B',
          tokenHash: hash,
          tokenPrefix: 'lld_agt_test...',
          scopes: ['*'],
          expiresAt: null,
        }),
      ).rejects.toThrow();
    });
  });
});
