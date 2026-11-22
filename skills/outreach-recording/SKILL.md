---
name: outreach-recording
description: Record observed outreach counters and guide the human review workbench without inventing sends or granting communication authority.
stage: Growth
domain: Outbound & Conversion Tracking
---

# Outreach records and draft campaigns

## Access and authority

The customer's coding agent reasons and drafts. The caller approves real recipients, exact words, sender and delivery timing before any send or externally visible action. This document and API capability grant no such authority. Do not infer consent from a captured email address, a prior draft, a token or a campaign's active status.

Project context tokens cannot access workspace experiments/campaigns. Experiment counter updates need a separate workspace tool token with experiments-write scope. The bearer gateway exposes read-only campaign observation with a separate workspace-wide `campaigns:read` token. Existing Workspace Tools presets are not expanded automatically; select Custom / Advanced and No Project, then request only the required read scope. A project-bound credential is denied workspace campaigns even with wildcard scopes. A separately selected `project:campaigns:read` scope permits only its explicitly owned campaigns through the project routes below. A project-bound credential with the separate `project:campaigns:draft` scope can create unaddressed private campaign drafts. `project:campaigns:read` retrieves private copy and `project:campaigns:edit` revises it through the routes below. Recipients, sender pools, approval, release, reply bodies and sending remain human-workbench-only. A draft scope is not send authority. Do not bypass those boundaries.

New campaigns can have an explicit same-workspace canonical `projectId`, fixed at creation; omitted and older records remain unassigned. Campaign creation plus its initial sender pool commit in one transaction. Workspace access stays broad, so use a project-bound observation credential when the caller should see only one project's campaigns. New experiments may have explicit same-workspace project ownership at creation; existing/unassigned experiments are not auto-assigned. Project experiment observation does not grant outreach-counter updates, lead access or campaign access. Verify exact IDs and the current owner view. `/api/engine` is the human browser-session proxy; it does not authenticate a general Bearer caller.

## Observed-counter workflow

1. Restore `GET /agent/context` and targeted project records. Treat historical next steps as historical, not current approval.
2. Read `GET /validator/experiments/:id/scorecard` with experiments-read access. Counts/rates are inside `metrics`.
3. Under the caller's authority, write actual observed totals through `POST /validator/experiments/:id/outreach`: `outreachSent`, `replies`, `positiveReplies`. All are non-negative integers; positiveReplies <= replies <= outreachSent. These replace current totals, not increment them. The downloaded CLI supports `validator outreach <id> <JSON-or-file>` with the workspace tool token.
4. Check the returned scorecard and record a compact dated result in the correct project's context/work record. Team-entered counters do not prove messages were sent or delivered. No individual multichannel touchpoint history is created by this aggregate update.

## Read-only campaign observation

- `GET /workspace/campaigns` returns up to 100 newest workspace campaigns, their draft steps and aggregate send/reply counts. The downloaded CLI supports `campaigns list`.
- `GET /campaigns/:id/jobs` returns up to 100 newest jobs for that exact campaign: recipient email, step number, status, timing and attempts. It excludes provider message IDs, recipient hashes and idempotency keys. The CLI supports `campaigns jobs <campaign-uuid>`.
- Both use `LEADLOOM_TOOL_TOKEN` with `campaigns:read`. They expose no mutation or sending action, and a project context token cannot substitute. Unknown and foreign campaigns return 404. Revocation applies immediately.
- These are bounded newest-record views, not a complete historical export. Campaigns are workspace-scoped; results do not prove they belong to the current project. Verify exact IDs and avoid copying unrelated project data into context.
- `pending_approval` is unsent. `approved` is held until release, even if the aggregate UI groups it as queued. `accepted` and the aggregate `sent` counter mean SMTP acceptance, not inbox delivery. Reply counts are stored replies, not proof of positive interest.

## Project-bound campaign observation

