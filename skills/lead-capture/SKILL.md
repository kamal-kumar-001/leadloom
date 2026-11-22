---
name: lead-capture
description: Inspect real waitlist contacts and raw conversion counters, while keeping testing and historical project context separate.
stage: Customers
domain: Customers & Waitlists
---

# Waitlist capture and traction review

## Access and truth boundaries

New experiments can have explicit same-workspace project ownership at creation; old and omitted-project records remain unassigned. Captured leads still require workspace experiments-read access. A context token alone grants no experiment access; the separate project:experiments:read scope exposes only that project's experiment metadata/page preview, not captured leads or scorecards. `/api/engine` requires a browser session; Bearer clients use engine routes or the downloaded CLI's configured gateway.

Public submission is deliberately unauthenticated, but that is not permission to add real people, test against a live page or pollute production metrics. Use disposable pages and synthetic addresses for tests under the caller's approved scope. Do not invent signups, unique visitors, traction or qualification.

## Workflow

1. Restore `GET /agent/context` and targeted project entries. Verify the exact experiment ID and current authority, rather than inferring it from a similar slug or workspace list.
2. Read `GET /validator/experiments/:id/scorecard` and `GET /validator/experiments/:id/leads`. Scorecard counts and rates are under `metrics`. Leads are stored under the experiment's page, not automatically copied to a workspace table.
3. Interpret `metrics.visitors` as raw page loads, including repeat/bot traffic, not unique people. Conversion/outreach verdicts are heuristics and team-entered counters are not independently measured sends. An email domain does not establish a person's role, company or purchase intent.
4. Capture on the public engine route `POST /validator/pages/:slug/leads` accepts `email`, optional `name`, `company`, `surveyResponses` and `referrer`. The web route `POST /api/v/:slug/leads` instead accepts answers under `survey` and translates them to `surveyResponses`. Do not send the engine shape to the web route and assume answers were stored.
5. Published pages only accept capture. Case-variant retries serialize on the page row and preserve first answers, returning committed `totalWaitlist`. A committed unpublish blocks queued capture. Storage failure is not success. Historical duplicate rows are not automatically merged.
6. Owner CSV export is `GET /validator/experiments/:id/leads/export`. Spreadsheet-formula cells receive safety apostrophes. Keep the download private unless the caller separately authorizes sharing.
7. Save a compact, dated result in the bound project's context or work record. Do not put unnecessary contact lists into resume context. Context POST replaces the object; merge deliberately.

## Human-only table workflow

The human workbench can import captured leads into an existing draft campaign or saved table through `POST /validator/experiments/:id/import-leads`. This route is not in the bearer gateway. Campaign import upserts recipients and replaces their captured-field metadata; repeated table imports intentionally append new rows. Neither operation sends mail. Do not confuse import with successful outreach.

Saved tables can be paged, plain-text edited and exported in the human workbench. Those human table routes are not accessible with project context tokens or via the bearer gateway. Workspace/project table tools have separate explicit scopes. Do not use context scope as table access.

## Gaps

No project-scoped captured-lead access, automatic enrichment, real-time lead webhook, unique-visitor measurement or inferred buyer verification. This pack does not authorize contact, publication, live testing or external sharing.


The human captured-lead dialog offers an explicit campaign draft or existing saved-table destination. Nothing is preselected. The table preview reads metadata only and shows the current mapping; the import rechecks the schema before writing. It requires a text Email/Email Address/Work Email column. Exact case-insensitive aliases normalize spaces, hyphens and underscores: name/full name/contact name map the complete captured name; company/company name/organization/organisation map company. Other and non-text columns remain empty in new rows. Never infer Email Verified, Username, First Name or Domain Name from substring matches. Existing rows and survey answers are not altered. Repeated table imports intentionally append, including duplicates; inspect the table after an unconfirmed import before deliberately repeating. Preview submissions are not a frozen batch; import rereads current experiment submissions. A saved table response has status saved, not campaign draft. The metadata-only human route is GET /workspace/tables/:id/schema and is absent from the bearer gateway.

The human table confirmation supplies expectedTableRevision from its schema preview. A changed column ID/name/type/order returns409with zero added rows, requiring deliberate reload/review. Legacy table callers omitting this optional revision still use current-schema mapping; they do not gain reviewed-schema guarantees. The revision is content concurrency control, not authorization.
