import {ProjectResearchArchive} from './project-research-archive';
import type {ProjectResearchIndexQuery} from '@leadloom/contracts';
/**
 * G4 website-to-lead-list: persist a website-signals analysis as a row in a
 * per-workspace "Website research leads" table. Every value written comes from
 * the engine's own heuristic computation on the submitted text - the client
 * never supplies computed signals. The row records its source
 * ('heuristic_keywords') and input method so later consumers cannot mistake
 * keyword matches for model output.
 */
import { appendResearchRow, findResearchTable, researchSaveIdentity, listProjectResearch } from './research-row-store';
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


  public async saveAnalysis(workspaceId: string, domain: string, pageText: string, input: 'pasted_text' | 'fetched_url',requestId?:string,projectId?:string): Promise<{ tableId: string; rowId: string; replayed:boolean }> {
    const signals = this.signals.analyzeText(domain, pageText);
    const icpHints = deriveIcpHints(pageText);
    const reasons = deriveRelevanceReasons(signals, icpHints);
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
    return appendResearchRow(this.db,workspaceId,RESEARCH_TABLE_NAME,COLUMNS,values,researchSaveIdentity(requestId,{kind:'website',domain,pageText,input,...(projectId?{projectId}:{})}),projectId?{projectId,kind:'website'}:undefined);
  }

  public searchProjectAnalyses(workspaceId:string,projectId:string,query:ProjectResearchIndexQuery){return new ProjectResearchArchive(this.db,'website',COLUMNS).search(workspaceId,projectId,query);}
  public getProjectAnalysis(workspaceId:string,projectId:string,rowId:string){return new ProjectResearchArchive(this.db,'website',COLUMNS).get(workspaceId,projectId,rowId);}

  public async listAnalyses(workspaceId: string,projectId?:string): Promise<SavedResearchRow[]> {
    if(projectId)return listProjectResearch(this.db,workspaceId,projectId,'website',RESEARCH_TABLE_NAME);
    const table = await findResearchTable(this.db,workspaceId,RESEARCH_TABLE_NAME);
    if (!table) return [];
    const cols = await this.db.column.findMany({ where: { tableId: table.id } });
    const nameOf: Record<string, string> = Object.create(null);
    for (const c of cols) nameOf[c.id] = c.name;
    const rows = await this.db.row.findMany({ where: { tableId: table.id }, orderBy: { orderIndex: 'desc' }, take: 50 });
    const cells = await this.db.cell.findMany({ where: { tableId: table.id, rowId: { in: rows.map((r: any) => r.id) } } });
    return rows.map((r: any) => {
      const values: Record<string, unknown> = Object.create(null);
      for (const cell of cells.filter((c: any) => c.rowId === r.id)) {
        const name = nameOf[cell.columnId];
        if (name) values[name] = cell.value;
      }
      return { rowId: r.id, values };
    });
  }
}
