# Leadloom candidate source

Start here for the current source snapshot. Older checkpoint notes, including package READMEs and files under `docs/plan`, describe earlier work rather than the current feature inventory. Use current source and the dated verification notes below. No planning file is permission to deploy anything.

Leadloom stores project context, work history and private assets, supplies scoped retrieval tools and connectors, and runs explicitly configured backend work. The customer's coding agent does the reasoning and calls the tools. Leadloom does not spawn or control that agent.

## Current private workflow

1. Sign in through a configured, verified authentication path, then create a project in Projects & Tokens.
2. Save the project brief, decisions, progress and work records. Read bounded indexes first, then retrieve only the needed record, asset version or research receipt.
3. Download the nine customer instruction packs from the product. They cover the founder workspace, idea feasibility, competitor review mining, private drafts, landing pages, lead capture, outreach recording, scheduled-work preparation and investor support.
4. Keep source ledgers, landing copy, pitches and outreach drafts private until a person deliberately chooses an external action. Stored words and sources are not proof of verification or permission to send.
5. Review experiment counters separately from owner-entered outcomes. Save a frozen historical review before changing the next test. An optional private growth watch records changed aggregate counters only, not conclusions, contacts, campaigns, notifications or sends.

Project-bound API credentials remain scoped to the selected project and granted capabilities. Do not replace them with a workspace-wide tool credential. Human workspace tables and some workspace operations are intentionally broader than project-bound retrieval; this is not blanket project isolation.

## New-idea founder workspace

Use a canonical project and explicitly selected `project:assets:read` / `project:assets:write` scopes. The downloaded CLI supports `founder init-file`, compact `founder get`, explicit full `founder detail`, conflict-checked `founder task-file`, and exact-version `founder export` to a new local directory. This persists an eleven-task dependency plan, caller-worker claims/results and private repo handoff files. It does not spawn agents or certify reported completion. The export supplies proposed PRD/acceptance checks, design record, untrusted evidence data, permissions, agent instructions, phased plan, launch/funding preparation, a credential-free env example, the CLI and packs actually present in the bundle. It never overwrites an existing directory, copies no token and does not run git/install/build/deploy.

Source-linked pain reporting is available through `reviews intake-file` and compact `reviews get`. It persists up to100 caller-supplied records per bounded batch as immutable source chunks, checks theme/counter-evidence references, separates synthetic counts, detects exact normalized-text repeats and verifies hashes on reads. Projects shows the same saved summary or refuses a changed digest. The caller authors the assessment and themes; this is not automatic scraping, source authentication, semantic clustering, independent people or demand. The research pack documents exact limits and recoverable partial-write retries.

The synthetic stress path now generates explicit bounded Cartesian case matrices and ingests caller-reported evaluations, with distinct missing/unevaluated coverage, immutable result chunks and a checked compact report. It does not generate responses or call models. `stress plan-file`, compact `stress plan`, explicit exact-version `stress cases`, `stress report-file` and compact `stress report` are documented in the founder pack. A1000-case matrix is not1000 independent people or evidence of demand.

A narrow one-shot public Apple feed reader is available as `apple-reviews fetch-file` in the downloaded CLI. It accepts a selected app/storefront, inspects one bounded fixed-origin feed page, returns incomplete source-linked excerpts without author identity and does not automatically store or analyze them. It is best-effort RSS, not official authenticated competitor API support. Google Play/Reddit/X collectors are not implemented; platform/account/commercial/cost restrictions cannot be inferred away. See `docs/verification/review-platform-access-v97.md`.

This is not automatic all-platform App Store/Play Store/Reddit/X scraping or a thousand independent simulated people. Source collection is still caller-driven; synthetic stress cases are not demand. Read `skills/founder-workspace/SKILL.md` for exact commands and remaining boundaries.

## Build prerequisites

Use Node 22.13 or later and the checked-in package lock. From the repository root:

```sh
npm ci --no-audit --no-fund
npm run prisma:generate --workspace @leadloom/database
npm run build
```

These build steps do not deploy the application or configure production accounts. Prisma generation needs the database package's documented configuration. Runtime needs PostgreSQL 16 with pgvector and a securely supplied database URL. Never point experiments or synthetic fixtures at an existing or production database.

For a newly created, independently verified empty database only, review `packages/database/scripts/bootstrap-fresh.sh`. It exists because the historical migration order needs a baseline on an empty install. A read-only preflight now refuses existing user relations, non-public user schemas and migration history, and fails closed on connection/check errors before baseline SQL. A preinstalled pgvector extension alone is supported. This is not a complete cluster/object audit, an existing-database repair command or protection against concurrent schema writers. Verify the intended target and keep fresh installation exclusive. Existing identified Leadloom databases use reviewed versioned migrations and the release procedure, not reset, db push or an assumed empty database.

## Runtime configuration

Supply secrets privately through the deployment environment. Do not commit them or paste them into chat. Engine startup needs `DATABASE_URL`, a valid `LEADLOOM_MASTER_KEY` and a base64 `LEADLOOM_SESSION_KEY` of at least 32 bytes. Authentication also needs the matching web/engine bridge configuration and a supported sign-in method. Do not copy credentials from another product just because a historical helper offers that option.

The Compose default profile starts only PostgreSQL and Redis. The `application` profile is opt-in. Current native builds and tests do not prove that the Docker images build or that the host can run them safely. Read [the infrastructure guide](docker/README.md) and [the release procedure](scripts/ops/RELEASE.md) before any container or host operation.

The application profile passes the following existing engine flags through, with every one defaulting to false:

