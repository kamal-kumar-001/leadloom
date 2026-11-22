# Durable waterfall execution foundation

This service is deliberately not mounted on HTTP, not instantiated in production startup, and not scheduled as a background worker. Existing dispatch remains unavailable. A saved request is not provider execution, verified data, a cost approval or a completion-time estimate.

## Implemented and tested with native PostgreSQL

- Workspace/current-writer validation; strict request IDs, explicit waterfall input-column mappings and up to100distinct selected rows.
- One receipt per workspace/request ID and immutable source/config/destination snapshots. Changed reuse is refused; unchanged retries recover the original run, including after completion.
- Native-verified parent-first lock order for submit/claim/apply: workspace, actor, table, then dependent run-row/column/cell locks. Concurrent table mutation and actual FK-cascading table deletion complete without lock-order deadlocks. Claim reselects queued work after taking parent locks and rechecks the current actor rather than trusting the unlocked candidate lookup. This is a database transition guarantee, not an external execution-authority lease.
- Atomic row claim with SKIP LOCKED. Source/config changes before claim cancel before invoking an executor.
- Stable per-attempt operation ID persisted before executor invocation. A trusted internal execution port receives the snapshot and ID. It is not an HTTP-supplied callback, provider URL, credential or network option.
- Provider result is persisted in a separate transaction before guarded writeback. A process restart or writeback storage failure can resume applying the saved result without re-executing a provider.
- Source input, destination, column config, row existence and current actor access are checked again during writeback. Changed data is retained as a conflict; no silent overwrite. Provider errors stay in run history and do not replace the destination cell.
- Lost/ambiguous outcomes become uncertain. Uncertain/running rows are not automatically claimed again. Trusted operator reconciliation can supply the result for that same persisted attempt ID and then apply it. Queued rows can be canceled; running/accepted external work is not claimed recalled.
- Tenant and state constraints, fresh and populated upgrade checks, Prisma/schema consistency, native concurrency and synthetic backup/restore/reconciliation.

## Before production execution can be enabled

A real executor must verify its own execution authority and approved credit/spend limits, reserve/reconcile budget, use fixed allowed provider routes and protected credentials, and reconcile ambiguous outcomes using the persisted operation ID. This foundation does not implement that budget/authority system or claim that arbitrary provider APIs support idempotency. External work that cannot safely be reconciled must remain uncertain without blind retry.

Provider execution/pricing and HTTP submit/read/cancel permissions are not wired. Human-session saved input-column creation and no-effect validation preview are wired separately; they do not queue or execute requests. Project-bound dispatch semantics are not defined by this workspace-only internal service. There is no automated stale-lease timer: an operator/executor integration must decide when a claimed operation is uncertain and retain it for reconciliation. No estimated completion time is fabricated.

The current schema retains a run when its requester is deleted, with requested_by set to null so it cannot be claimed. Deleting its parent table/column/workspace cascades its stored run data, as the declared foreign keys specify. This is not an immutable cross-deletion audit ledger and must not be presented as one. It does not cancel a provider request already in flight.

All executor ports used in verification are synthetic and make zero network calls. Actual provider billing, delivery, uptime and production recovery remain unproved.
