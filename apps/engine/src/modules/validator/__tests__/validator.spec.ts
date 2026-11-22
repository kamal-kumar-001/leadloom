import { describe, it, expect } from 'vitest';
import { ValidatorService } from '../validator.service';
import { ScorecardService } from '../scorecard.service';
import { HypothesisDecomposerService } from '../hypothesis-decomposer.service';
import { ValidationScorecardResponseSchema } from '@leadloom/contracts';

describe('Idea Validator Module — PRD Epic 6 Deep Dive', () => {
  it('should decompose raw hypothesis into structured ICP, high-converting copy, and founder sequence', () => {
    const decomposer = new HypothesisDecomposerService();
    const result = decomposer.decompose({
      rawHypothesis: 'Automated Kubernetes cost-cutter for Series A startups',
      preferredSlug: 'k8s-cutter',
    });

    expect(result.slug).toBe('k8s-cutter');
    expect(result.icp.targetTitles).toContain('VP of Engineering');
    expect(result.icp.buyingSignals).toContain('Actively hiring Kubernetes / Platform engineers');
    expect(result.smokePage.headline).toContain('Kubernetes');
    expect(result.smokePage.surveyQuestions).toHaveLength(2);
    expect(result.sequenceSubject).toContain('Kubernetes');
    expect(result.sequenceBody).toContain('k8s-cutter');
  });

  it('should accurately compute PRD weighted score formula and Go/No-Go verdicts', () => {
    const scorecardService = new ScorecardService();

    // High Pull test: 7.5% page conv, 8.3% reply rate, 60% positive resonance
    const highPullScorecard = scorecardService.computeScorecard(
      '11111111-1111-4111-8111-111111111111',
      'Automated Kubernetes cost-cutter for Series A startups',
      {
        visitors: 240,
        pageConversions: 18,
        pageConversionRate: 0.075,
        outreachSent: 120,
        replies: 10,
        replyRate: 0.083,
        positiveReplies: 6,
        positiveResonanceRate: 0.60,
        waitlistCount: 18,
      },
      'https://leadloom.com/v/k8s-cutter',
      'Subject',
      'Body'
    );

    // Validate Zod contract
    ValidationScorecardResponseSchema.parse(highPullScorecard);

    expect(highPullScorecard.verdict).toBe('high_pull');
    expect(highPullScorecard.verdictScore).toBeGreaterThanOrEqual(80);
    expect(highPullScorecard.actionableSummary).toContain('High customer pull detected');

    // Low Interest test
    const lowInterestScorecard = scorecardService.computeScorecard(
      '22222222-2222-4222-8222-222222222222',
      'Random unviable idea',
      {
        visitors: 200,
        pageConversions: 2,
        pageConversionRate: 0.01,
        outreachSent: 150,
        replies: 2,
        replyRate: 0.013,
        positiveReplies: 0,
        positiveResonanceRate: 0,
        waitlistCount: 2,
      },
      'https://leadloom.com/v/test',
      'Subject',
      'Body'
    );

    expect(lowInterestScorecard.verdict).toBe('low_interest');
    expect(lowInterestScorecard.verdictScore).toBeLessThan(45);
    expect(lowInterestScorecard.actionableSummary).toContain('Low customer interest');
  });

  it('never invents performance guarantees or figures in generated public copy', () => {
    const decomposer = new HypothesisDecomposerService();
    const banned = /\d+%|99\.9|zero-latency|sub-\d+ms|guaranteed|1,000%|\$\d+k\/mo/i;
    for (const h of [
      'Automated Kubernetes cost-cutter for Series A startups',
      'Outbound sales tooling for B2B teams',
      'AI agent orchestration platform',
      'Meal planning for busy parents',
    ]) {
      const d = decomposer.decompose({ rawHypothesis: h });
      expect(banned.test(d.smokePage.headline)).toBe(false);
      expect(banned.test(d.smokePage.subheadline)).toBe(false);
      expect(d.sequenceBody).not.toMatch(/prototype|architecture spec|leadloom\.com/);
    }
  });

  it('keeps distinct ideas distinct: public copy follows the hypothesis, not a keyword bucket', () => {
    const decomposer = new HypothesisDecomposerService();
    const orchestrator = decomposer.decompose({
      rawHypothesis: 'An orchestrator for solo founders who already pay for coding agents. Positioning: Idea-to-revenue without another AI bill.',
    });
    const reliability = decomposer.decompose({
      rawHypothesis: 'Structured output validation for production LLM agents. Positioning: Catch silent tool-call failures before users do.',
    });

    // Both hit the same AI/agent keyword bucket, yet each page sells its own idea.
    expect(orchestrator.smokePage.headline).toContain('orchestrator for solo founders');
    expect(orchestrator.smokePage.headline).not.toContain('LLM');
    expect(orchestrator.smokePage.subheadline).toContain('Idea-to-revenue without another AI bill');
    expect(reliability.smokePage.headline).toContain('Structured output validation');
    expect(reliability.smokePage.headline).not.toContain('orchestrator');
    expect(reliability.smokePage.subheadline).toContain('Catch silent tool-call failures');
    expect(orchestrator.smokePage.headline).not.toBe(reliability.smokePage.headline);
    expect(orchestrator.smokePage.subheadline).not.toBe(reliability.smokePage.subheadline);

    // Survey questions are idea-agnostic and identical across hypotheses.
    expect(orchestrator.smokePage.surveyQuestions).toEqual(reliability.smokePage.surveyQuestions);
    const choice = orchestrator.smokePage.surveyQuestions.find((q) => q.type === 'choice');
    expect(choice?.options?.length).toBeGreaterThanOrEqual(2);

    // Copy stays within rendering-safe length caps.
    expect(orchestrator.smokePage.headline.length).toBeLessThanOrEqual(110);
    expect(orchestrator.smokePage.title.length).toBeLessThanOrEqual(60);
    expect(orchestrator.smokePage.subheadline.length).toBeLessThanOrEqual(230);
  });

  it('derives sequence copy from the idea statement only, without the positioning segment', () => {
    const decomposer = new HypothesisDecomposerService();
    const d = decomposer.decompose({
      rawHypothesis: 'An orchestrator for solo founders who already pay for coding agents. Positioning: Idea-to-revenue without another AI bill.',
    });
    expect(d.sequenceSubject).toContain('orchestrator for solo founders');
    expect(d.sequenceSubject.toLowerCase()).not.toContain('positioning:');
    expect(d.sequenceBody).toContain('orchestrator for solo founders');
    expect(d.sequenceBody.toLowerCase()).not.toContain('positioning:');
  });

  it('should handle full workflow in ValidatorService from hypothesis to waitlist submission', async () => {
    const service = new ValidatorService();

    // 1. Generate experiment
    const generated = await service.generate('ws-test', {
      rawHypothesis: 'Wholesale B2B data enrichment with native deliverability',
      preferredSlug: 'leadloom-gtm',
    });

    expect(generated.experimentId).toBeDefined();
    expect(generated.pageUrl).toBe('http://localhost:3000/v/leadloom-gtm');
    expect(generated.scorecard.verdict).toBe('pending');

    // 1b. Owner publishes the page (draft by default)
    await service.setPublishStatus(generated.experimentId,'ws-test',true,(await service.getOwnerPage(generated.experimentId,'ws-test'))?.revision);

    // 2. Public user submits waitlist form
    const leadResult = await service.submitLead('leadloom-gtm', {
      email: 'founder@scaleup.io',
      name: 'Sarah Chen',
      company: 'ScaleUp Inc',
      surveyResponses: { q1: '$1,500/mo' },
    });

    expect(leadResult.success).toBe(true);
    expect(leadResult.totalWaitlist).toBe(1);

    // 2a. Owner queries captured waitlist leads for outreach
    const leadsData = await service.getLeads(generated.experimentId, 'ws-test');
    expect(leadsData.totalLeads).toBe(1);
    expect(leadsData.leads[0].email).toBe('founder@scaleup.io');
    expect(leadsData.leads[0].name).toBe('Sarah Chen');
    expect(leadsData.leads[0].company).toBe('ScaleUp Inc');
    expect(leadsData.leads[0].surveyResponses).toEqual({ q1: '$1,500/mo' });

    // 2a-fenced: foreign workspace cannot read leads
    await expect(service.getLeads(generated.experimentId, 'ws-other')).rejects.toThrow('Experiment not found');

    // 2b. Public traffic reaches the minimum sample for a verdict
    for (let i = 0; i < 30; i++) await service.getPublicPage('leadloom-gtm');

    // 3. Update outreach responses
    const updatedScorecard = await service.updateOutreachMetrics(
      generated.experimentId,
      'ws-test',
      100, // outreach sent
      12,  // replies
      8    // positive replies
    );

    expect(updatedScorecard.metrics.outreachSent).toBe(100);
    expect(updatedScorecard.metrics.replyRate).toBe(0.12);
    expect(updatedScorecard.verdict).toBe('high_pull');
  });
});
