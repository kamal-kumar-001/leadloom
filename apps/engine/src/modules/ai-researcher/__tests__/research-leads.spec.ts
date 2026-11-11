import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ResearchLeadsService, RESEARCH_TABLE_NAME } from '../research-leads.service';

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

const PAGE = 'Acme builds a developer API and SDK for Kubernetes cost management. We are hiring engineers - see careers. Pricing starts at $49 per seat. Built for B2B SaaS startups scaling on Docker and PostgreSQL.';

describe('ResearchLeadsService', () => {
  it('saves an engine-computed analysis as a row and lists it back with honest labels', async () => {
    const svc = new ResearchLeadsService(fakeDb());
    const ws = randomUUID();
    const saved = await svc.saveAnalysis(ws, 'acme.test', PAGE, 'pasted_text');
    expect(saved.tableId).toBeTruthy();
    const items = await svc.listAnalyses(ws);
    expect(items).toHaveLength(1);
    const v = items[0].values;
    expect(v['Domain']).toBe('acme.test');
    expect(v['Source']).toBe('heuristic_keywords');
    expect(v['Input']).toBe('pasted_text');
    expect(String(v['Tech keywords'])).toContain('Kubernetes');
    expect(String(v['Relevance reasons'])).toContain('Hiring/careers language');
    expect(v['Hiring language']).toBe(true);
    // a second save reuses the table and adds a row
    await svc.saveAnalysis(ws, 'other.test', 'No tracked words here.', 'pasted_text');
    const items2 = await svc.listAnalyses(ws);
    expect(items2).toHaveLength(2);
  });

  it('lists nothing for a workspace without the research table', async () => {
    const svc = new ResearchLeadsService(fakeDb());
    expect(await svc.listAnalyses(randomUUID())).toEqual([]);
  });

  it('exposes the fixed table name', () => {
    expect(RESEARCH_TABLE_NAME).toBe('Website research leads');
  });
});
