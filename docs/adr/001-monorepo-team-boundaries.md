# 001: Monorepo Architecture & Zero-Conflict 3-Team Governance

* **Status:** Accepted
* **Date:** 2026-11-10
* **Deciders:** Principal Staff Engineer, Chief Product Architect, Multi-Agent Orchestrator
* **Context:** LeadLoom is developed simultaneously by 3 independent engineering teams (and their autonomous AI coding agents): Team Alpha (Frontend & 3D Web), Team Beta (Data Processing & Waterfalls), and Team Gamma (Sequencer, Security & Infra). Without strict physical directory ownership and decoupled contracts, concurrent agent edits create Git merge conflicts, broken builds, and severe context thrashing.
* **Recommended Skill:** `[Recommended Skill: coding-standards]` `[Recommended Skill: backend-patterns]`

---

## Decision

We establish a **Strict Turborepo Monorepo Topology** with physical directory fencing and contract-first decoupling:

1. **Physical Directory Ownership Matrix:**
   - **Team Alpha:** `apps/web/**`, `packages/ui/**`, `packages/webgl-scenes/**`
   - **Team Beta:** `apps/engine/src/modules/{waterfall,signals,ai-researcher,validator}/**`, `workers/scraper/**`, `workers/enrich/**`
   - **Team Gamma:** `apps/engine/src/modules/{outbound,auth,vault}/**`, `packages/database/**`, `docker/**`, `docker-compose.yml`

2. **The Contract-First Boundary (`packages/contracts`):**
   - No team is permitted to directly call or import unversioned private classes or functions from another team's application package.
   - All inter-team requests, responses, WebSocket event payloads, and queue jobs are defined as Zod schemas and TypeScript interfaces inside `packages/contracts`.
   - Any modification to `packages/contracts` requires a version bump and an update to deterministic mock fixtures (`packages/contracts/src/mocks.ts`).
   - Team Alpha develops all frontend views, 3D canvases, and forms against deterministic mock fixtures without waiting for Team Beta or Gamma backend implementation.

3. **Append-Only Cross-Team Sync Feed (`docs/context/SYNC_FEED.md`):**
   - To eliminate context degradation across 50k+ lines of code, AI agents are **forbidden from scanning foreign team source code**.
   - Agents read only the last 20 entries of `docs/context/SYNC_FEED.md` to acquire cross-team awareness of new contract releases or API migrations.
   - After completing cross-boundary features, the agent appends a concise 3-line record to `SYNC_FEED.md`.

---

## Consequences

### Positive
- Zero Git merge conflicts across the 3 independent teams.
- True parallel velocity: Team Alpha can build complete interactive screens and 3D scenes on Day 1 using mock contracts.
- AI agents maintain 100% focused context inside their assigned team capsule (`TEAM_CONTEXT_{ALPHA|BETA|GAMMA}.md`).

### Negative / Trade-offs
- Modifying cross-team APIs requires a two-step process: updating `packages/contracts` first before consuming it in `apps/web` or `apps/engine`.
