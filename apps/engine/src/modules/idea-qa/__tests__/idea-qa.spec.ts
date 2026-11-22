import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateAnswers, QuestionSet } from '../intake';
import {
  buildQuestionsPrompt,
  buildBriefPrompt,
  parseQuestionSet,
  parseRefinedBrief,
  renderBriefMarkdown,
} from '../prompt';
import { IdeaQaService } from '../service';
import { TokenBudget, AgentConnector, AgentRunResult } from '../../agent-connect';
import { validateIntake } from '../../idea-research';
import { RunRegistryStore } from '../../run-registry';

const REPORT = {
  summary: 'Indie founders lack a single place from idea to first revenue.',
  gaps: ['orchestration across existing coding agents'],
  competitors: [{ name: 'ToolA', weakness: 'needs its own API key' }],
  open_questions: ['Which niche first?'],
  sources: ['https://example.com/market'],
};

const GOOD_QUESTIONS = {
  questions: [
    { id: 'q1', question: 'Which niche do you serve first?', why: 'It fixes the landing angle.' },
    { id: 'q2', question: 'Is self-hosting required?', why: 'It changes the deployment model.' },
  ],
};

const GOOD_BRIEF = {
  refined_idea: 'An orchestrator for solo founders who already pay for coding agents.',
  positioning: 'Founders with agent subscriptions get idea-to-revenue without another AI bill.',
  must_have: ['research report', 'landing draft'],
  out_of_scope: ['multi-tenant hosting'],
  open_risks: ['niche unverified'],
};

function mockConnector(response: string, status: 'SUCCESS' | 'FAILED' = 'SUCCESS'): AgentConnector & { calls: number } {
  const c: AgentConnector & { calls: number } = {
    connectorId: 'mock',
    provenance: 'mock' as const,
    calls: 0,
    async run(): Promise<AgentRunResult> {
      c.calls++;
      return {
        connectorId: 'mock', status, response: status === 'SUCCESS' ? response : '',
        resumeId: 'mock-conv-1',
        usage: { inputTokens: 800, outputTokens: 150, cachedInputTokens: 400, totalTokens: 950 },
        durationSeconds: 1, ...(status === 'FAILED' ? { error: 'mock failure' } : {}),
      };
    },
  };
  return c;
}

const refusingConnector: AgentConnector = {
  connectorId: 'agy-refusing',
  provenance: 'live' as const,
  async run(): Promise<AgentRunResult> {
    const { AuthorityDeniedError } = await import('../../agent-connect/errors');
    throw new AuthorityDeniedError('connector cannot enforce read-only');
  },
};

const intake = validateIntake({
  idea: 'Orchestrate the founder\'s existing coding agents from idea to revenue',
  targetUser: 'solo founders with coding-agent subscriptions',
  constraints: ['no own AI API key'],
});

const questionSet: QuestionSet = GOOD_QUESTIONS;

describe('validateAnswers', () => {
  it('accepts answers that reference known questions', () => {
    const out = validateAnswers([{ questionId: 'q1', answer: 'indie SaaS founders' }], questionSet);
    expect(out).toEqual([{ questionId: 'q1', answer: 'indie SaaS founders' }]);
  });
  it('rejects unknown ids, duplicates, empty and over-long answers, and empty sets', () => {
    expect(() => validateAnswers([{ questionId: 'q9', answer: 'x' }], questionSet)).toThrow('unknown question id');
    expect(() => validateAnswers(
      [{ questionId: 'q1', answer: 'a' }, { questionId: 'q1', answer: 'b' }], questionSet)).toThrow('duplicate');
    expect(() => validateAnswers([{ questionId: 'q1', answer: '  ' }], questionSet)).toThrow('non-empty');
    expect(() => validateAnswers([{ questionId: 'q1', answer: 'x'.repeat(2001) }], questionSet)).toThrow('exceeds');
    expect(() => validateAnswers([], questionSet)).toThrow('at least one');
  });
});

describe('prompt contracts', () => {
  it('questions prompt embeds idea, constraints, report context and the JSON shape', () => {
    const p = buildQuestionsPrompt(intake, REPORT);
    expect(p).toContain(intake.idea);
    expect(p).toContain('no own AI API key');
    expect(p).toContain('Which niche first?');
    expect(p).toContain('"questions"');
    expect(p).toContain('3-7 questions');
  });
  it('brief prompt embeds Q&A pairs and marks unanswered questions', () => {
    const answers = validateAnswers([{ questionId: 'q1', answer: 'indie SaaS founders' }], questionSet);
    const p = buildBriefPrompt(intake, REPORT, questionSet, answers);
    expect(p).toContain('indie SaaS founders');
    expect(p).toContain('(unanswered)');
    expect(p).toContain('"open_risks"');
    expect(p).toContain('never contradict a stated constraint');
  });
  it('parseQuestionSet refuses prose, empty sets, duplicate ids and missing fields', () => {
    expect(() => parseQuestionSet('sure! here are questions')).toThrow('not valid JSON');
    expect(() => parseQuestionSet('{"questions": []}')).toThrow('at least one');
    expect(() => parseQuestionSet(JSON.stringify({ questions: [GOOD_QUESTIONS.questions[0], GOOD_QUESTIONS.questions[0]] })))
      .toThrow('duplicate question id');
    expect(() => parseQuestionSet(JSON.stringify({ questions: [{ id: 'q1', question: 'Why?' }] }))).toThrow('missing why');
    expect(parseQuestionSet(JSON.stringify(GOOD_QUESTIONS)).questions).toHaveLength(2);
  });
  it('parseRefinedBrief refuses prose and missing fields', () => {
    expect(() => parseRefinedBrief('here is your brief')).toThrow('not valid JSON');
    expect(() => parseRefinedBrief('{"positioning": "x"}')).toThrow('refined_idea');
    expect(() => parseRefinedBrief(JSON.stringify({ ...GOOD_BRIEF, must_have: 'nope' }))).toThrow('must_have');
    expect(parseRefinedBrief(JSON.stringify(GOOD_BRIEF)).positioning).toContain('agent subscriptions');
  });
});

