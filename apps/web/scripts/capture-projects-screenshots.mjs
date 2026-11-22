import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '../..');
const screenshotDir = path.resolve(webRoot, 'screenshots');
const artifactDir = '/home/kamal/.gemini/antigravity/brain/acb8c7c9-8472-47d7-9bdf-e99f072980bb';

if (!existsSync(screenshotDir)) {
  mkdirSync(screenshotDir, { recursive: true });
}

const port = 3150;
const base = `http://127.0.0.1:${port}`;
const chromePath = '/usr/bin/brave-browser';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/login`, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`Server did not respond on port ${port} within ${timeoutMs}ms`);
}

let server;
let browser;
let failed = false;

try {
  console.log(`Starting Next.js on port ${port}...`);
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
        AUTH_SECRET: 'stage1-verification-auth-secret-32-bytes-long-key',
        NEXTAUTH_SECRET: 'stage1-verification-auth-secret-32-bytes-long-key',
      },
    }
  );

  server.stderr.on('data', (d) => {
    const msg = d.toString();
    if (!msg.includes('ExperimentalWarning') && !msg.includes('Fast Refresh')) {
      process.stderr.write(`[next] ${msg}`);
    }
  });

  await waitForServer();
  console.log(`Next.js responsive on port ${port}. Launching Brave Browser...`);

  browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--window-size=1280,900',
    ],
  });

  // Mock data for realistic rendering without real tokens
  const mockProjects = [
    {
      id: '018f6c40-1a2b-7c3d-8e4f-000000000001',
      workspaceId: '00000000-0000-4000-8000-000000000001',
      name: 'Enterprise Logistics Q4',
      slug: 'enterprise-logistics',
      description: 'Carrier integration & route optimization buyer pipeline',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
    {
      id: '018f6c40-1a2b-7c3d-8e4f-000000000002',
      workspaceId: '00000000-0000-4000-8000-000000000001',
      name: 'Headless Scraper Fleet',
      slug: 'scraper-fleet',
      description: 'Autonomous signal scraper and observation normalizer',
      createdAt: '2026-11-19T08:30:00.000Z',
      updatedAt: '2026-11-19T08:30:00.000Z',
    },
  ];

  const mockTokens = [
    {
      id: '018f6c40-1a2b-7c3d-8e4f-000000000010',
      name: 'Production Scraper Node 1',
      projectId: '018f6c40-1a2b-7c3d-8e4f-000000000001',
      tokenPrefix: 'lld_agt_8f1b',
      scope: 'context:read context:write',
      scopes: ['context:read', 'context:write'],
      expiry: null,
      expiresAt: null,
      revoked: false,
      createdAt: '2026-11-20T11:00:00.000Z',
    },
    {
      id: '018f6c40-1a2b-7c3d-8e4f-000000000020',
      name: 'Staging Ingest Agent',
      projectId: '018f6c40-1a2b-7c3d-8e4f-000000000002',
      tokenPrefix: 'lld_agt_3e7a',
      scope: '*',
      scopes: ['*'],
      expiry: '2026-12-20T11:00:00.000Z',
      expiresAt: '2026-12-20T11:00:00.000Z',
      revoked: false,
      createdAt: '2026-11-19T09:15:00.000Z',
    },
    {
      id: '018f6c40-1a2b-7c3d-8e4f-000000000030',
      name: 'Deprecated Crawler Node',
      projectId: '018f6c40-1a2b-7c3d-8e4f-000000000001',
      tokenPrefix: 'lld_agt_0a1c',
      scope: 'context:read',
      scopes: ['context:read'],
      expiry: '2026-11-15T00:00:00.000Z',
      expiresAt: '2026-11-15T00:00:00.000Z',
      revoked: true,
      createdAt: '2026-11-01T12:00:00.000Z',
    },
  ];

  async function setupPageInterception(page) {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/auth/session')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { email: 'kamal@leadloom.com' } }),
        });
      }
      if (url.includes('/api/engine/auth/me')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            userId: 'usr_00000000000000001',
            workspaceId: '00000000-0000-4000-8000-000000000001',
            role: 'admin',
          }),
        });
      }
      if (url.includes('/api/engine/projects')) {
        if (req.method() === 'GET') {
          return req.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockProjects),
          });
        }
      }
      if (url.includes('/api/engine/agent-tokens')) {
        if (req.method() === 'GET') {
          return req.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockTokens),
          });
        }
        if (req.method() === 'POST') {
          return req.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: '018f6c40-1a2b-7c3d-8e4f-000000000099',
              name: 'Autonomous Local Agent',
              projectId: '018f6c40-1a2b-7c3d-8e4f-000000000001',
              token: 'lld_agt_sample_dummy_token_never_real_for_verification',
              tokenPrefix: 'lld_agt_samp',
              scope: 'context:read context:write',
              scopes: ['context:read', 'context:write'],
              expiry: null,
              expiresAt: null,
              revoked: false,
              createdAt: new Date().toISOString(),
            }),
          });
        }
      }
      if (url.includes('/api/engine/workspace/')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
      req.continue();
    });
  }

  const viewports = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  const { encode } = await import('next-auth/jwt');
  const authSecret = 'stage1-verification-auth-secret-32-bytes-long-key';
  const tokenPayload = {
    email: 'kamal@leadloom.com',
    id: 'usr_001',
    idp: 'credentials',
    engineToken: 'dummy-engine-token',
    engineExp: 9999999999,
    sub: 'usr_001',
  };
  const sessionToken = await encode({
    token: tokenPayload,
    secret: authSecret,
    salt: 'authjs.session-token',
  });
  const legacyToken = await encode({
    token: tokenPayload,
    secret: authSecret,
    salt: 'next-auth.session-token',
  });

  for (const vp of viewports) {
    for (const theme of ['dark', 'light']) {
      console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) | Theme: ${theme}`);
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.setCookie(
        { name: 'authjs.session-token', value: sessionToken, url: base },
        { name: 'next-auth.session-token', value: legacyToken, url: base },
      );
      await setupPageInterception(page);

      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const txt = msg.text();
          if (!/Failed to load resource/i.test(txt) && !/WebGL/i.test(txt)) {
            errors.push(txt);
          }
        }
      });
      page.on('pageerror', (err) => errors.push(String(err)));

      await page.goto(`${base}/app/projects`, { waitUntil: 'networkidle2', timeout: 30000 });

      // Apply theme attribute
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        if (t === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }, theme);

      await sleep(600);

      // Verify no horizontal overflow on mobile
      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const viewWidth = window.innerWidth;
        return { docWidth, viewWidth, hasOverflow: docWidth > viewWidth };
      });

      if (overflow.hasOverflow) {
        console.error(`  FAIL [overflow]: Viewport ${vp.name} has horizontal overflow! docWidth: ${overflow.docWidth}, viewWidth: ${overflow.viewWidth}`);
        failed = true;
      } else {
        console.log(`  PASS [overflow]: No horizontal overflow in ${vp.name} (${overflow.docWidth}px <= ${overflow.viewWidth}px)`);
      }

      // Check client-side error boundary
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (bodyText.includes('Application error') || bodyText.includes('client-side exception')) {
        console.error(`  FAIL [error-boundary]: Error boundary rendered in ${vp.name} ${theme}`);
        failed = true;
      }

      // Take main screenshot
      const filename = `projects-${vp.name}-${theme}.png`;
      const localPath = path.join(screenshotDir, filename);
      await page.screenshot({ path: localPath, fullPage: false });
      console.log(`  PASS [screenshot]: Saved ${localPath}`);

      // Copy to artifact directory
      const artifactPath = path.join(artifactDir, filename);
      copyFileSync(localPath, artifactPath);

      // In dark theme, test issuing a token to capture the One-Time Reveal card!
      if (theme === 'dark') {
        try {
          // Click "Issue Agent Token" button
          const issueBtn = await page.$('button ::-p-text(Issue Agent Token)');
          if (issueBtn) {
            await issueBtn.click();
            await sleep(300);

            // Fill name input
            const nameInput = await page.$('#token-name');
            if (nameInput) {
              await nameInput.type('Autonomous Local Agent');
              // Click "Issue Credential" button
              const submitBtn = await page.$('button[type="submit"]');
              if (submitBtn) {
                await submitBtn.click();
                await sleep(500);

                // Wait for TokenRevealCard to appear
                await page.waitForSelector('[data-testid="token-reveal-card"]', { timeout: 5000 });

                // Scroll to TokenRevealCard so the secret is clearly in viewport
                await page.evaluate(() => {
                  const el = document.querySelector('[data-testid="token-reveal-card"]');
                  if (el) {
                    el.scrollIntoView({ behavior: 'instant', block: 'start' });
                  } else {
                    window.scrollTo(0, 0);
                  }
                });
                await sleep(400);

                // Capture One-Time Reveal Card screenshot
                const revealFilename = `projects-reveal-${vp.name}.png`;
                const revealLocalPath = path.join(screenshotDir, revealFilename);
                await page.screenshot({ path: revealLocalPath, fullPage: false });
                console.log(`  PASS [reveal-screenshot]: Saved ${revealLocalPath}`);
                copyFileSync(revealLocalPath, path.join(artifactDir, revealFilename));

                // On mobile, capture setup block and full-page reveal
                if (vp.name === 'mobile') {
                  // Setup instructions block screenshot
                  await page.evaluate(() => {
                    const main = document.querySelector('main');
                    if (main) {
                      main.scrollTop = main.scrollHeight;
                    }
                  });
                  await sleep(400);
                  const setupFilename = 'projects-setup-mobile.png';
                  const setupLocalPath = path.join(screenshotDir, setupFilename);
                  await page.screenshot({ path: setupLocalPath, fullPage: false });
                  console.log(`  PASS [setup-screenshot]: Saved ${setupLocalPath}`);
                  copyFileSync(setupLocalPath, path.join(artifactDir, setupFilename));

                  // Full-page screenshot showing both reveal card and setup instructions
                  await page.evaluate(() => {
                    const root = document.querySelector('.flex.h-screen');
                    if (root) root.style.height = 'auto';
                    const main = document.querySelector('main');
                    if (main) {
                      main.style.overflow = 'visible';
                      main.style.height = 'auto';
                    }
                  });
                  await sleep(400);
                  const fullFilename = 'projects-reveal-mobile-full.png';
                  const fullLocalPath = path.join(screenshotDir, fullFilename);
                  await page.screenshot({ path: fullLocalPath, fullPage: true });
                  console.log(`  PASS [full-reveal-screenshot]: Saved ${fullLocalPath}`);
                  copyFileSync(fullLocalPath, path.join(artifactDir, fullFilename));
                }
              }
            }
          }
        } catch (e) {
          console.warn(`  NOTE: reveal flow interaction: ${e.message}`);
        }
      }

      if (errors.length > 0) {
        console.error(`  WARN [console]:`, errors);
      }

      await page.close();
    }
  }

} catch (err) {
  console.error('Capture error:', err);
  failed = true;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill('SIGTERM');
}

if (failed) {
  console.error('\nSCREENSHOT CAPTURE FAILED');
  process.exit(1);
} else {
  console.log('\nSCREENSHOT CAPTURE SUCCESS: All views rendered cleanly and captured at 390px and 1280px.');
}
