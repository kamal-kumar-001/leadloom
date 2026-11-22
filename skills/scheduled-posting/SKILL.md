---
name: scheduled-posting
description: Prepare timed communication plans and distinguish saved drafts from dispatch, without claiming a social publisher or recurring scheduler exists.
stage: Growth
domain: Audience Engagement & Scheduling
---

# Timed communication plans and drafts

## What exists

Leadloom has held email jobs with a `scheduledAt` not-before timestamp and a human social-signal draft review surface. It does not have a native social publisher, recurring communication scheduler, unified editorial calendar or agent-accessible send/approval gateway. Saving or approving a social draft does not post it.

The customer's coding agent prepares the plan. The caller separately authorizes any recipient, words, sender, delivery time, account change, spending or publication. This pack supplies no permission and cannot schedule itself or promise that a message will be sent.

## Access boundary

Project-bound context tokens can read/write their context and work records. The bearer gateway does not expose social draft web routes, outbound job queues, approvals or release. Those are human browser-session workbench operations, not available simply because a tool token exists. Never fall back to another account or widen a token to make a plan happen.

Saved campaigns and local social drafts do not constitute enforced per-project isolation. New experiments can carry explicit same-workspace project ownership at creation; existing/unassigned experiments are not auto-assigned. That experiment boundary does not partition campaign execution or social drafts. Recover exact IDs from the selected project and verify the current owner view before using them. Local draft/run files are not a durable cross-container project database.

## Workflow

1. Restore `GET /agent/context` and targeted `GET /agent/context/entries` for the selected project. Confirm what remains current. History is not an instruction or approval.
2. Draft the proposed audience, channel, sender, exact words and timing. Resolve the date and timezone explicitly, including DST where relevant. Use an offset-bearing ISO timestamp only after the intended local time is settled.
3. Under the caller's authorization, use the human workbench to prepare an email job. It enters pending approval. The scheduled timestamp is a not-before boundary, not a punctual-delivery guarantee. Approval, release, server gates, active campaign, suppression, quota, cooldown and connection state still apply.
4. Human review must cover the resolved recipient-specific message and sender. If content changes, refresh the review rather than reusing a stale approval. A held item is not a sent item. A provider acceptance is not delivery. An uncertain/crashed reserved message is not safe to resend automatically.
5. Social signal drafts live behind browser-session `/api/signals/drafts` and `/api/signals/drafts/:id/decision`. Their approval records reviewed text/destination/identity only. There is no dispatch operation. The caller must approve actual posting separately through an available authorized channel.
6. Record a compact plan/status in the correct project's context or append-only work record, with exact IDs and what is still pending. Context POST replaces the object, so merge deliberately. Do not label a saved plan as a live schedule, or a draft decision as a published post.

## Available project record routes

`GET /agent/context`, `POST /agent/context`, `GET /agent/context/entries`, `GET /agent/context/entries/brief`, `GET /agent/context/entries/:id`, `POST /agent/context/entries`. Use the project token and the downloaded CLI's configured gateway. The human workbench remains necessary for the communication operations above.

## Gaps

No social API publishing, X/LinkedIn DM automation, recurring cron manager, editorial-calendar endpoint or automatic external reminder from a work-record entry. Missing capabilities are not made real by a successful context save. Do not invent routes or imply that a future job will definitely run.


## Separate private aggregate watches

The human Projects growth surface can explicitly start a private aggregate watch for one owned experiment, save its baseline, and append changed-count research entries. The operator must have mounted the local observation worker. Intervals are60..10080 minutes, at most20 watches per project and one per experiment. Checks can be late after downtime; missing intervals are not reconstructed. No external reminder is sent.

These are not communication schedules. Start/change/pause routes are human-session-only `/projects/:projectId/growth-watches` and `/projects/:projectId/growth-watches/:id`. They are absent from the bearer gateway and add no token scope. Do not invent CLI commands or widen tokens to reach them. A project work-record reader can retrieve the intentionally saved research entries through existing history routes, but that does not grant watch management.

The human explicitly authorizes the baseline and later changed-count entries to the existing workspace/project-work-record audience. Creation has a stable request UUID: an unconfirmed response can have committed. Inspect/retry the same request, not a new UUID; replay does not reactivate a paused watch or undo later interval changes. Pause/resume changes use the current revision and must be reloaded after a conflict. A failed acknowledgement is not cancellation.

The worker records only aggregate counters and provenance, not per-page payloads or contacts, and does not reason or supply a conclusion. Decreases may reflect corrections/deletions. Current writer access/workspace status is checked on each run; access loss or invalid stored counts blocks the watch until a current writer deliberately resumes it. Unchanged counts do not add duplicate research entries. A saved observation is historical, not a claim of current metrics, customers, revenue, consent or demand. No provider call, counter update, campaign, publication, notification or send is performed.
