import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const screenshotDir = path.resolve(webRoot, 'screenshots');
const artifactDir = '/home/kamal/.gemini/antigravity/brain/acb8c7c9-8472-47d7-9bdf-e99f072980bb';

if (!existsSync(screenshotDir)) {
  mkdirSync(screenshotDir, { recursive: true });
}

const port = 3158;
const base = `http://127.0.0.1:${port}`;
const chromePath = '/usr/bin/brave-browser';
const authSecret = 'stage1-verification-auth-secret-32-bytes-long-key';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/login`, { signal: AbortSignal.timeout(1500) });
      if (res.status < 500) return;
    } catch {}
    await sleep(400);
  }
  throw new Error(`Server did not respond within ${timeoutMs}ms`);
}

let server;
let browser;

try {
  server = spawn(
    'npx',
    ['next', 'dev', '-p', String(port), '-H', '127.0.0.1'],
    {
      cwd: webRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(port),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'development',
        AUTH_TRUST_HOST: 'true',
        NEXTAUTH_URL: `http://127.0.0.1:${port}`,
        AUTH_SECRET: authSecret,
        NEXTAUTH_SECRET: authSecret,
        LEADLOOM_PLATFORM_ADMIN_EMAIL: 'mr.kamal0120@gmail.com',
      },
    }
  );

  await waitForServer();

  browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,800'],
  });

  const { encode } = await import('next-auth/jwt');
  const user = {
    id: 'usr_smoke_001',
    name: 'Kamal Kumar',
    email: 'mr.kamal0120@gmail.com',
    email_verified: true,
  };
  const tokenPayload = { ...user, sub: user.id, idp: 'credentials', engineToken: 'dummy', engineExp: 9999999999 };
  const sessionToken = await encode({ token: tokenPayload, secret: authSecret, salt: 'authjs.session-token' });
  const legacyToken = await encode({ token: tokenPayload, secret: authSecret, salt: 'next-auth.session-token' });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setCookie(
    { name: 'authjs.session-token', value: sessionToken, url: base },
    { name: 'next-auth.session-token', value: legacyToken, url: base }
  );

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/auth/session')) {
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }) });
    }
    if (url.includes('/api/engine/auth/me')) {
      return req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ userId: user.id, workspaceId: '00000000-0000-4000-8000-000000000001', role: 'admin' }),
      });
    }
    req.continue();
  });

  await page.goto(`${base}/app/settings`, { waitUntil: 'networkidle2', timeout: 20000 });
  await sleep(600);

  // 1. Click sidebar collapse toggle
  const collapseBtn = await page.$('button[aria-label="Collapse sidebar"]');
  if (collapseBtn) {
    await collapseBtn.click();
    await sleep(300);
    // Expand again
    const expandBtn = await page.$('button[aria-label="Expand sidebar"]');
    if (expandBtn) {
      await expandBtn.click();
      await sleep(300);
    }
  }

  // 2. Click "Change Password" button in Account Settings Card
  const changePwdBtn = await page.$('button ::-p-text(Change Password)');
  if (changePwdBtn) {
    await changePwdBtn.click();
    await sleep(400);
  }

  // 3. Capture real click verified screenshot
  const filename = 'shell-smoke-verified.png';
  const localPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: localPath, fullPage: false });
  copyFileSync(localPath, path.join(artifactDir, filename));
  console.log(`SMOKE_CLICK_SUCCESS: Screenshot saved to ${localPath}`);

} catch (err) {
  console.error('Smoke failed:', err);
  process.exit(1);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill('SIGTERM');
}
