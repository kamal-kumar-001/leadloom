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

/** One grounded ICP hint: the category plus the words that evidence it. */
export interface IcpHint {
  category: string;
  matchedKeywords: string[];
}

const ICP_INDUSTRIES: ReadonlyArray<{ category: string; keywords: ReadonlyArray<[string, RegExp]> }> = [
  { category: 'developer tools', keywords: [['api', /\bapi\b/], ['sdk', /\bsdk\b/], ['developer', /developers?/], ['CLI', /\bcli\b/]] },
  { category: 'e-commerce', keywords: [['e-commerce', /e-?commerce/], ['storefront', /storefront/], ['checkout', /checkout/], ['Shopify', /shopify/]] },
  { category: 'fintech', keywords: [['payments', /payments?/], ['banking', /banking/], ['invoicing', /invoic(e|ing)/], ['fintech', /fintech/]] },
  { category: 'healthtech', keywords: [['healthcare', /health ?care/], ['clinical', /clinical/], ['patient', /patients?/]] },
  { category: 'martech', keywords: [['marketing', /marketing/], ['SEO', /\bseo\b/], ['ads', /\bads\b/], ['campaigns', /campaigns?/]] },
  { category: 'hrtech', keywords: [['recruiting', /recruit(er|ing|ment)/], ['payroll', /payroll/], ['onboarding', /onboarding/]] },
  { category: 'logistics', keywords: [['logistics', /logistics/], ['shipping', /shipping/], ['fulfillment', /fulfil?l?ment/]] },
];
const ICP_SIZE: ReadonlyArray<[string, RegExp]> = [
  ['enterprise', /\benterprise\b/],
  ['startup', /\bstart ?ups?\b/],
  ['small business', /\b(smb|small business)\b/],
  ['mid-market', /mid-?market/],
];
const ICP_MODEL: ReadonlyArray<[string, RegExp]> = [
  ['B2B', /\bb2b\b/],
  ['B2C', /\bb2c\b/],
  ['SaaS', /\bsaas\b/],
];

export function deriveIcpHints(pageText: string): IcpHint[] {
  const t = pageText.toLowerCase();
  const hints: IcpHint[] = [];
  for (const ind of ICP_INDUSTRIES) {
    const matched = ind.keywords.filter(([, re]) => re.test(t)).map(([name]) => name);
    if (matched.length) hints.push({ category: ind.category, matchedKeywords: matched });
  }
  for (const [name, re] of ICP_SIZE) if (re.test(t)) hints.push({ category: 'size', matchedKeywords: [name] });
  for (const [name, re] of ICP_MODEL) if (re.test(t)) hints.push({ category: 'model', matchedKeywords: [name] });
  return hints;
}

/**
 * Relevance reasons cite only evidence actually found. A thin page says it is
 * thin; no matches says no matches. Nothing here is a judgment of fit quality -
 * it is a list of grounded observations, labeled as keyword matches.
 */
export function deriveRelevanceReasons(signals: WebsiteSignals, icpHints: IcpHint[]): string[] {
  const reasons: string[] = [];
  if (signals.techKeywords.length) reasons.push(`Tech keywords found in page text: ${signals.techKeywords.join(', ')}`);
  for (const hint of icpHints) reasons.push(`ICP keyword match (${hint.category}): ${hint.matchedKeywords.join(', ')}`);
  if (signals.mentionsHiring) reasons.push('Hiring/careers language present in page text');
  if (signals.mentionsPricing) reasons.push('Pricing language present in page text');
  if (signals.mentionsScaling) reasons.push('Scaling language present in page text');
  if (!reasons.length) reasons.push('No tracked keywords matched the page text');
  if (signals.wordCount < 100) reasons.push(`Thin page text (${signals.wordCount} meaningful words): signals are limited`);
  return reasons;
}
