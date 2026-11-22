import { createHash, randomUUID } from 'node:crypto';
import { IncomingPost, ProductProfile } from './types';
import {assertGeneratedReplyAvailable} from '@leadloom/contracts';

/**
 * Reply-draft composer: turns a matched signal into an exact, reviewable
 * reply. Rules baked in:
 * - Every capability claim in a draft comes from SOURCED_PRODUCT_CLAIMS,
 *   taken from the product's own public pages (fetched 2026-11-19) or repo
 *   docs. These are the vendor's own marketing claims, NOT independent
 *   verification that the capability works reliably. Nothing else may be
 *   promised.
 * - A draft is text for a human to review. Approving marks review state only;
 *   there is no posting integration, so "approved" never means "posted".
 * - The approval check compares the exact body/destination/identity the
 *   reviewer saw with what is stored, so a draft cannot be silently changed
 *   and then approved.
 */

export interface SourcedClaim {
  text: string;
  sourceUrl: string;
}

export interface ProductFacts {
  productId: string;
  productUrl: string;
  /** ISO date the public pages were fetched. */
  claimsSourcedAt: string;
  claims: SourcedClaim[];
  /** Things the product cannot currently do; drafts must steer clear. */
  limitations: string[];
}

export const SOURCED_PRODUCT_CLAIMS: Record<string, ProductFacts> = {
  dmpilot: {
    productId: 'dmpilot',
    productUrl: 'https://www.dmpilot.org',
    claimsSourcedAt: '2026-11-19',
    claims: [
      { text: 'automatically sends an Instagram DM when someone comments a keyword you choose', sourceUrl: 'https://www.dmpilot.org' },
      { text: 'rotates phrasing so repeated DMs do not look like spam', sourceUrl: 'https://www.dmpilot.org' },
      { text: 'works through the official Meta Graph API', sourceUrl: 'https://www.dmpilot.org' },
      { text: 'can auto-reply publicly to matching comments', sourceUrl: 'https://www.dmpilot.org' },
    ],
    limitations: [
      'Meta Ads delivery is not connected; boost plans are drafts only',
      'Instagram only, no other social networks',
    ],
  },
  feefree: {
    productId: 'feefree',
    productUrl: 'https://feefree.dmpilot.org',
    claimsSourcedAt: '2026-11-19',
    claims: [
      { text: 'UPI checkout where money settles directly from the customer to your bank account with 0% gateway commission', sourceUrl: 'https://feefree.dmpilot.org' },
      { text: 'confirms payments by reading bank credit-alert emails over IMAP, so confirmation does not depend on the payer\'s app calling you back', sourceUrl: 'https://feefree.dmpilot.org' },
      { text: 'sends your SaaS a signed HMAC-SHA256 webhook once the bank alert is validated', sourceUrl: 'https://feefree.dmpilot.org' },
      { text: 'generates a dynamic UPI QR plus GPay/PhonePe/Paytm switchers with micro-amount offsets to tell same-amount payments apart', sourceUrl: 'https://feefree.dmpilot.org' },
    ],
    limitations: [
      'Android companion app is being rebuilt; the old APK is withdrawn',
      'Built for small merchants, in pilot',
    ],
  },
  bakerypos: {
    productId: 'bakerypos',
    productUrl: 'https://pos.dmpilot.org',
    claimsSourcedAt: '2026-11-19',
    claims: [
      { text: 'live bakehouse kitchen display so counter and kitchen stay in sync', sourceUrl: 'https://pos.dmpilot.org' },
      { text: 'batch and shelf-life tracking for baked goods', sourceUrl: 'https://pos.dmpilot.org' },
      { text: 'weighable item billing for items sold by weight', sourceUrl: 'https://pos.dmpilot.org' },
      { text: 'automated WhatsApp receipts', sourceUrl: 'https://pos.dmpilot.org' },
      { text: 'offline-first, so billing keeps working when the internet drops', sourceUrl: 'https://pos.dmpilot.org' },
    ],
    limitations: ['Aimed at bakeries and cafes, not general retail'],
  },
  leadloom: {
    productId: 'leadloom',
    productUrl: 'https://leadloom.dmpilot.org',
    claimsSourcedAt: '2026-11-19',
    claims: [
      { text: 'finds people publicly describing the problem your product solves and drafts a reply you approve before anything is posted', sourceUrl: 'https://leadloom.dmpilot.org' },
    ],
    limitations: ['In build; early access only'],
  },
};

export type DraftStatus = 'pending' | 'approved' | 'rejected';

export interface ReplyDraft {
  id: string;
  signalKey: string;
  productId: string;
  destinationUrl: string;
  /** null = no posting account connected; shown to the reviewer as such. */
  identity: string | null;
  body: string;
  claimsUsed: string[];
  status: DraftStatus;
  statusNote: string;
  createdAt: string;
  decidedAt: string | null;
}

