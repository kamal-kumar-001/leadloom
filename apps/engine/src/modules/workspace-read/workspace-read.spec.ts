import { describe, it, expect } from 'vitest';
import { WorkspaceReadService } from './workspace-read.service';

function fakeDb() {
  const calls: any[] = [];
  const rec = (name: string) => ({
    count: async (a: any) => { calls.push([name, 'count', a]); return 3; },
    findMany: async (a: any) => { calls.push([name, 'findMany', a]); return []; },
  });
  return { calls, db: { table: rec('table'), mailbox: rec('mailbox'), campaign: rec('campaign'), suppressionList: rec('sup'), validationExperiment: rec('exp'), byokCredential: rec('key') } };
}

describe('WorkspaceReadService', () => {
  it('scopes every query to the given workspace id', async () => {
    const { calls, db } = fakeDb();
    const svc = new WorkspaceReadService(db as any);
    await svc.summary('ws-1'); await svc.listTables('ws-1'); await svc.listMailboxes('ws-1'); await svc.listCampaigns('ws-1');
    expect(calls.length).toBe(9);
    for (const c of calls) expect(c[2].where).toEqual({ workspaceId: 'ws-1' });
  });
  it('never selects mailbox token or key columns', async () => {
    const { calls, db } = fakeDb();
    await new WorkspaceReadService(db as any).listMailboxes('ws-1');
    const sel = Object.keys(calls[0][2].select).join(',');
    expect(sel).not.toMatch(/token|dek|iv|authtag|smtp|imap/i);
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
