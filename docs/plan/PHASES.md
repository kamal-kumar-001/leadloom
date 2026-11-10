# LeadLoom: Working-Product Plan (phases and teams)

Direction from Kamal (2026-11-10 18:38): functionality first. Design polish comes later. Everything below keeps the main-only workflow. All new capability ships default-off behind flags. Nothing here implies a deploy, real provider calls, real sends or spend.

## Ground rules
- Branch: `main` only. Commits as Kamal. Pull before push. Never reset --hard, never overwrite `.env`.
- Design uses CSS variables (tokens) only: no hard-coded colors in new code. Light and dark themes for the dashboard.
- Demo content stays labelled demo. An incomplete API is never described as working.
- Connector behavior is built from public docs and our own code. No copied proprietary code or assets, no access-control bypass. Reused code from Kamal's own DMPilot / BakeryPOS repos keeps its own license and his ownership.
- The product reference is not named in the app or public docs.

## Teams
| Team | Who | Owns |
|---|---|---|
| Alpha | Kamal assigns (brief: `ALPHA_BRIEF.md`) | `apps/web/**`, `packages/ui/**`: dashboard shell, NextAuth screens, theme tokens, grid UI |
| Beta | Lab Antigravity (brief: `BETA_BRIEF.md`) | `apps/engine/src/modules/{waterfall,signals,ai-researcher,validator}/**`, `workers/**`: connectors and enrichment workers |
| Gamma | This agent | `apps/engine/src/modules/{outbound,vault,auth}/**`, `packages/database/**`, runtime wiring, integration and release |

Contracts live in `packages/contracts`. A change there is announced in `docs/context/SYNC_FEED.md`.

## Phases
**Phase 0: release hygiene (Gamma, done a5f2d5e).** Migration history compatible with the old recorded history and fresh DBs, verified on PG16 fixtures. Release condition: `migrate deploy` applies only `20261111_inbound_sync_ensure`. A redeploy needs Kamal's approval.

**Phase 1: auth and app shell.**
- Alpha: NextAuth (Auth.js v5) in `apps/web`, credentials plus Google/GitHub providers behind env, session cookie, protected `/app/*` layout, theme tokens, light/dark toggle, sidebar shell reusing DMPilot/BakeryPOS components and the grid-gradient background in LeadLoom tokens.
- Gamma: engine accepts the NextAuth session (shared signing secret, JWT verify) in place of the dev login issuer. Workspace and member tables, RBAC mapping. Flag `LEADLOOM_NEXTAUTH_BRIDGE_ENABLED`.
- Beta: connector interface and registry (below), no UI.

**Phase 2: connectors and enrichment.**
- Beta: connector SDK (`id`, `capabilities`, `auth`, `rateLimit`, `run`), implementations per `CONNECTORS.md`, a contract test suite per connector using recorded fixtures, BYOK keys read only through the vault port.
- Gamma: `/connectors` routes (list, connect, test-key), vault storage, per-workspace enablement, mailbox connect routes (Google and Microsoft OAuth already built as a library).
- Alpha: connector gallery and key-entry UI against `packages/contracts` mocks.

**Phase 3: tables, waterfall and sequencing.**
- Gamma: dispatch worker that consumes jobs (today dispatch returns a job id only), DB-backed validator persistence, mailbox token refresh scheduling.
- Beta: waterfall runs on the queue, CSV import, enrichment columns.
- Alpha: grid wired to live endpoints.

**Phase 4: outbound and validator.** Sequences, reply sync, webhook HMAC endpoints, scorecards. Real sending needs Kamal's explicit go.

**Phase 5: hardening.** Isolated PG16 suite in CI-like script, redeploy runbook, design polish pass.

## Integration gates (Gamma)
Every phase ends with: engine tests, tsc, isolated PG16 run (gated spec), migration fixture check (old history and empty DB), and a timestamped live check only after an approved deploy.

## What Kamal needs to provide (short)
Only when a phase reaches it. See `ACCESS_NEEDS.md`.
