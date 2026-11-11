#!/usr/bin/env node
/**
 * Production smoke regression: boots `next start` on the production build and
 * loads key pages in real Chrome, failing on any client-side exception.
 *
 * Why this exists: the React 18/fiber-8 stack produced a homepage chunk that
 * passed `next build` and SSR but crashed every client with
 * `ReactCurrentBatchConfig` undefined. Build success is not render success.
 *
 * Usage:
 *   node apps/web/scripts/smoke-production.mjs [--port 3100] [--chrome /path/to/chrome]
 *
 * Requires: `npm run build --workspace @leadloom/web` already run.
 * Chrome: uses --chrome, $CHROME_PATH, or common system locations.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const port = Number(argValue('port', 3100));
const base = `http://127.0.0.1:${port}`;

const chromeCandidates = [
  argValue('chrome', process.env.CHROME_PATH || ''),
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const chromePath = chromeCandidates.find((p) => existsSync(p));
if (!chromePath) {
  console.error('smoke: no Chrome/Chromium binary found (set --chrome or CHROME_PATH)');
  process.exit(2);
}

const pages = [
  {
    path: '/',
    name: 'homepage',
    expectText: 'Find Leads', // hero email CTA (demo workspace removed)
    expectSelector: 'canvas', // Living Loom 3D canvas mounts on the client
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`server did not respond on ${base} within ${timeoutMs}ms`);
}

let server;
let browser;
const failures = [];

try {
  server = spawn('npx', ['next', 'start', '-p', String(port)], {
    cwd: webRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  server.stderr.on('data', (d) => process.stderr.write(`[next] ${d}`));
  await waitForServer();

  browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=swiftshader',
      '--enable-unsafe-swiftshader',
      '--window-size=1280,900',
    ],
  });

  for (const spec of pages) {
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedResources = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('response', (res) => {
      if (res.status() >= 400) failedResources.push(`${res.status()} ${res.url()}`);
    });

    const url = `${base}${spec.path}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
    } catch (err) {
      failures.push(`${spec.name}: navigation failed: ${err.message}`);
      await page.close();
      continue;
    }
    // Give client hydration + lazy canvas a moment beyond network idle.
    await sleep(3000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes('Application error') || bodyText.includes('client-side exception')) {
      failures.push(`${spec.name}: Next.js client error boundary rendered`);
    }
    if (spec.expectText && !bodyText.includes(spec.expectText)) {
      failures.push(`${spec.name}: expected text not found: "${spec.expectText}"`);
    }
    if (spec.expectSelector) {
      const found = await page.$(spec.expectSelector);
      if (!found) failures.push(`${spec.name}: expected selector not found: ${spec.expectSelector}`);
    }
    for (const err of pageErrors) failures.push(`${spec.name}: pageerror: ${err}`);
    for (const err of consoleErrors) {
      // Resource failures are reported with URLs via failedResources below.
      if (/Failed to load resource/i.test(err)) continue;
      if (/Preload|preload|third-party|Deprecation/i.test(err)) continue;
      failures.push(`${spec.name}: console.error: ${err}`);
    }
    for (const res of failedResources) {
      if (/favicon\.ico/.test(res)) continue; // legacy fallback path; icon.svg is the real icon
      failures.push(`${spec.name}: failed resource: ${res}`);
    }
    const title = await page.title();
    console.log(`smoke: ${spec.name} (${url}) title="${title}" consoleErrors=${consoleErrors.length} pageErrors=${pageErrors.length}`);
    await page.close();
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill('SIGTERM');
}

if (failures.length) {
  console.error('\nSMOKE FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nSMOKE PASSED: production build renders without client-side exceptions.');
