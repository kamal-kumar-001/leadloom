import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import { createApplication } from '../../../../apps/engine/src/main';
import { InMemoryAgentTokenStore, AgentTokenService } from '../../../../apps/engine/src/modules/auth/agent-token.service';
import { InMemoryProjectRegistryStore, ProjectRegistryService } from '../../../../apps/engine/src/modules/project-context/project-registry.service';
import { InMemoryProjectContextStore, ProjectContextService } from '../../../../apps/engine/src/modules/project-context/project-context.service';
import { resolveEnginePath } from '../agent-gateway';

vi.mock('server-only', () => ({}));

describe('/api/agent Gateway Ingress Contract & Path Allowlist', () => {
  it('resolves only allowlisted methods and paths to internal engine routes', () => {
    // Context operations
    expect(resolveEnginePath('GET', ['context'])).toBe('/agent/context');
    expect(resolveEnginePath('POST', ['context'])).toBe('/agent/context');
    expect(resolveEnginePath('PUT', ['context'])).toBe('/agent/context');
    expect(resolveEnginePath('GET', ['agent', 'context'])).toBe('/agent/context');
    expect(resolveEnginePath('DELETE', ['context'])).toBeNull();

    const entryId='45d782fe-0d5e-4829-81de-fb5808a83249';
    expect(resolveEnginePath('GET',['context','entries'])).toBe('/agent/context/entries');
    expect(resolveEnginePath('GET',['context','entries','brief'])).toBe('/agent/context/entries/brief');
    expect(resolveEnginePath('POST',['context','entries','brief'])).toBeNull();
    expect(resolveEnginePath('POST',['context','entries'])).toBe('/agent/context/entries');
    expect(resolveEnginePath('GET',['context','entries',entryId])).toBe('/agent/context/entries/'+entryId);
    expect(resolveEnginePath('GET',['agent','context','entries',entryId])).toBe('/agent/context/entries/'+entryId);
    expect(resolveEnginePath('DELETE',['context','entries',entryId])).toBeNull();
    expect(resolveEnginePath('POST',['context','entries',entryId])).toBeNull();
    expect(resolveEnginePath('GET',['context','entries','..'])).toBeNull();
    expect(resolveEnginePath('GET',['projects',entryId,'entries'])).toBeNull();
    expect(resolveEnginePath('POST',['project','experiment-drafts'])).toBe('/agent/project/experiment-drafts');
    for(const m of ['GET','PUT','PATCH','DELETE'])expect(resolveEnginePath(m,['project','experiment-drafts'])).toBeNull();
    for(const action of ['publish','unpublish','recipients','leads'])expect(resolveEnginePath('POST',['project','experiment-drafts',entryId,action])).toBeNull();
    expect(resolveEnginePath('GET',['project','experiments',entryId,'results'])).toBe('/agent/project/experiments/'+entryId+'/results');
    for(const m of ['POST','PUT','PATCH','DELETE'])expect(resolveEnginePath(m,['project','experiments',entryId,'results'])).toBeNull();
    expect(resolveEnginePath('GET',['project','experiments'])).toBe('/agent/project/experiments');
    expect(resolveEnginePath('GET',['project','experiments',entryId,'page'])).toBe('/agent/project/experiments/'+entryId+'/page');
    for(const method of ['POST','PUT','PATCH','DELETE'])expect(resolveEnginePath(method,['project','experiments'])).toBeNull();
    for(const action of ['publish','unpublish','leads','outreach','scorecard'])expect(resolveEnginePath('GET',['project','experiments',entryId,action])).toBeNull();
    expect(resolveEnginePath('GET',['project','campaigns'])).toBe('/agent/project/campaigns');
    expect(resolveEnginePath('GET',['project','campaigns',entryId,'jobs'])).toBe('/agent/project/campaigns/'+entryId+'/jobs');
    for(const method of ['POST','PUT','PATCH','DELETE']){
      expect(resolveEnginePath(method,['project','campaigns'])).toBeNull();
      expect(resolveEnginePath(method,['project','campaigns',entryId,'jobs'])).toBeNull();
    }
    for(const action of ['recipients','mailboxes','status','approve','release'])expect(resolveEnginePath('GET',['project','campaigns',entryId,action])).toBeNull();
    expect(resolveEnginePath('GET',['project','assets'])).toBe('/agent/project/assets');
    expect(resolveEnginePath('POST',['project','assets'])).toBe('/agent/project/assets');
    expect(resolveEnginePath('GET',['project','assets',entryId])).toBe('/agent/project/assets/'+entryId);
    expect(resolveEnginePath('PUT',['project','assets',entryId])).toBe('/agent/project/assets/'+entryId);
    for(const method of ['DELETE','PATCH','POST'])expect(resolveEnginePath(method,['project','assets',entryId])).toBeNull();
    for(const action of ['publish','send','approve'])expect(resolveEnginePath('POST',['project','assets',entryId,action])).toBeNull();
    expect(resolveEnginePath('POST',['project','research','hn-search'])).toBe('/agent/project/research/hn-search');
    for(const method of ['GET','PUT','PATCH','DELETE'])expect(resolveEnginePath(method,['project','research','hn-search'])).toBeNull();
    expect(resolveEnginePath('POST',['project','research','hn-search','publish'])).toBeNull();
    expect(resolveEnginePath('GET',['project','research','index'])).toBe('/agent/project/research/index');
    expect(resolveEnginePath('GET',['project','research','records',entryId])).toBe('/agent/project/research/records/'+entryId);
    for(const method of ['POST','PUT','DELETE','PATCH']){
      expect(resolveEnginePath(method,['project','research','index'])).toBeNull();
      expect(resolveEnginePath(method,['project','research','records',entryId])).toBeNull();
    }
    expect(resolveEnginePath('GET',['project','research','records','..'])).toBeNull();
    expect(resolveEnginePath('GET',['project','research','records',entryId,'send'])).toBeNull();
    expect(resolveEnginePath('GET',['project','research'])).toBe('/agent/project/research');
    for(const method of ['POST','PUT','DELETE','PATCH'])expect(resolveEnginePath(method,['project','research'])).toBeNull();
    expect(resolveEnginePath('GET',['project','inventory'])).toBe('/agent/project/inventory');
    for(const method of ['POST','PUT','DELETE','PATCH'])expect(resolveEnginePath(method,['project','inventory'])).toBeNull();
    // Validator operations
    expect(resolveEnginePath('POST', ['validator', 'experiments'])).toBe('/validator/experiments');
    expect(resolveEnginePath('GET', ['validator', 'experiments'])).toBe('/validator/experiments');
    expect(resolveEnginePath('GET', ['workspace', 'experiments'])).toBe('/workspace/experiments');
    expect(resolveEnginePath('POST', ['validator', 'experiments', 'exp-123', 'publish'])).toBe('/validator/experiments/exp-123/publish');
    expect(resolveEnginePath('POST', ['validator', 'experiments', 'exp-123', 'unpublish'])).toBe('/validator/experiments/exp-123/unpublish');
    expect(resolveEnginePath('POST', ['validator', 'experiments', 'exp-123', 'outreach'])).toBe('/validator/experiments/exp-123/outreach');
    expect(resolveEnginePath('GET', ['validator', 'experiments', 'exp-123', 'scorecard'])).toBe('/validator/experiments/exp-123/scorecard');
    expect(resolveEnginePath('POST', ['validator', 'experiments', 'exp-123', 'scorecard'])).toBeNull();
    expect(resolveEnginePath('GET', ['validator', 'experiments', 'exp-123', 'leads'])).toBe('/validator/experiments/exp-123/leads');
    expect(resolveEnginePath('POST', ['validator', 'experiments', 'exp-123', 'leads'])).toBeNull();
    expect(resolveEnginePath('GET', ['validator', 'experiments', 'exp-123', 'leads', 'export'])).toBe('/validator/experiments/exp-123/leads/export');
    expect(resolveEnginePath('POST', ['validator', 'experiments', 'exp-123', 'leads', 'export'])).toBeNull();

    expect(resolveEnginePath('PUT',['validator','experiments',entryId,'page'])).toBe('/validator/experiments/'+entryId+'/page');
    expect(resolveEnginePath('PATCH',['validator','experiments',entryId,'page'])).toBeNull();
    expect(resolveEnginePath('PUT',['project','experiments',entryId,'page'])).toBeNull();
    // Campaign observation only. Never mutations, approvals or release.
    expect(resolveEnginePath('GET',['workspace','campaigns'])).toBe('/workspace/campaigns');
    expect(resolveEnginePath('GET',['campaigns',entryId,'jobs'])).toBe('/campaigns/'+entryId+'/jobs');
    for(const method of ['POST','PUT','PATCH','DELETE']){
      expect(resolveEnginePath(method,['workspace','campaigns'])).toBeNull();
      expect(resolveEnginePath(method,['campaigns',entryId,'jobs'])).toBeNull();
    }
    for(const action of ['recipients','mailboxes','status','approve','release'])expect(resolveEnginePath('GET',['campaigns',entryId,action])).toBeNull();
    expect(resolveEnginePath('POST',['outbound','release'])).toBeNull();

    // Research operations
    expect(resolveEnginePath('POST', ['research', 'website-signals'])).toBe('/research/website-signals');
    expect(resolveEnginePath('POST', ['research', 'website-signals', 'save'])).toBe('/research/website-signals/save');
    expect(resolveEnginePath('GET', ['research', 'leads'])).toBe('/research/leads');

    // Arbitrary paths outside allowlist MUST be rejected
    expect(resolveEnginePath('GET', ['auth', 'login'])).toBeNull();
    expect(resolveEnginePath('POST', ['auth', 'provision'])).toBeNull();
    expect(resolveEnginePath('GET', ['projects'])).toBeNull();
    expect(resolveEnginePath('POST', ['projects'])).toBeNull();
    expect(resolveEnginePath('GET', ['tables'])).toBeNull();
    expect(resolveEnginePath('GET', ['secret'])).toBeNull();
    expect(resolveEnginePath('GET', ['admin'])).toBeNull();
  });

  describe('Gateway HTTP Boundary Enforcements', () => {
    it('rejects requests without Bearer authorization with 401', async () => {
      const { GET } = await import('../../app/api/agent/[...path]/route');
      const req = new Request('http://localhost:3000/api/agent/context');
      const res = await GET(req, { params: Promise.resolve({ path: ['context'] }) });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Bearer token required');
    });

    it('rejects unallowlisted routes with 404', async () => {
      const { GET } = await import('../../app/api/agent/[...path]/route');
      const req = new Request('http://localhost:3000/api/agent/tables', {
        headers: { Authorization: 'Bearer lld_agt_mock' },
      });
      const res = await GET(req, { params: Promise.resolve({ path: ['tables'] }) });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('Endpoint or method not available');
    });

    it('rejects path traversal attempts with 400', async () => {
      const { GET } = await import('../../app/api/agent/[...path]/route');
      const req = new Request('http://localhost:3000/api/agent/../context', {
        headers: { Authorization: 'Bearer lld_agt_mock' },
      });
      const res = await GET(req, { params: Promise.resolve({ path: ['..', 'context'] }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid path');
    });

    it('rejects payloads exceeding 256KB with 413 Payload Too Large', async () => {
      const { POST } = await import('../../app/api/agent/[...path]/route');
      const oversized = 'x'.repeat(262_145);
      const req = new Request('http://localhost:3000/api/agent/context', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer lld_agt_mock',
          'Content-Type': 'application/json',
        },
        body: oversized,
      });
      const res = await POST(req, { params: Promise.resolve({ path: ['context'] }) });
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toContain('Payload exceeds 256KB limit');
    });
  });

  describe('Gateway Operational Smoke Test Against Real Ephemeral Engine', () => {
    it('forwards Bearer token verbatim to internal engine, executing context set and get with zero session minting', async () => {
      const atStore = new InMemoryAgentTokenStore();
      const prStore = new InMemoryProjectRegistryStore();
      const pcStore = new InMemoryProjectContextStore(prStore);

      const atService = new AgentTokenService(atStore);
      const prService = new ProjectRegistryService(prStore);
      const pcService = new ProjectContextService(pcStore);

      const workspaceId = randomUUID();
      const userId = randomUUID();
      const projectId = randomUUID();

      atStore.workspaces.set(workspaceId, { active: true });
      atStore.users.set(userId, { role: 'admin', disabledAt: null });

      prStore.projects.set(projectId, {
        id: projectId,
        workspaceId,
        name: 'Logistics Gateway',
        slug: 'logistics-gateway',
        description: 'Gateway verification project',
        createdByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Issue real project-bound token
      const issued = await atService.issue(workspaceId, userId, {
        name: 'Gateway Smoke Token',
        scopes: ['project:context:read', 'project:context:write'],
        projectId,
      });
      const agentToken = issued.token;

      // Boot ephemeral engine
      const sessionKey = Buffer.from('test_session_secret_key_32_bytes_long!!');
      const app = await createApplication({
        sessionKey,
        agentTokens: atService,
        projectContext: pcService,
        projectRegistry: prService,
      } as any);

      const fastify = app.getHttpAdapter().getInstance();
      await fastify.ready();
      const server = app.getHttpServer();
      await new Promise<void>((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => resolve());
        server.on('error', reject);
      });
      const address = server.address() as AddressInfo;
      const engineUrl = `http://127.0.0.1:${address.port}`;

      const origEngineUrl = process.env.ENGINE_URL;
      process.env.ENGINE_URL = engineUrl;

      try {
        const { POST, GET } = await import('../../app/api/agent/[...path]/route');

        // 1. POST /api/agent/context via gateway
        const postPayload = JSON.stringify({
          context: {
            hypothesis: 'Gateway automated dispatch',
            status: 'verified_through_ingress',
          },
          metadata: { agent: 'GatewayTest' },
        });

        const postReq = new Request('http://localhost:3000/api/agent/context', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${agentToken}`,
            'Content-Type': 'application/json',
          },
          body: postPayload,
        });

        const postRes = await POST(postReq, { params: Promise.resolve({ path: ['context'] }) });
        expect(postRes.status).toBe(200);
        expect(postRes.headers.get('cache-control')).toBe('no-store, max-age=0');
        const postData = await postRes.json();
        expect(postData.projectId).toBe(projectId);
        expect(postData.context.hypothesis).toBe('Gateway automated dispatch');

        // 2. GET /api/agent/context via gateway
        const getReq = new Request('http://localhost:3000/api/agent/context', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${agentToken}`,
          },
        });

        const getRes = await GET(getReq, { params: Promise.resolve({ path: ['context'] }) });
        expect(getRes.status).toBe(200);
        expect(getRes.headers.get('cache-control')).toBe('no-store, max-age=0');
        const getData = await getRes.json();
        expect(getData.projectId).toBe(projectId);
        expect(getData.context.hypothesis).toBe('Gateway automated dispatch');
        expect(getData.context.status).toBe('verified_through_ingress');

        // 3. Engine fences preserved: foreign token with invalid scope rejected with 403
        const unprivilegedToken = await atService.issue(workspaceId, userId, {
          name: 'Wrong Scope Token',
          scopes: ['signals:read'],
          projectId,
        });

        const rejectedReq = new Request('http://localhost:3000/api/agent/context', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${unprivilegedToken.token}`,
          },
        });
        const rejectedRes = await GET(rejectedReq, { params: Promise.resolve({ path: ['context'] }) });
        expect(rejectedRes.status).toBe(403);
      } finally {
        await app.close();
        if (origEngineUrl !== undefined) process.env.ENGINE_URL = origEngineUrl;
        else delete process.env.ENGINE_URL;
      }
    });

    it('forwards experiment listing and streaming CSV export with formula injection defense and Content-Disposition headers', async () => {
      const atStore = new InMemoryAgentTokenStore();
      const atService = new AgentTokenService(atStore);

      const workspaceId = randomUUID();
      const userId = randomUUID();
      const experimentId = randomUUID();

      atStore.workspaces.set(workspaceId, { active: true });
      atStore.users.set(userId, { role: 'admin', disabledAt: null });

      const issued = await atService.issue(workspaceId, userId, {
        name: 'Validator Gateway Token',
        scopes: ['experiments:read'],
      });
      const agentToken = issued.token;

      const mockExperiments = [
        { id: experimentId, hypothesis: 'AI Dev Tools', status: 'published', visitorCount: 42, leadCount: 3 },
      ];

      const mockLeads = [
        {
          id: 'lead-001',
          email: 'founder@example.com',
          name: '=cmd|"/C calc"!A0',
          company: '+AcmeCorp',
          surveyResponses: { role: '-CTO' },
          createdAt: new Date('2026-11-21T08:00:00Z'),
        },
      ];

      const sessionKey = Buffer.from('test_session_secret_key_32_bytes_long!!');
      const app = await createApplication({
        sessionKey,
        agentTokens: atService,
        reads: {
          listExperiments: vi.fn().mockResolvedValue(mockExperiments),
        },
        validator: {
          getLeads: vi.fn().mockImplementation(async (id: string, wsId: string) => {
            if (id === experimentId && wsId === workspaceId) {
              return { experimentId, leads: mockLeads };
            }
            throw new Error('Not found');
          }),
        },
      } as any);

      const fastify = app.getHttpAdapter().getInstance();
      await fastify.ready();
      const server = app.getHttpServer();
      await new Promise<void>((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => resolve());
        server.on('error', reject);
      });
      const address = server.address() as AddressInfo;
      const engineUrl = `http://127.0.0.1:${address.port}`;

      const origEngineUrl = process.env.ENGINE_URL;
      process.env.ENGINE_URL = engineUrl;

      try {
        const { GET } = await import('../../app/api/agent/[...path]/route');

        // 1. GET /api/agent/validator/experiments
        const listReq = new Request('http://localhost:3000/api/agent/validator/experiments', {
          method: 'GET',
          headers: { Authorization: `Bearer ${agentToken}` },
        });
        const listRes = await GET(listReq, { params: Promise.resolve({ path: ['validator', 'experiments'] }) });
        expect(listRes.status).toBe(200);
        const listData = await listRes.json();
        expect(listData).toHaveLength(1);
        expect(listData[0].hypothesis).toBe('AI Dev Tools');

        // 2. GET /api/agent/validator/experiments/:id/leads/export
        const exportReq = new Request(`http://localhost:3000/api/agent/validator/experiments/${experimentId}/leads/export`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${agentToken}` },
        });
        const exportRes = await GET(exportReq, {
          params: Promise.resolve({ path: ['validator', 'experiments', experimentId, 'leads', 'export'] }),
        });
        expect(exportRes.status).toBe(200);
        expect(exportRes.headers.get('content-type')).toContain('text/csv');
        expect(exportRes.headers.get('content-disposition')).toBe(`attachment; filename="experiment-${experimentId}-leads.csv"`);

        const csvText = await exportRes.text();
        expect(csvText).toContain('"id","email","name","company","survey_responses","created_at"');
        expect(csvText).toContain('\'=cmd|""/C calc""!A0');
        expect(csvText).toContain('\'+AcmeCorp');
        expect(csvText).toContain('founder@example.com');
      } finally {
        await app.close();
        if (origEngineUrl !== undefined) process.env.ENGINE_URL = origEngineUrl;
        else delete process.env.ENGINE_URL;
      }
    });
  });
});

it('project discovery only exposes bounded read-derived matching POST, never arbitrary discovery operations',()=>{expect(resolveEnginePath('POST',['project','discovery','match'])).toBe('/agent/project/discovery/match');for(const method of ['GET','PUT','PATCH','DELETE'])expect(resolveEnginePath(method,['project','discovery','match'])).toBeNull();for(const action of ['send','publish','schedule','approve','profile'])expect(resolveEnginePath('POST',['project','discovery',action])).toBeNull();expect(resolveEnginePath('POST',['project','discovery','match','extra'])).toBeNull();});
