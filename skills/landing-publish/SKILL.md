---
name: landing-publish
description: Review exact saved smoke-page copy and manage publication under the caller's separate authorization.
stage: Launch
domain: Launch & Smoke-Testing
---

# Smoke-page review and publishing

## When to use

Use to review, publish, unpublish or verify a Leadloom validation page. The customer coding agent reasons and obtains any required approval. Leadloom stores the page and enforces authentication. This pack supplies mechanics, never permission to publish or share.

## Access and project boundary

A project-bound context token cannot use workspace experiment routes. The configured workspace tool token must have experiments-read/write scopes as needed. Context access is not publication authority. `/api/engine` is the human browser-session proxy. Direct Bearer clients use engine routes or the downloaded CLI's configured `/api/agent` gateway. Use the human workbench when only project context access is available.

New experiments can be assigned an explicit same-workspace canonical `projectId` at creation. Existing and omitted-project records remain unassigned. There is no assignment/reassignment route. A project-bound token with separately selected `project:experiments:read` can list only its owned experiments and preview their page copy through `GET /agent/project/experiments` and `/agent/project/experiments/:id/page` (CLI `project-experiments list` / `project-experiments page <id>`). Context-only tokens remain denied. This read scope cannot publish, read leads or access workspace experiment routes. Workspace tool tokens retain their workspace-wide scopes. Never infer ownership from similar names or context references.

## Workflow

1. Restore the selected project's `GET /agent/context` and targeted work record. Confirm the intended experiment ID, purpose, audience and current caller authorization.
2. Retrieve `GET /validator/experiments/:id/page`. It returns `slug`, `status`, `title`, `headline`, `subheadline`, `heroCtaText` and `surveyQuestions`. Survey questions are objects with `id`, `text`, `type` and optional `options`. Owner preview is not counted as visitor traffic.
3. Review exact claims, copy, questions and CTA. Optional `pageCopy` at creation preserves the founder/agent's four plain-text fields instead of heuristic template words. ICP and outreach suggestions still use templates. Surveys use templates unless `surveyQuestions` is supplied at creation. Do not present those suggestions as researched facts. Existing draft text editing uses the revision-checked workflow below. Survey editing remains unsupported.
4. Only under separately grounded publication authority, call `POST /validator/experiments/:id/publish` with experiments-write access and strict JSON `{expectedRevision: <the exact reviewed owner-page revision>}`. Missing/invalid revision returns400; changed saved content returns409without publishing. Read and deliberately review/reconcile current content before trying a new revision; never auto-fetch the latest revision merely to bypass a conflict. Exact same-copy retry is safe even if already published. The CLI is `validator publish <experiment-id> <reviewed-page-revision>`. It returns `experimentId`, `slug`, `status: published`. This makes the page and waitlist collection available to visitors. The inverse `POST /validator/experiments/:id/unpublish` sets `status: draft` and stops public page reads/capture. Do not send the URL to other people without authority for that disclosure.
5. Verify the owner status and actual public page. Public engine data is at `GET /validator/pages/:slug`; the web renders `/v/:slug` and proxies data through `/api/v/:slug`. Public reads count raw page loads, including repeated/bot traffic, not unique visitors. A public JSON read is not visual rendering verification. Check the page itself when layout or escaping matters.
6. Persist the observed status and verified URL in the correct project's context or append-only work record. Do not invent the service's public origin. Context POST replaces the object, so merge deliberately. Historical launch entries are not proof that the page is still live.

## Draft creation contract

`POST /validator/experiments` accepts required `rawHypothesis` (10-500 characters), optional canonical same-workspace `projectId`, optional `preferredSlug` (lowercase letters/digits/hyphens) and optional `pageCopy`. When supplied, `pageCopy` must include all four fields: `title` (1-160), `headline` (1-300), `subheadline` (1-1500), `heroCtaText` (1-80). Fields are trimmed, unknown fields inside the object are rejected, and markup is rendered as plain text. The response contains `experimentId`, `pageUrl`, `scorecard`. Creation does not publish. Read the owner preview for saved copy. Optional `surveyQuestions` accepts 0-8 caller-authored questions; `[]` skips the survey. Each question has unique `id` (letter then up to 39 letters/digits/underscores/hyphens), unique trimmed `text` (1-300 characters) and `type` (`text` or `choice`). Choice questions need 2-10 distinct nonempty options (1-160 characters each); text questions omit options. Unknown question fields are rejected. Public browser text answers are required; choices default to their first option. Answers retain exact question text as keys.

## Public boundaries

Drafts and unknown pages are indistinguishable to visitors. Capture only accepts published pages, dedupes case-variant retries under a page-row transaction, preserves the first answers and stops behind a committed unpublish. Public limits and a shared-store global backstop apply. Ingress IP sanitization remains a deployment concern; this pack makes no spoof-proof rate-limit claim.

## Edit an existing draft's text

`GET /validator/experiments/:id/page` returns exact saved text, survey, status and an opaque revision. With workspace experiments:write scope, `PUT /validator/experiments/:id/page` accepts only `{expectedRevision, pageCopy: {title, headline, subheadline, heroCtaText}}`. The downloaded CLI supports `validator edit-page <id> <json-file>` with that body. It writes plain text, not HTML. Boundaries and limits match creation. Context and project-observation credentials cannot edit.

The page must be a draft. Explicitly unpublish a live page before editing and review the returned preview before a separate explicit publish. Editing never publishes and does not change slug, survey questions, project, metrics, outreach copy or captured leads. Stale differing edits return 409; retain your draft, read the latest page, then deliberately reconcile. An exact already-saved retry is a no-op while still draft. The human editor retains fields on failure and has an explicitly destructive unsaved-edit reload button. Never claim success after a storage error. A revision check is concurrency control, not permission to replace someone else's words.

## Gaps

No custom-domain binding, static-site bundle export, OpenGraph image generator, custom HTML, existing-survey editor or project reassignment. Do not call invented endpoints or widen token scopes to bypass these gaps.
