import {
  ValidationScorecardMetrics,
  ValidationScorecardResponse,
  ValidationVerdict,
} from '@leadloom/contracts';

/** Minimum observed samples before any non-pending verdict. Rates on smaller samples are noise. */
export const MIN_PAGE_LOADS_FOR_VERDICT = 30;
export const MIN_OUTREACH_FOR_VERDICT = 20;

export class ScorecardService {
  /**
   * Computes the weighted validation score and Go/No-Go verdict based on PRD Section 5.2 formula:
   * Score = ((PageConvRate / 0.08 * 0.35) + (ReplyRate / 0.05 * 0.35) + (PositiveResonance / 0.40 * 0.30)) * 100
   *
   * The verdict stays 'pending' until BOTH the page side and the outreach side
   * reach minimum observed samples; a small-sample rate is reported as a raw
   * metric, never turned into a verdict.
   */
  public computeScorecard(
    experimentId: string,
    hypothesis: string,
    metrics: ValidationScorecardMetrics,
    pageUrl: string,
    sequenceSubject: string,
    sequenceBody: string
  ): ValidationScorecardResponse {
    if (metrics.visitors < MIN_PAGE_LOADS_FOR_VERDICT || metrics.outreachSent < MIN_OUTREACH_FOR_VERDICT) {
      return {
        experimentId,
        hypothesis,
        verdict: 'pending',
        verdictScore: 0,
        metrics,
        actionableSummary: `Not enough data for a verdict yet: ${metrics.visitors}/${MIN_PAGE_LOADS_FOR_VERDICT} page loads and ${metrics.outreachSent}/${MIN_OUTREACH_FOR_VERDICT} outreach recorded. The raw metrics above are real observations; the rates are not meaningful at this sample size.`,
        pageUrl,
        sequenceSubject,
        sequenceBody,
      };
    }

    const pageConvComponent = (metrics.pageConversionRate / 0.08) * 0.35;
    const replyRateComponent = (metrics.replyRate / 0.05) * 0.35;
    const resonanceComponent = (metrics.positiveResonanceRate / 0.40) * 0.30;

    const rawScore = (pageConvComponent + replyRateComponent + resonanceComponent) * 100;
    const verdictScore = Math.min(100, Math.max(0, Number(rawScore.toFixed(1))));

    let verdict: ValidationVerdict;
    let actionableSummary: string;

    if (verdictScore >= 80) {
      verdict = 'high_pull';
      actionableSummary = `High customer pull detected (Score ${verdictScore}/100). Signups per page load: ${(metrics.pageConversionRate * 100).toFixed(1)}%, positive resonance: ${(metrics.positiveResonanceRate * 100).toFixed(1)}%. Strong signal within the current sample.`;
    } else if (verdictScore >= 45) {
      verdict = 'pivot_positioning';
      actionableSummary = `Moderate traction with positioning friction (Score ${verdictScore}/100). Page interest is present but outreach resonance is below target in the current sample.`;
    } else {
      verdict = 'low_interest';
      actionableSummary = `Low customer interest (Score ${verdictScore}/100). Weak page and outreach response in the current sample.`;
    }

    return {
      experimentId,
      hypothesis,
      verdict,
      verdictScore,
      metrics,
      actionableSummary,
      pageUrl,
      sequenceSubject,
      sequenceBody,
    };
  }
}
