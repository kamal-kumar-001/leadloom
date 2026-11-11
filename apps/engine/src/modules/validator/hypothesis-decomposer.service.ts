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
   * Decomposes raw hypothesis into structured ICP, high-converting copy, and founder sequence.
   */
  public decompose(request: GenerateValidationRequest): DecomposedHypothesisOutput {
    const { rawHypothesis, preferredSlug } = request;
    const slug = this.generateSlug(rawHypothesis, preferredSlug);

    // Heuristic extraction for domain keywords
    const lower = rawHypothesis.toLowerCase();
    const isDevOpsOrCloud = lower.includes('kubernetes') || lower.includes('k8s') || lower.includes('cloud') || lower.includes('infra');
    const isSalesOrRevOps = lower.includes('sales') || lower.includes('gtm') || lower.includes('outbound') || lower.includes('lead');
    const isAiOrMl = lower.includes('ai') || lower.includes('llm') || lower.includes('agent');

    let icp: ValidationICPSpec;
    let title: string;
    let headline: string;
    let subheadline: string;
    let surveyQuestion1: string;
    let surveyQuestion2: string;
    let surveyOptions2: string[];

    if (isDevOpsOrCloud) {
      icp = {
        targetTitles: ['VP of Engineering', 'Head of Infrastructure', 'DevOps Lead', 'Cloud Architect'],
        companyHeadcount: '25-150 employees (Series A / B)',
        buyingSignals: [
          'Actively hiring Kubernetes / Platform engineers',
          'Multi-cloud AWS / GCP adoption',
          'Publicly discussing cloud cost optimization or FinOps initiatives',
        ],
        sampleKeywords: ['Kubernetes', 'EKS', 'GKE', 'FinOps', 'Terraform', 'Cloud Costs'],
      };
      title = 'Kubernetes Cost Intelligence - Early Access';
      headline = 'Kubernetes cost visibility for lean engineering teams';
      subheadline = 'We are exploring whether continuous cluster right-sizing and spot allocation matter to teams without a dedicated FinOps lead. Join the early-access list and help shape what gets built.';
      surveyQuestion1 = 'What was your biggest surprise in last month’s cloud infrastructure bill?';
      surveyQuestion2 = 'How many engineers work on infrastructure at your company?';
      surveyOptions2 = ['1-3 engineers', '4-10 engineers', '10+ engineers'];
    } else if (isSalesOrRevOps) {
      icp = {
        targetTitles: ['VP of Sales', 'Head of RevOps', 'Head of Growth', 'Founder & CEO'],
        companyHeadcount: '10-75 employees',
        buyingSignals: [
          'Hiring SDRs / BDRs',
          'Using Apollo, ZoomInfo, or Clay',
          'Active founder outbound posts on LinkedIn',
        ],
        sampleKeywords: ['Outbound', 'Cold Email', 'Enrichment', 'Deliverability', 'RevOps'],
      };
      title = 'Provider-Direct Data Enrichment - Early Access';
      headline = 'Data enrichment with providers you pay directly';
      subheadline = 'We are testing whether running enrichment with your own provider keys beats buying bundled credits. Join the early-access list and tell us how your team buys data today.';
      surveyQuestion1 = 'How does your team buy B2B contact data today?';
      surveyQuestion2 = 'What is your current monthly budget for B2B lead enrichment tools?';
      surveyOptions2 = ['<$500/mo', '$500-$2,000/mo', '>$2,000/mo'];
    } else if (isAiOrMl) {
      icp = {
        targetTitles: ['CTO', 'Head of AI', 'Lead ML Engineer', 'Principal AI Architect'],
        companyHeadcount: '15-100 employees',
        buyingSignals: [
          'Deploying LLM apps in production',
          'Hiring prompt engineers or AI researchers',
          'Discussing token latency or GPU cloud spend',
        ],
        sampleKeywords: ['LLM', 'RAG', 'Agentic Workflows', 'Vector DB', 'OpenAI'],
      };
      title = 'LLM Reliability Tooling - Early Access';
      headline = 'Structured outputs and fallbacks for production LLM workflows';
      subheadline = 'We are exploring reliability tooling for agentic workflows. Join the early-access list and share your biggest production bottleneck.';
      surveyQuestion1 = 'Tell us about a recent LLM failure your team hit in production.';
      surveyQuestion2 = 'What is your primary bottleneck with LLM agents in production?';
      surveyOptions2 = ['Hallucinations', 'Token latency', 'API rate limits'];
    } else {
      // General B2B SaaS template
      icp = {
        targetTitles: ['Founder & CEO', 'VP Product', 'Head of Operations'],
        companyHeadcount: '10-50 employees',
        buyingSignals: [
          'Recent funding announcement',
          'Scaling headcount',
          'Actively seeking workflow automation',
        ],
        sampleKeywords: ['Automation', 'SaaS', 'Workflow', 'Productivity'],
      };
      title = `${rawHypothesis.slice(0, 50)} - Early Access`;
      headline = rawHypothesis;
      subheadline = 'We are validating whether this problem is worth solving. Join the early-access list and tell us how your team handles it today.';
      surveyQuestion1 = 'What is the most frustrating manual task your team deals with weekly?';
      surveyQuestion2 = 'How many hours per week does your team lose to it?';
      surveyOptions2 = ['1-5 hours/week', '5-15 hours/week', '15+ hours/week'];
    }

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
    const sequenceSubject = `Quick question about ${rawHypothesis.slice(0, 60)}`;
    const sequenceBody = `Hey {{first_name}},\n\n` +
      `We're researching ${rawHypothesis.toLowerCase()} for teams like {{company}}'s and put up a short early-access page describing the idea: /v/${slug}\n\n` +
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
