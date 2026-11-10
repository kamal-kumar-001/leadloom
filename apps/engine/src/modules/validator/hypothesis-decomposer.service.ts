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
      title = 'Autonomous Kubernetes Cloud Cost Intelligence';
      headline = 'Cut 40% Off Your Series A Kubernetes Spend — Without Touching YAML';
      subheadline = 'Continuous cluster right-sizing and spot allocation that preserves 99.99% uptime. Designed specifically for engineering teams that cannot afford a dedicated FinOps lead.';
      surveyQuestion1 = 'What was your biggest surprise in last month’s cloud infrastructure bill?';
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
      title = 'Signal-to-Pipeline Revenue Engine';
      headline = 'Wholesale Data Enrichment & Automated Deliverability for Modern Outbound';
      subheadline = 'Stop paying 1,000% SaaS markups on Apollo and Hunter credits. Run native waterfalls with zero data tax.';
      surveyQuestion1 = 'What is your current monthly budget for B2B lead enrichment tools?';
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
      title = 'Production LLM Reliability & Orchestration';
      headline = 'Zero-Latency Structured Outputs for Agentic Workflows';
      subheadline = 'Automated fallbacks across Gemini, Groq, and DeepSeek with deterministic JSON schemas and sub-100ms routing.';
      surveyQuestion1 = 'What is your primary bottleneck with LLM agents in production?';
      surveyOptions2 = ['Hallucinations', 'Token Latency', 'API Rate Limits'];
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
      title = `${rawHypothesis.slice(0, 50)} | Early Access`;
      headline = `Validate & Scale: ${rawHypothesis}`;
      subheadline = 'A dedicated modern workflow platform built to solve your highest-friction operational bottleneck in minutes.';
      surveyQuestion1 = 'What is the most frustrating manual task your team deals with weekly?';
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
          text: 'How large is your team handling this problem?',
          type: 'choice',
          options: surveyOptions2,
        },
      ],
    };

    // Peer-to-peer non-salesy founder validation sequence
    const sequenceSubject = `Quick question regarding {{company}}'s ${icp.sampleKeywords[0] ?? 'infrastructure'}`;
    const sequenceBody = `Hey {{first_name}},\n\n` +
      `Noticed you are scaling the team at {{company}}. We are currently conducting deep problem-discovery research with tech leaders tackling ${rawHypothesis.toLowerCase()}.\n\n` +
      `We put together a bare-bones prototype and interactive architecture spec: https://leadloom.com/v/${slug}\n\n` +
      `We are not selling anything—just looking for brutal, candid feedback: is this a top-3 headache for your team right now, or is it completely off the mark?\n\n` +
      `Best,\nFounder, LeadLoom Research`;

    return {
      slug,
      icp,
      smokePage,
      sequenceSubject,
      sequenceBody,
    };
  }
}