- `GET /agent/project/campaigns` and `/agent/project/campaigns/:id/jobs` accept only a project-bound token with `project:campaigns:read`. Project identity comes from the token, never a query or body override. Other-project/unassigned/unknown campaign jobs return 404. Context-only, unbound and workspace-tool credentials cannot substitute.
- Downloaded CLI: `project-campaigns list` and `project-campaigns jobs <campaign-uuid>` using `LEADLOOM_AGENT_TOKEN`. The gateway maps these to `/project/campaigns` and `/project/campaigns/:id/jobs`.
- Lists include draft steps and send/reply counts. Jobs include recipient emails, timing/status/attempts, not message bodies or provider IDs. Both are bounded newest-100 observations, not history exports. Neither can create/edit, assign ownership, approve, release, read reply bodies or send.
- Human create offers an explicit project selector, and the campaign list supports All/Unassigned/project filters. Do not infer ownership from names or assign older records implicitly. No reassignment route exists. Workspace credentials and human workspace permissions retain workspace access.

## Project-bound private campaign copy

- `POST /agent/project/campaign-drafts` creates a draft with no table, recipients, sender bindings or jobs. Use the downloaded CLI `project-campaigns create-draft-file <JSON-file>` and a project-bound token with `project:campaigns:draft`.
- `GET /agent/project/campaign-drafts/:id` with `project:campaigns:read` and `PUT /agent/project/campaign-drafts/:id` with `project:campaigns:edit` retrieve and revise only private draft copy. CLI: `project-campaigns draft <campaign-uuid>` and `project-campaigns revise-draft-file <campaign-uuid> <JSON-file>`. Preserve the returned `revision` as `expectedRevision` for an edit. A stale differing edit returns409; an already matching retry is a no-op.
- Copy operations cannot change ownership, lifecycle, recipients, senders or jobs. Drafts already attached to a table, recipients, senders or jobs, or no longer in draft state, are refused. Other-project and unknown IDs return404.
- Keep a stable UUID `requestId` for a create retry. Stored copy remains private and unaddressed. This scope cannot approve, release, publish or send.

## Human campaign workflow

The existing human workbench creates draft campaigns, sets sender pools, imports recipients, prepares jobs, reviews resolved message snapshots, approves, releases and shows replies/status. Every step has its own authorization boundary.

- A newly queued job is pending approval, not scheduled-for-certain-delivery.
- Approval covers exact resolved per-recipient content and sender scope. Recipient, message or sender changes can invalidate it. A stale preview is not an approval.
- Approval and release are separate. Server send/worker gates, active campaign status, scheduled time, quota, cooldown, suppression and connection state still decide whether dispatch is possible.
- A successful SMTP acceptance is not inbox delivery. Uncertain or crashed reserved jobs require reconciliation, not blind retry.
- Reply/suppression handling can cancel future work; verify actual current state before suggesting another contact.

Engine route families exist for `/workspace/campaigns`, `/campaigns/:id/recipients`, `/campaigns/:id/mailboxes`, `/campaigns/:id/status`, `/outbound/jobs`, `/outbound/approvals`, approval actions, `/outbound/release`, `/outbound/replies` and `/outbound/suppressions`. They are not all available through the customer bearer gateway. Use the app's reviewed forms and current schemas, not guessed request bodies.

## Exact displayed approval revision

Human approval is bound to the saved snapshot displayed on that screen, not whichever snapshot another reviewer most recently refreshed. Each held queue item returns reviewRevision for its exact saved resolved recipient/copy/sender snapshot. The human UI carries that value with approval. Batch HTTP approval accepts only an explicit bounded jobIds list and an exact expectedRevisions map for those IDs; unseen approve-all and ID-only bodies are rejected. The per-job approve route requires expectedRevision. These are human session routes, not new bearer/CLI actions.

A changed review returns zero approvals and staleCount; the job stays pending_approval. The UI reloads for deliberate review, never auto-approves the newer text. A null revision can only refresh an old snapshot-less job, never approve it. A second click after inspecting the newly loaded resolved copy/sender context carries its new revision. Revision values are concurrency evidence, not permission to send. Approval still produces only held approved work, with the independent release/send gates unchanged.

