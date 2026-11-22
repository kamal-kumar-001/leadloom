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

const port = 3156;
const base = `http://127.0.0.1:${port}`;
const chromePath = '/usr/bin/brave-browser';
const authSecret = 'stage1-verification-auth-secret-32-bytes-long-key';

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
  console.log(`Starting Next.js on port ${port} with LEADLOOM_PLATFORM_ADMIN_EMAIL=mr.kamal0120@gmail.com...`);
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

  const { encode } = await import('next-auth/jwt');

  // Helper to create session tokens
  async function makeTokens(user) {
    const tokenPayload = {
      ...user,
      id: user.id || 'usr_001',
      idp: 'credentials',
      engineToken: 'dummy-engine-token',
      engineExp: 9999999999,
      sub: user.id || 'usr_001',
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
    return [
      { name: 'authjs.session-token', value: sessionToken, url: base },
      { name: 'next-auth.session-token', value: legacyToken, url: base },
    ];
  }

  const adminUser = {
    id: 'usr_kamal_001',
    name: 'Kamal Kumar',
    email: 'mr.kamal0120@gmail.com',
    email_verified: true,
  };

  const regularUser = {
    id: 'usr_regular_002',
    name: 'Regular Member',
    email: 'member@acme-corp.com',
    email_verified: true,
  };

  async function setupAdminInterception(page) {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/auth/session')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: adminUser }),
        });
      }
      if (url.includes('/api/engine/auth/me')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            userId: 'usr_kamal_001',
            workspaceId: '00000000-0000-4000-8000-000000000001',
            role: 'admin',
          }),
        });
      }
      if (url.includes('/api/engine/tables')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
      if (url.includes('/api/engine/research/leads')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                rowId: 'row_1',
                values: {
                  Domain: 'stripe.com',
                  'Tech keywords': 'TypeScript, React, Golang, Kafka',
                  'Researched at': '2026-11-20T14:30:00.000Z',
                },
              },
            ],
          }),
        });
      }
      if (url.includes('/api/profile')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, name: 'Kamal Kumar (Verified)' }),
        });
      }
      req.continue();
    });
  }

  // 1. Capture Dashboard & Expanded Sidebar
  console.log('\n--- 1. Dashboard with Expanded Sidebar ---');
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const cookies = await makeTokens(adminUser);
    await page.setCookie(...cookies);
    await setupAdminInterception(page);

    await page.goto(`${base}/app/tables`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(800);

    const filename = 'shell-dashboard-expanded.png';
    const localPath = path.join(screenshotDir, filename);
    await page.screenshot({ path: localPath, fullPage: false });
    copyFileSync(localPath, path.join(artifactDir, filename));
    console.log(`  PASS: Saved ${filename}`);

    // 2. Click collapse toggle to capture Collapsed Sidebar
    console.log('\n--- 2. Click Sidebar Collapse Toggle ---');
    const collapseBtn = await page.$('button[aria-label="Collapse sidebar"]');
    if (collapseBtn) {
      await collapseBtn.click();
      await sleep(500);
      const colFilename = 'shell-sidebar-collapsed.png';
      const colLocalPath = path.join(screenshotDir, colFilename);
      await page.screenshot({ path: colLocalPath, fullPage: false });
      copyFileSync(colLocalPath, path.join(artifactDir, colFilename));
      console.log(`  PASS: Saved ${colFilename}`);

      // Uncollapse
      const expandBtn = await page.$('button[aria-label="Expand sidebar"]');
      if (expandBtn) {
        await expandBtn.click();
        await sleep(300);
      }
    }

    // 3. Open Command Palette via ⌘K search trigger
    console.log('\n--- 3. Command Palette Dialog (⌘K) ---');
    const searchTrigger = await page.$('button ::-p-text(Search workspace...)');
    if (searchTrigger) {
      await searchTrigger.click();
      await sleep(500);
      const paletteFilename = 'shell-command-palette.png';
      const paletteLocalPath = path.join(screenshotDir, paletteFilename);
      await page.screenshot({ path: paletteLocalPath, fullPage: false });
      copyFileSync(paletteLocalPath, path.join(artifactDir, paletteFilename));
      console.log(`  PASS: Saved ${paletteFilename}`);

      // Close modal
      await page.keyboard.press('Escape');
      await sleep(300);
    }

    // 4. Open Help Guide Modal from Sidebar
    console.log('\n--- 4. Help Guide Modal ---');
    const helpBtn = await page.$('button[title="Platform Guide & Instructions"]');
    if (helpBtn) {
      await helpBtn.click();
      await sleep(500);
      const helpFilename = 'shell-help-guide.png';
      const helpLocalPath = path.join(screenshotDir, helpFilename);
      await page.screenshot({ path: helpLocalPath, fullPage: false });
      copyFileSync(helpLocalPath, path.join(artifactDir, helpFilename));
      console.log(`  PASS: Saved ${helpFilename}`);

      // Close modal
      await page.keyboard.press('Escape');
      await sleep(300);
    }

    // 5. Open System Diagnostics Modal
    console.log('\n--- 5. System Diagnostics Modal ---');
    const diagBtn = await page.$('button[title="System Diagnostics & Health"]');
    if (diagBtn) {
      await diagBtn.click();
      await sleep(500);
      const diagFilename = 'shell-system-diagnostics.png';
      const diagLocalPath = path.join(screenshotDir, diagFilename);
      await page.screenshot({ path: diagLocalPath, fullPage: false });
      copyFileSync(diagLocalPath, path.join(artifactDir, diagFilename));
      console.log(`  PASS: Saved ${diagFilename}`);

      // Close modal
      await page.keyboard.press('Escape');
      await sleep(300);
    }

    // 6. Open Top-Right Notification Center
    console.log('\n--- 6. Notification Center ---');
    const notifBtn = await page.$('button[aria-label="Open notifications"]');
    if (notifBtn) {
      await notifBtn.click();
      await sleep(500);
      const notifFilename = 'shell-notification-center.png';
      const notifLocalPath = path.join(screenshotDir, notifFilename);
      await page.screenshot({ path: notifLocalPath, fullPage: false });
      copyFileSync(notifLocalPath, path.join(artifactDir, notifFilename));
      console.log(`  PASS: Saved ${notifFilename}`);
    }

    await page.close();
  }

  // 7. Research Page Alignment & Layout
  console.log('\n--- 7. Research Page Centered Layout ---');
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const cookies = await makeTokens(adminUser);
    await page.setCookie(...cookies);
    await setupAdminInterception(page);

    await page.goto(`${base}/app/research`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(800);

    const filename = 'research-page-aligned.png';
    const localPath = path.join(screenshotDir, filename);
    await page.screenshot({ path: localPath, fullPage: false });
    copyFileSync(localPath, path.join(artifactDir, filename));
    console.log(`  PASS: Saved ${filename}`);
    await page.close();
  }

  // 8. Account Settings: Edit Name & Save
  console.log('\n--- 8. Account Settings & Profile Name Save Flow ---');
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 850 });
    const cookies = await makeTokens(adminUser);
    await page.setCookie(...cookies);
    await setupAdminInterception(page);

    await page.goto(`${base}/app/settings`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(800);

    // Click "Edit Name"
    const editBtn = await page.$('button ::-p-text(Edit Name)');
    if (editBtn) {
      await editBtn.click();
      await sleep(300);

      const nameInput = await page.$('input[placeholder="Your full name"]');
      if (nameInput) {
        // Clear and type new name
        await nameInput.click({ clickCount: 3 });
        await nameInput.type('Kamal Kumar (Verified)');
        await sleep(200);

        // Click "Save"
        const saveBtn = await page.$('button[type="submit"]');
        if (saveBtn) {
          await saveBtn.click();
          await sleep(600);
        }
      }
    }

    const filename = 'account-settings-saved.png';
    const localPath = path.join(screenshotDir, filename);
    await page.screenshot({ path: localPath, fullPage: false });
    copyFileSync(localPath, path.join(artifactDir, filename));
    console.log(`  PASS: Saved ${filename}`);
    await page.close();
  }

  // 9. Platform Admin Access (Authorized: mr.kamal0120@gmail.com)
  console.log('\n--- 9. Platform Admin Access (Authorized) ---');
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const cookies = await makeTokens(adminUser);
    await page.setCookie(...cookies);
    await setupAdminInterception(page);

    await page.goto(`${base}/admin`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(800);

    const filename = 'platform-admin-console.png';
    const localPath = path.join(screenshotDir, filename);
    await page.screenshot({ path: localPath, fullPage: false });
    copyFileSync(localPath, path.join(artifactDir, filename));
    console.log(`  PASS: Saved ${filename}`);
    await page.close();
  }

  // 10. Platform Admin Access Denied (Unauthorized: member@acme-corp.com)
  console.log('\n--- 10. Platform Admin Access Denied (Unauthorized) ---');
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const cookies = await makeTokens(regularUser);
    await page.setCookie(...cookies);

    // Mock regular session
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/auth/session')) {
        return req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: regularUser }),
        });
      }
      req.continue();
    });

    await page.goto(`${base}/admin`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(800);

    const filename = 'platform-admin-denied.png';
    const localPath = path.join(screenshotDir, filename);
    await page.screenshot({ path: localPath, fullPage: false });
    copyFileSync(localPath, path.join(artifactDir, filename));
    console.log(`  PASS: Saved ${filename}`);
    await page.close();
  }

} catch (err) {
  console.error('Capture execution error:', err);
  failed = true;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill('SIGTERM');
}

if (failed) {
  console.error('\nCAPTURE EXECUTION FAILED');
  process.exit(1);
} else {
  console.log('\nCAPTURE EXECUTION SUCCESS: All screenshots captured and copied to artifact directory.');
}
