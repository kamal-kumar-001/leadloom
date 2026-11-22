export interface CaptureQuestion {
  text: string;
  type: 'text' | 'choice';
  options?: string[];
}

/** Persist exactly the selection shown by the native select, even untouched. */
export function captureSurveyResponses(questions: CaptureQuestion[], responses: Record<string, string>): Record<string, string> {
  return Object.fromEntries(questions.map((q) => [q.text,
    Object.hasOwn(responses, q.text) ? responses[q.text] : (q.type === 'choice' ? q.options?.[0] ?? '' : ''),
  ]));
}