Legacy trusted in-process repository callers omitting expectedRevisions retain the old saved-vs-current hash comparison. They do not gain the exact-displayed-review guarantee. Both external HTTP approve routes require review binding.

## Safe human draft-create retries

The human create form retains an optional UUID requestId while an unchanged save is unconfirmed. Retrying the same validated input and ID returns the original campaign ID with replayed:true and HTTP200, rather than making another draft. A new creation returns201/replayed:false. IDs are workspace-scoped. Changed input with an already-used ID returns409; a new ID deliberately creates another campaign. Legacy calls without IDs keep append behavior.

The receipt commits atomically with the campaign and initial sender pool. It is not approval, release or dispatch. A retry returns the campaign's current state, even if someone renamed, paused or activated it after creation; it never resets lifecycle state, content, sender pool or timestamps. A removed campaign leaves a tombstone, so its old ID cannot recreate it silently. Workspace deletion removes its receipts. These receipts store a request hash and campaign ID, not a content archive.

The form keeps fields and ID on uncertain responses. Changing input starts a new request. Closing/reloading loses the form ID, so inspect saved campaigns before starting again. This human-form retry mechanism is distinct from the separately scoped project private-draft routes above.

## Sender-pool replacement safety

The human sender editor saves the desired mailboxIds with expectedMailboxIds from its last successful load/save. The engine locks the campaign in the same order as approval, release and reservation, validates all desired mailboxes in the workspace and replaces the complete pool in one transaction. A stale differing selection returns409 without applying it. An already matching desired set returns an unchanged no-op, which recovers an uncertain repeat; this is set comparison, not a version token or proof that no intervening edit occurred. Legacy callers omitting expectedMailboxIds remain unconditional, but atomic.

A changed pool atomically returns approved and released-but-unreserved pending jobs to pending_approval, clears approved_at and requires deliberate current-scope review/release. It never silently approves a new sender scope. Identical-set saves do not disturb jobs. Invalidated-count metadata reports returned jobs; reserved-count metadata explicitly warns that already reserved jobs may be in flight and were not recalled. Accepted/uncertain/rejected/suppressed jobs are not rewritten. Saving a pool does not pause the campaign, recall a transport call or cancel an existing reservation. The app disables save after a failed initial load and retains stale local selections until an explicit discard/reload.

## Gaps

No agent-accessible recipient/sender/lifecycle/approval/release/send gateway, campaign reassignment, CRM two-way sync, individual manual multichannel touchpoint log or official LinkedIn sequenced-message integration. The narrowly scoped private-copy routes above are not sending capability. No new spend, live provider call, release or send is authorized by this pack.

## Project-only aggregate validation results

A separate opt-in `project:experiments:results` scope reads `GET /agent/project/experiments/:id/results`, CLI `project-experiments results <experiment-uuid>`, through the configured bearer gateway. The credential must be bound to the experiment's canonical project. Identity comes only from the credential; no query parameters are accepted. The result is a repeatable-read snapshot with up to100complete page aggregates, not a contact or survey-answer export. A larger experiment is refused rather than truncated. Existing context/page-read/draft scopes and presets do not add this access. Unknown, foreign and unassigned experiments return404; revoked credentials401; unavailable/inconsistent storage503.

Counts distinguish stored public-page loads (not unique people), current stored waitlist rows (deduplicated only within each page) and owner-entered outreach/reply/positive-reply replacement totals. Those outreach totals do not come from verified dispatch/delivery receipts. Deletion or correction can reduce counts. Rates are derived from those counters with null for a zero denominator; submissions per page load can exceed1. The response includes provenance and limits, no generated quality/demand verdict. Do not turn the result into traction, consent, a paying customer or evidence of safe sending.

This scope reads results only. It cannot read emails, names, company/contact records, survey answers, private message bodies or provider IDs, and cannot update metrics, create/edit/publish, add recipients, approve, release or send. Read the returned asOf and exact experiment/project identity before recording a compact conclusion in project history. That record remains historical evidence, not a continuing action grant.