| Private product or administrative capability | Flag |
| --- | --- |
| Pasted-text research and private research records | `LEADLOOM_RESEARCH_API_ENABLED` |
| Experiment drafts, page review and capture routes | `LEADLOOM_VALIDATOR_API_ENABLED` |
| Saved-mailbox DNS diagnostics | `LEADLOOM_DNS_DIAGNOSTICS_ENABLED` |
| Configured local plan/limit enforcement | `LEADLOOM_ENTITLEMENTS_ENFORCED` |
| Team invitation/member management | `LEADLOOM_TEAM_INVITES_ENABLED` |
| Explicit mailbox connection/test controls | `LEADLOOM_MAILBOX_CONNECT_ENABLED` |
| Waterfall API mount, not working paid dispatch | `LEADLOOM_WATERFALL_API_ENABLED` |
| Local private aggregate observation worker | `LEADLOOM_GROWTH_WATCHES_ENABLED` |

Even administrative controls can cause a deliberate account or network operation when used. Enabling a flag is not approval for every action it exposes.

Compatibility warning: earlier Compose versions ignored several of these environment settings. An existing environment file can already contain `true` values that will start taking effect after this source change. Review the fully resolved configuration before any approved deployment. False defaults do not override an existing true value. In particular, keep external fetch, live probes and outbound sending explicitly false unless their separate approvals and checks have been completed.

External website fetching, live connector probes, outbound worker mounting and actual sending have separate default-false flags: `LEADLOOM_RESEARCH_FETCH_ENABLED`, `LEADLOOM_CONNECTORS_LIVE_ENABLED`, `LEADLOOM_WORKER_ENABLED` and `LEADLOOM_OUTBOUND_SENDING_ENABLED`. Do not enable them without reviewing their authority, account, cost and delivery conditions. Some connector probes can consume credits. A worker can be mounted with sending disabled. Provider credentials or a paid plan are not a spending grant. Paid waterfall dispatch remains unavailable.

Set `LEADLOOM_PLATFORM_ADMIN_EMAIL` explicitly only for the intended platform operator. Compose passes that same setting to web and API, empty by default. The web console requires a provider-verified signed session for that designated identity plus a current active, verified database account; an address alone is not verification. Missing or failed database identity validation fails closed. A previously ignored environment value can start taking effect after a later deployment, so review it before release. The overview reads actual bounded workspace metadata and global record counts, not demo telemetry. Stored plans and access flags are not billing or uptime proof. Tenant changes, subscription billing, global audit events and key operations remain unsupported.

Set `LEADLOOM_PUBLIC_API_URL` to the operator's verified deployment URL before supplying customer tool configuration. Production sender/unsubscribe settings, SMTP/IMAP credentials, OTP delivery and OAuth callbacks need their own verified configuration. Development mail sinks, private-host bypasses and the legacy session issuer are not exposed by the Compose application profile.

## Verification and limits

The v72 application checkpoint passed engine 790 tests in 145 files plus one deliberate skip, web 130/27, contracts 14/6, database 19/2 and nine release/identity tests. Fifteen actual compiled/native browser journeys and six provider configurations also passed. The standard clean dependency install was performed for v70; v72 reused those unchanged dependency manifests and that installation.

The full local native suite also needs installed Chrome, PostgreSQL16/vector, openssl and an explicitly supplied local mail fixture package containing smtp-server3.21.7 and hoodiecrow-imap3.3.1. Ordinary npm ci does not install those separate test services. Static Compose checks also need Python3 and PyYAML. Browser/auth/mail tests use synthetic local transports, not live provider accounts.

Read [project and credential response races](docs/verification/project-credential-races-v80.md), [workspace setup record states](docs/verification/dashboard-records-v79.md), [read-only platform overview](docs/verification/platform-overview-v78.md), [admin identity configuration and middleware](docs/verification/admin-identity-v77.md), [the KeepCue discovery extension](docs/verification/keepcue-discovery-v76.md), [the KeepCue real-project workflow exercise](docs/verification/keepcue-workflow-v75.md), [guarded fresh bootstrap](docs/verification/guarded-bootstrap-v74.md), [Apollo evidence handling](docs/verification/apollo-match-evidence-v72.md), [private growth watches](docs/architecture/private-growth-watches.md) and [schema40 synthetic recovery](docs/verification/schema40-recovery.md) for exact scope. Recovery proof restores a whole disposable synthetic database, not one project's data into an existing workspace.

`/health` and the web health route are liveness/source-identity checks, not business or provider readiness. `/ready` additionally concerns outbound worker mounting, not approval to send. A green probe does not prove live authentication, mailbox delivery, provider costs, production data recovery or full-product readiness.

No container, production release, paid execution, live signup delivery or production restore is certified by this source archive. No price, demand, revenue, investor interest or delivery result is implied by a saved draft, receipt, counter or fixture.

- [v81 customer setup and destination verification](docs/verification/customer-setup-v81.md)

- [v82 project history and stored campaign attention](docs/verification/work-activity-v82.md)

- [v83 current provider-key selection and honest metadata](docs/verification/provider-key-selection-v83.md)

- [v84 current workbench reads and exact save receipts](docs/verification/workbench-reads-v84.md)

- [v85 observed counts and unavailable conversion rate](docs/verification/observed-metrics-v85.md)

- [v86 exact workflow save confirmations](docs/verification/workflow-receipts-v86.md)

- [v87 project-first functional guide and broader journey proof](docs/verification/project-first-guide-v87.md)

- [v89 main-based reconciliation, verification and source-only handoff](docs/verification/main-reconciliation-v89.md)
