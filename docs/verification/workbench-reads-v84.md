# v84: current project-workbench reads and exact save receipts

## What changed

The customer coding agent still reasons and calls Leadloom. This checkpoint repairs the human project workbench's targeted reads and acknowledgement handling. It adds no backend capability, permission, provider call, publication or send.

Actual compiled v83 reproduction found the same race in two editors. A private asset or work-record entry was committed through the web proxy and native API while its acknowledgement was held. A newer draft search or history kind filter was then applied. Releasing the successful save made its older callback reload its earlier unfiltered scope. The screen still said draft search Needle or history kind research while showing unrelated records.

A shared read epoch now owns the current query and kind. Every reload, including one requested by an old save callback, captures that current scope. Older responses, scope round trips and unmounted callbacks cannot replace a newer read. The editor target is separate from the list search, and both applied read scope and saved editor target are named on screen.

Draft pages validate bounded summary shapes, exact project ownership, duplicate IDs and forward offset progression. Entry pages and detail reads reuse the existing strict work-history checks. Full draft bodies enter the editor only after exact project, ID and requested-version checks. A latest-version request cannot load a response that identifies itself as historical. Invalid or failed list reads are unavailable, not empty, and keep local editor words.

Asset offset pagination is still a changing live read, not a frozen snapshot. If a concurrent revision shifts a previously loaded draft into a later page, the client refuses the overlapping page, clears the mixed list and asks for reload. It does not silently duplicate records or retarget the editor. A manual draft-list reload is available without clearing editor words.

Save acknowledgements are checked against the submitted project, target, kind, words and version before clearing local text or claiming success. Unknown or mismatched acknowledgements keep the exact retry request and words. A 15-second wait limit is not cancellation of server work. A committed operation can still need an exact retry to recover its receipt. New local edits clear an old success notice and are explicitly not confirmed saved.

## Current verification

- Full web suite: 202 passing cases across 34 files, including 14 new scope, normalizer, exact-receipt and bounded-wait cases.
- Engine and standalone web builds pass. Existing installed dependencies were reused, not newly installed.
- Actual final compiled/native/browser proof holds committed asset and history proxy acknowledgements, changes the search or kind filter, then releases them. Each list keeps only the matching record. The saved editor target remains distinct from the list filter.
- Malformed draft-list metadata clears the list, reports unavailable rather than no matching records, and retains unsaved editor words and target.
- A native asset revision commits, but its acknowledgement is deliberately made unverifiable. The editor keeps its words and exact retry request. Retrying recovers version two with exactly two stored versions, not an extra third version.
- A native history append commits with an unverifiable acknowledgement. Its whitespace-bearing local words remain. An exact retry uses the server contract's trim rules and leaves one stored entry, not a duplicate.
- Fourteen native assets are paged while one older fixture is revised concurrently. The shifted overlapping page is refused. Reload followed by stable paging returns all 14 unique assets. Editor words remain unchanged throughout.
- This driver makes six explicit browser fixture writes and no outside requests. Other asset/history fixture seeds and the concurrent revision use the private native API. Owned workspaces are removed during cleanup. These are not external sends or real-user account changes.
- Current draft-search, kind-filter and unavailable-list pixels were inspected. The complete editor target, applied scope, matching rows, local-unsaved warning and retained words are readable.
- Fresh native bootstrap reaches 40 migrations with pgvector 0.8.7. Current compiled broad application/customer CLI/browser, private KeepCue, stored dashboard records, read-only operator overview, Projects credential concurrency, configured customer setup, work-history/campaign-attention and provider-key selection journeys all pass. Matching compiled identities and unavailable/mixed-engine health checks pass.

Engine implementation is unchanged from v83 apart from generated identity. Its 806 passing cases across 148 files, with one existing inactive-gate marker, are carried from the v83 native/PostgreSQL/local SMTP/IMAP matrix, not rerun here. Contracts 16/7, database 19/2 and Node operational 14 are carried from v78. Dependencies, lockfile, migrations, credential presets and authorization are unchanged.

## Limits

This is private source and disposable-runtime verification, not production sign-in, deployment, provider connectivity, a complete-product or readiness claim. Search is not a frozen multi-page snapshot. Local editor words and exact retry IDs are not autosaved across page reload or project switching; the UI states that limit. A new save after changing words is a new request, not cancellation of an earlier uncertain save. This checkpoint does not add automatic project execution or control the customer coding agent.

KeepCue remains private and draft-only with synthetic discovery inputs and no proved demand. No remote server, repository, account, provider, spending or sending change was made. Existing live-effect gates remain.
