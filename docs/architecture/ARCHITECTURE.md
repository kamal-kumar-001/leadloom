# Leadloom architecture (lean working doc)

Purpose: record the module boundaries and extension points the sprint build
already has, classified so future work extends instead of rewrites. This is a
working note, not a documentation program - it is updated when structure
changes, nothing more.

## Current boundary map (built and tested)

- `apps/engine/src/modules/agent-connect/` - connector interface
  (`AgentConnector`), policy enforcement at dispatch, run policy
  (timeout/output/concurrency), real process executor, token budgets.
  Connectors: `codex-cli` (live, ready), `antigravity-cli` (assurance-gated:
  refuses all dispatch until host-verified; `writeAllowed` refused outright),
  test mock. Every connector declares `provenance: 'mock' | 'live'`,
  recorded on each run.
  agy connector status (2026-11-19): CLI v1.5.12 installed on the lab PC,
  headless smoke passed (JSON envelope incl. `denied_actions`). Host probe
  showed an unscoped `write_file` allow writes outside the workdir under
  `--sandbox` (probe artifact: bare rule + both canaries under /tmp temp
  scope); docs support `write_file(/path)` scoping with Ask->deny fallback
  in headless mode, unverified on host. Corrected session posture encoded
  (`read_file(<workdir>)` only, `write_file(*)`/URL/MCP wildcard denies, no
  command allow so outside-sandbox execution falls to Ask->deny). Assurance
  stays 'documented' (no dispatch) until a corrected bounded probe passes;
  workspace-write may need external isolation (container) regardless.
- `apps/engine/src/modules/idea-research/` - intake validation, strict-JSON
  research report contract, artifacts to local files.
- `apps/engine/src/modules/landing-render/` - report to static HTML draft,
  all agent text escaped, zero external resources.
- `apps/engine/src/modules/run-registry/` - append-only local JSON run index;
  per-owner collision-proof paths (slug + sha256), atomic writes, serialized
  concurrency, credential-shape redaction on stored labels/errors.
- `apps/engine/src/modules/signals-ingest/` - signals slice (pre-existing).
- `apps/web` - status UI: `/app/runs` + `/api/runs` (auth-gated, read-only),
  view model reads the local registry only. Mock-provenance runs are labeled
  SAMPLE DATA at page level and per row; unknown usage is never shown as 0.
  Signals UI: `/app/signals` + `/api/signals/*` (auth-gated) - provenance is
  explicit per row (recorded fixture / manual sample / live-hn), unconnected
  sources render as unavailable states, live HN fetch is one request per
  click, rate-limited, results never stored; drafts stay local until approval.

## Feature classification (A/B/C per the architecture-direction note)

### A - build now (sprint slice)
- Idea intake -> research report -> landing draft -> run status view. Done
  locally with the mock connector; real execution waits on the first live
  connector environment.
- First live connector: Codex CLI + ChatGPT sign-in (candidate route, source:
  https://developers.openai.com/codex/auth and
  https://developers.openai.com/codex/noninteractive). Conditional on
  installed/signed-in state and scoped-access decision.
- Run registry + status UI (done), including policy refusals as first-class
  records.

### B - prepare for later (extension points that exist today)
- Additional live connectors: add a new `AgentConnector` implementation; no
  changes to research/render/registry modules (adapter boundary already
  enforced at dispatch).
- Q&A stage with the user: new engine module consuming the same intake and
  recording to the same registry.
- Lead discovery / launch / monitoring stages: same pattern - one module per
  stage, artifacts on disk, registry as the unified status spine.
- Multi-owner use: registry paths are per-owner and collision-proof; the web
  slice resolves the owner from the session.

### C - not now
- Real Antigravity dispatch (no enforceable isolation; connector refuses).
- Leadloom-held AI API keys (user constraint: no own key this sprint).
- Publishing/deploying anything from the pipeline (all artifacts local).
- Multi-channel posting, payments, hosted multi-tenant infra.

## Standing rules (aligned with the direction note)
- Authority is enforced at dispatch or refused - never metadata.
- No speculative abstractions: extension points above exist because a named
  stage needs them, not because they might be useful.
- Tests protect existing behavior before any module changes.
- Agent output is untrusted content: escaped, never clickable, never executed.
- No prompts or credential-shaped strings in logs, registry labels or exports.
