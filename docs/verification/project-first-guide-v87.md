# Leadloom v87: project-first functional guide and broader journey proof

Private source checkpoint, November 22, 2026. Not deployed; not a full-product or production-readiness claim.

## Functional onboarding

The in-app Help Guide now starts with a project and the customer's coding agent instead of requiring provider keys and a mailbox first. It explains the actual workflow: source-backed research/discovery, coding-agent build handoff, private versioned launch drafts, separately reviewed page publication, separately reviewed outreach, and recorded growth/investor preparation.

It links directly to eight existing workbench pages. Opening a destination closes the guide without creating credentials, experiments, campaigns or jobs. Private preparation does not require provider keys or a connected mailbox. Runtime availability, access and any later publication, account change, spend or send remain separate checks. The customer's coding agent reasons and builds; Leadloom does not launch or control it.

The existing guide layout/styles were preserved. This is functional guidance/navigation, not a design refresh or a claim that every described operation is enabled in every runtime.

Actual compiled native/browser before proof showed the keys-first guide. After proof covers all six phases and all eight destinations: Projects, Research, Signals, Validator, Campaigns, Mailboxes, Connectors and Work history. Every link navigates correctly and closes the dialog. Native counts remain zero for tokens, experiments, campaigns and outbound jobs; zero mutation requests, outside requests or browser exceptions. Top/bottom actual guide pixels were inspected for readable content and links across all phases.

## Current verification

- Web: 208 passing tests across 35 files. Engine and web builds pass. Scraper builds and its 3 tests pass.
- Fresh PostgreSQL 16 bootstrap: 40 migrations, pgvector 0.8.7.
- Broad actual compiled application/browser/downloaded-customer-CLI workflow passes, including exact caller content, isolation, durable evidence, guarded writes/retries, revocation and matching build identity.
- Current private KeepCue, dashboard, operator, credential concurrency, configured setup, history/attention, provider keys, workbench races, observed-scorecard counters and exact growth/discovery receipt scenarios pass again.
- Additional current native/browser paths pass: password signup/verification/reset and local-provider failure recovery; team invite/accept/role/suspension/outage; profile/password; configured plan enforcement; provider-control policy; private growth watches across restart; private investor source ledger/pitch recovery; two-reviewer outreach approval; saved research archive; handoff; waterfall input mapping; fixture DNS.
- Current logical dump/restore: 43 tables, 845 fixture rows, 110 index definitions, 161 constraint metadata records, matching data hashes/extensions. Nine CHECK expressions deparse differently, recorded without claiming textual or semantic equivalence. Actual Prisma read and deleted-table tombstone retry protection pass; restored native subset 50 passing/12 files plus one inactive gate marker. Temporary restore database removed. Not live backup, PITR, deployment rollback, RTO or RPO proof.
- Carried from v85, not rerun as a full matrix: engine 810/149 plus one inactive gate marker; contracts 18/8; database 19/2; Node operational 14. No relevant engine implementation changed except generated identity. Installed dependencies reused; no new install claim.

## Harness maintenance and limits

The older team assertion expected legacy run telemetry in the intentionally replaced Work history surface. It now checks that legacy telemetry is absent. The restore harness adds local-fixture guards and single-worker execution. The profile harness, which resets its disposable database, now also refuses nonlocal/nonfixture URLs. These are test-only changes, not application behavior changes. Restore requires the broad fixture seed immediately before its dump: later profile tests reset fixture state, so the broad seed was repeated before the successful final restore.

No schema, dependency, lockfile, authentication preset or permission changed. No live-host/lab work, push, deploy, real provider/mail/DNS call, external account creation, public publication, spend or send. Local fake providers and fixture recipients do not prove live delivery or OAuth. Saved counts are not customers, demand, consent or revenue. KeepCue remains app-first, unpublished and draft-only in these tests, with its separate launch-plan ownership unchanged.

Earlier limits remain: no autosave across page reload/project switching; changing offset pages are not snapshots; a timed-out or malformed acknowledgement is not cancellation of committed server work. Existing provider/publish/send gates remain intact.
