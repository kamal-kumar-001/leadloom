import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import { createApplication } from '../../../../apps/engine/src/main';
import { InMemoryAgentTokenStore, AgentTokenService } from '../../../../apps/engine/src/modules/auth/agent-token.service';
import { ValidatorService } from '../../../../apps/engine/src/modules/validator/validator.service';
import { ValidatorController } from '../../../../apps/engine/src/modules/validator/validator.controller';
import { WebsiteSignalService } from '../../../../apps/engine/src/modules/ai-researcher/website-signals.service';

vi.mock('server-only', () => ({}));

describe('Core GTM Journey Operational Smoke: idea -> research -> validation -> lead capture -> outreach/growth', () => {
  it('executes full journey end-to-end, querying captured leads to bridge lead capture to outreach', async () => {
    const atStore = new InMemoryAgentTokenStore();
    const atService = new AgentTokenService(atStore);
    const validatorService = new ValidatorService('http://localhost:3000');
    const validatorController = new ValidatorController(validatorService);
    const websiteSignals = new WebsiteSignalService();

    const workspaceId = randomUUID();
    const userId = randomUUID();

    atStore.workspaces.set(workspaceId, { active: true });
    atStore.users.set(userId, { role: 'admin', disabledAt: null });

    // Issue workspace tool execution token with experiments & research scopes
    const issued = await atService.issue(workspaceId, userId, {
      name: 'Growth Core Journey Token',
      scopes: ['experiments:read', 'experiments:write', 'research:read', 'research:write'],
    });
    const toolToken = issued.token;

    // Boot ephemeral engine
    const sessionKey = Buffer.from('test_session_secret_key_32_bytes_long!!');
    const app = await createApplication({
      sessionKey,
      agentTokens: atService,
      validator: validatorController,
      websiteSignals,
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

    try {
      // ───────────────────────────────────────────────────────────────────────
      // 1. RESEARCH: Extract website signals from domain and page text
      // ───────────────────────────────────────────────────────────────────────
      const researchRes = await fetch(`${engineUrl}/research/website-signals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${toolToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain: 'devops-scale.io',
          pageText: 'Kubernetes cloud bill optimization tool for engineering teams.',
        }),
      });
      expect(researchRes.status).toBe(200);
      const researchData = await researchRes.json();
      expect(researchData.status).toBe('OK');
      expect(researchData.signals.source).toBe('heuristic_keywords');
      expect(researchData.signals.techKeywords).toContain('Kubernetes');

      // ───────────────────────────────────────────────────────────────────────
      // 2. IDEA -> VALIDATION: Generate experiment hypothesis & publish smoke page
      // ───────────────────────────────────────────────────────────────────────
      const expRes = await fetch(`${engineUrl}/validator/experiments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${toolToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawHypothesis: 'Automated Kubernetes cost-cutter for Series A startups',
          preferredSlug: 'k8s-cost-cut',
        }),
      });
      expect(expRes.status).toBe(200);
      const expData = await expRes.json();
      const experimentId = expData.experimentId;
      const slug = expData.pageUrl.split('/v/')[1];
      expect(experimentId).toBeDefined();
      expect(slug).toBe('k8s-cost-cut');

      // Publish the page to make it publicly accessible
      const reviewed=await(await fetch(`${engineUrl}/validator/experiments/${experimentId}/page`,{headers:{Authorization:`Bearer ${toolToken}`}})).json();
      const pubRes = await fetch(`${engineUrl}/validator/experiments/${experimentId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${toolToken}`,'Content-Type':'application/json' },
        body:JSON.stringify({expectedRevision:reviewed.revision}),
      });
      expect(pubRes.status).toBe(200);
      const pubData = await pubRes.json();
      expect(pubData.status).toBe('published');

      // ───────────────────────────────────────────────────────────────────────
      // 3. LEAD CAPTURE: Prospective customer visits smoke page and joins waitlist
      // ───────────────────────────────────────────────────────────────────────
      // Public page load
      const pageRes = await fetch(`${engineUrl}/validator/pages/${slug}`);
      expect(pageRes.status).toBe(200);
      const pageData = await pageRes.json();
      expect(pageData.headline).toContain('Kubernetes');

      // Lead signs up
      const leadSubmitRes = await fetch(`${engineUrl}/validator/pages/${slug}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'jordan@scaleup-unicorn.io',
          name: 'Jordan Hayes',
          company: 'ScaleUp Unicorn',
          surveyResponses: { budget: '$2,500/mo' },
        }),
      });
      expect(leadSubmitRes.status).toBe(200);
      const leadSubmitData = await leadSubmitRes.json();
      expect(leadSubmitData.success).toBe(true);
      expect(leadSubmitData.totalWaitlist).toBe(1);

      // ───────────────────────────────────────────────────────────────────────
      // 4. OUTREACH / GROWTH: Query captured leads to initiate outreach sequence
      // (The newly repaired missing bridge)
      // ───────────────────────────────────────────────────────────────────────
      const leadsRes = await fetch(`${engineUrl}/validator/experiments/${experimentId}/leads`, {
        headers: { Authorization: `Bearer ${toolToken}` },
      });
      expect(leadsRes.status).toBe(200);
      const leadsData = await leadsRes.json();
      expect(leadsData.experimentId).toBe(experimentId);
      expect(leadsData.totalLeads).toBe(1);
      expect(leadsData.leads).toHaveLength(1);
      expect(leadsData.leads[0].email).toBe('jordan@scaleup-unicorn.io');
      expect(leadsData.leads[0].name).toBe('Jordan Hayes');
      expect(leadsData.leads[0].company).toBe('ScaleUp Unicorn');
      expect(leadsData.leads[0].surveyResponses).toEqual({ budget: '$2,500/mo' });
      expect(leadsData.leads[0].id).toBeDefined();

      // Tenant isolation: foreign token without experiments:read or from foreign tenant fails
      const foreignWorkspaceId = randomUUID();
      atStore.workspaces.set(foreignWorkspaceId, { active: true });
      const foreignToken = await atService.issue(foreignWorkspaceId, userId, {
        name: 'Foreign Token',
        scopes: ['experiments:read'],
      });
      const foreignLeadsRes = await fetch(`${engineUrl}/validator/experiments/${experimentId}/leads`, {
        headers: { Authorization: `Bearer ${foreignToken.token}` },
      });
      expect(foreignLeadsRes.status).toBe(404);

      // ───────────────────────────────────────────────────────────────────────
      // 5. OUTREACH FEEDBACK & VERDICT: Record outreach replies and verify scorecard
      // ───────────────────────────────────────────────────────────────────────
      const outreachRes = await fetch(`${engineUrl}/validator/experiments/${experimentId}/outreach`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${toolToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outreachSent: 50,
          replies: 8,
          positiveReplies: 6,
        }),
      });
      expect(outreachRes.status).toBe(200);

      // Read final scorecard
      const scorecardRes = await fetch(`${engineUrl}/validator/experiments/${experimentId}/scorecard`, {
        headers: { Authorization: `Bearer ${toolToken}` },
      });
      expect(scorecardRes.status).toBe(200);
      const scorecard = await scorecardRes.json();
      expect(scorecard.metrics.waitlistCount).toBe(1);
      expect(scorecard.metrics.outreachSent).toBe(50);
      expect(scorecard.metrics.replies).toBe(8);
      expect(scorecard.metrics.positiveReplies).toBe(6);
      expect(scorecard.metrics.replyRate).toBe(0.16);
      expect(scorecard.metrics.positiveResonanceRate).toBe(0.75);
      // Fails closed to pending before meeting MIN_PAGE_LOADS_FOR_VERDICT (30)
      expect(scorecard.verdict).toBe('pending');
      expect(scorecard.actionableSummary).toContain('Not enough data for a verdict yet');

      // Meet sample threshold directly on validator service
      for (let i = 0; i < 30; i++) await validatorService.recordTraffic(slug);

      // Re-read scorecard
      const scorecardFinalRes = await fetch(`${engineUrl}/validator/experiments/${experimentId}/scorecard`, {
        headers: { Authorization: `Bearer ${toolToken}` },
      });
      const finalScorecard = await scorecardFinalRes.json();
      expect(finalScorecard.metrics.visitors).toBeGreaterThanOrEqual(30);
      expect(finalScorecard.verdict).toBe('high_pull');
    } finally {
      await app.close();
    }
  });
});
