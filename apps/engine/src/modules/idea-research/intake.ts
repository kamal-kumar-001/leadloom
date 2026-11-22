/** M2: idea intake. The user's idea, stated once, validated before an agent ever sees it. */

export interface IdeaIntake {
  /** One-paragraph idea, in the user's own words. */
  idea: string;
  /** Who it is for (e.g. 'indie hackers building SaaS'). */
  targetUser: string;
  /** Hard constraints the build must respect (e.g. 'no own AI API key'). */
  constraints: string[];
}

export function validateIntake(raw: unknown): IdeaIntake {
  if (typeof raw !== 'object' || raw === null) throw new Error('intake must be an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.idea !== 'string' || r.idea.trim().length < 10) {
    throw new Error('idea must be a string of at least 10 characters');
  }
  if (typeof r.targetUser !== 'string' || !r.targetUser.trim()) {
    throw new Error('targetUser is required');
  }
  const constraints = Array.isArray(r.constraints) ? r.constraints : [];
  for (const c of constraints) {
    if (typeof c !== 'string') throw new Error('constraints must be strings');
  }
  return { idea: r.idea.trim(), targetUser: r.targetUser.trim(), constraints: constraints as string[] };
}
