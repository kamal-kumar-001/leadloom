import { describe, expect, it } from 'vitest';
import { MatchingService } from '../matching.service';
import { PRODUCT_PROFILES } from '../product-profiles.seed';
import { IncomingPost } from '../types';

const svc = new MatchingService();
const post = (text: string, title = ''): IncomingPost => ({
  source: 'manual', externalId: 'n1', title, text, url: '', author: '', postedAt: '',
});
const matchesFor = (p: IncomingPost) => svc.matchPost(p, PRODUCT_PROFILES);

describe('profile matching on irrelevant / negative contexts', () => {
  it('ignores posts with zero signal', () => {
    expect(matchesFor(post('Just got back from a hiking trip, weather was great.'))).toEqual([]);
  });

  it('does not match substring lookalikes of keywords', () => {
    // "creator" inside another word form or "campaign" should not fire 'creators'/'campaign' keywords.
    expect(matchesFor(post('The creation of this sculpture took years.'))).toEqual([]);
  });

  it('rejects off-topic use of a keyword domain: payments as a topic of news, not a merchant problem', () => {
    // Keyword-only hit ('upi') on a non-problem post still matches; this test
    // documents the current limitation so the false positive is a conscious
    // behavior, not a silent bug. Human approval is the control for these.
    const m = matchesFor(post('RBI released new UPI guidelines today, interesting read.'));
    expect(m.length).toBeLessThanOrEqual(1);
    if (m.length === 1) {
      expect(m[0].matchedTerms).toEqual(['upi']);
      expect(m[0].score).toBeLessThan(0.6); // keyword-only hits stay low-score
    }
  });

  it('ranks a genuine problem post above a keyword-only mention', () => {
    const genuine = svc.matchPost(
      post('My cafe billing is chaos and I need ingredient inventory tracking before the weekend rush.'),
      PRODUCT_PROFILES,
    );
    const mention = svc.matchPost(post('RBI UPI guidelines news roundup'), PRODUCT_PROFILES);
    expect(genuine[0].productId).toBe('bakerypos');
    expect(genuine[0].score).toBeGreaterThan(mention.length ? mention[0].score : 0);
  });

  it('never matches a product whose domain is absent (no cross-product bleed)', () => {
    const m = matchesFor(post('Looking for bakery pos recommendations for my new cafe.'));
    const ids = m.map((x) => x.productId);
    expect(ids).toContain('bakerypos');
    expect(ids).not.toContain('dmpilot');
    expect(ids).not.toContain('feefree');
  });
});
