import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AgentConnector, TokenBudget } from '../agent-connect';
import { RunRegistryStore } from '../run-registry';
import { IdeaIntake } from './intake';
import { buildResearchPrompt, parseResearchReport, renderReportMarkdown, ResearchReport } from './prompt';

export interface ResearchRunResult {
  status: 'SUCCESS' | 'FAILED';
  report?: ResearchReport;
  reportJsonPath?: string;
  reportMdPath?: string;
  tokensSpentTotal: number;
  resumeId: string | null;
  error?: string;
}

/**
 * M2: idea intake -> sourced research report.
 * One agent run through the given connector (mock in local dev, real CLI at
 * execution time once the permitted route is established). Budget is checked
 * BEFORE the run and recorded AFTER it. Every attempt - success, failure and
 * refusal - lands in the run registry for the unified status view.
 * Artifacts are local files only; nothing is pushed, published or sent.
 */
export class IdeaResearchService {
  constructor(
    private readonly connector: AgentConnector,
    private readonly budget: TokenBudget,
    private readonly ownerKey: string,
    private readonly tokenCeiling: number,
    private readonly outputDir: string,
    private readonly registry?: RunRegistryStore,
  ) {}

  async run(intake: IdeaIntake, workdir: string): Promise<ResearchRunResult> {
    const startedAt = new Date().toISOString();
    const label = intake.idea.slice(0, 80);
    const provenance = this.connector.provenance === 'mock' ? 'mock-connector' as const : 'live-connector' as const;
    this.budget.assertWithin(this.ownerKey, this.tokenCeiling);
    let result;
    try {
      result = await this.connector.run({
        prompt: buildResearchPrompt(intake),
        workdir,
        authority: { writeAllowed: false, networkAllowed: false, allowedTools: [], maxTotalTokens: this.tokenCeiling },
      });
    } catch (e) {
      // Authority refusal is a REFUSED record - visible in the status view, never hidden.
      await this.registry?.record({ kind: 'agent-run', status: 'REFUSED', provenance, startedAt, finishedAt: new Date().toISOString(), label: `${this.connector.connectorId}: ${label}`, error: (e as Error).message });
      throw e;
    }
    if (result.status !== 'SUCCESS') {
      await this.registry?.record({ kind: 'agent-run', status: 'FAILED', provenance, startedAt, finishedAt: new Date().toISOString(), label: `${this.connector.connectorId}: ${label}`, tokensUsed: result.usage.totalTokens, error: result.error ?? 'agent run failed' });
      return { status: 'FAILED', tokensSpentTotal: this.budget.spentBy(this.ownerKey), resumeId: result.resumeId, error: result.error ?? 'agent run failed' };
    }
    this.budget.record(this.ownerKey, result.usage);
    let report: ResearchReport;
    try {
      report = parseResearchReport(result.response);
    } catch (e) {
      await this.registry?.record({ kind: 'idea-research', status: 'FAILED', provenance, startedAt, finishedAt: new Date().toISOString(), label, tokensUsed: result.usage.totalTokens, error: (e as Error).message });
      return { status: 'FAILED', tokensSpentTotal: this.budget.spentBy(this.ownerKey), resumeId: result.resumeId, error: (e as Error).message };
    }
    await mkdir(this.outputDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = join(this.outputDir, `research-${stamp}.json`);
    const mdPath = join(this.outputDir, `research-${stamp}.md`);
    await writeFile(jsonPath, JSON.stringify({ intake, report, usage: result.usage, connectorId: result.connectorId }, null, 2));
    await writeFile(mdPath, renderReportMarkdown(intake, report));
    await this.registry?.record({ kind: 'idea-research', status: 'SUCCESS', provenance, startedAt, finishedAt: new Date().toISOString(), label, artifacts: [jsonPath, mdPath], tokensUsed: result.usage.totalTokens });
    return {
      status: 'SUCCESS', report, reportJsonPath: jsonPath, reportMdPath: mdPath,
      tokensSpentTotal: this.budget.spentBy(this.ownerKey), resumeId: result.resumeId,
    };
  }
}
