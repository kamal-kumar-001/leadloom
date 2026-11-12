import { describe, it, expect } from 'vitest';
import { WorkspaceReadService } from './workspace-read.service';

function fakeDb() {
  const calls: any[] = [];
  const rec = (name: string) => ({
    count: async (a: any) => { calls.push([name, 'count', a]); return 3; },
    findMany: async (a: any) => { calls.push([name, 'findMany', a]); return []; },
  });
  const grp = (name: string) => ({ groupBy: async (a: any) => { calls.push([name, 'groupBy', a]); return []; } });
  return { calls, db: { table: { ...rec('table'), findFirst: async (a: any) => { calls.push(['table', 'findFirst', a]); return null; } }, column: rec('column'), row: rec('row'), cell: rec('cell'), mailbox: rec('mailbox'), campaign: rec('campaign'), suppressionList: rec('sup'), validationExperiment: rec('exp'), byokCredential: rec('key'), outboundJob: grp('job'), inboundReply: grp('reply') } };
}

describe('WorkspaceReadService', () => {
  it('scopes every query to the given workspace id', async () => {
    const { calls, db } = fakeDb();
    const svc = new WorkspaceReadService(db as any);
    await svc.summary('ws-1'); await svc.listTables('ws-1'); await svc.listMailboxes('ws-1'); await svc.listCampaigns('ws-1');
    expect(calls.length).toBe(11);
    for (const c of calls) expect(c[2].where).toEqual({ workspaceId: 'ws-1' });
  });
  it('never selects mailbox token or key columns', async () => {
    const { calls, db } = fakeDb();
    await new WorkspaceReadService(db as any).listMailboxes('ws-1');
    const sel = Object.keys(calls[0][2].select).join(',');
    expect(sel).not.toMatch(/token|dek|iv|authtag|smtp|imap/i);
  });
  it('campaigns carry real per-campaign send-status buckets and reply counts', async () => {
    const db: any = {
      campaign: { findMany: async () => [{ id: 'c1', name: 'A', status: 'active', steps: [], dailyLimitTotal: 50, scheduleTimezone: 'UTC', createdAt: new Date(), updatedAt: new Date() }, { id: 'c2', name: 'B', status: 'draft', steps: [], dailyLimitTotal: 10, scheduleTimezone: 'UTC', createdAt: new Date(), updatedAt: new Date() }] },
      outboundJob: { groupBy: async () => [
        { campaignId: 'c1', status: 'pending_approval', _count: { _all: 2 }, _max: { updatedAt: new Date('2026-11-01') } },
        { campaignId: 'c1', status: 'approved', _count: { _all: 1 }, _max: { updatedAt: new Date('2026-11-02') } },
        { campaignId: 'c1', status: 'accepted', _count: { _all: 5 }, _max: { updatedAt: new Date('2026-11-03') } },
        { campaignId: 'c1', status: 'uncertain', _count: { _all: 1 }, _max: { updatedAt: new Date('2026-11-04') } },
        { campaignId: 'c1', status: 'cancelled', _count: { _all: 3 }, _max: { updatedAt: new Date('2026-11-05') } },
      ] },
      inboundReply: { groupBy: async () => [{ campaignId: 'c1', _count: { _all: 4 }, _max: { receivedAt: new Date('2026-11-06') } }] },
    };
    const out = await new WorkspaceReadService(db).listCampaigns('w');
    expect(out[0].sendStatus).toEqual({ awaitingApproval: 2, queued: 1, sending: 0, sent: 5, uncertain: 1, failed: 3, replies: 4, lastActivityAt: new Date('2026-11-06').toISOString() });
    expect(out[1].sendStatus).toEqual({ awaitingApproval: 0, queued: 0, sending: 0, sent: 0, uncertain: 0, failed: 0, replies: 0, lastActivityAt: null });
    expect(JSON.stringify(out)).not.toMatch(/from_email|message_id|recipient/i);
  });
  it('summary returns only counts', async () => {
    const { db } = fakeDb();
    expect(await new WorkspaceReadService(db as any).summary('w')).toEqual({ tables: 3, mailboxes: 3, campaigns: 3, suppressions: 3, experiments: 3, providerKeys: 3 });
  });

  it('suppressions expose only a hash prefix, never the full hash', async () => {
    const db: any = { suppressionList: { findMany: async () => [{ id: 'a', emailHash: 'f'.repeat(64), reason: 'unsub', source: 'link', createdAt: new Date() }], count: async () => 1 } };
    const out = await new WorkspaceReadService(db).listSuppressions('w');
    expect(out[0].hashPrefix).toBe('ffffffff');
    expect(JSON.stringify(out)).not.toContain('f'.repeat(16));
  });
  it('experiments truncate the hypothesis and omit sequence and ICP fields', async () => {
    const calls: any[] = [];
    const db: any = { validationExperiment: { findMany: async (a: any) => { calls.push(a); return [{ id: 'e', hypothesis: 'x'.repeat(500), verdict: 'pending', verdictScore: null, createdAt: new Date() }]; }, count: async () => 1 } };
    const out = await new WorkspaceReadService(db).listExperiments('w');
    expect(out[0].hypothesis.length).toBe(140);
    expect(Object.keys(calls[0].select).join()).not.toMatch(/sequence|icp|actionable/i);
  });
});

