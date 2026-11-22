import { IdeaIntake } from './intake';

export interface ResearchReport {
  summary: string;
  gaps: string[];
  competitors: { name: string; weakness: string }[];
  open_questions: string[];
  sources: string[];
}

/**
 * Prompt contract: the agent must answer with ONE JSON object matching
 * ResearchReport, no prose around it. parseResearchReport refuses anything
 * else - a coding agent's chatty answer is a failed run, not a report.
 */
export function buildResearchPrompt(intake: IdeaIntake): string {
  const constraintLines = intake.constraints.length
    ? intake.constraints.map((c) => `- ${c}`).join('\n')
    : '- (none stated)';
  return [
    'You are a market researcher. Analyze this product idea and answer with EXACTLY one JSON object and nothing else.',
    '',
    `Idea: ${intake.idea}`,
    `Target user: ${intake.targetUser}`,
    'Constraints:',
    constraintLines,
    '',
    'Required JSON shape:',
    '{',
    '  "summary": string,                      // 2-3 sentences: what the market looks like',
    '  "gaps": string[],                       // unmet needs the idea could exploit',
    '  "competitors": [{"name": string, "weakness": string}],',
    '  "open_questions": string[],             // what the founder must answer before building',
    '  "sources": string[]                     // URLs you actually relied on; empty if none',
    '}',
    '',
    'Rules: only list sources you actually consulted; say so in open_questions when you could not verify something.',
  ].join('\n');
}

export function parseResearchReport(agentResponse: string): ResearchReport {
  let parsed: any;
  try {
    parsed = JSON.parse(agentResponse);
  } catch {
    throw new Error('agent response is not valid JSON (report contract violated)');
  }
  if (typeof parsed?.summary !== 'string' || !parsed.summary) throw new Error('report missing summary');
  for (const key of ['gaps', 'open_questions', 'sources'] as const) {
    if (!Array.isArray(parsed[key]) || parsed[key].some((x: unknown) => typeof x !== 'string')) {
      throw new Error(`report field ${key} must be a string array`);
    }
  }
  if (!Array.isArray(parsed.competitors) ||
      parsed.competitors.some((c: any) => typeof c?.name !== 'string' || typeof c?.weakness !== 'string')) {
    throw new Error('report field competitors must be {name, weakness} objects');
  }
  return parsed as ResearchReport;
}

export function renderReportMarkdown(intake: IdeaIntake, report: ResearchReport): string {
  const bullets = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : '- (none)');
  return [
    `# Research report: ${intake.idea.slice(0, 60)}`,
    '',
    `**Target user:** ${intake.targetUser}`,
    '',
    '## Summary',
    report.summary,
    '',
    '## Gaps',
    bullets(report.gaps),
    '',
    '## Competitors',
    report.competitors.length
      ? report.competitors.map((c) => `- **${c.name}** - ${c.weakness}`).join('\n')
      : '- (none)',
    '',
    '## Open questions for the founder',
    bullets(report.open_questions),
    '',
    '## Sources',
    bullets(report.sources),
    '',
  ].join('\n');
}
