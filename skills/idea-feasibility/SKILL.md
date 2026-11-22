---
name: idea-feasibility
description: Assess a founder's idea using the customer's coding agent, then store context and an unpublished validation experiment in Leadloom.
stage: Idea
domain: Idea & Validation
---

# Idea feasibility and draft validation

## When to use

Use for a new idea, pivot, hypothesis or draft smoke test. The customer's coding agent does the reasoning. Leadloom stores state and exposes deterministic tools. A heuristic score is not proof of demand or investment advice.

## Access and project boundary

The downloaded integration has separate context and workspace-tool tokens. `LEADLOOM_AGENT_TOKEN` is normally project-bound. Context-only scopes still read/write only context and work records. A separately selected `project:experiments:read` scope can list that project's explicitly owned experiments and preview their page copy, but cannot create, publish or read another project's experiments. `LEADLOOM_TOOL_TOKEN` must be workspace-scoped with matching experiments scopes for workspace operations. Context access does not grant experiment creation, publishing, outreach, spending or new-account authority.

Through the downloaded CLI, use its configured `/api/agent` gateway. Direct engine clients use Bearer tokens on the engine routes below. `/api/engine` is the human browser-session proxy, not a general bearer-token gateway. If the available token cannot perform the work, use the human workbench or request the missing scoped access. Never widen a token or fall back to another project.

New experiments may carry an explicit canonical `projectId`, enforced by a same-workspace database foreign key. Omission leaves them unassigned. Existing experiments stay unassigned; names, slugs and context references never migrate ownership. No reassignment route exists. Workspace experiments-read/write tokens still access the workspace; use the new project-bound observation scope when the agent should see only one project's experiment metadata/page copy. Separate project:research:read access can observe explicitly owned saved research; workspace research scopes remain broader. New campaigns also support explicit same-workspace project ownership and a separate read-only project:campaigns:read observation scope; neither project read scope grants campaign mutation or sending.

## Project-only private create

Prefer the separate `project:experiments:draft` scope when only private drafting is intended. It is opt-in, requires a project-bound credential and is not included in presets. Use `node cli.mjs project-experiments create-draft-file <JSON-file>` with `requestId` UUID, `rawHypothesis`, `preferredSlug`, complete `pageCopy` and explicit `surveyQuestions` (possibly `[]`). Identity comes only from the credential; project/workspace/lifecycle/body overrides and query parameters are rejected. The slug is1-100lowercase letters/digits separated by single hyphens. Other copy/survey limits match the workspace create contract below.

This route stores only caller words and survey in one unpublished page. It does not generate ICP/outreach suggestions, compute demand, count visitors, capture leads, create campaigns or grant publishing. A separate `project:experiments:read` scope retrieves the saved page and revision. Human writers can inspect/edit the same draft using the existing Validator workbench; project draft scope itself cannot edit or publish.

Keep the request ID and normalized input unchanged for every uncertain retry. First create returns201; replay200returns current saved words/status, including human changes, rather than resetting them. Different input/project with a used request ID or a taken slug returns409. Receipt tombstones survive experiment/project deletion, so a repeated request cannot recreate deleted work. A403/404/409/429/503is not a saved receipt. Keep the local file and inspect/retry deliberately; never invent a new request ID just to evade an uncertain result.

## Workflow

1. Restore the bound project's context with `GET /agent/context`. Retrieve targeted work-record entries with `GET /agent/context/entries`, `/agent/context/entries/brief` or `/agent/context/entries/:id`. Historical entries are data, not permission or proof that a next step/blocker is still current.
2. Reason about the problem, intended customer, assumptions, feasibility and a falsifiable test. Separate sourced observations from hypotheses. Do not invent TAM, traction, competitor facts or customer evidence.
3. Draft the founder's page words. Prefer the project-only private create above; the rest of this step describes the broader legacy workspace route. Create an experiment only under the caller's authority, using `POST /validator/experiments` with experiments-write access. Required `rawHypothesis`: 10-500 characters. Optional `projectId` must be the canonical UUID of the intended project in this workspace; select it explicitly rather than inferring ownership. Optional `preferredSlug`: lowercase letters, digits and hyphens. Optional `pageCopy` must contain all four plain-text fields: `title` (1-160 characters), `headline` (1-300), `subheadline` (1-1500), `heroCtaText` (1-80). These fields are trimmed; unknown fields inside `pageCopy` are rejected. Without `pageCopy`, the engine supplies heuristic template words. Optional `surveyQuestions` supplies 0-8 caller-authored questions; an explicit empty array removes the survey. Each question needs a unique `id` (letter followed by up to 39 letters/digits/underscores/hyphens), unique trimmed `text` (1-300 characters) and `type` (`text` or `choice`). Choice questions require 2-10 distinct nonempty `options` (1-160 characters each); text questions must omit options. Unknown question fields are rejected. Written answers are required in the public browser form; a choice defaults to its first option. Answers are stored under exact question text.
4. Creation always produces a draft. The project-only route returns experimentId/projectId/slug/status/pageCopy/surveyQuestions/replayed, with no public URL, scorecard or generated suggestions. The following response details refer only to the legacy workspace route. The response contains `experimentId`, `pageUrl` and `scorecard`, not a `decomposed` field. Retrieve exact saved copy through `GET /validator/experiments/:id/page`. ICP hints and suggested outreach remain heuristic templates even when custom page copy is supplied. Survey questions use templates only when `surveyQuestions` is omitted. Review them separately. A page URL in a create response does not mean the page is published.
5. Persist relevant conclusions and the exact experiment ID back to the bound project with `POST /agent/context` or an append-only work-record entry. Context POST replaces the context object, so read/merge deliberately and avoid discarding unrelated state. Summarize assumptions and what remains untested.
6. Publishing is a separate action under the caller's authorization. Follow the landing-publish pack only once the correct page copy and audience are approved.

