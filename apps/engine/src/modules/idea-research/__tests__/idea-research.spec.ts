import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateIntake } from '../intake';
import { buildResearchPrompt, parseResearchReport, renderReportMarkdown } from '../prompt';
import { IdeaResearchService } from '../service';
import { TokenBudget, AgentConnector, AgentRunResult } from '../../agent-connect';

const GOOD_REPORT = {
  summary: 'Indie founders lack a single place from idea to first revenue.',
  gaps: ['orchestration across existing coding agents'],
  competitors: [{ name: 'ToolA', weakness: 'needs its own API key' }],
  open_questions: ['Which niche first?'],
  sources: ['https://example.com/market'],
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
        usage: { inputTokens: 1000, outputTokens: 200, cachedInputTokens: 500, totalTokens: 1200 },
        durationSeconds: 1, ...(status === 'FAILED' ? { error: 'mock failure' } : {}),
      };
    },
  };
  return c;
}

const intake = validateIntake({
  idea: 'Orchestrate the founder\'s existing coding agents from idea to revenue',
  targetUser: 'solo founders with coding-agent subscriptions',
  constraints: ['no own AI API key'],
});

describe('validateIntake', () => {
  it('accepts a well-formed intake and defaults constraints', () => {
    expect(validateIntake({ idea: 'a real product idea here', targetUser: 'devs' }).constraints).toEqual([]);
  });
  it('rejects short idea, missing targetUser, non-string constraints', () => {
    expect(() => validateIntake({ idea: 'short', targetUser: 'devs' })).toThrow('10 characters');
    expect(() => validateIntake({ idea: 'a real product idea here' })).toThrow('targetUser');
    expect(() => validateIntake({ idea: 'a real product idea here', targetUser: 'd', constraints: [1] })).toThrow('strings');
  });
});

describe('prompt contract', () => {
  it('embeds the idea, constraints and the exact JSON shape', () => {
    const p = buildResearchPrompt(intake);
    expect(p).toContain(intake.idea);
    expect(p).toContain('no own AI API key');
    expect(p).toContain('"open_questions"');
    expect(p).toContain('only list sources you actually consulted');
  });
  it('round-trips a valid report and rejects contract violations', () => {
    expect(parseResearchReport(JSON.stringify(GOOD_REPORT)).summary).toBe(GOOD_REPORT.summary);
    expect(() => parseResearchReport('Here is my analysis: ...')).toThrow('not valid JSON');
    expect(() => parseResearchReport('{"gaps":[]}')).toThrow('summary');
    expect(() => parseResearchReport(JSON.stringify({ ...GOOD_REPORT, sources: 'none' }))).toThrow('sources');
  });
});

describe('IdeaResearchService (mock connector, local artifacts only)', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'leadloom-research-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('runs intake -> report end to end and writes json+md artifacts', async () => {
    const svc = new IdeaResearchService(mockConnector(JSON.stringify(GOOD_REPORT)), new TokenBudget(), 'kamal', 50_000, dir);
    const res = await svc.run(intake, dir);
    expect(res.status).toBe('SUCCESS');
    expect(res.report?.competitors[0].name).toBe('ToolA');
    expect(res.tokensSpentTotal).toBe(1200);
    expect(res.resumeId).toBe('mock-conv-1');
    const saved = JSON.parse(readFileSync(res.reportJsonPath!, 'utf8'));
    expect(saved.connectorId).toBe('mock');
    expect(saved.report.gaps).toEqual(GOOD_REPORT.gaps);
    expect(readFileSync(res.reportMdPath!, 'utf8')).toContain('Open questions for the founder');
  });

  it('checks the budget BEFORE calling the agent', async () => {
    const budget = new TokenBudget();
    budget.record('kamal', { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalTokens: 50_000 });
    const conn = mockConnector(JSON.stringify(GOOD_REPORT));
    const svc = new IdeaResearchService(conn, budget, 'kamal', 50_000, dir);
    await expect(svc.run(intake, dir)).rejects.toThrow('budget exhausted');
    expect(conn.calls).toBe(0);
  });

  it('treats non-JSON agent output as a failed run and writes nothing', async () => {
    const svc = new IdeaResearchService(mockConnector('Sure! Let me think about that...'), new TokenBudget(), 'kamal', 50_000, dir);
    const res = await svc.run(intake, dir);
    expect(res.status).toBe('FAILED');
    expect(res.error).toContain('not valid JSON');
    expect(existsSync(join(dir, 'research-'))).toBe(false);
  });

  it('propagates connector failure without writing artifacts', async () => {
    const svc = new IdeaResearchService(mockConnector('', 'FAILED'), new TokenBudget(), 'kamal', 50_000, dir);
    const res = await svc.run(intake, dir);
    expect(res.status).toBe('FAILED');
    expect(res.error).toBe('mock failure');
  });
});
