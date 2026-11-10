// Design-rule check for apps/web. Run: node scripts/check-design.mjs [--strict]
// Prints violations grouped by rule. Exit 1 with --strict when any remain.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const web = join(root, 'apps/web');
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    if (['node_modules', '.next'].includes(n)) continue;
    const p = join(d, n);
    statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts)$/.test(n) && files.push(p);
  }
})(web);
// Files allowed to carry raw colors: tokens, third-party brand marks, WebGL scenes.
const COLOR_ALLOW = [/components\/marketing\/3d\//, /components\/auth\/oauth-buttons/, /tailwind\.config/, /app\/icon/];
const rules = [
  ['hex color in component', /#[0-9a-fA-F]{6}\b/, (f) => !COLOR_ALLOW.some((r) => r.test(f))],
  ['text-white/text-black (use text-text-onAccent or text tokens)', /\btext-(white|black)\b/, (f) => !/app\/layout\.tsx$/.test(f)],
  ['raw Tailwind palette class (use tokens)', /\b(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/, () => true],
  ['accent fill with non-accent text color (use <Button variant="primary">, no color overrides)', /bg-brand-loom(?![\w/-]).*text-text-(inverse|primary|secondary|muted)|text-text-(inverse|primary|secondary|muted).*bg-brand-loom(?![\w/-])/, () => true],
  ['colored Button override (primary Button owns its colors)', /<Button[^>]*className="[^"]*bg-brand-loom/, () => true],
  ['hover:bg-brand-weave on accent fill (hover comes from the Button)', /hover:bg-brand-weave/, () => true],
  ['direct sonner toast import (use lib/notify)', /from 'sonner'/, (f) => !/lib\/notify|components\/feedback/.test(f) && !/app\/layout\.tsx$/.test(f)],
  ['forbidden positioning words', /open-core|open source|open-source|self-host|pumpgtm|zero-knowledge/i, (f) => !/lib\/engine-client/.test(f)],
];
let total = 0;
for (const [name, re, applies] of rules) {
  const hits = [];
  for (const f of files) {
    const rel = relative(web, f);
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (re.test(line) && applies(rel, line)) hits.push(`${rel}:${i + 1}`);
    });
  }
  total += hits.length;
  console.log(`${hits.length === 0 ? 'ok  ' : 'FAIL'} ${name}: ${hits.length}`);
  hits.slice(0, 12).forEach((h) => console.log('       ' + h));
  if (hits.length > 12) console.log(`       ... ${hits.length - 12} more`);
}
console.log(`total violations: ${total}`);
if (process.argv.includes('--strict') && total) process.exit(1);
