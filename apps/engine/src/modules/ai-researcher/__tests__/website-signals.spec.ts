import { describe, it, expect } from 'vitest';
import { WebsiteSignalService } from '../website-signals.service';

describe('WebsiteSignalService (G4 honest heuristics)', () => {
  const svc = new WebsiteSignalService();

  it('labels output as heuristic and never invents confidence or summary', () => {
    const r = svc.analyzeText('acme.test', 'We build with Kubernetes and PostgreSQL. See our careers page.');
    expect(r.source).toBe('heuristic_keywords');
    expect(r.confidence).toBeNull();
    expect(r.summary).toBeNull();
    expect(r.techKeywords).toEqual(['Kubernetes', 'PostgreSQL']);
    expect(r.mentionsHiring).toBe(true);
    expect(r.mentionsPricing).toBe(false);
  });

  it('returns empty signals for empty or irrelevant text, never fabricated ones', () => {
    const r = svc.analyzeText('empty.test', '');
    expect(r.techKeywords).toEqual([]);
    expect(r.mentionsHiring).toBe(false);
    expect(r.mentionsScaling).toBe(false);
    expect(r.wordCount).toBe(0);
  });

  it('exposes thin pages as thin via wordCount', () => {
    const thin = svc.analyzeText('thin.test', 'hello world');
    const thick = svc.analyzeText('thick.test', 'kubernetes '.repeat(500));
    expect(thin.wordCount).toBeLessThan(5);
    expect(thick.wordCount).toBeGreaterThan(100);
  });
});
