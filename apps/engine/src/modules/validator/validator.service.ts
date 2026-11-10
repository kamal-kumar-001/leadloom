import * as crypto from 'crypto';
import {
  GenerateValidationRequest,
  SubmitWaitlistLeadRequest,
  ValidationScorecardMetrics,
  ValidationScorecardResponse,
} from '@leadloom/contracts';
import { DecomposedHypothesisOutput, HypothesisDecomposerService } from './hypothesis-decomposer.service';
import { ScorecardService } from './scorecard.service';

export interface StoredExperiment {
  id: string;
  hypothesis: string;
  decomposed: DecomposedHypothesisOutput;
  metrics: ValidationScorecardMetrics;
  leads: Array<{
    email: string;
    name?: string;
    company?: string;
    surveyResponses: Record<string, string>;
    createdAt: Date;
  }>;
  createdAt: Date;
}

export class ValidatorService {
  private experiments = new Map<string, StoredExperiment>();
  private slugToId = new Map<string, string>();
  private decomposer: HypothesisDecomposerService;
  private scorecard: ScorecardService;

  constructor(private readonly publicOrigin = 'http://localhost:3000') {
    this.decomposer = new HypothesisDecomposerService();
    this.scorecard = new ScorecardService();
  }

  public generate(request: GenerateValidationRequest): {
    experimentId: string;
    pageUrl: string;
    decomposed: DecomposedHypothesisOutput;
    scorecard: ValidationScorecardResponse;
  } {
    const decomposed = this.decomposer.decompose(request);
    const baseSlug = decomposed.slug;
    if (request.preferredSlug && this.slugToId.has(baseSlug)) throw new Error('Requested page slug is already in use');
    while (this.slugToId.has(decomposed.slug)) decomposed.slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
    decomposed.smokePage.slug = decomposed.slug;
    const experimentId = crypto.randomUUID();

    const initialMetrics: ValidationScorecardMetrics = {
      visitors: 0,
      pageConversions: 0,
      pageConversionRate: 0,
      outreachSent: 0,
      replies: 0,
      replyRate: 0,
      positiveReplies: 0,
      positiveResonanceRate: 0,
      waitlistCount: 0,
    };

    const stored: StoredExperiment = {
      id: experimentId,
      hypothesis: request.rawHypothesis,
      decomposed,
      metrics: initialMetrics,
      leads: [],
      createdAt: new Date(),
    };

    this.experiments.set(experimentId, stored);
    this.slugToId.set(decomposed.slug, experimentId);

    const pageUrl = new URL(`/v/${decomposed.slug}`, this.publicOrigin).href;
    const initialScorecard = this.scorecard.computeScorecard(
      experimentId,
      request.rawHypothesis,
      initialMetrics,
      pageUrl,
      decomposed.sequenceSubject,
      decomposed.sequenceBody
    );

    return {
      experimentId,
      pageUrl,
      decomposed,
      scorecard: initialScorecard,
    };
  }

  public getExperiment(id: string): StoredExperiment | undefined {
    return this.experiments.get(id);
  }

  public getExperimentBySlug(slug: string): StoredExperiment | undefined {
    const id = this.slugToId.get(slug);
    return id ? this.experiments.get(id) : undefined;
  }

  public recordTraffic(slug: string): void {
    const exp = this.getExperimentBySlug(slug);
    if (!exp) return;

    exp.metrics.visitors += 1;
    exp.metrics.pageConversionRate =
      exp.metrics.visitors > 0 ? exp.metrics.pageConversions / exp.metrics.visitors : 0;
  }

  public submitLead(slug: string, lead: SubmitWaitlistLeadRequest): { success: boolean; totalWaitlist: number } {
    const exp = this.getExperimentBySlug(slug);
    if (!exp) {
      throw new Error(`Smoke test page not found for slug: ${slug}`);
    }

    const alreadyExists = exp.leads.some(l => l.email.toLowerCase() === lead.email.toLowerCase());
    if (!alreadyExists) {
      exp.leads.push({
        email: lead.email,
        name: lead.name,
        company: lead.company,
        surveyResponses: lead.surveyResponses ?? {},
        createdAt: new Date(),
      });
      exp.metrics.pageConversions += 1;
      exp.metrics.waitlistCount = exp.leads.length;
      if (exp.metrics.visitors < exp.metrics.pageConversions) {
        exp.metrics.visitors = exp.metrics.pageConversions;
      }
      exp.metrics.pageConversionRate =
        exp.metrics.visitors > 0 ? exp.metrics.pageConversions / exp.metrics.visitors : 0;
    }

    return {
      success: true,
      totalWaitlist: exp.metrics.waitlistCount,
    };
  }

  public updateOutreachMetrics(
    experimentId: string,
    outreachSent: number,
    replies: number,
    positiveReplies: number
  ): ValidationScorecardResponse {
    const exp = this.experiments.get(experimentId);
    if (!exp) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (![outreachSent, replies, positiveReplies].every(n => Number.isInteger(n) && n >= 0) || replies > outreachSent || positiveReplies > replies) {
      throw new Error('Invalid outreach metrics');
    }
    exp.metrics.outreachSent = outreachSent;
    exp.metrics.replies = replies;
    exp.metrics.replyRate = outreachSent > 0 ? replies / outreachSent : 0;
    exp.metrics.positiveReplies = positiveReplies;
    exp.metrics.positiveResonanceRate = replies > 0 ? positiveReplies / replies : 0;

    const pageUrl = new URL(`/v/${exp.decomposed.slug}`, this.publicOrigin).href;
    return this.scorecard.computeScorecard(
      experimentId,
      exp.hypothesis,
      exp.metrics,
      pageUrl,
      exp.decomposed.sequenceSubject,
      exp.decomposed.sequenceBody
    );
  }

  public getScorecard(experimentId: string): ValidationScorecardResponse {
    const exp = this.experiments.get(experimentId);
    if (!exp) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    const pageUrl = new URL(`/v/${exp.decomposed.slug}`, this.publicOrigin).href;
    return this.scorecard.computeScorecard(
      experimentId,
      exp.hypothesis,
      exp.metrics,
      pageUrl,
      exp.decomposed.sequenceSubject,
      exp.decomposed.sequenceBody
    );
  }
}
