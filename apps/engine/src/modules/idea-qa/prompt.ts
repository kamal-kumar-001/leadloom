import { IdeaIntake } from '../idea-research';
import { ResearchReport } from '../idea-research';
import { QaAnswer, QaQuestion, QuestionSet } from './intake';

export interface RefinedBrief {
  /** The idea restated after the founder's answers, 2-3 sentences. */
  refined_idea: string;
  /** One sentence: who it is for and why they switch. */
  positioning: string;
  must_have: string[];
  out_of_scope: string[];
  /** What is still unverified after the Q&A; honest leftovers, never hidden. */
  open_risks: string[];
}

const QUESTION_SHAPE = [
  'Required JSON shape:',
  '{',
  '  "questions": [{"id": string, "question": string, "why": string}]   // 3-7 items, unique ids like "q1"',
  '}',
].join('\n');

const BRIEF_SHAPE = [
  'Required JSON shape:',
  '{',
  '  "refined_idea": string,   // 2-3 sentences after the answers',
  '  "positioning": string,    // one sentence: who it is for and why they switch',
  '  "must_have": string[],',
  '  "out_of_scope": string[],',
  '  "open_risks": string[]    // what is still unverified; empty only if truly nothing remains',
  '}',
].join('\n');

function reportContext(report: ResearchReport): string {
  return [
    'Research report summary:',
    report.summary,
    '',
    'Gaps found:',
    report.gaps.map((g) => `- ${g}`).join('\n') || '- (none)',
    '',
    'Open questions from research:',
    report.open_questions.map((q) => `- ${q}`).join('\n') || '- (none)',
  ].join('\n');
}

/**
 * Prompt contract (same rule as research): ONE JSON object, no prose.
 * parseQuestionSet refuses anything else - a chatty answer is a failed run.
 */
export function buildQuestionsPrompt(intake: IdeaIntake, report: ResearchReport): string {
  return [
    'You are a product advisor preparing a founder Q&A. Ask only questions whose answers change what gets built.',
    'Answer with EXACTLY one JSON object and nothing else.',
    '',
    `Idea: ${intake.idea}`,
    `Target user: ${intake.targetUser}`,
    `Constraints: ${intake.constraints.length ? intake.constraints.join('; ') : '(none stated)'}`,
    '',
    reportContext(report),
    '',
    QUESTION_SHAPE,
    '',
    'Rules: 3-7 questions; each "why" is one sentence on how the answer changes the build; do not ask what the research already answered; respect the constraints.',
  ].join('\n');
}

export function buildBriefPrompt(
  intake: IdeaIntake,
  report: ResearchReport,
  questions: QuestionSet,
  answers: QaAnswer[],
): string {
  const qaLines = questions.questions
    .map((q) => {
      const a = answers.find((x) => x.questionId === q.id);
      return a ? `Q (${q.id}) ${q.question}\nA: ${a.answer}` : `Q (${q.id}) ${q.question}\nA: (unanswered)`;
    })
    .join('\n\n');
  return [
    'You are a product strategist. Fold the founder\'s answers into a refined build brief.',
    'Answer with EXACTLY one JSON object and nothing else.',
    '',
    `Idea: ${intake.idea}`,
    `Target user: ${intake.targetUser}`,
    `Constraints: ${intake.constraints.length ? intake.constraints.join('; ') : '(none stated)'}`,
    '',
    reportContext(report),
    '',
    'Founder Q&A:',
    qaLines,
    '',
    BRIEF_SHAPE,
    '',
    'Rules: never contradict a stated constraint; unanswered questions and anything you could not verify belong in open_risks, not in must_have.',
  ].join('\n');
}

export function parseQuestionSet(agentResponse: string): QuestionSet {
  let parsed: any;
  try {
    parsed = JSON.parse(agentResponse);
  } catch {
    throw new Error('agent response is not valid JSON (question-set contract violated)');
  }
  if (!Array.isArray(parsed?.questions) || parsed.questions.length === 0) {
    throw new Error('question set must contain at least one question');
  }
  const ids = new Set<string>();
  for (const q of parsed.questions) {
    if (typeof q?.id !== 'string' || !q.id.trim()) throw new Error('every question needs a non-empty id');
    if (ids.has(q.id)) throw new Error(`duplicate question id: ${q.id}`);
    if (typeof q?.question !== 'string' || !q.question.trim()) throw new Error(`question ${q.id} missing text`);
    if (typeof q?.why !== 'string' || !q.why.trim()) throw new Error(`question ${q.id} missing why`);
    ids.add(q.id);
  }
  return parsed as QuestionSet;
}

export function parseRefinedBrief(agentResponse: string): RefinedBrief {
  let parsed: any;
  try {
    parsed = JSON.parse(agentResponse);
  } catch {
    throw new Error('agent response is not valid JSON (brief contract violated)');
  }
  if (typeof parsed?.refined_idea !== 'string' || !parsed.refined_idea) throw new Error('brief missing refined_idea');
  if (typeof parsed?.positioning !== 'string' || !parsed.positioning) throw new Error('brief missing positioning');
  for (const key of ['must_have', 'out_of_scope', 'open_risks'] as const) {
    if (!Array.isArray(parsed[key]) || parsed[key].some((x: unknown) => typeof x !== 'string')) {
      throw new Error(`brief field ${key} must be a string array`);
    }
  }
  return parsed as RefinedBrief;
}

export function renderBriefMarkdown(
  intake: IdeaIntake,
  brief: RefinedBrief,
  questions: QaQuestion[],
  answers: QaAnswer[],
): string {
  const bullets = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : '- (none)');
  const qaSection = questions
    .map((q) => {
      const a = answers.find((x) => x.questionId === q.id);
      return `**${q.question}**\n${a ? a.answer : '(unanswered)'}`;
    })
    .join('\n\n');
  return [
    `# Refined brief: ${intake.idea.slice(0, 60)}`,
    '',
    `**Target user:** ${intake.targetUser}`,
    '',
    '## Refined idea',
    brief.refined_idea,
    '',
    '## Positioning',
    brief.positioning,
    '',
    '## Must have',
    bullets(brief.must_have),
    '',
    '## Out of scope',
    bullets(brief.out_of_scope),
    '',
    '## Open risks',
    bullets(brief.open_risks),
    '',
    '## Founder Q&A',
    qaSection,
    '',
  ].join('\n');
}
