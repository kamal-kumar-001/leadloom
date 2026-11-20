import { describe, expect, it } from 'vitest';
import { composeReplyBody, DraftStoreRegistry, ReplyDraftStore, SOURCED_PRODUCT_CLAIMS } from '../reply-drafts';
import { PRODUCT_PROFILES } from '../product-profiles.seed';
import { IncomingPost } from '../types';

const post = (over: Partial<IncomingPost> = {}): IncomingPost => ({
  source: 'manual',
  externalId: 'p1',
  title: 'Looking for a UPI payment gateway',
  text: 'Need confirmation without depending on the payer app callback.',
  url: 'https://example.com/post/1',
  author: 'someone',
  postedAt: '2026-11-18T09:30:00Z',
  ...over,
});
const feefree = PRODUCT_PROFILES.find((p) => p.productId === 'feefree')!;
const facts = SOURCED_PRODUCT_CLAIMS.feefree;

describe('composeReplyBody', () => {
  const { body, claimsUsed } = composeReplyBody(post(), facts);

  it('quotes the poster’s own problem', () => {
    expect(body).toContain('Looking for a UPI payment gateway');
  });

  it('only uses claims from the verified list, each traceable to a source URL', () => {
    for (const claim of claimsUsed) {
      const found = facts.claims.find((c) => c.text === claim);
      expect(found, claim).toBeDefined();
      expect(found!.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  it('never states known limitations as capabilities', () => {
    expect(body).not.toMatch(/android app/i);
    expect(body).not.toMatch(/escrow/i);
    expect(body).not.toContain('guaranteed');
  });

  it('links the product site', () => {
    expect(body).toContain(facts.productUrl);
  });
});

describe('ReplyDraftStore', () => {
  it('creates one draft per signal+product and dedupes repeats', () => {
    const store = new ReplyDraftStore();
    const a = store.create(post(), feefree);
    const b = store.create(post(), feefree);
    expect(b.id).toBe(a.id);
    expect(store.list()).toHaveLength(1);
  });

  it('records identity as null (no posting account connected)', () => {
    const store = new ReplyDraftStore();
    expect(store.create(post(), feefree).identity).toBeNull();
  });

  it('approves only when reviewed values are byte-identical', () => {
    const store = new ReplyDraftStore();
    const d = store.create(post(), feefree);
    expect(() =>
      store.decide(d.id, 'approved', { body: d.body.replace('UPI', 'UPI!!'), destinationUrl: d.destinationUrl, identity: null }),
    ).toThrow(/does not match/);
    expect(() =>
      store.decide(d.id, 'approved', { body: d.body, destinationUrl: 'https://evil.example/x', identity: null }),
    ).toThrow(/does not match/);
    const ok = store.decide(d.id, 'approved', { body: d.body, destinationUrl: d.destinationUrl, identity: d.identity });
    expect(ok.status).toBe('approved');
    expect(ok.statusNote).toMatch(/NOT posted/);
  });

  it('rejects double decisions', () => {
    const store = new ReplyDraftStore();
    const d = store.create(post(), feefree);
    store.decide(d.id, 'rejected', { body: d.body, destinationUrl: d.destinationUrl, identity: null });
    expect(() =>
      store.decide(d.id, 'approved', { body: d.body, destinationUrl: d.destinationUrl, identity: null }),
    ).toThrow(/already rejected/);
  });

  it('refuses to draft for a product without verified claims', () => {
    const store = new ReplyDraftStore();
    expect(() => store.create(post(), { ...feefree, productId: 'unknown-product' })).toThrow(/No sourced claims/);
  });
});

describe('DraftStoreRegistry tenant isolation', () => {
  const dmpilot = PRODUCT_PROFILES.find((p) => p.productId === 'dmpilot')!;
  const alicePost = post({ externalId: 'a1', url: 'https://example.com/alice-post' });

  it('one owner cannot list another owner\'s drafts', () => {
    const reg = new DraftStoreRegistry();
    reg.forUser('alice@example.com').create(alicePost, dmpilot);
    expect(reg.forUser('alice@example.com').list()).toHaveLength(1);
    expect(reg.forUser('bob@example.com').list()).toHaveLength(0);
    expect(reg.ownerCount()).toBe(2);
  });

  it('one owner cannot decide on another owner\'s draft id', () => {
    const reg = new DraftStoreRegistry();
    const draft = reg.forUser('alice@example.com').create(alicePost, dmpilot);
    expect(() =>
      reg.forUser('bob@example.com').decide(draft.id, 'approved', {
        body: draft.body,
        destinationUrl: draft.destinationUrl,
        identity: draft.identity,
      }),
    ).toThrow(/not found/i);
    expect(reg.forUser('alice@example.com').get(draft.id)!.status).toBe('pending');
  });

  it('dedupe is per-owner: same signal+product creates one draft each, not a shared one', () => {
    const reg = new DraftStoreRegistry();
    const a1 = reg.forUser('alice@example.com').create(alicePost, dmpilot);
    const a2 = reg.forUser('alice@example.com').create(alicePost, dmpilot);
    const b1 = reg.forUser('bob@example.com').create(alicePost, dmpilot);
    expect(a2.id).toBe(a1.id);
    expect(b1.id).not.toBe(a1.id);
  });

  it('owner keys normalize case/whitespace so aliases cannot split isolation', () => {
    const reg = new DraftStoreRegistry();
    reg.forUser('  Alice@Example.com ').create(alicePost, dmpilot);
    expect(reg.forUser('alice@example.com').list()).toHaveLength(1);
    expect(reg.ownerCount()).toBe(1);
  });
});
