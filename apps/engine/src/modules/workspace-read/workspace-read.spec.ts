import { describe, it, expect } from 'vitest';
import { WorkspaceReadService } from './workspace-read.service';

function fakeDb() {
  const calls: any[] = [];
  const rec = (name: string) => ({
    count: async (a: any) => { calls.push([name, 'count', a]); return 3; },
    findMany: async (a: any) => { calls.push([name, 'findMany', a]); return []; },
  });
  return { calls, db: { table: { ...rec('table'), findFirst: async (a: any) => { calls.push(['table', 'findFirst', a]); return null; } }, column: rec('column'), row: rec('row'), cell: rec('cell'), mailbox: rec('mailbox'), campaign: rec('campaign'), suppressionList: rec('sup'), validationExperiment: rec('exp'), byokCredential: rec('key') } };
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