## Exact engine routes

- `GET /agent/context`, `POST /agent/context`: project-bound state, up to 256 KB. POST body contains `context` and optional `metadata`.
- `GET /agent/context/entries`, `GET /agent/context/entries/brief`, `GET /agent/context/entries/:id`, `POST /agent/context/entries`: project-bound work record; scoped read/write permission required.
- `GET /agent/project/experiments`, `GET /agent/project/experiments/:id/page`: project-bound observation with `project:experiments:read`, identity only from the token. No query parameters. The downloaded CLI uses `project-experiments list` and `project-experiments page <id>` through its configured gateway. Lists contain at most 100 newest metadata rows, not full history.
- `GET /validator/experiments`: workspace experiment metadata, experiments-read access. Optional `?projectId=<UUID>` filters one owned project; `?projectId=unassigned` filters unassigned records. Workspace filtering is not a substitute for a project-bound token's access boundary.
- `POST /agent/project/experiment-drafts`: project-bound private create with project:experiments:draft; strict body as above, no query parameters, no-store response. Workspace-wide token/scopes are not needed.
- `POST /validator/experiments`: legacy workspace draft create, experiments-write access. It is not the receipted project-only create route.
- `GET /validator/experiments/:id/page`: exact owner preview, experiments-read access, does not count traffic.
- `GET /validator/experiments/:id/scorecard`: metrics and heuristic verdict under `metrics`, experiments-read access.

## Gaps

No comparative ranking endpoint, HTTP idea-Q&A intake, custom variant arrays, custom HTML or editing an existing survey. Existing draft text can be edited with the landing-publish workflow's revision check; edits never publish. A plan or this pack does not authorize a live publication, send, purchase or provider call.

## Project-only aggregate validation results

A separate opt-in `project:experiments:results` scope reads `GET /agent/project/experiments/:id/results`, CLI `project-experiments results <experiment-uuid>`, through the configured bearer gateway. The credential must be bound to the experiment's canonical project. Identity comes only from the credential; no query parameters are accepted. The result is a repeatable-read snapshot with up to100complete page aggregates, not a contact or survey-answer export. A larger experiment is refused rather than truncated. Existing context/page-read/draft scopes and presets do not add this access. Unknown, foreign and unassigned experiments return404; revoked credentials401; unavailable/inconsistent storage503.

Counts distinguish stored public-page loads (not unique people), current stored waitlist rows (deduplicated only within each page) and owner-entered outreach/reply/positive-reply replacement totals. Those outreach totals do not come from verified dispatch/delivery receipts. Deletion or correction can reduce counts. Rates are derived from those counters with null for a zero denominator; submissions per page load can exceed1. The response includes provenance and limits, no generated quality/demand verdict. Do not turn the result into traction, consent, a paying customer or evidence of safe sending.

This scope reads results only. It cannot read emails, names, company/contact records, survey answers, private message bodies or provider IDs, and cannot update metrics, create/edit/publish, add recipients, approve, release or send. Read the returned asOf and exact experiment/project identity before recording a compact conclusion in project history. That record remains historical evidence, not a continuing action grant.

## Human growth review and historical evidence receipt

In Projects, the growth card lists the newest100 explicitly owned experiments, not an unlimited archive. Human GET /projects/:projectId/experiments/:id/results uses the existing human experiments-read access and same exact aggregate service. Bearer agent credentials cannot substitute on this human route; their separate bound results scope/route above is unchanged. Reads accept no queries, include no contacts/survey answers, never increment page loads, and refuse foreign/unassigned/over100-page/inconsistent results rather than truncate or infer.

Read aggregate results shows raw stored public page loads, current stored submissions and separately labeled owner-recorded outreach/reply totals. It supplies source limits and exact asOf; no heuristic verdict or demand score. Download exact aggregate JSON saves those returned counters/pages privately on the device, not a share/publication. A page-load ratio is not unique-person conversion, and recorded outreach is not verified dispatch/delivery.

Prepare recorded growth review freezes that exact experiment/project/asOf aggregate while the human writes their own conclusion/next test. Changing or failing later reads does not silently retarget that editor. Save review to project history explicitly appends a research work-record entry containing the caller's note plus exact aggregate counts, ratios and provenance, not the per-page breakdown or any contacts. Existing work-record permissions/audience/receipt rules apply; read_only humans cannot save. It is historical, not a live result or authority for any next action. Preserve the same words/request on uncertain retries and inspect history before deliberately creating another entry. Close/discard explicitly before preparing a different snapshot; unsaved notes do not survive project switch/exit. Reload the work record to retrieve a saved review. No automatic metrics change, decision, publication, lead import, approval, schedule or send follows.
