import { ValidationICPSpec } from '@leadloom/contracts';

export type SignalSource = 'job_posting' | 'tech_stack' | 'github_star' | 'funding_event';

export interface IngestedSignal {
  id: string;
  domain: string;
  companyName: string;
  source: SignalSource;
  rawPayload: Record<string, unknown>;
  detectedAt: Date;
  keywordsMatched: string[];
  relevanceScore: number; // 0.0 to 1.0
}

export class SignalListenerService {
  private signals: IngestedSignal[] = [];

  /**
   * Evaluates and scores an incoming signal against an ICP specification.
   */
  public evaluateSignal(
    domain: string,
    companyName: string,
    source: SignalSource,
    content: string,
    icp?: ValidationICPSpec
  ): IngestedSignal {
    const textLower = content.toLowerCase();
    const matchedKeywords: string[] = [];

    const targetKeywords = icp?.sampleKeywords?.map(k => k.toLowerCase()) ?? [
      'kubernetes',
      'devops',
      'cloud',
      'infra',
      'aws',
      'docker',
    ];

    for (const kw of targetKeywords) {
      if (textLower.includes(kw)) {
        matchedKeywords.push(kw);
      }
    }

    // Check titles if job posting
    if (source === 'job_posting' && icp?.targetTitles) {
      for (const title of icp.targetTitles) {
        if (textLower.includes(title.toLowerCase())) {
          matchedKeywords.push(title);
        }
      }
    }

    // Score based on ratio of matched keywords with base weight
    const baseWeight = source === 'job_posting' ? 0.4 : 0.3;
    const matchRatio = Math.min(1, matchedKeywords.length / Math.max(1, targetKeywords.length));
    const relevanceScore = Math.min(1, Number((baseWeight + matchRatio * 0.6).toFixed(2)));

    const signal: IngestedSignal = {
      id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      domain: domain.toLowerCase().trim(),
      companyName,
      source,
      rawPayload: { contentPreview: content.slice(0, 300) },
      detectedAt: new Date(),
      keywordsMatched: Array.from(new Set(matchedKeywords)),
      relevanceScore,
    };

    this.signals.push(signal);
    return signal;
  }

  public getSignalsForDomain(domain: string): IngestedSignal[] {
    const clean = domain.toLowerCase().trim();
    return this.signals.filter(s => s.domain === clean);
  }

  public getAllSignals(): IngestedSignal[] {
    return [...this.signals];
  }
}
