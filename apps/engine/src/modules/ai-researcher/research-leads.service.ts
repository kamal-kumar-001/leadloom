/**
 * G4 website-to-lead-list: persist a website-signals analysis as a row in a
 * per-workspace "Website research leads" table. Every value written comes from
 * the engine's own heuristic computation on the submitted text - the client
 * never supplies computed signals. The row records its source
 * ('heuristic_keywords') and input method so later consumers cannot mistake
 * keyword matches for model output.
 */
import { WebsiteSignalService, deriveIcpHints, deriveRelevanceReasons } from './website-signals.service.js';

export const RESEARCH_TABLE_NAME = 'Website research leads';

const COLUMNS: ReadonlyArray<{ name: string; type: string }> = [
  { name: 'Domain', type: 'text' },
  { name: 'Tech keywords', type: 'text' },
  { name: 'ICP keyword matches', type: 'text' },
  { name: 'Hiring language', type: 'boolean' },
  { name: 'Pricing language', type: 'boolean' },
  { name: 'Scaling language', type: 'boolean' },
  { name: 'Words analyzed', type: 'number' },
  { name: 'Relevance reasons', type: 'text' },
  { name: 'Source', type: 'text' },
  { name: 'Input', type: 'text' },
  { name: 'Researched at', type: 'text' },
];

export interface SavedResearchRow {
  rowId: string;
  values: Record<string, unknown>;
}

export class ResearchLeadsService {
  constructor(
    private readonly db: any,
    private readonly signals: WebsiteSignalService = new WebsiteSignalService(),
  ) {}

  private async ensureTable(workspaceId: string): Promise<{ tableId: string; columnIds: Record<string, string> }> {
    let table = await this.db.table.findFirst({ where: { workspaceId, name: RESEARCH_TABLE_NAME } });
    if (!table) {
      table = await this.db.table.create({ data: { workspaceId, name: RESEARCH_TABLE_NAME } });
      for (let i = 0; i < COLUMNS.length; i++) {
        await this.db.column.create({ data: { tableId: table.id, name: COLUMNS[i].name, type: COLUMNS[i].type, orderIndex: i } });
      }
    }
    const cols = await this.db.column.findMany({ where: { tableId: table.id } });
    const columnIds: Record<string, string> = {};
    for (const c of cols) columnIds[c.name] = c.id;
    return { tableId: table.id, columnIds };
  }

  public async saveAnalysis(workspaceId: string, domain: string, pageText: string, input: 'pasted_text' | 'fetched_url'): Promise<{ tableId: string; rowId: string }> {
    const signals = this.signals.analyzeText(domain, pageText);
    const icpHints = deriveIcpHints(pageText);
    const reasons = deriveRelevanceReasons(signals, icpHints);
    const { tableId, columnIds } = await this.ensureTable(workspaceId);
    const values: Record<string, unknown> = {
      Domain: signals.companyDomain,
      'Tech keywords': signals.techKeywords.join(', '),
      'ICP keyword matches': icpHints.map((h) => `${h.category}: ${h.matchedKeywords.join(', ')}`).join('; '),
      'Hiring language': signals.mentionsHiring,
      'Pricing language': signals.mentionsPricing,
      'Scaling language': signals.mentionsScaling,
      'Words analyzed': signals.wordCount,
      'Relevance reasons': reasons.join(' | '),
      Source: signals.source,
      Input: input,
      'Researched at': new Date().toISOString(),
    };
    const count = await this.db.row.count({ where: { tableId } });
    const row = await this.db.row.create({ data: { tableId, orderIndex: count } });
    for (const [name, value] of Object.entries(values)) {
      const columnId = columnIds[name];
      if (!columnId) continue;
      await this.db.cell.create({ data: { tableId, rowId: row.id, columnId, value: value as any } });
    }
    await this.db.table.update({ where: { id: tableId }, data: { rowCount: { increment: 1 } } });
    return { tableId, rowId: row.id };
  }

  public async listAnalyses(workspaceId: string): Promise<SavedResearchRow[]> {
    const table = await this.db.table.findFirst({ where: { workspaceId, name: RESEARCH_TABLE_NAME } });
    if (!table) return [];
    const cols = await this.db.column.findMany({ where: { tableId: table.id } });
    const nameOf: Record<string, string> = {};
    for (const c of cols) nameOf[c.id] = c.name;
    const rows = await this.db.row.findMany({ where: { tableId: table.id }, orderBy: { orderIndex: 'desc' }, take: 50 });
    const cells = await this.db.cell.findMany({ where: { tableId: table.id, rowId: { in: rows.map((r: any) => r.id) } } });
    return rows.map((r: any) => {
      const values: Record<string, unknown> = {};
      for (const cell of cells.filter((c: any) => c.rowId === r.id)) {
        const name = nameOf[cell.columnId];
        if (name) values[name] = cell.value;
      }
      return { rowId: r.id, values };
    });
  }
}
