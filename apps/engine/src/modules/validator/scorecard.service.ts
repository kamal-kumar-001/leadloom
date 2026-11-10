import {
  ValidationScorecardMetrics,
  ValidationScorecardResponse,
  ValidationVerdict,
} from '@leadloom/contracts';

export class ScorecardService {
  /**
   * Computes the weighted validation score and Go/No-Go verdict based on PRD Section 5.2 formula:
   * Score = ((PageConvRate / 0.08 * 0.35) + (ReplyRate / 0.05 * 0.35) + (PositiveResonance / 0.40 * 0.30)) * 100
   */
  public computeScorecard(
    experimentId: string,
    hypothesis: string,
    metrics: ValidationScorecardMetrics,
    pageUrl: string,
    sequenceSubject: string,
    sequenceBody: string
  ): ValidationScorecardResponse {
    // If not enough data collected yet (e.g. < 10 visitors and 0 outreach), mark as pending
    if (metrics.visitors < 10 && metrics.outreachSent === 0) {
      return {
        experimentId,
        hypothesis,
        verdict: 'pending',
        verdictScore: 0,
        metrics,
        actionableSummary: 'Validation experiment recently initialized. Awaiting outbound replies and page traffic.',
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
      actionableSummary = `🔥 High customer pull detected (Score ${verdictScore}/100). Conversion rate is ${(metrics.pageConversionRate * 100).toFixed(1)}% and positive resonance is ${(metrics.positiveResonanceRate * 100).toFixed(1)}%. Greenlight engineering MVP.`;
    } else if (verdictScore >= 45) {
      verdict = 'pivot_positioning';
      actionableSummary = `⚠️ Moderate traction with positioning friction (Score ${verdictScore}/100). Visitors are interested but outreach reply resonance is below 40%. Recommend adjusting headline and value proposition.`;
    } else {
      verdict = 'low_interest';
      actionableSummary = `❄️ Low customer interest (Score ${verdictScore}/100). Low conversion and low outreach response across targeted ICP. Recommend killing or fundamentally rethinking hypothesis before writing code.`;
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
