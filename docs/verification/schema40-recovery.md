# Schema40 disposable recovery checkpoint

v69 adds recovery verification and a local-only rehearsal guard correction. It changes no application implementation, migration, scope, runtime flag or enabled service from v68. The current compiled implementation remains v68's verified build identity `1667030c1fc5ed092880c04ec16f0e87a60da650f2760d2bb94c7a2b770c06f0` (760 included files). The existing identity scheme excludes `.mts` rehearsal scripts and top-level documentation; full archive manifests separately hash those files.

## Fresh whole-database restore

The guarded rehearsal creates three fresh random `leadloom_restore_` databases on disposable local PostgreSQL16: source, restored and corruption target. It bootstraps the real migration chain, seeds synthetic data through current services, dumps the source in custom format, restores into a fresh target in one transaction, and removes all three databases and temporary archives afterward. It never dumps the existing database named by the admin connection.

Final actual result:

- 40 migrations,43 public tables,123 rows,397 schema columns.
-161 named constraints, normalized through PostgreSQL for equivalent CHECK deparsing, and110 index structures.
- Exact ordered per-table JSON data hashes, row counts, column types/defaults/nullability, constraint definitions and index structural metadata match after restore.
- Extensions match: plpgsql1.0 and vector0.8.7.
- Custom dump133811bytes, SHA256 `b38f30377d559fadeab0a5e93a1c2fbbe0edb226bf4fc1c6c53f9eacd38ebc64`. This temporary synthetic dump was deleted, not delivered as a production backup.
- A deliberately truncated archive is rejected; single-transaction restore leaves the fresh corruption target with no public tables.

Index comparison covers method, uniqueness/primary/valid flags and column positions/counts. It is not an independent proof of every expression or partial-predicate semantic equivalence. This is logical dump/restore, not PITR or production-volume RTO/RPO proof.

## Restored watches and current scoped routes

The source contains active, paused and blocked growth watches, immutable original start receipts, an edited current interval, baseline/changed observation history, and an active watch due while the saved current counter differs from its last recorded snapshot.

After exact restore, all three configurations and their history match. Original start replay preserves the later interval and paused/blocked states. A newly constructed application exposes their saved state with the observation worker unmounted. No background or outbound worker starts, and route reads do not append observations.

The test then explicitly calls one bounded local observation pass. It records the current8-load snapshot exactly once, without inventing missed intervals. A second fresh service adds nothing. Paused/blocked watches remain paused/blocked, and the pending-approval outbound fixture is unchanged. This is controlled synthetic execution, not permission to start or resume real watches after recovery.

Two projects in the same workspace retain distinct exact context generations, draft bodies/history and work records. Actual restored agent routes return each bound project's context, deny project-query substitution, return404 for the other project's asset/history IDs, and reject a revoked token. Direct service reads also deny the foreign tenant/project. A human route can inspect restored watches with `workerAvailable:false`, while an agent token cannot manage them.

This verifies selected restored routing/targeted retrieval boundaries. It is still a whole synthetic database restore, not a per-project export/import/rollback capability or a claim that all workspace-wide tools are project-isolated.

Existing recovery checks also pass: exact old/current draft versions and create receipts, project research/campaign/table/private-experiment receipts, deleted-experiment tombstones, saved inventory, held outbound state, uncertain waterfall operation preserved without automatic provider retry and same-operation synthetic reconciliation. A synthetic encrypted provider credential needs the retained matching test key/workspace; wrong-key and wrong-workspace uses fail. The dump text contains neither synthetic provider plaintext nor issued bearer tokens. Database recovery does not replace key/configuration recovery.

## Rehearsal guard correction

A parser-only baseline, with no connection attempted, found that the old URL check inspected the first `host` query value while the actual pg client chose the last duplicate. A duplicate could therefore pass the local-socket prefix check yet select a disallowed local socket. This was a helper validation defect, not a live incident or deliberate-attack claim.

The helper now rejects duplicate `host` values and noncanonical/traversal/null-containing socket paths before connecting, and verifies PostgreSQL16 before creating test databases. Existing remote-host, query-redirection, password-bearing-URL and explicit-opt-in checks remain. Six executable negative cases pass: missing opt-in, remote hostname, extra query redirection, duplicate socket value, path traversal and non-test socket. All refuse at pre-connection validation. The successful full rehearsal was rerun after this correction.

## Preserved implementation and limits

Application source and migration behavior remain v68's verified candidate. v68's complete build, engine782, web130, contracts14, database19, Node9 and15 native browser journeys plus6 provider configurations are carried forward, not claimed as newly rerun in this checkpoint. Node release/identity9 and the full new restore/guard checks were run for v69. Complete-source byte comparison identifies only the rehearsal script change and this new verification note relative to v68.

No lab change/build, host operation, live data/account mutation, push, deploy, provider contact, publication, external send or spending. PostgreSQL is stopped, no application children remain, and all temporary rehearsal databases/archives are removed. This supersedes v54 as the latest actual disposable restore evidence, not as proof of production backup, off-site encrypted retention, key escrow, scheduled backups, deployment rollback, production send safety or provider access. No user-owned blocker is established and no full-product/readiness claim is made.
