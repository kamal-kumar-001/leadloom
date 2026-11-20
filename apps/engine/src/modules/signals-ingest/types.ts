/**
 * Signals-ingest module: bounded discovery + matching slice for Leadloom's
 * distribution direction (find people describing problems our products solve,
 * draft a useful reply, track outcomes). Human-approved posting only; this
 * module never posts anywhere.
 *
 * Sources are deliberately narrow:
 * - 'hackernews': the documented public HN Algolia search API.
 * - 'manual': content the user personally selected and is permitted to use
 *   (e.g. a thread they opened and chose to import). Not a scrape/export path.
 */

export type SignalSourceId = 'hackernews' | 'manual';

export interface IncomingPost {
  source: SignalSourceId;
  /** Stable identifier within the source, used for dedupe. */
  externalId: string;
  /** Story title, or the parent story's title for comments. May be ''. */
  title: string;
  /** Body text of the post/comment. May be ''. */
  text: string;
  /** Canonical link a human can open. */
  url: string;
  author: string;
  /** ISO-8601 timestamp, or '' when unknown. */
  postedAt: string;
}

export interface ProductProfile {
  productId: string;
  displayName: string;
  /** Multi-word problem statements, matched as case-insensitive phrases. */
  problemPhrases: string[];
  /** Single terms, matched on word boundaries so "reach" never hits "reached". */
  keywords: string[];
}

export interface MatchedSignal {
  post: IncomingPost;
  productId: string;
  /** 0..1, deterministic and explainable from matchedTerms. */
  score: number;
  matchedTerms: string[];
}
