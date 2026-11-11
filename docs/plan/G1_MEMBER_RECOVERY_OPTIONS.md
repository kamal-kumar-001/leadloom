# G1 follow-up: removed-member recovery — DRAFT PROPOSAL for Kamal's decision

Status: proposal only. No code change is made or implied. Current behavior is
kept exactly as verified on 2026-11-11: removing a member suspends the whole
account (disabled_at + session_version bump, audit row, data never deleted),
login then fails with "Account unavailable", and there is no self-serve or
admin-UI path back.

Why this needs a decision: suspension is product-wide. A person removed from
one workspace is locked out of LeadLoom entirely, including any other context
their account had, and only manual DB access restores them.

## Option A — Admin "restore access" for suspended members (smallest change)
- Members list gains a "Suspended" section with a Restore action.
- Engine: POST /workspace/members/:id/restore, admin-only, clears disabled_at,
  bumps session_version, writes an audit row, keeps the previous role.
- Bounded: restore only re-activates the account in the same workspace; it
  cannot change role, move data, or touch credentials.
- Reversible: restoring is itself undoable by suspending again.

## Option B — Workspace-scoped removal instead of account suspension
- Removal detaches the user from the workspace (role revoked, workspace data
  untouched); the account stays alive and falls back to a pristine personal
  workspace on next login, matching the state a brand-new account gets.
- Larger change: membership must become per-workspace rather than a field on
  the user, which touches session claims and every workspace-scoped query.
- This is the cleaner long-term model if multi-workspace membership is ever
  wanted, but it is not a small patch.

## Option C — Keep suspension, add honesty only
- Keep today's behavior; make the remove dialog say plainly "This signs the
  person out of LeadLoom completely and only you can restore them," and log a
  support path for restore.
- Zero engine change; still leaves restore as a manual operation.

Recommendation to weigh: Option A is the bounded, reversible step that fixes
the lockout without a data-model change; Option B is the structural answer if
accounts should ever belong to more than one workspace. Option C is the
do-nothing floor. All three preserve the current audit trail.
