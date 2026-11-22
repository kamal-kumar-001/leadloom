import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';

import { createApplication } from '../../../../apps/engine/src/main';
import { CampaignRecipientsRepository } from '../../../../apps/engine/src/modules/outbound/campaign-recipients.repository';
import type { SqlConnection, TransactionalDatabase } from '../../../../apps/engine/src/modules/outbound/atomic-dispatch.repository';
import { ValidatorService } from '../../../../apps/engine/src/modules/validator/validator.service';
import { ValidatorController } from '../../../../apps/engine/src/modules/validator/validator.controller';
import { importCapturedLeads } from '../engine-client';

vi.mock('server-only', () => ({}));

describe('Manual Lead Import Operational Smoke: Captured Leads -> Campaign Draft (Zero Sends)', () => {
  let pg: PGlite;
  const sessionKey = randomBytes(32);
  const workspaceId = randomUUID();
  const foreignWorkspaceId = randomUUID();

  const mintToken = (role = 'admin', ws = workspaceId) => {
    const payload = Buffer.from(
      JSON.stringify({
        sub: randomUUID(),
        workspaceId: ws,
        role,
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url');
    return payload + '.' + createHmac('sha256', sessionKey).update(payload).digest('base64url');
  };

  const connection = (d: any): TransactionalDatabase => ({
    query: async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      (await d.query(sql, params)).rows as T[],
    transaction: async <T>(operation: (conn: SqlConnection) => Promise<T>): Promise<T> =>
      d.transaction(async (tx: any) =>
        operation({
          query: async <R extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
            (await tx.query(sql, params)).rows as R[],
        })
      ),
  });

  beforeEach(async () => {
    pg = new PGlite({ extensions: { vector } });
    for (const migration of [
      '20261110_init_v2',
      '20261110_integrity',
      '20261118_mailbox_password_auth',
      '20261124_campaign_recipients',
      '20261203_projects_registry',
      '20261205_project_entries',
      '20261208_campaign_project',
    ]) {
      const sqlPath = fileURLToPath(
        new URL(`../../../../packages/database/prisma/migrations/${migration}/migration.sql`, import.meta.url)
      );
      await pg.exec(readFileSync(sqlPath, 'utf8'));
    }

    const now = new Date();
    await pg.query(
      'INSERT INTO workspaces (id, name, updated_at) VALUES ($1, $2, $3), ($4, $5, $6)',
      [workspaceId, 'Founder Workspace', now, foreignWorkspaceId, 'Foreign Workspace', now]
    );
  }, 30000);

  afterEach(async () => {
    await pg?.close();
  });

  const setupTestServices = async () => {
    const recipientsRepo = new CampaignRecipientsRepository(connection(pg));
    const validatorService = new ValidatorService('http://localhost:3000');
    const validatorController = new ValidatorController(validatorService);

    const app = await createApplication({
      sessionKey,
      recipients: recipientsRepo,
      validator: validatorController,
    } as any);

    const fastify = app.getHttpAdapter().getInstance();
    return { fastify, recipientsRepo, validatorService, validatorController };
  };

  it('imports waitlist leads into draft campaign with full attribution and strictly zero sends', async () => {
    const { fastify, recipientsRepo, validatorController } = await setupTestServices();
    const adminToken = mintToken('admin');

    // 1. Create validation experiment & publish smoke page
    const exp = await validatorController.generate(workspaceId, {
      rawHypothesis: 'Developer tools for auto-remediating Kubernetes CVEs',
      preferredSlug: 'k8s-cve-auto-remediate',
    });
    const experimentId = exp.experimentId;
    await validatorController.setPublishStatus(experimentId,workspaceId,true,(await validatorController.getOwnerPage(experimentId,workspaceId))?.revision);

    // 2. Capture 2 waitlist leads with survey responses
    await validatorController.submitLead('k8s-cve-auto-remediate', {
      email: 'dan@devops.co',
      name: 'Dan Lee',
      company: 'DevOps Co',
      surveyResponses: { 'cluster-count': '50', cloud: 'AWS' },
    });
    await validatorController.submitLead('k8s-cve-auto-remediate', {
      email: 'maya@scale.tech',
      name: 'Maya Lin',
      company: 'Scale Tech',
      surveyResponses: { 'cluster-count': '200', cloud: 'GCP' },
    });

    // Verify leads are in the experiment
    const leadsRes = await fastify.inject({
      method: 'GET',
      url: `/validator/experiments/${experimentId}/leads`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(leadsRes.statusCode).toBe(200);
    const leadsJson = JSON.parse(leadsRes.body);
    expect(leadsJson.totalLeads).toBe(2);

    // 3. Create a target draft campaign
    const campaign = await recipientsRepo.createCampaign(workspaceId, {
      name: 'Kubernetes Early Access Followup Draft',
      steps: [
        {
          stepNumber: 1,
          delayHours: 0,
          subject: 'Early access to {{companyName}} Kubernetes security',
          bodyTemplate: 'Hi {{firstName}}, thanks for joining our waitlist.',
        },
      ],
      dailyLimitTotal: 25,
      scheduleTimezone: 'UTC',
      mailboxPoolIds: [],
    });
    expect(campaign).not.toBeNull();
    const campaignId = campaign!.id;
    expect(campaign!.status).toBe('draft');

    // 4. Founder performs manual import into draft campaign
    const importRes = await fastify.inject({
      method: 'POST',
      url: `/validator/experiments/${experimentId}/import-leads`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      payload: {
        targetType: 'campaign',
        targetId: campaignId,
      },
    });

    expect(importRes.statusCode).toBe(200);
    const importJson = JSON.parse(importRes.body);
    expect(importJson).toEqual({
      success: true,
      targetType: 'campaign',
      targetId: campaignId,
      targetName: 'Kubernetes Early Access Followup Draft',
      importedCount: 2,
      status: 'draft',
      message: 'Successfully imported 2 lead(s) into campaign draft. No sends triggered.',
    });

    // 5. Zero-send invariant verification:
    // a. Campaign status remains strictly 'draft'
    const dbCampaign = await recipientsRepo.getCampaign(workspaceId, campaignId);
    expect(dbCampaign?.status).toBe('draft');

    // b. Recipients are stored in campaign_recipients with names and custom fields
    const recipients = await recipientsRepo.listRecipients(workspaceId, campaignId);
    expect(recipients).toHaveLength(2);

    const dan = recipients.find((r) => r.email === 'dan@devops.co');
    expect(dan).toBeDefined();
    expect(dan?.firstName).toBe('Dan');
    expect(dan?.lastName).toBe('Lee');
    expect(dan?.companyName).toBe('DevOps Co');
    expect(dan?.customFields).toEqual({
      surveyResponses: { 'cluster-count': '50', cloud: 'AWS' },
      experimentId,
    });

    const maya = recipients.find((r) => r.email === 'maya@scale.tech');
    expect(maya).toBeDefined();
    expect(maya?.firstName).toBe('Maya');
    expect(maya?.lastName).toBe('Lin');
    expect(maya?.companyName).toBe('Scale Tech');
    expect(maya?.customFields).toEqual({
      surveyResponses: { 'cluster-count': '200', cloud: 'GCP' },
      experimentId,
    });

    // c. Zero outbound jobs created / queued (zero sends triggered)
    const outboundJobs = await pg.query('SELECT count(*) as count FROM outbound_jobs WHERE workspace_id=$1', [workspaceId]);
    expect(Number((outboundJobs.rows[0] as any).count)).toBe(0);

    // 6. Idempotent import: re-importing the same leads updates without duplicates
    const reimportRes = await fastify.inject({
      method: 'POST',
      url: `/validator/experiments/${experimentId}/import-leads`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      payload: {
        targetType: 'campaign',
        targetId: campaignId,
      },
    });
    expect(reimportRes.statusCode).toBe(200);
    const recipientsAfter = await recipientsRepo.listRecipients(workspaceId, campaignId);
    expect(recipientsAfter).toHaveLength(2);
  });

  it('rejects import into non-draft campaigns with 409 Conflict', async () => {
    const { fastify, recipientsRepo, validatorController } = await setupTestServices();
    const adminToken = mintToken('admin');

    const exp = await validatorController.generate(workspaceId, {
      rawHypothesis: 'Serverless cost intelligence platform',
      preferredSlug: 'serverless-costs',
    });
    const experimentId = exp.experimentId;
    await validatorController.setPublishStatus(experimentId,workspaceId,true,(await validatorController.getOwnerPage(experimentId,workspaceId))?.revision);
    await validatorController.submitLead('serverless-costs', {
      email: 'lead@cloud.io',
      name: 'Cloud Lead',
    });

    const campaign = await recipientsRepo.createCampaign(workspaceId, {
      name: 'Active Outreach Campaign',
      steps: [{ stepNumber: 1, delayHours: 0, subject: 'Hello', bodyTemplate: 'World' }],
      dailyLimitTotal: 25,
      scheduleTimezone: 'UTC',
      mailboxPoolIds: [],
    });
    const campaignId = campaign!.id;

    // Mutate status to 'active'
    await pg.query('UPDATE campaigns SET status=$1 WHERE id=$2', ['active', campaignId]);

    const importRes = await fastify.inject({
      method: 'POST',
      url: `/validator/experiments/${experimentId}/import-leads`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      payload: {
        targetType: 'campaign',
        targetId: campaignId,
      },
    });

    expect(importRes.statusCode).toBe(409);
    const json = JSON.parse(importRes.body);
    expect(json.error).toBe('Target campaign must be in draft status');
  });

  it('enforces RBAC, tenant isolation, and experiment validation', async () => {
    const { fastify, recipientsRepo, validatorController } = await setupTestServices();
    const adminToken = mintToken('admin');
    const readOnlyToken = mintToken('read_only');
    const foreignAdminToken = mintToken('admin', foreignWorkspaceId);

    const exp = await validatorController.generate(workspaceId, {
      rawHypothesis: 'Edge analytics framework for mobile apps',
      preferredSlug: 'edge-analytics',
    });
    const experimentId = exp.experimentId;
    await validatorController.setPublishStatus(experimentId,workspaceId,true,(await validatorController.getOwnerPage(experimentId,workspaceId))?.revision);

    const campaign = await recipientsRepo.createCampaign(workspaceId, {
      name: 'Edge Analytics Campaign Draft',
      steps: [{ stepNumber: 1, delayHours: 0, subject: 'Hello', bodyTemplate: 'World' }],
      dailyLimitTotal: 25,
      scheduleTimezone: 'UTC',
      mailboxPoolIds: [],
    });
    const campaignId = campaign!.id;

    // 1. Read-only user cannot import (403)
    const readOnlyRes = await fastify.inject({
      method: 'POST',
      url: `/validator/experiments/${experimentId}/import-leads`,
      headers: {
        authorization: `Bearer ${readOnlyToken}`,
        'content-type': 'application/json',
      },
      payload: { targetType: 'campaign', targetId: campaignId },
    });
    expect(readOnlyRes.statusCode).toBe(403);

    // 2. Empty experiment leads rejects with 400
    const emptyRes = await fastify.inject({
      method: 'POST',
      url: `/validator/experiments/${experimentId}/import-leads`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      payload: { targetType: 'campaign', targetId: campaignId },
    });
    expect(emptyRes.statusCode).toBe(400);
    expect(JSON.parse(emptyRes.body).error).toBe('No captured leads to import');

    // Add 1 lead so empty check passes
    await validatorController.submitLead('edge-analytics', {
      email: 'alex@edge.com',
      name: 'Alex Mobile',
    });

    // 3. Foreign tenant cannot access experiment (404)
    const foreignRes = await fastify.inject({
      method: 'POST',
      url: `/validator/experiments/${experimentId}/import-leads`,
      headers: {
        authorization: `Bearer ${foreignAdminToken}`,
        'content-type': 'application/json',
      },
      payload: { targetType: 'campaign', targetId: campaignId },
    });
    expect(foreignRes.statusCode).toBe(404);

    // 4. Non-existent campaign returns 404
    const notFoundRes = await fastify.inject({
      method: 'POST',
      url: `/validator/experiments/${experimentId}/import-leads`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      payload: { targetType: 'campaign', targetId: randomUUID() },
    });
    expect(notFoundRes.statusCode).toBe(404);
    expect(JSON.parse(notFoundRes.body).error).toBe('Target campaign not found');
  });

  it('client SDK importCapturedLeads connects via proxy payload with error handling', async () => {
    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        targetType: 'campaign',
        targetId: 'camp-123',
        targetName: 'Q1 Draft',
        importedCount: 5,
        status: 'draft',
        message: 'Successfully imported 5 lead(s) into campaign draft. No sends triggered.',
      }),
    });
    vi.stubGlobal('fetch', globalFetch);

    const res = await importCapturedLeads('exp-456', {
      targetType: 'campaign',
      targetId: 'camp-123',
    });

    expect(globalFetch).toHaveBeenCalledWith(
      '/api/engine/validator/experiments/exp-456/import-leads',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ targetType: 'campaign', targetId: 'camp-123' }),
      })
    );
    expect(res.data?.success).toBe(true);
    expect(res.data?.importedCount).toBe(5);
    expect(res.data?.status).toBe('draft');
  });
});
