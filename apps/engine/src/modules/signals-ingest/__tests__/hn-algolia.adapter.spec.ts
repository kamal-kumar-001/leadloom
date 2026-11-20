import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HnAlgoliaAdapter, HnSearchResponse } from '../sources/hn-algolia.adapter';

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'hn-search-comments.json'), 'utf8'),
) as HnSearchResponse;

describe('HnAlgoliaAdapter.normalizeHits (recorded fixture)', () => {
  const adapter = new HnAlgoliaAdapter();
  const posts = adapter.normalizeHits(fixture.hits);

  it('normalizes every fixture hit', () => {
    expect(posts.length).toBe(fixture.hits.length);
  });

  it('maps comment hits to source fields a human can open', () => {
    const first = posts[0];
    expect(first.source).toBe('hackernews');
    expect(first.externalId).toBe(fixture.hits[0].objectID);
    expect(first.title).toBe(fixture.hits[0].story_title);
    expect(first.url).toBe(`https://news.ycombinator.com/item?id=${fixture.hits[0].objectID}`);
    expect(first.text.length).toBeGreaterThan(0);
  });

  it('strips HTML from comment text', () => {
    for (const p of posts) expect(p.text).not.toMatch(/<[^>]+>/);
  });
});

describe('HnAlgoliaAdapter.search', () => {
  it('refuses to run without an injected fetch', async () => {
    await expect(new HnAlgoliaAdapter().search('x')).rejects.toThrow(/fetch implementation/);
  });

  it('issues one encoded request and normalizes the response', async () => {
    const seen: string[] = [];
    const fakeFetch = async (url: string) => {
      seen.push(url);
      return { ok: true, status: 200, json: async () => fixture };
    };
    const posts = await new HnAlgoliaAdapter(fakeFetch).search('customer support tool', { hitsPerPage: 5 });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('query=customer%20support%20tool');
    expect(seen[0]).toContain('tags=comment');
    expect(posts.length).toBe(fixture.hits.length);
  });

  it('throws on a non-OK response', async () => {
    const failFetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
    await expect(new HnAlgoliaAdapter(failFetch).search('x')).rejects.toThrow(/HTTP 429/);
  });
});
