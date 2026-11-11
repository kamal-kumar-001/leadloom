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
            location: z.string().max(200).nullish(),
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
  const locations = [...new Set(fixture.jobs.map((j) => (j.location ?? '').trim()).filter(Boolean))];
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

  private async ensureTable(workspaceId: string): Promise<{ tableId: string; columnIds: Record<string, string> }> {
    let table = await this.db.table.findFirst({ where: { workspaceId, name: INTENT_TABLE_NAME } });
    if (!table) {
      table = await this.db.table.create({ data: { workspaceId, name: INTENT_TABLE_NAME } });
      for (let i = 0; i < COLUMNS.length; i++) {
        await this.db.column.create({ data: { tableId: table.id, name: COLUMNS[i].name, type: COLUMNS[i].type, orderIndex: i } });
      }
    }
    const cols = await this.db.column.findMany({ where: { tableId: table.id } });
    const columnIds: Record<string, string> = {};
    for (const c of cols) columnIds[c.name] = c.id;
    return { tableId: table.id, columnIds };
  }

  /** Persist an engine-computed fixture analysis; the client never supplies computed values. */
  public async saveAnalysis(workspaceId: string, raw: unknown): Promise<{ ok: true; tableId: string; rowId: string } | { ok: false; error: string }> {
    const result = this.analyze(raw);
    if (!result.ok) return result;
    const a = result.analysis;
    const { tableId, columnIds } = await this.ensureTable(workspaceId);
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
    const count = await this.db.row.count({ where: { tableId } });
    const row = await this.db.row.create({ data: { tableId, orderIndex: count } });
    for (const [name, value] of Object.entries(values)) {
      const columnId = columnIds[name];
      if (!columnId) continue;
      await this.db.cell.create({ data: { tableId, rowId: row.id, columnId, value: value as any } });
    }
    await this.db.table.update({ where: { id: tableId }, data: { rowCount: { increment: 1 } } });
    return { ok: true, tableId, rowId: row.id };
  }

  public async listAnalyses(workspaceId: string): Promise<SavedIntentRow[]> {
    const table = await this.db.table.findFirst({ where: { workspaceId, name: INTENT_TABLE_NAME } });
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