describe('listCampaignJobs', () => {
  const jobsDb = (campaign: any, jobs: any[]) => {
    const calls: any[] = [];
    const db: any = {
      campaign: { count: async () => 0, findMany: async () => [], findFirst: async (a: any) => { calls.push(['campaign', 'findFirst', a]); return campaign && a.where.workspaceId === campaign.workspaceId ? { id: campaign.id, name: campaign.name, status: campaign.status } : null; } },
      outboundJob: { groupBy: async () => [], findMany: async (a: any) => { calls.push(['job', 'findMany', a]); return jobs; } },
    };
    return { calls, db };
  };
  const camp = { id: 'c1', workspaceId: 'ws-1', name: 'Q4 Outreach', status: 'active' };

  it('returns null for another tenant\'s campaign id (never their jobs)', async () => {
    const { calls, db } = jobsDb(camp, []);
    const svc = new WorkspaceReadService(db);
    expect(await svc.listCampaignJobs('ws-2', 'c1')).toBeNull();
    expect(calls.filter((c) => c[0] === 'job').length).toBe(0);
  });

  it('maps job metadata to ISO dates and leaks no step bodies or provider ids', async () => {
    const jobs = [{ id: 'j1', recipientEmail: 'ada@acme.test', stepNumber: 2, status: 'approved', scheduledAt: new Date('2026-11-10T09:00:00Z'), reservedAt: null, attempts: 1, createdAt: new Date('2026-11-09T09:00:00Z'), updatedAt: new Date('2026-11-11T09:00:00Z') }];
    const { calls, db } = jobsDb(camp, jobs);
    const out = await new WorkspaceReadService(db).listCampaignJobs('ws-1', 'c1');
    expect(out).not.toBeNull();
    expect(out!.campaign).toEqual({ id: 'c1', name: 'Q4 Outreach', status: 'active' });
    expect(out!.jobs[0].scheduledAt).toBe('2026-11-10T09:00:00.000Z');
    expect(out!.jobs[0].reservedAt).toBeNull();
    expect(out!.jobs[0].updatedAt).toBe('2026-11-11T09:00:00.000Z');
    const jobCall = calls.find((c) => c[0] === 'job')[2];
    expect(jobCall.where).toEqual({ workspaceId: 'ws-1', campaignId: 'c1' });
    expect(Object.keys(jobCall.select).join(',')).not.toMatch(/subject|body|messageId|provider|template/i);
    expect(jobCall.take).toBe(100);
  });
});

describe('listTableRows', () => {
  const wsDb = (workspaceId: string) => {
    const table = { id: 't1', workspaceId, name: 'Website research leads', rowCount: 1 };
    return {
      table: { count: async () => 1, findMany: async () => [table], findFirst: async ({ where }: any) => (where.id === 't1' && where.workspaceId === workspaceId ? table : null) },
      column: { findMany: async () => [{ id: 'c1', tableId: 't1', name: 'Domain', type: 'text', orderIndex: 0 }, { id: 'c2', tableId: 't1', name: 'Source', type: 'text', orderIndex: 1 }] },
      row: { findMany: async () => [{ id: 'r1', tableId: 't1', orderIndex: 0 }] },
      cell: { findMany: async () => [{ tableId: 't1', rowId: 'r1', columnId: 'c1', value: 'acme.test' }, { tableId: 't1', rowId: 'r1', columnId: 'c2', value: 'heuristic_keywords' }] },
      mailbox: { count: async () => 0, findMany: async () => [] },
      campaign: { count: async () => 0, findMany: async () => [] },
      suppressionList: { count: async () => 0, findMany: async () => [] },
      validationExperiment: { count: async () => 0, findMany: async () => [] },
      byokCredential: { count: async () => 0 },
    };
  };

  it('returns rows keyed by column name for the owning workspace', async () => {
    const svc = new WorkspaceReadService(wsDb('ws-1'));
    const out = await svc.listTableRows('ws-1', 't1');
    expect(out).not.toBeNull();
    expect(out!.columns.map((c: any) => c.name)).toEqual(['Domain', 'Source']);
    expect(out!.rows).toEqual([{ rowId: 'r1', values: { Domain: 'acme.test', Source: 'heuristic_keywords' } }]);
  });

  it('returns null for another tenant\'s table id (never their data)', async () => {
    const svc = new WorkspaceReadService(wsDb('ws-1'));
    expect(await svc.listTableRows('ws-2', 't1')).toBeNull();
  });
});