describe('IdeaQaService', () => {
  let dir: string;
  let registry: RunRegistryStore;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idea-qa-'));
    registry = new RunRegistryStore(join(dir, 'registry.json'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('askQuestions SUCCESS: writes artifact, records a mock-provenance run, spends budget', async () => {
    const connector = mockConnector(JSON.stringify(GOOD_QUESTIONS));
    const budget = new TokenBudget();
    const svc = new IdeaQaService(connector, budget, 'owner', 50_000, join(dir, 'out'), registry);
    const res = await svc.askQuestions(intake, REPORT, dir);
    expect(res.status).toBe('SUCCESS');
    expect(res.questionSet?.questions).toHaveLength(2);
    expect(existsSync(res.questionsJsonPath!)).toBe(true);
    const runs = (await registry.load()).runs;
    expect(runs).toHaveLength(1);
    expect(runs[0].kind).toBe('idea-qa');
    expect(runs[0].status).toBe('SUCCESS');
    expect(runs[0].provenance).toBe('mock-connector');
    expect(runs[0].tokensUsed).toBe(950);
    expect(budget.spentBy('owner')).toBe(950);
  });

  it('askQuestions FAILED: records the failure with unknown-fields intact, no artifact', async () => {
    const connector = mockConnector('', 'FAILED');
    const svc = new IdeaQaService(connector, new TokenBudget(), 'owner', 50_000, join(dir, 'out'), registry);
    const res = await svc.askQuestions(intake, REPORT, dir);
    expect(res.status).toBe('FAILED');
    const runs = (await registry.load()).runs;
    expect(runs[0].status).toBe('FAILED');
    expect(runs[0].error).toBe('mock failure');
  });

  it('contract violation after a successful run is a FAILED record, not a silent pass', async () => {
    const connector = mockConnector('the questions are: ...');
    const svc = new IdeaQaService(connector, new TokenBudget(), 'owner', 50_000, join(dir, 'out'), registry);
    const res = await svc.askQuestions(intake, REPORT, dir);
    expect(res.status).toBe('FAILED');
    expect(res.error).toContain('not valid JSON');
    expect((await registry.load()).runs[0].status).toBe('FAILED');
  });

  it('authority refusal is recorded REFUSED and rethrown', async () => {
    const svc = new IdeaQaService(refusingConnector, new TokenBudget(), 'owner', 50_000, join(dir, 'out'), registry);
    await expect(svc.askQuestions(intake, REPORT, dir)).rejects.toThrow('cannot enforce read-only');
    const runs = (await registry.load()).runs;
    expect(runs[0].status).toBe('REFUSED');
    expect(runs[0].provenance).toBe('live-connector');
  });

  it('budget exhaustion refuses the run before the connector is called', async () => {
    const connector = mockConnector(JSON.stringify(GOOD_QUESTIONS));
    const budget = new TokenBudget();
    budget.record('owner', { inputTokens: 49_000, outputTokens: 2_000, cachedInputTokens: 0, totalTokens: 51_000 });
    const svc = new IdeaQaService(connector, budget, 'owner', 50_000, join(dir, 'out'), registry);
    await expect(svc.askQuestions(intake, REPORT, dir)).rejects.toThrow();
    expect(connector.calls).toBe(0);
  });

  it('refineBrief SUCCESS: validates answers, writes json+md artifacts, records the run', async () => {
    const connector = mockConnector(JSON.stringify(GOOD_BRIEF));
    const svc = new IdeaQaService(connector, new TokenBudget(), 'owner', 50_000, join(dir, 'out'), registry);
    const res = await svc.refineBrief(intake, REPORT, questionSet, [{ questionId: 'q1', answer: 'indie SaaS founders' }], dir);
    expect(res.status).toBe('SUCCESS');
    expect(res.brief?.must_have).toContain('research report');
    const md = readFileSync(res.briefMdPath!, 'utf8');
    expect(md).toContain('indie SaaS founders');
    expect(md).toContain('(unanswered)'); // q2 has no answer
    expect((await registry.load()).runs[0].kind).toBe('idea-qa');
  });

  it('refineBrief rejects answers to unknown questions before any agent run', async () => {
    const connector = mockConnector(JSON.stringify(GOOD_BRIEF));
    const svc = new IdeaQaService(connector, new TokenBudget(), 'owner', 50_000, join(dir, 'out'), registry);
    await expect(svc.refineBrief(intake, REPORT, questionSet, [{ questionId: 'qX', answer: 'hi' }], dir))
      .rejects.toThrow('unknown question id');
    expect(connector.calls).toBe(0);
    expect((await registry.load()).runs).toHaveLength(0);
  });
});

describe('renderBriefMarkdown', () => {
  it('renders all sections with honest leftovers', () => {
    const md = renderBriefMarkdown(
      intake, GOOD_BRIEF, questionSet.questions,
      [{ questionId: 'q1', answer: 'indie SaaS founders' }],
    );
    for (const section of ['Refined idea', 'Positioning', 'Must have', 'Out of scope', 'Open risks', 'Founder Q&A']) {
      expect(md).toContain(section);
    }
    expect(md).toContain('(unanswered)');
  });
});
