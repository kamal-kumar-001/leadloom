import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../../../main';
import { InMemoryAgentTokenStore, PrismaAgentTokenStore, AgentTokenService } from '../../auth/agent-token.service';
import {
  InMemoryProjectContextStore,
  PrismaProjectContextStore,
  ProjectContextService,
} from '../project-context.service';
import {
  InMemoryProjectRegistryStore,
  PrismaProjectRegistryStore,
  ProjectRegistryService,
} from '../project-registry.service';
import { issueSession } from '../../auth/issuer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Slice B: Project-Scoped Workspace Restore & Persist', () => {
  const SESSION_KEY = Buffer.from('test_session_secret_key_32_bytes_long!!');

  async function setupApp(options?: {
    agentTokenStore?: InMemoryAgentTokenStore;
    projectContextStore?: InMemoryProjectContextStore;
    projectRegistryStore?: InMemoryProjectRegistryStore;
    userRole?: 'admin' | 'member' | 'read_only';
  }) {
    const atStore = options?.agentTokenStore ?? new InMemoryAgentTokenStore();
    const prStore = options?.projectRegistryStore ?? new InMemoryProjectRegistryStore();
    const pcStore = options?.projectContextStore ?? new InMemoryProjectContextStore(prStore);
    const atService = new AgentTokenService(atStore);
    const prService = new ProjectRegistryService(prStore);
    const pcService = new ProjectContextService(pcStore);

    const workspaceId = randomUUID();
    const userId = randomUUID();
    const role = options?.userRole ?? 'admin';

    atStore.workspaces.set(workspaceId, { active: true });
    atStore.users.set(userId, { role, disabledAt: null });

    // Pre-seed test projects so human routes validate registry ownership
    await prService.create(workspaceId, userId, { name: 'Large Proj', slug: 'large-proj' });
    await prService.create(workspaceId, userId, { name: 'Single Row Proj', slug: 'single-row-proj' });
    await prService.create(workspaceId, userId, { name: 'Human Proj', slug: 'human-proj' });
    await prService.create(workspaceId, userId, { name: 'Locked Proj', slug: 'proj-locked' });

    const { token: sessionToken } = issueSession({ userId, workspaceId, role }, SESSION_KEY, 3600);

    const mockReads = {
      summary: async () => ({ tables: 1, experiments: 2 }),
      listTables: async () => [{ id: randomUUID(), name: 'Test Table' }],
      listTableRows: async () => null,
      listMailboxes: async () => [],
      listSuppressions: async () => [],
      listExperiments: async () => [{ id: randomUUID(), hypothesis: 'Test Hypothesis' }],
      listCampaigns: async () => [],
      jobMetadata: async () => null,
    };

    const mockValidator = {
      generate: async (_ws: string, _body: any) => ({
        experimentId: randomUUID(),
        status: 'draft',
        pageUrl: 'http://localhost:3000/v/test-slug',
        scorecard: {
          experimentId: randomUUID(),
          hypothesis: _body?.rawHypothesis ?? 'Test Hypothesis',
          verdict: 'pending',
          verdictScore: 50,
          metrics: { visitors: 0, waitlistCount: 0 },
        },
      }),
      getScorecard: async (id: string) => ({
        experimentId: id,
        hypothesis: 'Test Hypothesis',
        verdict: 'pending',
        verdictScore: 50,
        metrics: { visitors: 10, waitlistCount: 2 },
      }),
      setPublishStatus: async (id: string, _ws: string, published: boolean) => ({
        experimentId: id,
        slug: 'test-slug',
        status: published ? 'published' : 'draft',
      }),
      recordOutreach: async (id: string, _ws: string, body: any) => ({
        experimentId: id,
        hypothesis: 'Test Hypothesis',
        verdict: 'high_pull',
        verdictScore: 85,
        metrics: { outreachSent: body.outreachSent, replies: body.replies, positiveReplies: body.positiveReplies },
      }),
      getOwnerPage: async (id: string) => ({
        id,revision:'a'.repeat(64),
        slug: 'test-slug',
        title: 'Test Landing',
        headline: 'Test Headline',
      }),
    };

    const mockInvitations = {
      mine: async () => [],
      list: async () => [{ id: randomUUID(), email: 'inv@test.org', role: 'member' }],
      invite: async () => ({ ok: true, invitation: { id: randomUUID() } }),
      revoke: async () => true,
    };

    const mockMailboxConnect = {
      connect: async () => ({ ok: true, mailbox: { id: randomUUID() }, result: { mx: true, spf: true, dkim: true } }),
      test: async () => ({ ok: true, mailbox: { id: randomUUID() }, result: { mx: true, spf: true, dkim: true } }),
      remove: async () => true,
    };

    const mockRecipients = {
      createCampaign: async () => ({ id: randomUUID(), name: 'Test Campaign', status: 'draft' }),
      campaignExists: async () => true,
      addRecipients: async () => ({ count: 1 }),
      listMailboxPool: async () => [],
    };

    const app = await createApplication({
      sessionKey: SESSION_KEY,
      agentTokens: atService,
      projectContext: pcService,
      projectRegistry: prService,
      reads: mockReads as any,
      validator: mockValidator as any,
      invitations: mockInvitations as any,
      mailboxConnect: mockMailboxConnect as any,
      recipients: mockRecipients as any,
      entitlements: {
        checkFeature: async () => ({ allowed: true }),
        checkLimit: async () => ({ allowed: true, remaining: 100 }),
      },
    } as any);

    const server = app.getHttpAdapter().getInstance();

    return {
      app,
      server,
      workspaceId,
      userId,
      atStore,
      pcStore,
      prStore,
      atService,
      pcService,
      prService,
      sessionToken,
    };
  }

  // ─── 1. Slice A Scope Enforcement on Real Protected HTTP Routes ─────────────

  describe('Scope Enforcement on Real Protected Routes (Slice A Verification)', () => {
    it('enforces route-level scopes: allows experiments:read, blocks writes and tables:read', async () => {
      const { server, app, workspaceId, userId, atService } = await setupApp();
      try {
        // Issue token with strictly experiments:read scope
        const issued = await atService.issue(workspaceId, userId, {
          name: 'Scoped Experiment Reader',
          scopes: ['experiments:read'],
        });

        // 1. Allowed Route: GET /workspace/experiments -> 200 OK
        const readExp = await server.inject({
          method: 'GET',
          url: '/workspace/experiments',
          headers: { authorization: `Bearer ${issued.token}` },
        });
        expect(readExp.statusCode).toBe(200);
        expect(readExp.json().length).toBe(1);

        // 2. Disallowed Write Route: POST /validator/experiments -> 403 Forbidden
        const writeExp = await server.inject({
          method: 'POST',
          url: '/validator/experiments',
          headers: { authorization: `Bearer ${issued.token}` },
          payload: { rawHypothesis: 'Valid hypothesis text between 10 and 500 chars' },
        });
        expect(writeExp.statusCode).toBe(403);
        expect(writeExp.json().error).toMatch(/insufficient scope/i);

        // 3. Disallowed Domain Route: GET /workspace/tables -> 403 Forbidden
        const readTables = await server.inject({
          method: 'GET',
          url: '/workspace/tables',
          headers: { authorization: `Bearer ${issued.token}` },
        });
        expect(readTables.statusCode).toBe(403);
        expect(readTables.json().error).toMatch(/insufficient scope/i);

        // 4. Wildcard token can access both
        const wildcard = await atService.issue(workspaceId, userId, {
          name: 'Wildcard Agent',
          scopes: ['*'],
        });
        const wildcardExp = await server.inject({
          method: 'GET',
          url: '/workspace/experiments',
          headers: { authorization: `Bearer ${wildcard.token}` },
        });
        expect(wildcardExp.statusCode).toBe(200);

        const wildcardTables = await server.inject({
          method: 'GET',
          url: '/workspace/tables',
          headers: { authorization: `Bearer ${wildcard.token}` },
        });
        expect(wildcardTables.statusCode).toBe(200);
      } finally {
        await app.close();
      }
    });
  });

  // ─── 2. Server-Side Project Binding & Context Lifecycle ──────────────────────

  describe('Server-Side Bound Project Context Restore & Persist', () => {
    it('persists and restores context strictly bound to project server-side', async () => {
      const { server, app, workspaceId, userId, atService } = await setupApp();
      try {
        // Issue token bound server-side to 'alpha-project'
        const tokenA = await atService.issue(workspaceId, userId, {
          name: 'Alpha Agent',
          projectId: 'alpha-project',
          scopes: ['project:context:read', 'project:context:write'],
        });
        expect(tokenA.projectId).toBe('alpha-project');

        // Persist context via POST /agent/context (no projectId supplied by caller)
        const persistRes = await server.inject({
          method: 'POST',
          url: '/agent/context',
          headers: { authorization: `Bearer ${tokenA.token}` },
          payload: {
            context: {
              activeHypothesis: 'Targeting mid-market logistics leads',
              validatedHooks: ['Automated POD matching', 'Fuel surcharge auditing'],
              decisionLog: [{ timestamp: '2026-11-20', decision: 'Launch 2 variants' }],
            },
            metadata: { version: 1, author: 'AlphaAgent' },
          },
        });
        expect(persistRes.statusCode).toBe(200);
        const saved = persistRes.json();
        expect(saved.projectId).toBe('alpha-project');
        expect(saved.workspaceId).toBe(workspaceId);
        expect(saved.context.activeHypothesis).toBe('Targeting mid-market logistics leads');

        // Restore context via GET /agent/context
        const restoreRes = await server.inject({
          method: 'GET',
          url: '/agent/context',
          headers: { authorization: `Bearer ${tokenA.token}` },
        });
        expect(restoreRes.statusCode).toBe(200);
        const restored = restoreRes.json();
        expect(restored.projectId).toBe('alpha-project');
        expect(restored.context.validatedHooks).toEqual([
          'Automated POD matching',
          'Fuel surcharge auditing',
        ]);

        // Update context in place (idempotent upsert)
        const updateRes = await server.inject({
          method: 'POST',
          url: '/agent/context',
          headers: { authorization: `Bearer ${tokenA.token}` },
          payload: {
            context: {
              activeHypothesis: 'Updated hypothesis v2',
              validatedHooks: ['Automated POD matching'],
            },
            metadata: { version: 2 },
          },
        });
        expect(updateRes.statusCode).toBe(200);
        expect(updateRes.json().context.activeHypothesis).toBe('Updated hypothesis v2');

        const reRestore = await server.inject({
          method: 'GET',
          url: '/agent/context',
          headers: { authorization: `Bearer ${tokenA.token}` },
        });
        expect(reRestore.json().context.activeHypothesis).toBe('Updated hypothesis v2');
      } finally {
        await app.close();
      }
    });
  });

  // ─── 3. Hard Cross-Project Isolation & Negative Tests ───────────────────────

  describe('Hard Cross-Project Isolation (Negative Tests)', () => {
    it('unbound token (projectId null) calling /agent/context is rejected with 403', async () => {
      const { server, app, workspaceId, userId, atService } = await setupApp();
      try {
        // Issue token WITHOUT projectId (workspace-wide / unbound)
        const unboundToken = await atService.issue(workspaceId, userId, {
          name: 'Unbound Agent',
          scopes: ['*'],
        });
        expect(unboundToken.projectId).toBeNull();

        // Calling GET /agent/context -> 403 Forbidden
        const getRes = await server.inject({
          method: 'GET',
          url: '/agent/context',
          headers: { authorization: `Bearer ${unboundToken.token}` },
        });
        expect(getRes.statusCode).toBe(403);
        expect(getRes.json().error).toMatch(/Token is not project-bound/i);

        // Calling POST /agent/context -> 403 Forbidden
        const postRes = await server.inject({
          method: 'POST',
          url: '/agent/context',
          headers: { authorization: `Bearer ${unboundToken.token}` },
          payload: { context: { test: true } },
        });
        expect(postRes.statusCode).toBe(403);
        expect(postRes.json().error).toMatch(/Token is not project-bound/i);
      } finally {
        await app.close();
      }
    });

    it('cross-project isolation: project B cannot restore project A context (clean 404, zero leakage)', async () => {
      const { server, app, workspaceId, userId, atService } = await setupApp();
      try {
        const tokenA = await atService.issue(workspaceId, userId, {
          name: 'Agent A',
          projectId: 'project-alpha',
          scopes: ['*'],
        });
        const tokenB = await atService.issue(workspaceId, userId, {
          name: 'Agent B',
          projectId: 'project-beta',
          scopes: ['*'],
        });

        // Seed project A context
        await server.inject({
          method: 'POST',
          url: '/agent/context',
          headers: { authorization: `Bearer ${tokenA.token}` },
          payload: { context: { secretStrategy: 'Alpha Confidential Blueprint' } },
        });

        // Token B calls restore -> MUST return 404, never Project A's data
        const resB = await server.inject({
          method: 'GET',
          url: '/agent/context',
          headers: { authorization: `Bearer ${tokenB.token}` },
        });
        expect(resB.statusCode).toBe(404);
        expect(resB.json().error).toMatch(/No context found for project project-beta/i);
      } finally {
        await app.close();
      }
    });

    it('rejects caller attempts to swap or tamper with projectId', async () => {
      const { server, app, workspaceId, userId, atService } = await setupApp();
      try {
        const tokenA = await atService.issue(workspaceId, userId, {
          name: 'Agent A',
          projectId: 'project-alpha',
          scopes: ['*'],
        });

        // Token A attempts to pass query param projectId=project-beta
        const tamperGet = await server.inject({
          method: 'GET',
          url: '/agent/context?projectId=project-beta',
          headers: { authorization: `Bearer ${tokenA.token}` },
        });
        expect(tamperGet.statusCode).toBe(403);
        expect(tamperGet.json().error).toMatch(/Project mismatch with bound token/i);

        // Token A attempts to pass body projectId=project-beta
        const tamperPost = await server.inject({
          method: 'POST',
          url: '/agent/context',
          headers: { authorization: `Bearer ${tokenA.token}` },
          payload: { projectId: 'project-beta', context: { hack: true } },
        });
        expect(tamperPost.statusCode).toBe(403);
        expect(tamperPost.json().error).toMatch(/Project mismatch with bound token/i);

        // Token A attempts to access /projects/project-beta/context
        const explicitRoute = await server.inject({
          method: 'GET',
          url: '/projects/project-beta/context',
          headers: { authorization: `Bearer ${tokenA.token}` },
        });
        expect(explicitRoute.statusCode).toBe(403);
        expect(explicitRoute.json().error).toMatch(/unannotated route|human sessions only|Project mismatch/i);
      } finally {
        await app.close();
      }
    });

    it('enforces multi-tenant workspace isolation (same projectId in different workspace)', async () => {
      const { server, app, workspaceId: ws1, userId, atService, atStore } = await setupApp();
      try {
        const ws2 = randomUUID();
        const u2 = randomUUID();
        atStore.workspaces.set(ws2, { active: true });
        atStore.users.set(u2, { role: 'member', disabledAt: null });

        // Token 1 in Workspace 1 for 'shared-slug'
        const token1 = await atService.issue(ws1, userId, {
          name: 'Tenant 1 Agent',
          projectId: 'shared-slug',
          scopes: ['*'],
        });

        // Token 2 in Workspace 2 for same 'shared-slug'
        const token2 = await atService.issue(ws2, u2, {
          name: 'Tenant 2 Agent',
          projectId: 'shared-slug',
          scopes: ['*'],
        });

        // Tenant 1 persists context
        await server.inject({
          method: 'POST',
          url: '/agent/context',
          headers: { authorization: `Bearer ${token1.token}` },
          payload: { context: { tenant: 'WS1 Private Data' } },
        });

        // Tenant 2 calls restore -> 404 (does NOT see Tenant 1 data)
        const res2 = await server.inject({
          method: 'GET',
          url: '/agent/context',
          headers: { authorization: `Bearer ${token2.token}` },
        });
        expect(res2.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });

    it('rejects unauthenticated requests and read-only roles attempting write', async () => {
      const { server, app, workspaceId, userId, atService, atStore } = await setupApp();
      try {
        // Unauthenticated
        const unauth = await server.inject({ method: 'GET', url: '/agent/context' });
        expect(unauth.statusCode).toBe(401);

        // Read-only user token
        const readOnlyUserId = randomUUID();
        atStore.users.set(readOnlyUserId, { role: 'read_only', disabledAt: null });
        const roToken = await atService.issue(workspaceId, readOnlyUserId, {
          name: 'Read Only Agent',
          projectId: 'proj-ro',
          scopes: ['*'],
        });

        const roWrite = await server.inject({
          method: 'POST',
          url: '/agent/context',
          headers: { authorization: `Bearer ${roToken.token}` },
          payload: { context: { attempt: 'fail' } },
        });
        expect(roWrite.statusCode).toBe(403);
        expect(roWrite.json().error).toMatch(/Read-only workspace role/i);
      } finally {
        await app.close();
      }
    });

    it('runnable core flow: agent executes complete Idea Feasibility & Validation cycle with context persistence and project fencing', async () => {
      const { server, app, workspaceId, userId, atService } = await setupApp();
      try {
        // 1. Issue project-bound agent token for 'logistics-ai'
        const projectAgentToken = await atService.issue(workspaceId, userId, {
          name: 'Founder Project Agent',
          projectId: 'logistics-ai',
          scopes: ['project:context:read', 'project:context:write'],
        });

        // 2. Issue workspace execution agent token for validator & research tools
        const toolAgentToken = await atService.issue(workspaceId, userId, {
          name: 'Execution Agent',
          scopes: ['experiments:read', 'experiments:write', 'research:read', 'research:write'],
        });

        // 3. Step 1: Project agent restores context -> initially 404
        const initCtx = await server.inject({
          method: 'GET',
          url: '/agent/context',
          headers: { authorization: `Bearer ${projectAgentToken.token}` },
        });
        expect(initCtx.statusCode).toBe(404);

        // 4. Execution agent creates experiment from hypothesis via POST /validator/experiments
        const createExp = await server.inject({
          method: 'POST',
          url: '/validator/experiments',
          headers: { authorization: `Bearer ${toolAgentToken.token}` },
          payload: {
            rawHypothesis: 'Automated detention billing and fee recovery for mid-sized freight brokers',
            preferredSlug: 'detention-recovery',
          },
        });
        expect(createExp.statusCode).toBe(200);
        const expData = createExp.json();
        expect(expData.experimentId).toBeDefined();
        const expId = expData.experimentId;

        // 5. Execution agent retrieves scorecard via GET /validator/experiments/:id/scorecard
        const scorecardRes = await server.inject({
          method: 'GET',
          url: `/validator/experiments/${expId}/scorecard`,
          headers: { authorization: `Bearer ${toolAgentToken.token}` },
        });
        expect(scorecardRes.statusCode).toBe(200);
        expect(scorecardRes.json().experimentId).toBe(expId);

        // 6. Execution agent publishes smoke page via POST /validator/experiments/:id/publish
        const publishRes = await server.inject({
          method: 'POST',
          url: `/validator/experiments/${expId}/publish`,
          headers: { authorization: `Bearer ${toolAgentToken.token}` },
          payload:{expectedRevision:(await server.inject({method:'GET',url:`/validator/experiments/${expId}/page`,headers:{authorization:`Bearer ${toolAgentToken.token}`}})).json().revision},
        });
        expect(publishRes.statusCode).toBe(200);
        expect(publishRes.json().status).toBe('published');

        // 7. Execution agent records observed outreach touches via POST /validator/experiments/:id/outreach
        const outreachRes = await server.inject({
          method: 'POST',
          url: `/validator/experiments/${expId}/outreach`,
          headers: { authorization: `Bearer ${toolAgentToken.token}` },
          payload: {
            outreachSent: 30,
            replies: 8,
            positiveReplies: 3,
          },
        });
        expect(outreachRes.statusCode).toBe(200);
        expect(outreachRes.json().verdict).toBe('high_pull');

        // 8. Final Step: Project agent saves updated project memory via POST /agent/context
        const persistRes = await server.inject({
          method: 'POST',
          url: '/agent/context',
          headers: { authorization: `Bearer ${projectAgentToken.token}` },
          payload: {
            context: {
              activeHypothesis: 'Automated detention billing and fee recovery for mid-sized freight brokers',
              experimentId: expId,
              slug: 'detention-recovery',
              status: 'published',
              metrics: { outreachSent: 30, replies: 8, positiveReplies: 3 },
              milestone: 'high_pull_validated',
            },
            metadata: { version: 1, agent: 'ClaudeCode' },
          },
        });
        expect(persistRes.statusCode).toBe(200);

        // 9. Project agent verifies persistent state via GET /agent/context
        const verifyCtx = await server.inject({
          method: 'GET',
          url: '/agent/context',
          headers: { authorization: `Bearer ${projectAgentToken.token}` },
        });
        expect(verifyCtx.statusCode).toBe(200);
        const savedCtx = verifyCtx.json();
        expect(savedCtx.projectId).toBe('logistics-ai');
        expect(savedCtx.context.milestone).toBe('high_pull_validated');
        expect(savedCtx.context.experimentId).toBe(expId);

        // 10. Boundary guard: project-scoped token cannot reach workspace-wide routes (Amendment 2)
        const fencedRoute = await server.inject({
          method: 'POST',
          url: '/validator/experiments',
          headers: { authorization: `Bearer ${projectAgentToken.token}` },
          payload: { rawHypothesis: 'Valid hypothesis text between 10 and 500 chars' },
        });
        expect(fencedRoute.statusCode).toBe(403);
        expect(fencedRoute.json().error).toMatch(/Project-scoped agent token cannot access workspace-wide routes/i);

        // 11. Boundary guard: agent tokens cannot call human-only route
        const humanRoute = await server.inject({
          method: 'POST',
          url: '/projects',
          headers: { authorization: `Bearer ${toolAgentToken.token}` },
          payload: { name: 'Unauthorized Project', slug: 'unauthorized-project' },
        });
        expect(humanRoute.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    });
  });

  // ─── 4. Binding Security Acceptance Amendments (Amendments 1 - 5) ──────────

  describe('Binding Security Acceptance Amendments', () => {
    describe('Amendment 1: Fail-Closed Default (Unannotated Routes Rejection)', () => {
      it('rejects valid narrow agent token on representative unannotated routes with 403', async () => {
        const { server, app, workspaceId, userId, atService } = await setupApp();
        try {
          const narrowToken = await atService.issue(workspaceId, userId, {
            name: 'Narrow Agent',
            scopes: ['experiments:read'],
          });

          // 1. Unannotated Read route: GET /auth/me
          const authMe = await server.inject({
            method: 'GET',
            url: '/auth/me',
            headers: { authorization: `Bearer ${narrowToken.token}` },
          });
          expect(authMe.statusCode).toBe(403);
          expect(authMe.json().error).toMatch(/unannotated route/i);

          // 2. Unannotated Write route: POST /workspace/mailboxes/connect
          const connectMb = await server.inject({
            method: 'POST',
            url: '/workspace/mailboxes/connect',
            headers: { authorization: `Bearer ${narrowToken.token}` },
            payload: { email: 'test@example.com', password: 'secretpassword123', smtpHost: 'smtp.example.com', smtpPort: 587, imapHost: 'imap.example.com', imapPort: 993 },
          });
          expect(connectMb.statusCode).toBe(403);
          expect(connectMb.json().error).toMatch(/unannotated route/i);

          // 3. Unannotated Admin route: GET /workspace/invitations
          const listInv = await server.inject({
            method: 'GET',
            url: '/workspace/invitations',
            headers: { authorization: `Bearer ${narrowToken.token}` },
          });
          expect(listInv.statusCode).toBe(403);
          expect(listInv.json().error).toMatch(/unannotated route/i);

          // 4. Unannotated Outbound route: POST /workspace/campaigns
          const createCampaign = await server.inject({
            method: 'POST',
            url: '/workspace/campaigns',
            headers: { authorization: `Bearer ${narrowToken.token}` },
            payload: { name: 'Exploit Campaign', tableId: randomUUID(), mailboxPool: [randomUUID()], steps: [] },
          });
          expect(createCampaign.statusCode).toBe(403);
          expect(createCampaign.json().error).toMatch(/unannotated route/i);

          // 5. Unannotated Token-issuance route: POST /agent-tokens
          const issueTokens = await server.inject({
            method: 'POST',
            url: '/agent-tokens',
            headers: { authorization: `Bearer ${narrowToken.token}` },
            payload: { name: 'Nested Token' },
          });
          expect(issueTokens.statusCode).toBe(403);
          expect(issueTokens.json().error).toMatch(/unannotated route/i);
        } finally {
          await app.close();
        }
      });

      it('rejects wildcard scopes: ["*"] agent token on unannotated routes with 403 (wildcard never widens route allowlist)', async () => {
        const { server, app, workspaceId, userId, atService } = await setupApp();
        try {
          const wildcardToken = await atService.issue(workspaceId, userId, {
            name: 'Wildcard Agent',
            scopes: ['*'],
          });

          // Even with scopes: ['*'], unannotated routes must reject with 403
          const routes = [
            { method: 'GET' as const, url: '/auth/me' },
            { method: 'GET' as const, url: '/workspace/invitations' },
            { method: 'POST' as const, url: '/agent-tokens', payload: { name: 'Sub' } },
            { method: 'POST' as const, url: '/workspace/campaigns', payload: { name: 'Wild' } },
          ];

          for (const route of routes) {
            const res = await server.inject({
              method: route.method,
              url: route.url,
              headers: { authorization: `Bearer ${wildcardToken.token}` },
              payload: (route as any).payload,
            });
            expect(res.statusCode).toBe(403);
            expect(res.json().error).toMatch(/unannotated route/i);
          }
        } finally {
          await app.close();
        }
      });
    });

    describe('Amendment 2: Project Isolation on Data (Project-bound tokens cannot reach workspace-wide routes)', () => {
      it('rejects project-bound token on workspace-wide routes even if scope matches (403)', async () => {
        const { server, app, workspaceId, userId, atService } = await setupApp();
        try {
          // Token bound to 'proj_alpha' with experiments:read scope
          const tokenAlpha = await atService.issue(workspaceId, userId, {
            name: 'Project Alpha Agent',
            projectId: 'proj_alpha',
            scopes: ['experiments:read'],
          });

          // GET /workspace/experiments has requiredScope: 'experiments:read'
          // Even though scope matches, because token is project-bound, workspace-wide route must 403
          const expRes = await server.inject({
            method: 'GET',
            url: '/workspace/experiments',
            headers: { authorization: `Bearer ${tokenAlpha.token}` },
          });
          expect(expRes.statusCode).toBe(403);
          expect(expRes.json().error).toMatch(/Project-scoped agent token cannot access workspace-wide routes/i);

          // Wildcard token bound to 'proj_alpha' also rejected on workspace-wide routes
          const wildcardBound = await atService.issue(workspaceId, userId, {
            name: 'Wildcard Alpha Agent',
            projectId: 'proj_alpha',
            scopes: ['*'],
          });

          const wildcardExp = await server.inject({
            method: 'GET',
            url: '/workspace/experiments',
            headers: { authorization: `Bearer ${wildcardBound.token}` },
          });
          expect(wildcardExp.statusCode).toBe(403);
          expect(wildcardExp.json().error).toMatch(/Project-scoped agent token cannot access workspace-wide routes/i);

          const wildcardTables = await server.inject({
            method: 'GET',
            url: '/workspace/tables',
            headers: { authorization: `Bearer ${wildcardBound.token}` },
          });
          expect(wildcardTables.statusCode).toBe(403);
          expect(wildcardTables.json().error).toMatch(/Project-scoped agent token cannot access workspace-wide routes/i);
        } finally {
          await app.close();
        }
      });

      it('denies ALL agent tokens on /projects/:projectId/context on both GET and POST (human sessions only)', async () => {
        const { server, app, workspaceId, userId, atService, pcService } = await setupApp();
        try {
          await pcService.persist(workspaceId, 'proj-locked', { context: { note: 'secret' } });

          // 1. Project-bound agent token
          const boundToken = await atService.issue(workspaceId, userId, {
            name: 'Bound Agent',
            projectId: 'proj-locked',
            scopes: ['*'],
          });

          // 2. Unbound wildcard agent token
          const unboundToken = await atService.issue(workspaceId, userId, {
            name: 'Unbound Agent',
            scopes: ['*'],
          });

          for (const token of [boundToken.token, unboundToken.token]) {
            const getRes = await server.inject({
              method: 'GET',
              url: '/projects/proj-locked/context',
              headers: { authorization: `Bearer ${token}` },
            });
            expect(getRes.statusCode).toBe(403);
            expect(getRes.json().error).toMatch(/human sessions only|unannotated route/i);

            const postRes = await server.inject({
              method: 'POST',
              url: '/projects/proj-locked/context',
              headers: { authorization: `Bearer ${token}` },
              payload: { context: { hack: true } },
            });
            expect(postRes.statusCode).toBe(403);
            expect(postRes.json().error).toMatch(/human sessions only|unannotated route/i);
          }
        } finally {
          await app.close();
        }
      });
    });

    describe('Amendment 3: Issuance Validation (Project existence and workspace ownership)', () => {
      it('validates project existence and workspace ownership when issuing project-bound tokens', async () => {
        const { server, app, workspaceId, userId, sessionToken, prService, atStore } = await setupApp();
        try {
          // 1. Seed valid project in this workspace
          const validProj = await prService.create(workspaceId, userId, { name: 'Valid Project', slug: 'proj-valid' });

          // 2. Issuing token for valid project succeeds (201) and resolves to canonical UUID
          const validIssue = await server.inject({
            method: 'POST',
            url: '/agent-tokens',
            headers: { authorization: `Bearer ${sessionToken}` },
            payload: {
              name: 'Valid Project Token',
              projectId: 'proj-valid',
              scopes: ['context:read', 'context:write'],
            },
          });
          expect(validIssue.statusCode).toBe(201);
          expect(validIssue.json().projectId).toBe(validProj.id);

          // 3. Issuing token for non-existent project fails (400)
          const nonexistentIssue = await server.inject({
            method: 'POST',
            url: '/agent-tokens',
            headers: { authorization: `Bearer ${sessionToken}` },
            payload: {
              name: 'Missing Project Token',
              projectId: 'proj-nonexistent',
              scopes: ['context:read'],
            },
          });
          expect(nonexistentIssue.statusCode).toBe(400);
          expect(nonexistentIssue.json().error).toMatch(/Project does not exist or does not belong to this workspace/i);

          // 4. Cross-workspace project: project exists in Workspace 2 only
          const ws2 = randomUUID();
          atStore.workspaces.set(ws2, { active: true });
          await prService.create(ws2, userId, { name: 'WS2 Project', slug: 'proj-ws2' });

          // User in Workspace 1 attempts to bind token to Workspace 2's project
          const crossWsIssue = await server.inject({
            method: 'POST',
            url: '/agent-tokens',
            headers: { authorization: `Bearer ${sessionToken}` },
            payload: {
              name: 'Cross WS Exploit Token',
              projectId: 'proj-ws2',
              scopes: ['context:read'],
            },
          });
          expect(crossWsIssue.statusCode).toBe(400);
          expect(crossWsIssue.json().error).toMatch(/Project does not exist or does not belong to this workspace/i);
        } finally {
          await app.close();
        }
      });

      it('fails closed with 503 if services.projectRegistry is missing when issuing a project-bound token', async () => {
        const atStore = new InMemoryAgentTokenStore();
        const atService = new AgentTokenService(atStore);
        const workspaceId = randomUUID();
        const userId = randomUUID();
        atStore.workspaces.set(workspaceId, { active: true });
        atStore.users.set(userId, { role: 'admin', disabledAt: null });
        const { token: sessionToken } = issueSession({ userId, workspaceId, role: 'admin' }, SESSION_KEY, 3600);

        // App created WITHOUT services.projectRegistry
        const app = await createApplication({
          sessionKey: SESSION_KEY,
          agentTokens: atService,
          // projectRegistry intentionally omitted
        } as any);
        const server = app.getHttpAdapter().getInstance();

        try {
          const res = await server.inject({
            method: 'POST',
            url: '/agent-tokens',
            headers: { authorization: `Bearer ${sessionToken}` },
            payload: { name: 'Attempt Bound Without Validator', projectId: 'proj-123' },
          });
          expect(res.statusCode).toBe(503);
          expect(res.json().error).toMatch(/Project registry service unavailable/i);
        } finally {
          await app.close();
        }
      });
    });

    describe('Amendment 4: Context Scopes & Bounds', () => {
      it('enforces separate context:read and context:write scopes on /agent/context', async () => {
        const { server, app, workspaceId, userId, atService, pcService } = await setupApp();
        try {
          // Pre-seed context for project
          await pcService.persist(workspaceId, 'proj-scoped', {
            context: { initial: 'data' },
            metadata: { version: 1 },
          });

          // Token A: Read only (scopes: ['context:read'])
          const readOnlyToken = await atService.issue(workspaceId, userId, {
            name: 'Read Only Agent',
            projectId: 'proj-scoped',
            scopes: ['context:read'],
          });

          // GET /agent/context -> 200 OK
          const getRes = await server.inject({
            method: 'GET',
            url: '/agent/context',
            headers: { authorization: `Bearer ${readOnlyToken.token}` },
          });
          expect(getRes.statusCode).toBe(200);
          expect(getRes.json().context).toEqual({ initial: 'data' });

          // POST /agent/context -> 403 Forbidden (cannot write)
          const postAttempt = await server.inject({
            method: 'POST',
            url: '/agent/context',
            headers: { authorization: `Bearer ${readOnlyToken.token}` },
            payload: { context: { overwrite: 'unauthorized' } },
          });
          expect(postAttempt.statusCode).toBe(403);

          // PUT /agent/context -> 403 Forbidden (cannot write)
          const putAttempt = await server.inject({
            method: 'PUT',
            url: '/agent/context',
            headers: { authorization: `Bearer ${readOnlyToken.token}` },
            payload: { context: { overwrite: 'unauthorized' } },
          });
          expect(putAttempt.statusCode).toBe(403);

          // Token B: Write only (scopes: ['context:write'])
          const writeOnlyToken = await atService.issue(workspaceId, userId, {
            name: 'Write Only Agent',
            projectId: 'proj-scoped',
            scopes: ['context:write'],
          });

          // POST /agent/context -> 200 OK
          const postRes = await server.inject({
            method: 'POST',
            url: '/agent/context',
            headers: { authorization: `Bearer ${writeOnlyToken.token}` },
            payload: { context: { updatedBy: 'writer' } },
          });
          expect(postRes.statusCode).toBe(200);

          // GET /agent/context -> 403 Forbidden (cannot read)
          const getAttempt = await server.inject({
            method: 'GET',
            url: '/agent/context',
            headers: { authorization: `Bearer ${writeOnlyToken.token}` },
          });
          expect(getAttempt.statusCode).toBe(403);
        } finally {
          await app.close();
        }
      });

      it('enforces hard payload bound: rejects context payloads over 256KB with 413 Payload Too Large', async () => {
        const { server, app, workspaceId, userId, atService } = await setupApp();
        try {
          const token = await atService.issue(workspaceId, userId, {
            name: 'Writer Agent',
            projectId: 'large-proj',
            scopes: ['context:write'],
          });

          // Generate a payload exceeding 256KB (e.g. 270KB string)
          const largePayload = {
            context: {
              bigField: 'x'.repeat(270 * 1024),
            },
          };

          const res = await server.inject({
            method: 'POST',
            url: '/agent/context',
            headers: { authorization: `Bearer ${token.token}` },
            payload: largePayload,
          });

          expect(res.statusCode).toBe(413);
          expect(res.json().message ?? res.json().error).toMatch(/large|limit/i);
        } finally {
          await app.close();
        }
      });

      it('retrieval returns strictly the bound project single context row (object, not list)', async () => {
        const { server, app, workspaceId, userId, atService, pcService } = await setupApp();
        try {
          await pcService.persist(workspaceId, 'single-row-proj', {
            context: { key: 'value' },
            metadata: { version: 1 },
          });

          const token = await atService.issue(workspaceId, userId, {
            name: 'Reader Agent',
            projectId: 'single-row-proj',
            scopes: ['context:read'],
          });

          const res = await server.inject({
            method: 'GET',
            url: '/agent/context',
            headers: { authorization: `Bearer ${token.token}` },
          });

          expect(res.statusCode).toBe(200);
          const body = res.json();
          expect(Array.isArray(body)).toBe(false);
          expect(body).toMatchObject({
            workspaceId,
            projectId: 'single-row-proj',
            context: { key: 'value' },
          });
        } finally {
          await app.close();
        }
      });

      it('enforces 256KB cap centrally in ProjectContextService and rejects human persist attempts over 256KB with 413', async () => {
        const { server, app, sessionToken, pcService, workspaceId } = await setupApp();
        try {
          const largePayload = {
            context: {
              bigField: 'x'.repeat(270 * 1024),
            },
          };

          // 1. Human session calling POST /projects/:projectId/context with >256KB -> 413
          const humanRes = await server.inject({
            method: 'POST',
            url: '/projects/large-proj/context',
            headers: { authorization: `Bearer ${sessionToken}` },
            payload: largePayload,
          });
          expect(humanRes.statusCode).toBe(413);
          expect(humanRes.json().message ?? humanRes.json().error).toMatch(/large|limit/i);

          // 2. Central service directly throws PayloadTooLargeError
          await expect(
            pcService.persist(workspaceId, 'large-proj', largePayload as any),
          ).rejects.toThrow(/Context payload exceeds 256KB limit/i);
        } finally {
          await app.close();
        }
      });

      it('enforces bounded restore: rejects legacy oversized rows (>256KB) with 413, preventing memory/context leakage to agents', async () => {
        const { server, app, workspaceId, userId, atService, pcStore } = await setupApp();
        try {
          // Manually seed legacy oversized context directly in store (bypassing persist guard)
          await pcStore.persist(workspaceId, 'legacy-huge-proj', {
            hugeData: 'z'.repeat(270 * 1024),
          }, {});

          const token = await atService.issue(workspaceId, userId, {
            name: 'Agent Restorer',
            projectId: 'legacy-huge-proj',
            scopes: ['context:read'],
          });

          // Agent attempts restore -> must be rejected with 413 rather than returning oversized payload
          const res = await server.inject({
            method: 'GET',
            url: '/agent/context',
            headers: { authorization: `Bearer ${token.token}` },
          });
          expect(res.statusCode).toBe(413);
          expect(res.json().error).toMatch(/Stored context exceeds 256KB limit/i);
        } finally {
          await app.close();
        }
      });
    });

    describe('Amendment 5: Regression Protection (Human Session Behavior)', () => {
      it('preserves 100% human session behavior across existing routes', async () => {
        const { server, app, workspaceId, userId, sessionToken, pcService, prService } = await setupApp({ userRole: 'admin' });
        try {
          const humanProj = await prService.findByIdOrSlug(workspaceId, 'human-proj');
          // Pre-seed context for project using canonical UUID
          await pcService.persist(workspaceId, humanProj!.id, {
            context: { createdBy: 'human' },
          });

          const headers = { authorization: `Bearer ${sessionToken}` };

          // 1. GET /auth/me
          const meRes = await server.inject({ method: 'GET', url: '/auth/me', headers });
          expect(meRes.statusCode).toBe(200);
          expect(meRes.json()).toEqual({ userId, workspaceId, role: 'admin', name: null });

          // 2. GET /workspace/summary
          const summaryRes = await server.inject({ method: 'GET', url: '/workspace/summary', headers });
          expect(summaryRes.statusCode).toBe(200);
          expect(summaryRes.json()).toEqual({ tables: 1, experiments: 2 });

          // 3. GET /workspace/experiments
          const expRes = await server.inject({ method: 'GET', url: '/workspace/experiments', headers });
          expect(expRes.statusCode).toBe(200);
          expect(expRes.json().length).toBe(1);

          // 4. GET /workspace/tables
          const tablesRes = await server.inject({ method: 'GET', url: '/workspace/tables', headers });
          expect(tablesRes.statusCode).toBe(200);
          expect(tablesRes.json().length).toBe(1);

          // 5. GET /workspace/invitations (admin only)
          const invRes = await server.inject({ method: 'GET', url: '/workspace/invitations', headers });
          expect(invRes.statusCode).toBe(200);

          // 6. POST /agent-tokens (human admin issuance)
          const issueRes = await server.inject({
            method: 'POST',
            url: '/agent-tokens',
            headers,
            payload: { name: 'Human Issued Agent', scopes: ['context:read'] },
          });
          expect(issueRes.statusCode).toBe(201);
          expect(issueRes.json().token).toMatch(/^lld_agt_/);

          // 7. GET /projects/:projectId/context (human inspection route)
          const ctxRes = await server.inject({ method: 'GET', url: '/projects/human-proj/context', headers });
          expect(ctxRes.statusCode).toBe(200);
          expect(ctxRes.json().context).toEqual({ createdBy: 'human' });
        } finally {
          await app.close();
        }
      });
    });

    describe('Canonical Workspace-Owned Project Registry & Human Context Ownership', () => {
      it('allows human to create and list projects with slug uniqueness and cross-tenant isolation', async () => {
        const { server, app, workspaceId, sessionToken } = await setupApp();
        try {
          // 1. Create project via POST /workspace/projects
          const createRes = await server.inject({
            method: 'POST',
            url: '/workspace/projects',
            headers: { authorization: `Bearer ${sessionToken}` },
            payload: { name: 'Marketing Automation', slug: 'marketing-auto', description: 'GTM agents' },
          });
          expect(createRes.statusCode).toBe(201);
          const p = createRes.json();
          expect(p.slug).toBe('marketing-auto');
          expect(p.name).toBe('Marketing Automation');
          expect(p.workspaceId).toBe(workspaceId);
          expect(p.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

          // 2. Duplicate slug in same workspace -> 409
          const dupRes = await server.inject({
            method: 'POST',
            url: '/workspace/projects',
            headers: { authorization: `Bearer ${sessionToken}` },
            payload: { name: 'Duplicate Name', slug: 'marketing-auto' },
          });
          expect(dupRes.statusCode).toBe(409);
          expect(dupRes.json().error).toMatch(/already exists/i);

          // 3. List projects via GET /workspace/projects
          const listRes = await server.inject({
            method: 'GET',
            url: '/workspace/projects',
            headers: { authorization: `Bearer ${sessionToken}` },
          });
          expect(listRes.statusCode).toBe(200);
          const list = listRes.json();
          expect(Array.isArray(list)).toBe(true);
          expect(list.some((x: any) => x.slug === 'marketing-auto')).toBe(true);

          // 4. Aliases /projects work identically
          const aliasList = await server.inject({
            method: 'GET',
            url: '/projects',
            headers: { authorization: `Bearer ${sessionToken}` },
          });
          expect(aliasList.statusCode).toBe(200);
        } finally {
          await app.close();
        }
      });

      it('strictly forbids agent tokens from creating or listing projects (human sessions only)', async () => {
        const { server, app, workspaceId, userId, atService } = await setupApp();
        try {
          const agent = await atService.issue(workspaceId, userId, {
            name: 'Agent Project Requester',
            scopes: ['*'],
          });

          // Agent attempts POST /workspace/projects -> 403
          const postRes = await server.inject({
            method: 'POST',
            url: '/workspace/projects',
            headers: { authorization: `Bearer ${agent.token}` },
            payload: { name: 'Rogue Agent Project', slug: 'rogue-proj' },
          });
          expect(postRes.statusCode).toBe(403);
          expect(postRes.json().error).toMatch(/human sessions only|unannotated/i);

          // Agent attempts GET /workspace/projects -> 403
          const getRes = await server.inject({
            method: 'GET',
            url: '/workspace/projects',
            headers: { authorization: `Bearer ${agent.token}` },
          });
          expect(getRes.statusCode).toBe(403);
          expect(getRes.json().error).toMatch(/human sessions only|unannotated/i);
        } finally {
          await app.close();
        }
      });

      it('human context routes validate actual registry ownership and resolve canonical UUID', async () => {
        const { server, app, workspaceId, userId, sessionToken, prService, pcService } = await setupApp();
        try {
          const project = await prService.create(workspaceId, userId, {
            name: 'Audit Project',
            slug: 'audit-proj',
          });

          // 1. Human persists context via slug
          const postRes = await server.inject({
            method: 'POST',
            url: '/projects/audit-proj/context',
            headers: { authorization: `Bearer ${sessionToken}` },
            payload: { context: { auditStatus: 'passed' } },
          });
          expect(postRes.statusCode).toBe(200);
          expect(postRes.json().projectId).toBe(project.id); // Canonical UUID

          // 2. Human restores via slug
          const getSlugRes = await server.inject({
            method: 'GET',
            url: '/projects/audit-proj/context',
            headers: { authorization: `Bearer ${sessionToken}` },
          });
          expect(getSlugRes.statusCode).toBe(200);
          expect(getSlugRes.json().context).toEqual({ auditStatus: 'passed' });
          expect(getSlugRes.json().projectId).toBe(project.id);

          // 3. Human restores via canonical UUID -> same context (no duplicate keys by alias)
          const getUuidRes = await server.inject({
            method: 'GET',
            url: `/projects/${project.id}/context`,
            headers: { authorization: `Bearer ${sessionToken}` },
          });
          expect(getUuidRes.statusCode).toBe(200);
          expect(getUuidRes.json().context).toEqual({ auditStatus: 'passed' });
          expect(getUuidRes.json().projectId).toBe(project.id);

          // 4. Human tries to access non-existent project context -> 404
          const notFoundRes = await server.inject({
            method: 'GET',
            url: '/projects/does-not-exist/context',
            headers: { authorization: `Bearer ${sessionToken}` },
          });
          expect(notFoundRes.statusCode).toBe(404);
          expect(notFoundRes.json().error).toMatch(/not found in this workspace/i);
        } finally {
          await app.close();
        }
      });

      it('rejects UUID-formatted slugs at project creation (400)', async () => {
        const { server, app, sessionToken } = await setupApp();
        try {
          const fakeUuidSlug = randomUUID();
          const res = await server.inject({
            method: 'POST',
            url: '/workspace/projects',
            headers: { authorization: `Bearer ${sessionToken}` },
            payload: { name: 'Attempt UUID Slug', slug: fakeUuidSlug },
          });
          expect(res.statusCode).toBe(400);
          expect(res.json().error).toMatch(/UUID/i);
        } finally {
          await app.close();
        }
      });

      it('fails closed with 503 on human context routes when projectRegistry is absent', async () => {
        const pcStore = new InMemoryProjectContextStore();
        const pcService = new ProjectContextService(pcStore);
        const workspaceId = randomUUID();
        const userId = randomUUID();
        const { token: sessionToken } = issueSession({ userId, workspaceId, role: 'admin' }, SESSION_KEY, 3600);

        const app = await createApplication({
          sessionKey: SESSION_KEY,
          projectContext: pcService,
          // projectRegistry intentionally omitted
        } as any);
        const server = app.getHttpAdapter().getInstance();

        try {
          const res = await server.inject({
            method: 'GET',
            url: '/projects/some-project/context',
            headers: { authorization: `Bearer ${sessionToken}` },
          });
          expect(res.statusCode).toBe(503);
          expect(res.json().error).toMatch(/Project registry service unavailable/i);
        } finally {
          await app.close();
        }
      });
    });
  });

  // ─── 5. Disposable Local Postgres Integration (PGlite) ───────────────────────

  describe('Disposable Local Postgres Integration (PGlite)', () => {
    let pg: PGlite;
    const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../../../packages/database/prisma/migrations');

    beforeEach(async () => {
      pg = new PGlite({ extensions: { vector } });
      for (const migration of [
        '20261110_init_v2',
        '20261114_user_suspension',
        '20261201_agent_tokens',
        '20261202_project_scoped_context',
        '20261203_projects_registry',
        '20261213_context_revision',
      ]) {
        const sql = readFileSync(path.join(MIGRATIONS_DIR, migration, 'migration.sql'), 'utf8');
        await pg.exec(sql);
      }
    });

    afterEach(async () => {
      await pg?.close();
    });

    it('applies 20261202 & 20261203 migrations and verifies PrismaProjectContextStore SQL lifecycle in local Postgres', async () => {
      const wsId = randomUUID();
      const uId = randomUUID();
      await pg.query(`INSERT INTO workspaces (id, name, is_active, updated_at) VALUES ($1::uuid, 'Test WS', true, now())`, [wsId]);
      await pg.query(`INSERT INTO users (id, workspace_id, email, role, updated_at) VALUES ($1::uuid, $2::uuid, 'u@test.org', 'member', now())`, [uId, wsId]);

      const mockPrisma = {
        $queryRawUnsafe: async (sql: string, ...params: any[]) => {
          const res = await pg.query(sql, params);
          return res.rows;
        },
      };

      const store = new PrismaProjectContextStore(mockPrisma);
      const service = new ProjectContextService(store);

      // 1. Initial persist
      const created = await service.persist(wsId, 'pglite-project-1', {
        context: { founderNotes: 'Seed notes for project 1', targetAudience: 'Dentists' },
        metadata: { source: 'agent-session' },
      }, uId);

      expect(created.projectId).toBe('pglite-project-1');
      expect(created.workspaceId).toBe(wsId);
      expect((created.context as any).founderNotes).toBe('Seed notes for project 1');

      // 2. Direct SQL verify
      const dbRows = await pg.query<{ project_id: string; context: any }>(
        `SELECT project_id, context FROM project_contexts WHERE workspace_id = $1::uuid AND project_id = $2`,
        [wsId, 'pglite-project-1'],
      );
      expect(dbRows.rows.length).toBe(1);
      expect(dbRows.rows[0].project_id).toBe('pglite-project-1');

      // 3. In-place UPSERT (update context)
      const updated = await service.persist(wsId, 'pglite-project-1', {
        context: { founderNotes: 'Updated seed notes v2' },
        metadata: { source: 'agent-session-v2' },
      }, uId);
      expect(updated.id).toBe(created.id); // Same row id
      expect((updated.context as any).founderNotes).toBe('Updated seed notes v2');

      // 4. Restore
      const restored = await service.restore(wsId, 'pglite-project-1');
      expect(restored).not.toBeNull();
      expect((restored!.context as any).founderNotes).toBe('Updated seed notes v2');

      // 5. Non-existent project restore returns null
      const missing = await service.restore(wsId, 'non-existent-project');
      expect(missing).toBeNull();
    });

    it('enforces PostgreSQL unique constraint (workspace_id, slug) on projects table', async () => {
      const wsId = randomUUID();
      await pg.query(`INSERT INTO workspaces (id, name, is_active, updated_at) VALUES ($1::uuid, 'WS', true, now())`, [wsId]);

      // Direct insert first row
      await pg.query(
        `INSERT INTO projects (workspace_id, slug, name) VALUES ($1::uuid, 'unique-slug', 'Project 1')`,
        [wsId],
      );

      // Attempt duplicate insert with same slug -> expects unique violation
      await expect(
        pg.query(
          `INSERT INTO projects (workspace_id, slug, name) VALUES ($1::uuid, 'unique-slug', 'Project 2')`,
          [wsId],
        ),
      ).rejects.toThrow();
    });

    it('composes real PGlite services: first-project HTTP create -> issue -> persist -> restore + cross-tenant denial', async () => {
      // 1. Workspace 1 & User 1
      const ws1 = randomUUID();
      const u1 = randomUUID();
      await pg.query(`INSERT INTO workspaces (id, name, is_active, updated_at) VALUES ($1::uuid, 'WS 1', true, now())`, [ws1]);
      await pg.query(`INSERT INTO users (id, workspace_id, email, role, updated_at) VALUES ($1::uuid, $2::uuid, 'u1@ws1.org', 'admin', now())`, [u1, ws1]);

      // 2. Workspace 2 & User 2
      const ws2 = randomUUID();
      const u2 = randomUUID();
      await pg.query(`INSERT INTO workspaces (id, name, is_active, updated_at) VALUES ($1::uuid, 'WS 2', true, now())`, [ws2]);
      await pg.query(`INSERT INTO users (id, workspace_id, email, role, updated_at) VALUES ($1::uuid, $2::uuid, 'u2@ws2.org', 'admin', now())`, [u2, ws2]);

      const mockPrisma = {
        $queryRawUnsafe: async (sql: string, ...params: any[]) => {
          const res = await pg.query(sql, params);
          return res.rows;
        },
      };

      const atStore = new PrismaAgentTokenStore(mockPrisma);
      const pcStore = new PrismaProjectContextStore(mockPrisma);
      const prStore = new PrismaProjectRegistryStore(mockPrisma);

      const atService = new AgentTokenService(atStore);
      const pcService = new ProjectContextService(pcStore);
      const prService = new ProjectRegistryService(prStore);

      const app = await createApplication({
        sessionKey: SESSION_KEY,
        agentTokens: atService,
        projectContext: pcService,
        projectRegistry: prService,
      } as any);
      const server = app.getHttpAdapter().getInstance();

      try {
        const { token: sessionToken1 } = issueSession({ userId: u1, workspaceId: ws1, role: 'admin' }, SESSION_KEY, 3600);
        const { token: sessionToken2 } = issueSession({ userId: u2, workspaceId: ws2, role: 'admin' }, SESSION_KEY, 3600);

        // A. Human in WS1 creates first project via HTTP POST /workspace/projects
        const createProjectRes = await server.inject({
          method: 'POST',
          url: '/workspace/projects',
          headers: { authorization: `Bearer ${sessionToken1}` },
          payload: { name: 'Alpha Logistics', slug: 'alpha-logistics', description: 'Logistics project' },
        });
        expect(createProjectRes.statusCode).toBe(201);
        const createdProject = createProjectRes.json();
        expect(createdProject.slug).toBe('alpha-logistics');
        const canonicalProjectId = createdProject.id;
        expect(canonicalProjectId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        // B. Human in WS1 issues agent token specifying the project slug 'alpha-logistics'
        const issueTokenRes = await server.inject({
          method: 'POST',
          url: '/agent-tokens',
          headers: { authorization: `Bearer ${sessionToken1}` },
          payload: {
            name: 'Alpha Worker Agent',
            projectId: 'alpha-logistics', // Supplied as slug
            scopes: ['context:read', 'context:write'],
          },
        });
        expect(issueTokenRes.statusCode).toBe(201);
        const tokenData = issueTokenRes.json();
        // Server resolved slug to canonical UUID!
        expect(tokenData.projectId).toBe(canonicalProjectId);
        const rawAgentToken = tokenData.token;
        expect(rawAgentToken).toMatch(/^lld_agt_/);

        // C. Agent persists context via POST /agent/context
        const persistRes = await server.inject({
          method: 'POST',
          url: '/agent/context',
          headers: { authorization: `Bearer ${rawAgentToken}` },
          payload: {
            context: { roadmap: 'Phase 1: Carrier integration', status: 'in-progress' },
            metadata: { agentVersion: '1.0.0' },
          },
        });
        expect(persistRes.statusCode).toBe(200);
        expect(persistRes.json().projectId).toBe(canonicalProjectId);

        // D. Agent restores context via GET /agent/context
        const restoreRes = await server.inject({
          method: 'GET',
          url: '/agent/context',
          headers: { authorization: `Bearer ${rawAgentToken}` },
        });
        expect(restoreRes.statusCode).toBe(200);
        expect(restoreRes.json().context).toEqual({ roadmap: 'Phase 1: Carrier integration', status: 'in-progress' });
        expect(restoreRes.json().projectId).toBe(canonicalProjectId);

        // E. Human in WS1 inspects context by slug -> returns same context!
        const humanBySlugRes = await server.inject({
          method: 'GET',
          url: '/projects/alpha-logistics/context',
          headers: { authorization: `Bearer ${sessionToken1}` },
        });
        expect(humanBySlugRes.statusCode).toBe(200);
        expect(humanBySlugRes.json().context).toEqual({ roadmap: 'Phase 1: Carrier integration', status: 'in-progress' });
        expect(humanBySlugRes.json().projectId).toBe(canonicalProjectId);

        // F. Human in WS1 inspects context by UUID -> returns same context!
        const humanByUuidRes = await server.inject({
          method: 'GET',
          url: `/projects/${canonicalProjectId}/context`,
          headers: { authorization: `Bearer ${sessionToken1}` },
        });
        expect(humanByUuidRes.statusCode).toBe(200);
        expect(humanByUuidRes.json().context).toEqual({ roadmap: 'Phase 1: Carrier integration', status: 'in-progress' });
        expect(humanByUuidRes.json().projectId).toBe(canonicalProjectId);

        // G. Cross-Tenant Denial: WS2 human tries to issue agent token for WS1's project -> 400
        const crossIssueRes = await server.inject({
          method: 'POST',
          url: '/agent-tokens',
          headers: { authorization: `Bearer ${sessionToken2}` },
          payload: {
            name: 'Rogue Token WS2',
            projectId: 'alpha-logistics',
            scopes: ['context:read'],
          },
        });
        expect(crossIssueRes.statusCode).toBe(400);
        expect(crossIssueRes.json().error).toMatch(/does not exist or does not belong to this workspace/i);

        // H. Cross-Tenant Denial: WS2 human tries to access WS1's project context -> 404
        const crossContextRes = await server.inject({
          method: 'GET',
          url: '/projects/alpha-logistics/context',
          headers: { authorization: `Bearer ${sessionToken2}` },
        });
        expect(crossContextRes.statusCode).toBe(404);
        expect(crossContextRes.json().error).toMatch(/not found in this workspace/i);

        // I. Direct SQL check in PostgreSQL: context row is keyed strictly by canonical UUID
        const dbCtx = await pg.query<{ project_id: string }>(
          `SELECT project_id FROM project_contexts WHERE workspace_id = $1::uuid`,
          [ws1],
        );
        expect(dbCtx.rows.length).toBe(1);
        expect(dbCtx.rows[0].project_id).toBe(canonicalProjectId);

        // J. Human in WS1 revokes the agent token via POST /agent-tokens/:id/revoke
        const revokeRes = await server.inject({
          method: 'POST',
          url: `/agent-tokens/${tokenData.id}/revoke`,
          headers: { authorization: `Bearer ${sessionToken1}` },
        });
        expect(revokeRes.statusCode).toBe(200);
        expect(revokeRes.json()).toEqual({ id: tokenData.id, revoked: true });

        // K. Revoked agent token can no longer access /agent/context -> 401 Unauthorized
        const revokedRestoreRes = await server.inject({
          method: 'GET',
          url: '/agent/context',
          headers: { authorization: `Bearer ${rawAgentToken}` },
        });
        expect(revokedRestoreRes.statusCode).toBe(401);
        expect(revokedRestoreRes.json().error).toMatch(/Authentication required/i);
      } finally {
        await app.close();
      }
    });
  });
});
