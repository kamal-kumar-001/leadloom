# Date-aware public HN discovery, v92

Checked 2026-11-23 IST. Source checkpoint only, not a deployment or marketing launch.

## Change

The existing explicitly scoped, operator-default-off public HN search supports an optional `postedAfter` ISO timestamp and `sort` of `relevance` or `recent`. The downloaded customer CLI adds `project-hn search-file <JSON-file>`; legacy `project-hn search <query>` stays all-time relevance.

The strict file contains only `query`, optional `postedAfter`, and optional `sort`. Project identity remains bound to the credential. The exact `project:research:search` permission is required; stored-research, context and wildcard scopes do not authorize public queries. Queries must contain only public, non-secret problem terms.

Newest-first mode uses the existing public HN Algolia adapter and fixed `/api/v1/search_by_date` destination. The selected cutoff becomes a `created_at_i` numeric filter and is also enforced locally. Future cutoffs fail before rate-store or upstream access. Missing, invalid/non-ISO, older-than-cutoff and future post timestamps are not labeled current. Without a cutoff, unknown dates remain explicitly null. Recent results are locally ordered.

Responses echo the exact selected filters and explain bounded coverage with `complete:false`. Counts describe normalized posts considered by the service, not every raw upstream hit. At most ten posts return, with no pagination, fallback query, retry or automatic persistence. The CLI checks filter echoes, bounded coverage arithmetic, dates and ordering before presenting success.

No scope, rate or egress boundary was widened: six queries/minute/workspace and sixty/minute across the deployment through the mandatory shared store; per-process concurrency remains one/workspace and two total. The fixed-destination reader retains byte/time bounds, no redirects, no cookies or credentials, and no automatic polling. HN generated replies and posting remain refused under v90 policy.

## Verification

- Contracts: 37 tests passed.
- Signals: 60 tests passed, one opt-in native test skipped. Includes exact fractional cutoff, offset handling, missing/impossible/non-ISO/future dates, invalid cutoff with no rate-store/upstream calls, fixed-destination protection and prior HN policy tests.
- Web: 272 tests passed, including an actual generated-CLI subprocess test with valid offset input and deliberately altered filter/coverage/date/order responses.
- Engine production compilation passed. Clean standalone web TypeScript checking passed.
- Next production compile/generate stages passed separately with `--no-lint`, after explicit type checking. This does not diagnose or fix the earlier default combined build timeout.
- `apps/web/scripts/project-hn-date-v92.synthetic.mts` exercised the actual compiled engine, standalone web, downloaded CLI, and a new uniquely named PostgreSQL16 database. A loopback upstream fixture deliberately returned old, missing-date, future and out-of-order posts. Exact filtering/order, permission/default-off, project-override refusal, zero-egress and zero-rate-use invalid future cutoff, shared limiter across engine restart, and zero saved tables/entries/assets/campaigns/jobs passed. The database was dropped afterward. No real account or upstream was used in that rehearsal.
- One separate real public request ran through the compiled reader/adapter/service, with an isolated permissive rate-store dependency. It is not a deployed gateway, authentication or account test. It returned ten date-valid comments for public query `saved reels`, with cutoff `2026-08-24T18:57:45.321Z`. The returned excerpts were largely off-topic for KeepCue. This is transport/date proof, not ten prospects, contact consent or verified demand. No second or fallback public query was made.

Observed public response URL:
https://hn.algolia.com/api/v1/search_by_date?query=saved%20reels&tags=comment&hitsPerPage=10&numericFilters=created_at_i%3E%3D1787597865

First-party endpoint/filter reference, read before implementation:
https://hn.algolia.com/api

## Remaining boundaries

Search dates do not establish relevance, buyer fit, urgency, willingness to pay, identity or consent. The customer's coding agent still selects evidence and uses the existing project profile/matching and separately scoped private write paths. Empty results do not prove no demand, and noisy results must not become a lead count. Existing DMPilot preview handoff remains preview-only; this change adds no publication, scheduling, outreach, account or credential capability. No product push, deployment, production DB mutation, spending or Mac process occurred.
