import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { IntentFixtureService, INTENT_TABLE_NAME, INTENT_SOURCE } from '../intent-fixture.service';

function fakeDb() {
  const tables: any[] = [];
  const columns: any[] = [];
  const rows: any[] = [];
  const cells: any[] = [];
  return {
    table: {
      findFirst: async ({ where }: any) => tables.find((t) => t.workspaceId === where.workspaceId && t.name === where.name) ?? null,
      create: async ({ data }: any) => { const t = { id: randomUUID(), rowCount: 0, ...data }; tables.push(t); return t; },
      update: async ({ where, data }: any) => { const t = tables.find((x) => x.id === where.id); if (data.rowCount?.increment) t.rowCount += data.rowCount.increment; return t; },
    },
    column: {
      create: async ({ data }: any) => { const c = { id: randomUUID(), ...data }; columns.push(c); return c; },
      findMany: async ({ where }: any) => columns.filter((c) => c.tableId === where.tableId),
    },
    row: {
      count: async ({ where }: any) => rows.filter((r) => r.tableId === where.tableId).length,
      create: async ({ data }: any) => { const r = { id: randomUUID(), ...data }; rows.push(r); return r; },
      findMany: async ({ where, take }: any) => rows.filter((r) => r.tableId === where.tableId).sort((a, b) => b.orderIndex - a.orderIndex).slice(0, take ?? 50),
    },
    cell: {
      create: async ({ data }: any) => { const c = { id: randomUUID(), ...data }; cells.push(c); return c; },
      findMany: async ({ where }: any) => cells.filter((c) => c.tableId === where.tableId && where.rowId.in.includes(c.rowId)),
    },
  };
}

const FIXTURE = {
  company: 'Acme Robotics',
  jobs: [
    { title: 'Growth Marketing Lead', location: 'Remote - US', absolute_url: 'https://boards.example.invalid/acme/1', updated_at: '2026-11-01T09:00:00Z' },
    { title: 'Outbound Sales Manager', location: 'New York, NY', absolute_url: 'https://boards.example.invalid/acme/2', updated_at: '2026-11-05T10:30:00Z' },
    { title: 'Backend Engineer', updated_at: 'not-a-date' },
  ],
};

describe('IntentFixtureService', () => {
  it('normalizes a hiring-board fixture without inference and labels it as fixture data', () => {
    const svc = new IntentFixtureService(fakeDb());
    const result = svc.analyze(FIXTURE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.analysis;
    expect(a.fixture).toBe(true);
    expect(a.source).toBe(INTENT_SOURCE);
    expect(a.company).toBe('Acme Robotics');
    expect(a.jobCount).toBe(3);
    expect(a.sampleTitles).toHaveLength(3);
    expect(a.locations).toEqual(['Remote - US', 'New York, NY']);
    expect(a.latestPostingDate).toBe('2026-11-05T10:30:00.000Z'); // unparseable date ignored
    expect(a.caveat).toMatch(/not a live feed/i);
  });

  it('rejects malformed fixtures with a readable error', () => {
    const svc = new IntentFixtureService(fakeDb());
    expect(svc.analyze({ jobs: [] }).ok).toBe(false);
    expect(svc.analyze({ company: 'X', jobs: [{ title: 'Y' }], extra: true }).ok).toBe(false);
    expect(svc.analyze('not json').ok).toBe(false);
    const bad = svc.analyze({ company: 'X', jobs: [{ location: 'no title' }] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/Invalid hiring-board fixture/);
  });

  it('saves an engine-computed fixture analysis as a row and lists it back with honest labels', async () => {
    const svc = new IntentFixtureService(fakeDb());
    const ws = randomUUID();
    const saved = await svc.saveAnalysis(ws, FIXTURE);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const items = await svc.listAnalyses(ws);
    expect(items).toHaveLength(1);
    const v = items[0].values;
    expect(v['Company']).toBe('Acme Robotics');
    expect(v['Signal']).toBe('hiring (fixture)');
    expect(v['Open roles in fixture']).toBe(3);
    expect(v['Source']).toBe(INTENT_SOURCE);
    expect(String(v['Caveat'])).toMatch(/not a live feed/i);
  });

  it('refuses to save a malformed fixture (client never supplies computed values)', async () => {
    const svc = new IntentFixtureService(fakeDb());
    const ws = randomUUID();
    const saved = await svc.saveAnalysis(ws, { company: 'X', jobs: 'nope' });
    expect(saved.ok).toBe(false);
    expect(await svc.listAnalyses(ws)).toHaveLength(0);
  });
});
