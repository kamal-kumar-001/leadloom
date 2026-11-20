import { describe, expect, it } from 'vitest';
import { MatchingService, termMatches } from '../matching.service';
import { IncomingPost, ProductProfile } from '../types';

const dmpilot: ProductProfile = {
  productId: 'dmpilot',
  displayName: 'DMPilot',
  problemPhrases: ['instagram dm automation', 'manage comments'],
  keywords: ['inbox', 'creators'],
};

const post = (over: Partial<IncomingPost>): IncomingPost => ({
  source: 'manual', externalId: 'x', title: '', text: '', url: '', author: '', postedAt: '', ...over,
});

describe('termMatches', () => {
  it('matches single words on word boundaries only', () => {
    expect(termMatches('my inbox is full', 'inbox')).toBe(true);
    expect(termMatches('they reached out', 'reach')).toBe(false);
  });

  it('matches multi-word phrases as case-insensitive substrings', () => {
    expect(termMatches('looking for instagram dm automation tools', 'instagram dm automation')).toBe(true);
  });

  it('ignores empty terms', () => {
    expect(termMatches('anything', '  ')).toBe(false);
  });
});

describe('MatchingService.matchPost', () => {
  const svc = new MatchingService();

  it('returns no match when nothing hits', () => {
    expect(svc.matchPost(post({ text: 'unrelated content about gardening' }), [dmpilot])).toEqual([]);
  });

  it('matches title and body together and reports matched terms', () => {
    const matches = svc.matchPost(
      post({ title: 'Best instagram dm automation?', text: 'My inbox is chaos since we grew.' }),
      [dmpilot],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].productId).toBe('dmpilot');
    expect(matches[0].matchedTerms).toEqual(expect.arrayContaining(['instagram dm automation', 'inbox']));
    expect(matches[0].score).toBeGreaterThan(0.3);
  });

  it('scores phrase+keyword hits above keyword-only hits', () => {
    const rich = svc.matchPost(post({ text: 'instagram dm automation for my inbox' }), [dmpilot]);
    const thin = svc.matchPost(post({ text: 'my inbox' }), [dmpilot]);
    expect(rich[0].score).toBeGreaterThan(thin[0].score);
  });
});
