import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ResearchLeadsService, RESEARCH_TABLE_NAME } from '../research-leads.service';

import {fakeResearchDb as fakeDb} from './research-db.fixture';

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