function fingerprint(body: string, destinationUrl: string, identity: string | null): string {
  return createHash('sha256').update(`${body}${destinationUrl}${identity ?? ''}`).digest('hex');
}

export function composeReplyBody(post: IncomingPost, facts: ProductFacts, maxClaims = 3): { body: string; claimsUsed: string[] } {
  assertGeneratedReplyAvailable(post);
  const problem = (post.title || post.text).replace(/\s+/g, ' ').trim().slice(0, 140);
  const picked = facts.claims.slice(0, maxClaims);
  const claimLines = picked.map((c) => `- ${c.text}`);
  const body = [
    `Saw your post about "${problem}".`,
    '',
    `I work on ${facts.productId === 'dmpilot' ? 'DMPilot' : facts.productId === 'feefree' ? 'FeeFree' : facts.productId === 'bakerypos' ? 'BakeryPOS' : 'Leadloom'}, which might fit:`,
    ...claimLines,
    '',
    `Details: ${facts.productUrl}`,
    '',
    'Happy to answer questions here or in DM.',
  ].join('\n');
  return { body, claimsUsed: picked.map((c) => c.text) };
}

export class ReplyDraftStore {
  /**
   * Session-only store for ONE owner (authenticated user). Memory of one
   * server instance, gone on restart. No DB. Tenant isolation is structural:
   * each owner gets their own store via DraftStoreRegistry, so no method
   * here ever touches another owner's drafts.
   */
  private drafts = new Map<string, ReplyDraft>();
  private fingerprints = new Map<string, string>();

  create(post: IncomingPost, profile: ProductProfile): ReplyDraft {
    assertGeneratedReplyAvailable(post);
    const facts = SOURCED_PRODUCT_CLAIMS[profile.productId];
    if (!facts) throw new Error(`No sourced claims on file for ${profile.productId}; refusing to draft.`);
    const signalKey = `${post.source}:${post.externalId}:${profile.productId}`;
    const existing = Array.from(this.drafts.values()).find((d) => d.signalKey === signalKey);
    if (existing) return existing;
    const { body, claimsUsed } = composeReplyBody(post, facts);
    const draft: ReplyDraft = {
      id: randomUUID(),
      signalKey,
      productId: profile.productId,
      destinationUrl: post.url,
      identity: null,
      body,
      claimsUsed,
      status: 'pending',
      statusNote: 'awaiting review',
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    this.drafts.set(draft.id, draft);
    this.fingerprints.set(draft.id, fingerprint(body, draft.destinationUrl, draft.identity));
    return draft;
  }

  get(id: string): ReplyDraft | null {
    return this.drafts.get(id) ?? null;
  }

  list(): ReplyDraft[] {
    return Array.from(this.drafts.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Record a review decision. The reviewed values must be byte-identical to
   * the stored draft, so nobody can approve text they did not see.
   */
  decide(
    id: string,
    decision: 'approved' | 'rejected',
    reviewed: { body: string; destinationUrl: string; identity: string | null },
  ): ReplyDraft {
    const draft = this.drafts.get(id);
    if (!draft) throw new Error('Draft not found (session-only store resets on restart).');
    if (decision === 'approved') assertGeneratedReplyAvailable({source:draft.signalKey.startsWith('hackernews:')?'hackernews':'manual',url:draft.destinationUrl});
    if (draft.status !== 'pending') throw new Error(`Draft already ${draft.status}.`);
    if (fingerprint(reviewed.body, reviewed.destinationUrl, reviewed.identity) !== this.fingerprints.get(id)) {
      throw new Error('Reviewed content does not match the stored draft; refusing decision.');
    }
    draft.status = decision;
    draft.decidedAt = new Date().toISOString();
    draft.statusNote =
      decision === 'approved'
        ? 'reviewed and approved - NOT posted (no posting integration connected); review-only, NOT authorization to post later under any identity'
        : 'rejected by reviewer';
    return draft;
  }

  clear(): void {
    this.drafts.clear();
    this.fingerprints.clear();
  }
}

/**
 * Structural tenant isolation for the session-only draft store: one
 * ReplyDraftStore per authenticated owner key (email). Instance-only, gone
 * on restart. There is deliberately no cross-owner read path.
 */
export class DraftStoreRegistry {
  private stores = new Map<string, ReplyDraftStore>();

  forUser(ownerKey: string): ReplyDraftStore {
    const key = ownerKey.trim().toLowerCase();
    if (!key) throw new Error('owner key required');
    let store = this.stores.get(key);
    if (!store) {
      store = new ReplyDraftStore();
      this.stores.set(key, store);
    }
    return store;
  }

  /** Test/maintenance helper: number of distinct owners seen. */
  ownerCount(): number {
    return this.stores.size;
  }

  clear(): void {
    this.stores.clear();
  }
}
