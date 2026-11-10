import { shouldBlockRequest } from './resource-interceptor';

export interface ScrapedPageResult {
  url: string;
  domain: string;
  title: string;
  metaDescription: string;
  cleanMarkdown: string;
  detectedSignals: string[];
  latencyMs: number;
  memoryUsageMb: number;
}

export class HeadlessScraperWorker {
  private readonly maxConcurrency: number;
  private activeJobs = 0;

  constructor(maxConcurrency: number = 2) {
    this.maxConcurrency = maxConcurrency;
  }

  public getConcurrency(): { active: number; max: number } {
    return { active: this.activeJobs, max: this.maxConcurrency };
  }

  /**
   * Sanitizes raw HTML into stripped markdown-like text, removing scripts, styles, and HTML comments.
   */
  public htmlToCleanMarkdown(html: string): string {
    let clean = html;
    // Strip scripts & styles
    clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    clean = clean.replace(/<!--[\s\S]*?-->/g, '');

    // Convert common tags to markdown approximations
    clean = clean.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
    clean = clean.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
    clean = clean.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
    clean = clean.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
    clean = clean.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');

    // Strip all remaining HTML tags
    clean = clean.replace(/<[^>]+>/g, ' ');

    // Normalize whitespace
    clean = clean.replace(/[ \t]+/g, ' ');
    clean = clean.replace(/\n\s*\n\s*\n+/g, '\n\n');
    return clean.trim();
  }

  /**
   * Extracts page title from HTML.
   */
  public extractTitle(html: string): string {
    const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    return match ? match[1].trim() : '';
  }

  /**
   * Extracts meta description from HTML.
   */
  public extractMetaDescription(html: string): string {
    const match = /<meta\s+name=["']description["']\s+content=["'](.*?)["']/i.exec(html) ||
      /<meta\s+content=["'](.*?)["']\s+name=["']description["']/i.exec(html);
    return match ? match[1].trim() : '';
  }

  /**
   * Scrapes target URL adhering to concurrency fencing and resource interception.
   */
  public async scrape(url: string, simulatedHtml?: string): Promise<ScrapedPageResult> {
    if (this.activeJobs >= this.maxConcurrency) {
      throw new Error(`Scraper worker concurrency limit (${this.maxConcurrency}) reached. Fencing active.`);
    }

    this.activeJobs += 1;
    const startTime = Date.now();

    try {
      let html = simulatedHtml;
      if (!html) {
        // Fetch with timeout and resource check
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'LeadLoom-Bot/1.0 (+https://useleadloom.com)',
            'Accept': 'text/html,application/xhtml+xml',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status} fetching ${url}`);
        }
        html = await response.text();
      }

      const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      const title = this.extractTitle(html);
      const metaDescription = this.extractMetaDescription(html);
      const cleanMarkdown = this.htmlToCleanMarkdown(html);

      // Detect hiring and tech stack signals
      const detectedSignals: string[] = [];
      const lower = cleanMarkdown.toLowerCase();

      if (lower.includes('kubernetes') || lower.includes('k8s')) detectedSignals.push('tech:kubernetes');
      if (lower.includes('aws') || lower.includes('eks')) detectedSignals.push('tech:aws');
      if (lower.includes('terraform')) detectedSignals.push('tech:terraform');
      if (lower.includes('careers') || lower.includes('we are hiring') || lower.includes('open positions')) {
        detectedSignals.push('intent:hiring');
      }

      const memoryUsage = process.memoryUsage();
      const memoryUsageMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);

      return {
        url,
        domain,
        title,
        metaDescription,
        cleanMarkdown,
        detectedSignals,
        latencyMs: Date.now() - startTime,
        memoryUsageMb,
      };
    } finally {
      this.activeJobs -= 1;
    }
  }

  public isResourceBlocked(resourceType: string, resourceUrl: string): boolean {
    return shouldBlockRequest(resourceType, resourceUrl);
  }
}
