export interface ResearchResult {
  companyDomain: string;
  summary: string;
  detectedTechStack: string[];
  observedPainPoints: string[];
  suggestedIcebreaker: string;
  confidence: number;
}

export class AIResearcherService {
  /**
   * Synthesizes scraped clean markdown and extracts structured insights.
   */
  public async analyzeMarkdown(
    domain: string,
    scrapedMarkdown: string,
    _llmApiKey?: string
  ): Promise<ResearchResult> {
    const textLower = scrapedMarkdown.toLowerCase();

    // Fast heuristic inspection / local fallback
    const techStackPatterns = [
      { name: 'Kubernetes', test: /kubernetes|k8s|kubectl/ },
      { name: 'AWS EKS', test: /eks|elastic kubernetes/ },
      { name: 'Terraform', test: /terraform|iac/ },
      { name: 'Docker', test: /docker|containerd/ },
      { name: 'React', test: /react|next\.js/ },
      { name: 'Node.js', test: /node\.js|typescript/ },
      { name: 'PostgreSQL', test: /postgres|pgvector/ },
      { name: 'Redis', test: /redis/ },
    ];

    const detectedTechStack = techStackPatterns
      .filter(p => p.test.test(textLower))
      .map(p => p.name);

    const painPoints: string[] = [];
    if (textLower.includes('scale') || textLower.includes('scaling')) {
      painPoints.push('Infrastructure scaling complexities');
    }
    if (textLower.includes('cost') || textLower.includes('spend') || textLower.includes('budget')) {
      painPoints.push('Cloud cost runaway and attribution');
    }
    if (textLower.includes('hiring') || textLower.includes('careers')) {
      painPoints.push('Engineering bandwidth and talent acquisition');
    }
    if (painPoints.length === 0) {
      painPoints.push('Streamlining multi-tool workflow fragmentation');
    }

    const icebreaker = detectedTechStack.length > 0
      ? `Noticed ${domain} is leveraging ${detectedTechStack.slice(0, 2).join(' and ')} to scale engineering.`
      : `Saw the recent updates from ${domain}'s product engineering team.`;

    return {
      companyDomain: domain,
      summary: `B2B platform identified from ${domain} domain footprint.`,
      detectedTechStack,
      observedPainPoints: painPoints,
      suggestedIcebreaker: icebreaker,
      confidence: 0.88,
    };
  }
}
