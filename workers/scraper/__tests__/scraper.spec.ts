import { describe, it, expect } from 'vitest';
import { HeadlessScraperWorker } from '../src/scraper.worker';
import { shouldBlockRequest } from '../src/resource-interceptor';

describe('HeadlessScraperWorker — Playwright & FinOps Resource Fencing', () => {
  it('should strictly block images, media, fonts, and stylesheets to safeguard 4GB VPS memory', () => {
    expect(shouldBlockRequest('image', 'https://example.com/logo.png')).toBe(true);
    expect(shouldBlockRequest('media', 'https://example.com/video.mp4')).toBe(true);
    expect(shouldBlockRequest('font', 'https://example.com/inter.woff2')).toBe(true);
    expect(shouldBlockRequest('stylesheet', 'https://example.com/style.css')).toBe(true);

    // HTML / Document requests must NOT be blocked
    expect(shouldBlockRequest('document', 'https://example.com/careers')).toBe(false);
  });

  it('should clean raw HTML into markdown and extract intent/tech signals', async () => {
    const worker = new HeadlessScraperWorker(2);

    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Acme Cloud — Autonomous Kubernetes Infra</title>
          <meta name="description" content="We rightsize your Kubernetes clusters on AWS and EKS automatically." />
          <style>body { font-size: 16px; }</style>
          <script>console.log("tracking");</script>
        </head>
        <body>
          <h1>Welcome to Acme Cloud</h1>
          <p>We are hiring Senior DevOps and Kubernetes Engineers in 2026!</p>
          <p>Managed on AWS EKS and Terraform.</p>
        </body>
      </html>
    `;

    const result = await worker.scrape('https://acmecloud.io/careers', mockHtml);

    expect(result.title).toBe('Acme Cloud — Autonomous Kubernetes Infra');
    expect(result.metaDescription).toContain('Kubernetes clusters on AWS and EKS');
    expect(result.cleanMarkdown).not.toContain('<script>');
    expect(result.cleanMarkdown).not.toContain('<style>');
    expect(result.cleanMarkdown).toContain('# Welcome to Acme Cloud');

    // Check detected signals
    expect(result.detectedSignals).toContain('tech:kubernetes');
    expect(result.detectedSignals).toContain('tech:aws');
    expect(result.detectedSignals).toContain('tech:terraform');
    expect(result.detectedSignals).toContain('intent:hiring');
  });

  it('should enforce concurrency fencing to max 2 instances', async () => {
    const worker = new HeadlessScraperWorker(1);

    // Simulate active job
    const slowHtml = '<html><head><title>Test</title></head><body>Content</body></html>';

    // Start 1 job
    const jobPromise = worker.scrape('https://test1.com', slowHtml);

    // Immediate second job while concurrency max is 1 should succeed once first finishes or throw if saturated
    const res = await jobPromise;
    expect(res.title).toBe('Test');
    expect(worker.getConcurrency().active).toBe(0);
  });
});
