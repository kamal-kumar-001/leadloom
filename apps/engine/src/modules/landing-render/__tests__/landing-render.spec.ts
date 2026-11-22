import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderLandingHtml, validateLandingInput, escapeHtml } from '../render';
import { LandingRenderService } from '../service';

const input = validateLandingInput({
  productName: 'Leadloom',
  tagline: 'From idea to revenue with the agents you already own',
  summary: 'Solo founders juggle disconnected tools between an idea and first revenue.',
  gaps: ['no orchestration across existing coding agents', 'launch checklists live in wikis, not workflows'],
  sources: ['https://example.com/market', 'https://news.ycombinator.com/item?id=1'],
});

describe('validateLandingInput', () => {
  it('accepts well-formed input and rejects bad shapes', () => {
    expect(input.productName).toBe('Leadloom');
    expect(() => validateLandingInput({ tagline: 'x', summary: 'y', gaps: [], sources: [] })).toThrow('productName');
    expect(() => validateLandingInput({ productName: 'x', tagline: 'y', summary: 'z', gaps: 'a', sources: [] })).toThrow('gaps');
  });
});

describe('renderLandingHtml', () => {
  it('renders brand, content and the not-published marker', () => {
    const html = renderLandingHtml(input);
    expect(html).toContain('#090a0f');
    expect(html).toContain('#3E1F47');
    expect(html).toContain('#F3E3A0');
    expect(html).toContain('From idea to revenue with the agents you already own');
    expect(html).toContain('no orchestration across existing coding agents');
    expect(html).toContain('Not published');
  });

  it('emits zero external resources (no CDN, no fonts, no JS, no images)', () => {
    const html = renderLandingHtml(input);
    expect(html).not.toMatch(/<script/);
    expect(html).not.toMatch(/<link/);
    expect(html).not.toMatch(/<img/);
    expect(html).not.toMatch(/https?:\/\/[^"'\s]*\.(js|css|woff)/);
  });

  it('HTML-escapes agent-sourced content (untrusted)', () => {
    const evil = validateLandingInput({
      productName: 'X<script>alert(1)</script>',
      tagline: 't"><img src=x onerror=alert(1)>',
      summary: 's & "quotes"',
      gaps: ['<b>not bold</b>'],
      sources: ['javascript:alert(1)'],
    });
    const html = renderLandingHtml(evil);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('onerror=alert(1)>');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('&lt;script&gt;');
    expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });

  it('renders sources as text citations, never clickable hrefs', () => {
    const html = renderLandingHtml(input);
    expect(html).not.toContain('<a href');
  });
});

describe('LandingRenderService', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'leadloom-landing-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('writes one local html file with a slug name', async () => {
    const svc = new LandingRenderService(dir);
    const res = await svc.render(input);
    expect(res.htmlPath).toContain('landing-leadloom.html');
    const written = readFileSync(res.htmlPath, 'utf8');
    expect(written).toContain('<!doctype html>');
    expect(res.bytes).toBe(Buffer.byteLength(written, 'utf8'));
  });

  it('slugs odd names safely and falls back for empty slugs', async () => {
    const svc = new LandingRenderService(dir);
    const res = await svc.render({ ...input, productName: 'My Weird App!! 2026' });
    expect(res.htmlPath).toContain('landing-my-weird-app-2026.html');
    const res2 = await svc.render({ ...input, productName: '!!!' });
    expect(res2.htmlPath).toContain('landing-product.html');
  });
});
