import {ProjectResearchArchive} from './project-research-archive';
import type {ProjectResearchIndexQuery} from '@leadloom/contracts';
/**
 * G5 intent signals, fixture-first increment: parse a hiring-board-shaped
 * JSON fixture (Greenhouse public board response shape: { company, jobs: [...] })
 * into normalized intent-signal rows, with zero network egress.
 *
 * Honesty contract: every row this produces is FIXTURE data. Source is
 * 'fixture_hiring_board_sample', the analysis carries fixture:true and a
 * caveat, and nothing here claims a live feed, a verified company, or a
 * funding/hiring event observed in the wild. Live ATS/board ingestion is a
 * separate, gated step that must first verify official access rules, rate
 * limits, data meaning and permitted use (see docs/plan/PROVIDER_ACCESS_MATRIX.md,
 * Team-B-reported). Keyword-free: this module only normalizes what the fixture
 * literally contains.
 */
import { appendResearchRow, findResearchTable, researchSaveIdentity, listProjectResearch } from './research-row-store';
import { z } from 'zod';

export const INTENT_TABLE_NAME = 'Intent signals (fixture)';
export const INTENT_SOURCE = 'fixture_hiring_board_sample';
export const FIXTURE_CAVEAT =
  'Fixture data pasted/loaded locally, not a live feed. No hiring board, ATS or filing source was contacted; company, roles and dates are whatever the fixture claims.';

export const HiringBoardFixtureSchema = z
  .object({
    company: z.string().min(1).max(200),
    jobs: z
      .array(
        z
          .object({
            title: z.string().min(1).max(200),
            // Real Greenhouse boards return location as { name }; accept a plain string too.
            location: z.union([z.string().max(200), z.object({ name: z.string().max(200) }).strict()]).nullish(),
            absolute_url: z.string().url().max(2048).nullish(),
            updated_at: z.string().max(64).nullish(),
          })
          .strict()
      )
      .min(1)
      .max(500),
  })
  .strict();
export type HiringBoardFixture = z.infer<typeof HiringBoardFixtureSchema>;

export interface IntentFixtureAnalysis {
  fixture: true;
  caveat: string;
  company: string;
  signalType: 'hiring';
  jobCount: number;
  sampleTitles: string[];
  locations: string[];
  latestPostingDate: string | null;
  source: typeof INTENT_SOURCE;
}

/** Normalize a validated fixture into the stored analysis. No inference beyond counting and listing what the fixture contains. */
export function analyzeHiringBoardFixture(fixture: HiringBoardFixture): IntentFixtureAnalysis {
  const titles = fixture.jobs.map((j) => j.title);
  const locations = Array.from(new Set(fixture.jobs.map((j) => (typeof j.location === 'string' ? j.location : (j.location?.name ?? '')).trim()).filter(Boolean)));
  const dates = fixture.jobs
    .map((j) => j.updated_at)
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  return {
    fixture: true,
    caveat: FIXTURE_CAVEAT,
    company: fixture.company,
    signalType: 'hiring',
    jobCount: fixture.jobs.length,
    sampleTitles: titles.slice(0, 5),
    locations: locations.slice(0, 10),
    latestPostingDate: dates[0] ? dates[0].toISOString() : null,
    source: INTENT_SOURCE,
  };
}

const COLUMNS: ReadonlyArray<{ name: string; type: string }> = [
  { name: 'Company', type: 'text' },
  { name: 'Signal', type: 'text' },
  { name: 'Open roles in fixture', type: 'number' },
  { name: 'Sample titles', type: 'text' },
  { name: 'Locations', type: 'text' },
  { name: 'Latest posting date claimed', type: 'text' },
  { name: 'Source', type: 'text' },
  { name: 'Caveat', type: 'text' },
  { name: 'Saved at', type: 'text' },
];

export interface SavedIntentRow {
  rowId: string;
  values: Record<string, unknown>;
}

export class IntentFixtureService {
  constructor(private readonly db: any) {}

  analyze(raw: unknown): { ok: true; analysis: IntentFixtureAnalysis } | { ok: false; error: string } {
    const parsed = HiringBoardFixtureSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: `Invalid hiring-board fixture: ${issue ? `${issue.path.join('.') || 'root'} ${issue.message}` : 'does not match the expected shape'}` };
    }
    return { ok: true, analysis: analyzeHiringBoardFixture(parsed.data) };
  }


  /** Persist an engine-computed fixture analysis; the client never supplies computed values. */
  public async saveAnalysis(workspaceId: string, raw: unknown,requestId?:string,projectId?:string): Promise<{ ok: true; tableId: string; rowId: string; replayed:boolean } | { ok: false; error: string }> {
    const result = this.analyze(raw);
    if (!result.ok) return result;
    const a = result.analysis;
    const values: Record<string, unknown> = {
      Company: a.company,
      Signal: 'hiring (fixture)',
      'Open roles in fixture': a.jobCount,
      'Sample titles': a.sampleTitles.join('; '),
      Locations: a.locations.join('; '),
      'Latest posting date claimed': a.latestPostingDate ?? 'not in fixture',
      Source: a.source,
      Caveat: a.caveat,
      'Saved at': new Date().toISOString(),
    };
    return {ok:true,...await appendResearchRow(this.db,workspaceId,INTENT_TABLE_NAME,COLUMNS,values,researchSaveIdentity(requestId,{kind:'intent-fixture',fixture:HiringBoardFixtureSchema.parse(raw),...(projectId?{projectId}:{})}),projectId?{projectId,kind:'intent-fixture'}:undefined)};
  }

  public searchProjectAnalyses(workspaceId:string,projectId:string,query:ProjectResearchIndexQuery){return new ProjectResearchArchive(this.db,'intent-fixture',COLUMNS).search(workspaceId,projectId,query);}
  public getProjectAnalysis(workspaceId:string,projectId:string,rowId:string){return new ProjectResearchArchive(this.db,'intent-fixture',COLUMNS).get(workspaceId,projectId,rowId);}

  public async listAnalyses(workspaceId: string,projectId?:string): Promise<SavedIntentRow[]> {
    if(projectId)return listProjectResearch(this.db,workspaceId,projectId,'intent-fixture',INTENT_TABLE_NAME);
    const table = await findResearchTable(this.db,workspaceId,INTENT_TABLE_NAME);
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
