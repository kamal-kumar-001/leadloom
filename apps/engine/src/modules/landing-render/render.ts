/**
 * M3 slice: render a static landing page draft from a research report.
 * LOCAL ARTIFACT ONLY: writes one self-contained HTML file to a local dir.
 * No deploy, no DNS, no tracking pixels, no forms wired to anything.
 *
 * SECURITY: every string that originates from an agent report is
 * HTML-escaped - agent output is untrusted content, never interpolated raw.
 * No external assets: no CDNs, no fonts, no JS. One file, inline CSS.
 */

export interface LandingInput {
  productName: string;
  tagline: string;
  summary: string;
  gaps: string[];
  sources: string[];
}

const BRAND = {
  canvas: '#090a0f',
  purple: '#3E1F47',
  butter: '#F3E3A0',
  text: '#EDEDF2',
  muted: '#9A93A8',
} as const;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function validateLandingInput(raw: unknown): LandingInput {
  if (typeof raw !== 'object' || raw === null) throw new Error('landing input must be an object');
  const r = raw as Record<string, unknown>;
  for (const key of ['productName', 'tagline', 'summary'] as const) {
    if (typeof r[key] !== 'string' || !(r[key] as string).trim()) throw new Error(`${key} is required`);
  }
  for (const key of ['gaps', 'sources'] as const) {
    if (!Array.isArray(r[key]) || (r[key] as unknown[]).some((x) => typeof x !== 'string')) {
      throw new Error(`${key} must be a string array`);
    }
  }
  return r as unknown as LandingInput;
}

export function renderLandingHtml(input: LandingInput): string {
  const name = escapeHtml(input.productName.trim());
  const tagline = escapeHtml(input.tagline.trim());
  const summary = escapeHtml(input.summary.trim());
  const gaps = input.gaps.map((g) => `        <li>${escapeHtml(g)}</li>`).join('\n');
  const sources = input.sources
    .map((s) => {
      const label = escapeHtml(s);
      // Never emit a clickable href from agent-sourced text; text-only citation.
      return `        <li>${label}</li>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>
  body{margin:0;background:${BRAND.canvas};color:${BRAND.text};font-family:system-ui,-apple-system,sans-serif;line-height:1.6}
  main{max-width:720px;margin:0 auto;padding:64px 24px}
  .badge{display:inline-block;background:${BRAND.purple};color:${BRAND.butter};padding:6px 14px;border-radius:999px;font-size:13px;letter-spacing:.04em;text-transform:uppercase}
  h1{font-size:40px;line-height:1.15;margin:24px 0 8px}
  .tagline{color:${BRAND.butter};font-size:20px;margin:0 0 24px}
  .summary{color:${BRAND.muted};font-size:17px}
  .card{background:rgba(62,31,71,.35);border:1px solid rgba(243,227,160,.18);border-radius:16px;padding:24px;margin:32px 0}
  h2{font-size:18px;color:${BRAND.butter};margin:0 0 12px}
  ul{margin:0;padding-left:20px;color:${BRAND.text}}
  .sources{color:${BRAND.muted};font-size:13px;word-break:break-all}
  .draft{margin-top:40px;font-size:12px;color:${BRAND.muted};border-top:1px solid rgba(243,227,160,.12);padding-top:16px}
</style>
</head>
<body>
<main>
  <span class="badge">Coming soon</span>
  <h1>${name}</h1>
  <p class="tagline">${tagline}</p>
  <p class="summary">${summary}</p>
  <div class="card">
    <h2>The problems we are solving</h2>
    <ul>
${gaps}
    </ul>
  </div>
  <div class="sources">
    <h2>Research sources</h2>
    <ul>
${sources}
    </ul>
  </div>
  <p class="draft">Draft generated locally by Leadloom for review. Not published. No analytics, no tracking, no signup wired.</p>
</main>
</body>
</html>
`;
}
