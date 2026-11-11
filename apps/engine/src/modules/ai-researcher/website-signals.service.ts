/**
 * Website signal extraction (G4 buyer discovery, first increment).
 *
 * Honesty contract: everything returned here is derived from keyword matching
 * over fetched page text. It is labeled `heuristic_keywords`, carries no
 * invented confidence score, and never fabricates a summary, pain point or
 * icebreaker. When a field cannot be grounded in the page text it is null.
 *
 * An LLM-backed analysis path is intentionally NOT implemented here: calling a
 * provider requires a workspace BYOK key and the live-connector flag, and any
 * such call must record which model produced which claim. Until that exists,
 * heuristic signals are the whole product surface of this module.
 */

export interface WebsiteSignals {
  companyDomain: string;
  /** Always 'heuristic_keywords'. Downstream UI must show the source. */
  source: 'heuristic_keywords';
  /** Technology keywords actually found in the page text. Empty when none. */
  techKeywords: string[];
  /** True only when hiring/careers language is present in the page text. */
  mentionsHiring: boolean;
  /** True only when pricing/cost language is present in the page text. */
  mentionsPricing: boolean;
  /** True only when scaling language is present in the page text. */
  mentionsScaling: boolean;
  /** Number of meaningful words analyzed, so thin pages are visible as thin. */
  wordCount: number;
  /** Null: no summary is fabricated without a model. */
  summary: null;
  /** Null: no confidence is invented for keyword matching. */
  confidence: null;
}

const TECH_KEYWORDS: ReadonlyArray<{ name: string; test: RegExp }> = [
  { name: 'Kubernetes', test: /kubernetes|k8s|kubectl/ },
  { name: 'Terraform', test: /terraform/ },
  { name: 'Docker', test: /docker|containerd/ },
  { name: 'React', test: /\breact\b|next\.js/ },
  { name: 'Node.js', test: /node\.js/ },
  { name: 'PostgreSQL', test: /postgres/ },
  { name: 'Redis', test: /\bredis\b/ },
  { name: 'GraphQL', test: /graphql/ },
  { name: 'Kafka', test: /\bkafka\b/ },
];

export class WebsiteSignalService {
  /**
   * Extracts keyword signals from page text already fetched by the caller.
   * This module never fetches: URL policy and fetching live at the HTTP
   * boundary, behind the same host policy as mailbox connect.
   */
  public analyzeText(domain: string, pageText: string): WebsiteSignals {
    const textLower = pageText.toLowerCase();
    const techKeywords = TECH_KEYWORDS.filter((p) => p.test.test(textLower)).map((p) => p.name);
    const wordCount = pageText.split(/\s+/).filter((w) => w.length > 2).length;
    return {
      companyDomain: domain,
      source: 'heuristic_keywords',
      techKeywords,
      mentionsHiring: /hiring|careers|join our team|open roles/.test(textLower),
      mentionsPricing: /pricing|per seat|per user|\$\d+/.test(textLower),
      mentionsScaling: /\bscal(e|ing|ability)\b/.test(textLower),
      wordCount,
      summary: null,
      confidence: null,
    };
  }
}
