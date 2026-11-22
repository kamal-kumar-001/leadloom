import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AgentConnector, TokenBudget } from '../agent-connect';
import { IdeaIntake, ResearchReport } from '../idea-research';
import { RunRegistryStore } from '../run-registry';
import { QaAnswer, QuestionSet, validateAnswers } from './intake';
import {
  buildBriefPrompt,
  buildQuestionsPrompt,
  parseQuestionSet,
  parseRefinedBrief,
  renderBriefMarkdown,
  RefinedBrief,
} from './prompt';

export interface QuestionsRunResult {
  status: 'SUCCESS' | 'FAILED';
  questionSet?: QuestionSet;
  questionsJsonPath?: string;
  tokensSpentTotal: number;
  resumeId: string | null;
  error?: string;
}

export interface BriefRunResult {
  status: 'SUCCESS' | 'FAILED';
  brief?: RefinedBrief;
  briefJsonPath?: string;
  briefMdPath?: string;
  tokensSpentTotal: number;
  resumeId: string | null;
  error?: string;
}

/**
 * M3: Q&A stage - research report -> founder questions -> refined build brief.
 * Two explicit agent runs, each with its own registry record; every success,
 * failure and refusal is visible in the unified status view. Budget is checked
 * BEFORE each run and recorded AFTER it. Artifacts are local files only;
 * nothing is pushed, published or sent.
 */
export class IdeaQaService {
  constructor(
    private readonly connector: AgentConnector,
    private readonly budget: TokenBudget,
    private readonly ownerKey: string,
    private readonly tokenCeiling: number,
    private readonly outputDir: string,
    private readonly registry?: RunRegistryStore,
  ) {}

  private provenance(): 'mock-connector' | 'live-connector' {
    return this.connector.provenance === 'mock' ? 'mock-connector' : 'live-connector';
  }

  private async recordRefused(startedAt: string, label: string, error: string) {
    await this.registry?.record({
      kind: 'idea-qa', status: 'REFUSED', provenance: this.provenance(), startedAt,
      finishedAt: new Date().toISOString(), label: `${this.connector.connectorId}: ${label}`, error,
    });
  }

  /** Step 1: generate the founder question set from intake + research report. */
  async askQuestions(intake: IdeaIntake, report: ResearchReport, workdir: string): Promise<QuestionsRunResult> {
    const startedAt = new Date().toISOString();
    const label = `questions: ${intake.idea.slice(0, 70)}`;
    this.budget.assertWithin(this.ownerKey, this.tokenCeiling);
    let result;
    try {
      result = await this.connector.run({
        prompt: buildQuestionsPrompt(intake, report),
        workdir,
        authority: { writeAllowed: false, networkAllowed: false, allowedTools: [], maxTotalTokens: this.tokenCeiling },
      });
    } catch (e) {
      await this.recordRefused(startedAt, label, (e as Error).message);
      throw e;
    }
    if (result.status !== 'SUCCESS') {
      await this.registry?.record({ kind: 'idea-qa', status: 'FAILED', provenance: this.provenance(), startedAt, finishedAt: new Date().toISOString(), label, tokensUsed: result.usage.totalTokens, error: result.error ?? 'agent run failed' });
      return { status: 'FAILED', tokensSpentTotal: this.budget.spentBy(this.ownerKey), resumeId: result.resumeId, error: result.error ?? 'agent run failed' };
    }
    this.budget.record(this.ownerKey, result.usage);
    let questionSet: QuestionSet;
    try {
      questionSet = parseQuestionSet(result.response);
    } catch (e) {
      await this.registry?.record({ kind: 'idea-qa', status: 'FAILED', provenance: this.provenance(), startedAt, finishedAt: new Date().toISOString(), label, tokensUsed: result.usage.totalTokens, error: (e as Error).message });
      return { status: 'FAILED', tokensSpentTotal: this.budget.spentBy(this.ownerKey), resumeId: result.resumeId, error: (e as Error).message };
    }
    await mkdir(this.outputDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = join(this.outputDir, `questions-${stamp}.json`);
    await writeFile(jsonPath, JSON.stringify({ intake, questionSet, usage: result.usage, connectorId: result.connectorId }, null, 2));
    await this.registry?.record({ kind: 'idea-qa', status: 'SUCCESS', provenance: this.provenance(), startedAt, finishedAt: new Date().toISOString(), label, artifacts: [jsonPath], tokensUsed: result.usage.totalTokens });
    return {
      status: 'SUCCESS', questionSet, questionsJsonPath: jsonPath,
      tokensSpentTotal: this.budget.spentBy(this.ownerKey), resumeId: result.resumeId,
    };
  }

  /** Step 2: fold the founder's validated answers into a refined build brief. */
  async refineBrief(
    intake: IdeaIntake,
    report: ResearchReport,
    questionSet: QuestionSet,
    rawAnswers: unknown,
    workdir: string,
  ): Promise<BriefRunResult> {
    const answers = validateAnswers(rawAnswers, questionSet);
    const startedAt = new Date().toISOString();
    const label = `brief: ${intake.idea.slice(0, 70)}`;
    this.budget.assertWithin(this.ownerKey, this.tokenCeiling);
    let result;
    try {
      result = await this.connector.run({
        prompt: buildBriefPrompt(intake, report, questionSet, answers),
        workdir,
        authority: { writeAllowed: false, networkAllowed: false, allowedTools: [], maxTotalTokens: this.tokenCeiling },
      });
    } catch (e) {
      await this.recordRefused(startedAt, label, (e as Error).message);
      throw e;
    }
    if (result.status !== 'SUCCESS') {
      await this.registry?.record({ kind: 'idea-qa', status: 'FAILED', provenance: this.provenance(), startedAt, finishedAt: new Date().toISOString(), label, tokensUsed: result.usage.totalTokens, error: result.error ?? 'agent run failed' });
      return { status: 'FAILED', tokensSpentTotal: this.budget.spentBy(this.ownerKey), resumeId: result.resumeId, error: result.error ?? 'agent run failed' };
    }
    this.budget.record(this.ownerKey, result.usage);
    let brief: RefinedBrief;
    try {
      brief = parseRefinedBrief(result.response);
    } catch (e) {
      await this.registry?.record({ kind: 'idea-qa', status: 'FAILED', provenance: this.provenance(), startedAt, finishedAt: new Date().toISOString(), label, tokensUsed: result.usage.totalTokens, error: (e as Error).message });
      return { status: 'FAILED', tokensSpentTotal: this.budget.spentBy(this.ownerKey), resumeId: result.resumeId, error: (e as Error).message };
    }
    await mkdir(this.outputDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = join(this.outputDir, `brief-${stamp}.json`);
    const mdPath = join(this.outputDir, `brief-${stamp}.md`);
    await writeFile(jsonPath, JSON.stringify({ intake, questionSet, answers, brief, usage: result.usage, connectorId: result.connectorId }, null, 2));
    await writeFile(mdPath, renderBriefMarkdown(intake, brief, questionSet.questions, answers));
    await this.registry?.record({ kind: 'idea-qa', status: 'SUCCESS', provenance: this.provenance(), startedAt, finishedAt: new Date().toISOString(), label, artifacts: [jsonPath, mdPath], tokensUsed: result.usage.totalTokens });
    return {
      status: 'SUCCESS', brief, briefJsonPath: jsonPath, briefMdPath: mdPath,
      tokensSpentTotal: this.budget.spentBy(this.ownerKey), resumeId: result.resumeId,
    };
  }
}
