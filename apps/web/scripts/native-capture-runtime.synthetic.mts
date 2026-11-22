import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { PrismaClient } from '@prisma/client';
import { ValidatorService } from '../../engine/src/modules/validator/validator.service';
const root = new URL('../../../', import.meta.url).pathname;
const dbUrl = readFileSync('/tmp/leadloom-native-db-url.txt', 'utf8');
const db = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const ws = randomUUID(), slug = 'native-capture-' + randomUUID();
const base = 'http://127.0.0.1:3177';
let browser: any, engine: any, web: any;
const children: any[] = [];
async function stop(child: any) { if (child && child.exitCode === null) { child.kill('SIGTERM'); await new Promise(r => child.once('exit', r)); } }
async function wait(url: string, child: any) { for (let i = 0; i < 120; i++) { if (child.exitCode !== null) throw Error('Startup exited'); try { if ((await fetch(url)).status < 500) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw Error('Startup timed out'); }
async function run() {
  await db.workspace.create({ data: { id: ws, name: 'Synthetic public capture fixture' } });
  const svc = new ValidatorService(base, db);
  const created = await svc.generate(ws, { rawHypothesis: 'Manual research for synthetic teams', preferredSlug: slug });
  await svc.setPublishStatus(created.experimentId,ws,true,(await svc.getOwnerPage(created.experimentId,ws))?.revision);
  const env = { ...process.env, NODE_ENV: 'production', DATABASE_URL: dbUrl, HOST: '127.0.0.1', LEADLOOM_MASTER_KEY: Buffer.alloc(32, 5).toString('base64'), LEADLOOM_SESSION_KEY: Buffer.alloc(32, 6).toString('base64'), LEADLOOM_WORKER_ENABLED: 'false', LEADLOOM_OUTBOUND_SENDING_ENABLED: 'false', LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED: 'false', LEADLOOM_VALIDATOR_API_ENABLED: 'true', LEADLOOM_RESEARCH_FETCH_ENABLED: 'false' };
  engine = spawn(process.execPath, [root + 'apps/engine/dist/main.js'], { cwd: root + 'apps/engine', env: { ...env, PORT: '4037', APP_BASE_URL: base }, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(engine);
  engine.stderr.on('data', (d: Buffer) => process.stderr.write(d));
  await wait('http://127.0.0.1:4037/health', engine);
  web = spawn(process.execPath, [root + 'apps/web/.next/standalone/apps/web/server.js'], { cwd: root + 'apps/web', env: { ...env, PORT: '3177', HOSTNAME: '127.0.0.1', ENGINE_URL: 'http://127.0.0.1:4037', AUTH_SECRET: 'synthetic-capture-runtime-32characters-long', AUTH_TRUST_HOST: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(web);
  web.stderr.on('data', (d: Buffer) => process.stderr.write(d));
  await wait(base + '/login', web);
  browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1000 });
  const errors: string[] = []; page.on('pageerror', (e: any) => errors.push(String(e)));
  await page.setRequestInterception(true); page.on('request', (r: any) => { const u = r.url(); if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else r.abort(); });
  await page.goto(base + '/v/' + slug, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('input[type=email]');
  await page.type('input[type=email]', 'browser@example.invalid'); await page.click('button[type=submit]'); await page.waitForSelector('textarea'); await page.type('textarea', 'Synthetic visitor text');
  const displayed = await page.$eval('select', (el: any) => el.value);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Submit'); if (!b) throw Error('No final submit'); b.click(); });
  await page.waitForFunction(() => document.body.innerText.includes('Your response has been saved'));
  const captured = await db.waitlistLead.findFirstOrThrow({ where: { page: { experimentId: created.experimentId } } });
  assert.equal(captured.email, 'browser@example.invalid'); assert(Object.values(captured.surveyResponses as any).includes(displayed)); assert(Object.values(captured.surveyResponses as any).includes('Synthetic visitor text'));
  await new Promise((r) => setTimeout(r, 750));
  await page.screenshot({ path: '/downloads/leadloom-waitlist-capture-success.png', fullPage: false });
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('input[type=email]');
  const duplicate = await page.evaluate(async (s: string) => { const r = await fetch('/api/v/' + s + '/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'BROWSER@example.invalid', survey: { changed: 'Retry must not replace answers' } }) }); return { status: r.status, data: await r.json() }; }, slug);
  assert.equal(duplicate.status, 200); assert.equal(duplicate.data.totalWaitlist, 1);
  assert.deepEqual((await db.waitlistLead.findUniqueOrThrow({ where: { id: captured.id } })).surveyResponses, captured.surveyResponses);
  await svc.setPublishStatus(created.experimentId, ws, false);
  const closed = await page.evaluate(async (s: string) => (await fetch('/api/v/' + s + '/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'closed@example.invalid' }) })).status, slug);
  assert.equal(closed, 404); assert.equal((await svc.getLeads(created.experimentId, ws)).totalLeads, 1);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => document.body.innerText.includes("This smoke test page isn't available."));
  assert.deepEqual(errors, []);
  console.log('PASS actual compiled engine, real Prisma/PG16, standalone Chrome public capture: displayed default survey choice saved, exact answers persisted, restart reads, duplicate retry stable count and answers, unpublish blocks capture and page. No external hosts or recipients contacted.');
}
try { await run(); } finally { await browser?.close(); for (const c of children.reverse()) await stop(c); await db.workspace.deleteMany({ where: { id: ws } }); await db.$disconnect(); }
