# Beta task 5: consume real workspace reads (Overview, Tables, Mailboxes, Campaigns lists) + a11y

Binding first: docs/plan/DESIGN_RULES.md; run `node scripts/check-design.mjs` before pushing (stay at 0). Use lib/notify, components/feedback, @leadloom/ui. Do not touch tokens, tailwind, packages/ui, the shell, gating, emails, engine code, or apps/web/lib/engine-client.ts (Gamma owns it; the client functions below already exist).

Gamma added engine reads (authenticated, tenant-scoped by the server, real persisted rows only) and typed client functions in lib/engine-client.ts:
`fetchWorkspaceSummary`, `fetchWorkspaceTables`, `fetchWorkspaceMailboxes`, `fetchWorkspaceCampaigns`. Each returns `{data, error}`; data is null on failure.

## Part A: read-only lists on real data
- Overview (/app): add real count cards from `fetchWorkspaceSummary` (tables, mailboxes, campaigns, suppressions, experiments, provider keys) using StatCard. Loading, and error with retry. A count of 0 is shown as 0 with an EmptyState hint, never hidden.
- /app/tables, /app/mailboxes, /app/campaigns: show the REAL list at the top from the matching fetch (name/email/status fields as returned; mailbox health shows spf/dkim/dmarc as the raw returned values, "unknown" shown as "Unknown", healthScore only as returned). Empty list = EmptyState "No X yet" with no fake rows. Remove the "Sample data on this page" pill logic for a page ONLY if that page no longer renders any fixture (tell me which pages still do; the pill list lives in the shell and Gamma will update it, do not edit the shell).
- Keep any remaining fixture UI below the real list under a clearly labelled "Sample preview" Card, or remove it if it only duplicates the real list. Do not add create/edit/send/connect actions. No connector work.
- No invented columns, no computed rates, no trends, no percentages.

## Part B: shared a11y/feedback hardening (only in components/feedback and the files you already own)
Visible focus rings on all interactive feedback components (token focus ring), aria-live for toasts/offline banner, Escape + focus return on ConfirmDialog, reduced-motion respected. Report what you changed.

## Done
tsc, next build, checker 0. You looked at each changed page in dark and light at 1280 and 390. Report commit hashes and any page that still renders fixtures. Pull --rebase before each push.
