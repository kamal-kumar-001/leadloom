import {
  GenerateValidationRequest,
  SmokePageConfig,
  ValidationICPSpec,
} from '@leadloom/contracts';

export interface DecomposedHypothesisOutput {
  slug: string;
  icp: ValidationICPSpec;
  smokePage: SmokePageConfig;
  sequenceSubject: string;
  sequenceBody: string;
}

export class HypothesisDecomposerService {
  /**
   * Generates a clean URL slug from hypothesis text or user preferred slug.
   */
  public generateSlug(text: string, preferred?: string): string {
    if (preferred && preferred.trim().length > 0) {
      return preferred
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => !['a', 'an', 'the', 'for', 'and', 'with', 'in', 'on', 'to'].includes(w));

    return words.slice(0, 4).join('-') || 'idea-experiment';
  }

  /**
   * Splits a promoted hypothesis into the idea statement and the optional
   * "Positioning:" segment the pipeline promotion appends. Both are the
   * founder's own words; nothing here invents product claims.
   */
  private splitPositioning(raw: string): { idea: string; positioning: string | null } {
    const parts = raw.split(/\s+positioning:\s*/i);
    const idea = (parts[0] || '').replace(/\s+/g, ' ').trim();
    const positioning =
      parts.length > 1 ? parts.slice(1).join(' ').replace(/\s+/g, ' ').trim() : null;
    return { idea, positioning: positioning && positioning.length > 0 ? positioning : null };
  }

  private firstSentence(text: string): string {
    const m = text.match(/^(.{10,160}?[.!?])(\s|$)/);
    return (m ? m[1] : text).trim();
  }

  private trimAtWord(text: string, max: number): string {
    const clean = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max);
    const boundary = cut.lastIndexOf(' ');
    return (boundary > 20 ? cut.slice(0, boundary) : cut).replace(/[.,;:!?-]+$/, '').trim();
  }

  /**
   * ICP targeting hints remain keyword-bucket heuristics (PRD 5.2); they steer
   * lead sourcing only and are never shown to page visitors.
   */
  private icpFor(lower: string): ValidationICPSpec {
    const isDevOpsOrCloud = lower.includes('kubernetes') || lower.includes('k8s') || lower.includes('cloud') || lower.includes('infra');
    const isSalesOrRevOps = lower.includes('sales') || lower.includes('gtm') || lower.includes('outbound') || lower.includes('lead');
    const isAiOrMl = lower.includes('ai') || lower.includes('llm') || lower.includes('agent');

    if (isDevOpsOrCloud) {
      return {
        targetTitles: ['VP of Engineering', 'Head of Infrastructure', 'DevOps Lead', 'Cloud Architect'],
        companyHeadcount: '25-150 employees (Series A / B)',
        buyingSignals: [
          'Actively hiring Kubernetes / Platform engineers',
          'Multi-cloud AWS / GCP adoption',
          'Publicly discussing cloud cost optimization or FinOps initiatives',
        ],
        sampleKeywords: ['Kubernetes', 'EKS', 'GKE', 'FinOps', 'Terraform', 'Cloud Costs'],
      };
    }
    if (isSalesOrRevOps) {
      return {
        targetTitles: ['VP of Sales', 'Head of RevOps', 'Head of Growth', 'Founder & CEO'],
        companyHeadcount: '10-75 employees',
        buyingSignals: [
          'Hiring SDRs / BDRs',
          'Using Apollo, ZoomInfo, or Clay',
          'Active founder outbound posts on LinkedIn',
        ],
        sampleKeywords: ['Outbound', 'Cold Email', 'Enrichment', 'Deliverability', 'RevOps'],
      };
    }
    if (isAiOrMl) {
      return {
        targetTitles: ['CTO', 'Head of AI', 'Lead ML Engineer', 'Principal AI Architect'],
        companyHeadcount: '15-100 employees',
        buyingSignals: [
          'Deploying LLM apps in production',
          'Hiring prompt engineers or AI researchers',
          'Discussing token latency or GPU cloud spend',
        ],
        sampleKeywords: ['LLM', 'RAG', 'Agentic Workflows', 'Vector DB', 'OpenAI'],
      };
    }
    return {
      targetTitles: ['Founder & CEO', 'VP Product', 'Head of Operations'],
      companyHeadcount: '10-50 employees',
      buyingSignals: [
        'Recent funding announcement',
        'Scaling headcount',
        'Actively seeking workflow automation',
      ],
      sampleKeywords: ['Automation', 'SaaS', 'Workflow', 'Productivity'],
    };
  }

  /**
   * Decomposes raw hypothesis into structured ICP, hypothesis-grounded copy, and founder sequence.
   * Visitor-facing copy always reflects the founder's own hypothesis text so the
   * experiment measures demand for the idea that was actually entered.
   */
  public decompose(request: GenerateValidationRequest): DecomposedHypothesisOutput {
    const { rawHypothesis, preferredSlug } = request;
    const slug = this.generateSlug(rawHypothesis, preferredSlug);
    const { idea, positioning } = this.splitPositioning(rawHypothesis);
    const icp = this.icpFor(idea.toLowerCase());

    const core = this.firstSentence(idea).replace(/[.!?]+$/, '');
    const headline = this.trimAtWord(core, 110);
    const title = `${this.trimAtWord(core, 36)} - Early Access`;
    const subheadline = positioning
      ? `${this.trimAtWord(positioning, 170)} Join the early-access list and tell us whether this fits your team.`
      : 'We are validating whether this idea is worth building. Join the early-access list and tell us how your team handles it today.';
    const surveyQuestion1 = 'How does your team handle this problem today? Walk us through your current workflow.';
    const surveyQuestion2 = 'How urgent is this problem for your team?';
    const surveyOptions2 = ['Not urgent', 'Worth fixing this quarter', 'Blocker - need a solution now'];

    const smokePage: SmokePageConfig = {
      slug,
      title,
      headline,
      subheadline,
      heroCtaText: 'Request Early Access',
      surveyQuestions: [
        {
          id: 'q1',
          text: surveyQuestion1,
          type: 'text',
        },
        {
          id: 'q2',
          text: surveyQuestion2,
          type: 'choice',
          options: surveyOptions2,
        },
      ],
    };

    // Peer-to-peer non-salesy founder validation sequence
    const sequenceSubject = `Quick question about ${this.trimAtWord(idea, 60)}`;
    const sequenceBody = `Hey {{first_name}},\n\n` +
      `We're researching this idea for teams like {{company}}'s: ${this.trimAtWord(idea, 200)} We put up a short early-access page describing it: /v/${slug}\n\n` +
      `Nothing for sale here - is this a real headache for your team, or off the mark? A one-line reply either way genuinely helps.\n\n` +
      `Thanks,\n{{sender_name}}`;

    return {
      slug,
      icp,
      smokePage,
      sequenceSubject,
      sequenceBody,
    };
  }
}
