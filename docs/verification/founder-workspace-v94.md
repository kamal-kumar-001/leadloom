# New-idea founder workspace, v94

Checked 2026-11-23 IST. New product capability, private local candidate only.

## Usable path

With a canonical project and explicitly selected `project:assets:read` / `project:assets:write`, the downloaded customer CLI now supports:

- `founder init-file <brief.json>`: save a strict caller-authored brief and an eleven-task dependency graph.
- `founder get <id>`: compact current state, ready tasks, claim identities and evidence counts. Full source/event bodies are omitted.
- `founder detail <id>`: explicit full private record when needed.
- `founder task-file <id> <action.json>`: claim, report, block or explicitly release work with exact expectedVersion and stable requestId.
- `founder export <id> <version> <new-directory>`: exact-version private repo handoff, refusing an existing directory and unexpected file paths before writes.

The graph covers research, skeptical validation, synthetic stress, scope, repo, foundation, parallel backend/frontend, integration, launch preparation and funding preparation. It uses existing transactional versioned project assets, with no migration, new secret store or consumer-agent execution. Concurrent claims cannot both commit against the same version. Report/block requires the current worker label/claim; completion requires artifact references. Worker labels are caller-supplied, not authenticated identities; claims are advisory coordination, not an authorization boundary. Reports are not independently verified execution. Unchanged retries recover exact historical receipts, explicitly marked when a newer currentVersion exists.

The local handoff includes PRD/acceptance checks, design record, evidence JSON, crisp validation template, synthetic-stress limitations, build plan, permissions, AGENTS.md, launch/funding preparation, setup, a credential-free env example, the CLI and the nine packs actually present in the bundle. A hash receipt is written last. No token is copied; no git init/install/build/agent/deploy occurs. The files are a proposed scaffold, not an implemented application. Partial export is retained for inspection, not silently deleted. A saved-workspace panel displays compact caller-reported task state in Projects.

## Grounding and checks

Six new service tests and 27 targeted web/CLI/bundle/gateway/panel tests passed. These include current-version competing claims, stale/historical replay, dependencies, wrong-worker refusal, export traversal/identity/version refusal, no overwrite and no credential export. The bundle-count assertion was updated from eight to nine packs and explicitly checks the new pack.

Engine compilation passed. The current normal combined production build compiled but exceeded its 120-second cap during lint/type checking. The prior v93 normal full build remains a valid earlier checkpoint, not a passing current full invocation. Explicit clean standalone web TypeScript checking and documented Next compile/generate stages then passed, without changing production configuration.

Actual compiled web/engine, newly created PostgreSQL16 storage, downloaded customer bundle/CLI and headless browser passed a fictional new-idea rehearsal. It created a workspace, raced two real CLI claims to one winner, reported a receipt, recovered a historical replay, refused wrong-worker/out-of-order/context-only/foreign-project access, exported exact-version files with all nine packs, verified every hash/no token, refused overwriting, and resumed after engine restart. Compact default omitted full evidence/event bodies. The actual saved panel pixels were inspected and readable. Final fixture counts: zero campaigns, outbound jobs, mailboxes or experiment pages. The new database was dropped afterward.

The sample ToolShelf idea and its evidence are explicitly fictional. They are not Kamal's undisclosed new idea, real reviews or demand. The example repo archive is an inspection sample, configured to an ephemeral local test address, not a working app or deployable service.

## Still missing or gated

No real App Store/Play Store/Reddit/X collection, thousand-person simulation, finished app, Mac integration, store release, live deployment, publication/outreach or funding outcome was verified. The caller must research, decide, build and report real results. Freestyle and new agent long-running options remain unverified leads. A claimed phase completion creates no external permission. Push/deploy/spend/external-send/production-data gates remain unchanged; nothing ran on the user's Mac.
