# Leadloom v85: observed counts and unavailable conversion rate

Private source checkpoint, November 22, 2026. This is not a deployment, launch, demand result or complete-product readiness claim.

## Corrected behavior

The scorecard previously replaced stored page loads with the larger of page loads and signups. In an actual compiled native-PostgreSQL reproduction, one signup through the public capture API with no page read was reported as one load. With 30 fake signups and 20 explicitly team-recorded fixture outreach, it reported 30 loads, 100% conversion and high_pull/100 although the native page-load counter remained zero. No outreach was sent.

The engine now preserves the native page-load count. `pageConversionRate` is `number | null` throughout the shared contract, engine and web client. It is null when there is no observed load denominator or signups exceed measured loads. The UI shows Unavailable and explains that the counts need reconciliation. An unavailable rate keeps the heuristic verdict Pending with score 0, which is a pending sentinel, not a measured zero-interest result. A comparable numeric rate keeps the existing formula and thresholds.

Actual final compiled API and browser proof: zero stored and reported loads, 30 fake signups, null rate, Pending/0. One subsequent public page read increments the stored/reported load count to one, without inventing the remaining 29. No outside browser requests. Owned scorecard fixtures were removed.

## Verification

- Engine: 810 passing tests across 149 files, plus one inactive-gate marker skipped. All three shards used native-table/integration gates and local mail fixtures where applicable.
- Web: 202 passing tests across 34 files.
- Contracts: 18 passing tests across 8 files, including nullable-rate acceptance and invalid/nonfinite/out-of-range rejection.
- Database: 19 passing tests across 2 files. Node operational tests: 14 passing.
- Contracts, engine and web builds pass. Existing installed dependencies were reused; this is not a new clean-install claim.
- A new disposable PostgreSQL 16 database applies all 40 migrations with pgvector 0.8.7.
- Actual compiled engine, standalone web, downloaded customer CLI, browser and native storage broad journey passes, including project isolation, exact caller-authored content, durable context/history, research, campaigns, tables, approval states, revocation and fail-closed matching build identity.
- Private KeepCue app-first draft workflow, dashboard, operator view, Projects credential concurrency, configured connection setup, project history/attention, provider-key ordering and held workbench-save callbacks pass again against this build.

The evidence archive contains the logs and native outputs. The summary PNG is a crop of the actual scorecard screenshot, limited to the metric cards and reconciliation notice. It does not claim that a full scrolling scorecard was visually inspected.

## Compatibility and limits

Consumers of the scorecard must handle null rather than treat an unavailable ratio as zero. Counts remain raw: page reads are not unique people and can include repeats or bots. Outreach totals are entered by the team, not evidence of sending or delivery. Thresholds and score weights remain a product heuristic, not statistical validation or a recommendation to spend or launch.

No migration, dependency, lockfile, authentication preset or permission was changed. No live-host/lab change, push, deployment, account creation, provider use, spend or external send. KeepCue's real launch-plan ownership is unchanged; the local workflow remains unpublished and draft-only.

The cumulative source contains earlier fixes and their documented limits. In particular, unsaved workbench words/request IDs are not durable across page reload or project switching. Changing asset pages are not frozen snapshots; overlapping pages are refused and require reload.
