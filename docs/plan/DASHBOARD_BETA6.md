# Beta task 6: suppressions and experiments reads (real, minimal)

Binding first: docs/plan/DESIGN_RULES.md; run `node scripts/check-design.mjs` (stay at 0). Use lib/notify, components/feedback, @leadloom/ui. Do not touch tokens, tailwind, packages/ui, the shell, gating, emails, engine code, lib/engine-client.ts, lib/notify.ts.

Gamma added `fetchWorkspaceSuppressions` and `fetchWorkspaceExperiments` (lib/engine-client.ts; types WorkspaceSuppressionRow, WorkspaceExperimentRow). Each returns `{data, error}`; data is null on failure.

## Part A: Suppressions card on /app/mailboxes
Read-only Card below the mailbox list: "Suppression list". Columns: hash prefix (mono, label it "Address hash", never imply it is an email), reason, source, added date. Empty = EmptyState "No suppressed contacts yet". Loading, error with retry. No add/remove/export, no attempt to reconstruct or display addresses.

## Part B: Experiments list on /app/validator
Read-only list above any fixture: hypothesis (already truncated by the server), verdict (raw value shown as a Badge: pending/etc., capitalized), score only if not null, created date. Empty = EmptyState. Existing fixture UI stays under a "Sample preview" Card; remove the topbar-sample claim only by telling Gamma (do not edit the shell). No create/generate actions here.

## Done
tsc, next build, checker 0, looked at both pages dark and light at 1280 and 390, with the empty state and, if you can seed locally, a populated state. Commit hashes in your report. Pull --rebase before each push.
