/**
 * Fetch boundary for website research (G4). URL policy lives here, behind the
 * same private-host rule as mailbox connect: only http(s), no redirects to a
 * different host, no private/link-local/metadata hosts unless explicitly
 * allowed for local fixtures. HTML is reduced to visible-ish text by tag
 * stripping - good enough for keyword heuristics, and labeled as such.
 */
export interface FetchResult {
  finalUrl: string;
  text: string;
  truncated: boolean;
}

const BLOCKED = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1|\[?fe80)/i;
const MAX_BYTES = 512 * 1024;

export class SafeWebsiteFetcher {
  constructor(
    private readonly opts: { allowPrivateHosts?: boolean; timeoutMs?: number } = {},
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  public async fetchText(rawUrl: string): Promise<FetchResult> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new Error('Invalid URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http(s) URLs can be fetched');
    if (!this.opts.allowPrivateHosts && BLOCKED.test(url.hostname)) throw new Error('This host cannot be fetched');
    const res = await this.fetchImpl(url.toString(), {
      redirect: 'manual',
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 10_000),
      headers: { accept: 'text/html,*/*;q=0.8' },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      const target = loc ? new URL(loc, url) : null;
      if (!target || target.host !== url.host) throw new Error('Redirects to a different host are not followed');
      return this.fetchText(target.toString());
    }
    if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const truncated = buf.length > MAX_BYTES;
    const html = buf.subarray(0, MAX_BYTES).toString('utf8');
    const text = html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { finalUrl: url.toString(), text, truncated };
  }
}
