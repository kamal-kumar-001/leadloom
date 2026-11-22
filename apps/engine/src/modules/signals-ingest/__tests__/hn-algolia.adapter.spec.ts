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

  it('rejects invalid response structure', async () => {
    const badBodies = [
      null,
      undefined,
      'not json object',
      42,
      [],
      { noHits: true },
      { hits: null },
      { hits: 'not an array' },
      { hits: 123 },
    ];

    for (const body of badBodies) {
      const fetchWithBody = async () => ({ ok: true, status: 200, json: async () => body });
      await expect(new HnAlgoliaAdapter(fetchWithBody).search('query')).rejects.toThrow(
        /Invalid HN Algolia response/,
      );
    }
  });
});

describe('HnAlgoliaAdapter hit validation and sanitization', () => {
  const adapter = new HnAlgoliaAdapter();

  it('skips malformed hits and requires numeric-string IDs', () => {
    const malformedHits = [
      null as any,
      undefined as any,
      'string hit' as any,
      12345 as any,
      [],
      {},
      { objectID: null },
      { objectID: undefined },
      { objectID: '' },
      { objectID: 'abc' },
      { objectID: '123a' },
      { objectID: '-456' },
      { objectID: ' 789 ' },
      { objectID: 12345 as any }, // numeric type instead of string
    ];

    const results = adapter.normalizeHits(malformedHits);
    expect(results).toHaveLength(0);

    const validHit = { objectID: '123456', title: 'Valid Story', url: 'https://example.com' };
    const validResults = adapter.normalizeHits([validHit]);
    expect(validResults).toHaveLength(1);
    expect(validResults[0].externalId).toBe('123456');
  });

  it('deduplicates hits with identical objectID', () => {
    const hitsWithDuplicates = [
      { objectID: '111', title: 'First 111', url: 'https://example.com/1' },
      { objectID: '222', title: 'Story 222', url: 'https://example.com/2' },
      { objectID: '111', title: 'Duplicate 111', url: 'https://example.com/3' },
      { objectID: '222', title: 'Duplicate 222', url: 'https://example.com/4' },
      { objectID: '333', title: 'Story 333', url: 'https://example.com/5' },
    ];

    const results = adapter.normalizeHits(hitsWithDuplicates);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.externalId)).toEqual(['111', '222', '333']);
    expect(results[0].title).toBe('First 111');
  });

  it('allows only HTTP(S) URLs without embedded credentials', () => {
    const hits = [
      // Allowed: standard HTTPS and HTTP URLs
      { objectID: '101', title: 'Secure story', url: 'https://example.com/post' },
      { objectID: '102', title: 'HTTP story', url: 'http://example.com/post' },
      // Allowed: fallback to item URL when url is null or omitted
      { objectID: '103', title: 'Ask HN with null url', url: null },
      { objectID: '104', title: 'Ask HN with undefined url', url: undefined },
      // Disallowed: non-HTTP(S) protocols
      { objectID: '201', title: 'FTP story', url: 'ftp://files.example.com/doc' },
      { objectID: '202', title: 'Javascript URL', url: 'javascript:alert(1)' },
      { objectID: '203', title: 'File URL', url: 'file:///etc/passwd' },
      // Disallowed: embedded credentials
      { objectID: '301', title: 'With user and pass', url: 'http://user:secret@example.com/login' },
      { objectID: '302', title: 'With username only', url: 'https://admin@example.com/dashboard' },
      { objectID: '303', title: 'With password only', url: 'https://:pass@example.com/secret' },
      // Disallowed: malformed URLs
      { objectID: '401', title: 'Invalid URL string', url: 'not-a-valid-url' },
      { objectID: '402', title: 'URL is number', url: 99999 as any },
    ];

    const results = adapter.normalizeHits(hits);
    expect(results).toHaveLength(4);
    expect(results.map((r) => r.externalId)).toEqual(['101', '102', '103', '104']);
    expect(results[0].url).toBe('https://example.com/post');
    expect(results[1].url).toBe('http://example.com/post');
    expect(results[2].url).toBe('https://news.ycombinator.com/item?id=103');
    expect(results[3].url).toBe('https://news.ycombinator.com/item?id=104');
  });

  it('bounds text lengths for title and text', () => {
    const longTitle = 'T'.repeat(2_500);
    const longComment = 'C'.repeat(30_000);

    const hit = {
      objectID: '777',
      story_title: longTitle,
      comment_text: longComment,
    };

    const [post] = adapter.normalizeHits([hit]);
    expect(post).toBeDefined();
    expect(post.title.length).toBe(HnAlgoliaAdapter.MAX_TITLE_LENGTH);
    expect(post.title.length).toBeLessThanOrEqual(1_000);
    expect(post.text.length).toBe(HnAlgoliaAdapter.MAX_TEXT_LENGTH);
    expect(post.text.length).toBeLessThanOrEqual(20_000);
  });

  it('does not invent missing authors or dates', () => {
    const hitsWithMissingMeta = [
      {
        objectID: '801',
        title: 'Story Without Meta',
        url: 'https://example.com/1',
        author: null,
        created_at: null,
      },
      {
        objectID: '802',
        title: 'Story With Undefined Meta',
        url: 'https://example.com/2',
        author: undefined,
        created_at: undefined,
      },
      {
        objectID: '803',
        title: 'Story With Invalid Date',
        url: 'https://example.com/3',
        author: 'validuser',
        created_at: 'completely-invalid-date-string',
      },
      {
        objectID: '804',
        title: 'Story With Valid Meta',
        url: 'https://example.com/4',
        author: 'realauthor',
        created_at: '2026-11-22T10:00:00Z',
      },
    ];

    const results = adapter.normalizeHits(hitsWithMissingMeta);
    expect(results).toHaveLength(4);

    expect(results[0].author).toBe('');
    expect(results[0].postedAt).toBe('');

    expect(results[1].author).toBe('');
    expect(results[1].postedAt).toBe('');

    expect(results[2].author).toBe('validuser');
    expect(results[2].postedAt).toBe('');

    expect(results[3].author).toBe('realauthor');
    expect(results[3].postedAt).toBe('2026-11-22T10:00:00Z');
  });
});
