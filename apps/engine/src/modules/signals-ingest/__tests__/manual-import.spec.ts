import { describe, expect, it } from 'vitest';
import { ManualImportAdapter } from '../sources/manual-import.adapter';

describe('ManualImportAdapter', () => {
  const adapter = new ManualImportAdapter();

  it('parses a JSON array of user-selected items', () => {
    const posts = adapter.parse(JSON.stringify([{ title: 'T', text: 'looking for help', url: 'https://example.com/1' }]));
    expect(posts).toHaveLength(1);
    expect(posts[0].source).toBe('manual');
    expect(posts[0].url).toBe('https://example.com/1');
  });

  it('parses pipe lines as url | title | text', () => {
    const posts = adapter.parse('https://example.com/2 | Need a tool | our support inbox is overflowing');
    expect(posts[0].text).toContain('overflowing');
  });

  it('produces deterministic ids and rejects empty/invalid input', () => {
    const a = adapter.parse('https://x.test | t | same text')[0].externalId;
    const b = adapter.parse('https://x.test | t | same text')[0].externalId;
    expect(a).toBe(b);
    expect(() => adapter.parse('')).toThrow(/empty/);
    expect(() => adapter.parse('no pipes here')).toThrow(/line 1/);
  });
});
