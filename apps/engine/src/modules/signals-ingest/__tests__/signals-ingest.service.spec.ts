import { describe, expect, it } from 'vitest';
import { SignalsIngestService } from '../signals-ingest.service';
import { IncomingPost } from '../types';

const post = (id: string, text: string): IncomingPost => ({
  source: 'hackernews', externalId: id, title: '', text, url: '', author: '', postedAt: '',
});

describe('SignalsIngestService', () => {
  it('dedupes on source+externalId', () => {
    const svc = new SignalsIngestService();
    expect(svc.ingest([post('1', 'a'), post('1', 'a')])).toEqual({ added: 1, duplicates: 1 });
    expect(svc.countPosts()).toBe(1);
  });

  it('matches stored posts against registered profiles, best first', () => {
    const svc = new SignalsIngestService();
    svc.registerProfile({ productId: 'p1', displayName: 'P1', problemPhrases: ['email outreach'], keywords: ['deliverability'] });
    svc.ingest([post('1', 'my email outreach lands in spam, deliverability is bad'), post('2', 'nothing relevant')]);
    const matches = svc.matches();
    expect(matches).toHaveLength(1);
    expect(matches[0].post.externalId).toBe('1');
    expect(matches[0].matchedTerms).toEqual(expect.arrayContaining(['email outreach', 'deliverability']));
  });

  it('clear() empties stored posts', () => {
    const svc = new SignalsIngestService();
    svc.ingest([post('1', 'x')]);
    svc.clear();
    expect(svc.countPosts()).toBe(0);
  });
});
