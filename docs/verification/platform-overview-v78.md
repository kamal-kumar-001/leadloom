# v78: read-only platform overview

## What changed

The platform operator overview now reads stored metadata instead of displaying invented tenant records, metrics or audit activity. The customer coding agent still reasons and calls Leadloom; Leadloom does not control that agent.

`GET /admin/overview` requires the designated configured platform identity and a current active, verified database account. The server-rendered operator layout repeats the current-account check through `/admin/verify`. Missing or failed identity storage returns unavailable rather than falling back to a non-database identity decision. Default identity configuration remains empty. No live identity was selected or configured.

The response includes a snapshot time, six global record counts and at most 25 workspace metadata rows: workspace ID/name, stored plan key, access flag, creation time and member/project/campaign counts. Totals stay global when name search is applied. Search is literal, case-insensitive and parameterized. Strict query validation rejects unknown fields. The keyset cursor is canonical, bound to the exact search and preserves native microsecond timestamps plus UUID ordering.

A repeatable-read transaction keeps each response internally consistent. Pagination is not a frozen multi-page snapshot; changes between reads can change subsequent pages. Responses are uncached. No user emails, project bodies, contacts, credentials, recipient addresses, audit events or job message content are returned.

The browser uses manual refresh, bounded pages, a 10-second request timeout, aborts and generation fencing. Loading or failure removes the old snapshot, counts and table. Delayed responses cannot replace a newer search. The page labels counts as stored records, plans as stored labels and active status as an access flag.

Tenant mutation, subscription billing, global audit events and key operations remain unsupported. Record counts are not readiness, demand, revenue, provider health, permission to act or delivery proof.

## Verification

- Engine: 804 unique passing cases across 147 files. Three shards ran with native PostgreSQL gates enabled; 14 mail-fixture cases initially gated off were then run with the local SMTP/IMAP fixture dependency, giving 21 passes across the five overlapping files. One pre-existing inactive-gate marker remains skipped, not an untested native scenario. Do not sum overlapping passes as extra cases.
- Web: 134 cases across 28 files.
- Contracts: 16 cases across 7 files.
- Database: 19 cases across 2 files.
- Node operational tests: 14 passes.
- Focused overview contracts/service/routes: 16 cases across 3 files, repeated after final text changes.
- Engine and web build successfully from the clean dependency tree. Existing installed dependencies were reused; no new clean-install claim.
- Actual compiled API and standalone web pass empty/default, matching and wrong-identity configuration cases.
- Actual PostgreSQL overview proof returns all 27 owned fixtures in 25+2 pages at the same microsecond timestamp, exact current global counts, strict query/cursor refusal and no private emails/project bodies.
- Actual browser proof covers search, next/previous pages, no timer polling, failure clearing, delayed-response fencing and disabled-account denial in both API and server layout. Browser requests stayed local; fixture reads created no campaigns or outbound jobs. Owned overview fixtures were removed in cleanup.
- Actual rebuilt KeepCue customer CLI/browser journey passes private typed assets, immutable launch-copy versions, source limits, targeted context, restart recovery, project boundaries, revocation, frozen zero-evidence growth review and saved discovery-profile use. Its two discovery inputs are synthetic, not real leads or demand. Disposable KeepCue storage is removed, not retained as a production workspace.
- A fresh native bootstrap applies 40 migrations with pgvector 0.8.7. The current compiled broad application/browser journey passes, including workspace features, project inventory/history, customer CLI, authored-copy/approval controls and matching health identities with fail-closed unavailable/mixed-engine states.
- Inspected actual overview and unavailable-state screenshots. Counts/table are readable and the failed state removes the previous data.

## Preserved failed attempts

The initial root-level engine shard omitted integration opt-ins and is retained as `engine-first-ungated`, not full coverage. Native-gated shards plus the separate local mail-fixture run supersede it.

A post-rebuild standalone browser run initially failed because the local rehearsal had not staged Next static assets. The supplied Dockerfile already copies those assets. After staging `.next/static` and `public` in the standalone tree to match that layout, the actual compiled browser proof passed. The failed log is retained as `platform-before-static-staging`. No product failure was hidden by weakening an assertion.

## Delivery and limits

The complete-source archive, cumulative overlay, per-file manifests and verification evidence accompany this checkpoint. Source bytes match the clean build tree. Generated build identities are checked independently after archive extraction. Dependency manifests, lockfile and migrations are unchanged from v77.

All new execution stayed on disposable local storage. No lab changes, push, deploy, account creation, provider call, paid action, external post, recipient outreach or production migration occurred. KeepCue remains an app-first private scenario; posts and outreach are drafts for review. This is not Docker/container execution, live OAuth/provider validation, a production readiness claim or proof of a completed product.
