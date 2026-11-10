# Team Beta Context Capsule — Core Data Engine, DAG Waterfalls & Scrapers

* **Team Name:** Team Beta (Data Processing & Enrichment Pipelines)
* **Designated Skills:** `[Recommended Skill: backend-patterns]` `[Recommended Skill: coding-standards]` `[Recommended Skill: tdd-workflow]` `[Recommended Skill: memory-leak-debugging]`
* **Primary Scope:** Adaptive DAG waterfall engine, BullMQ queues, Crawlee/Playwright headless scrapers, 30-day domain cache, and Idea Validator backend synthesis.

---

## 1. Owned Physical Directories (Strict Write Permissions)
- `apps/engine/src/modules/waterfall/**`
- `apps/engine/src/modules/signals/**`
- `apps/engine/src/modules/ai-researcher/**`
- `apps/engine/src/modules/validator/**`
- `workers/scraper/**`
- `workers/enrich/**`

> **Forbidden Pattern:** Team Beta agents are strictly forbidden from modifying `apps/web/**`, `packages/ui/**`, or `apps/engine/src/modules/vault/**`. Any schema alterations must be coordinated through `packages/contracts` and `packages/database`.

---

## 2. Shared Contracts & Interfaces (`packages/contracts`)
- **Implements:**
  - `waterfall.contract.ts` (`PreFlightEstimateResponse`, `DispatchWaterfallRequest`, `WaterfallCellPayload`)
  - `validation.contract.ts` (`GenerateValidationRequest`, `ValidationScorecardResponse`)
- **Consumes:**
  - `vault.contract.ts` (Calls `VaultService.decrypt()` strictly within worker execution loops)

---

## 3. Active Task Queue
1. **DAG Waterfall Short-Circuit Engine:** Build topological node sort with early-exit predicates (abort downstream nodes once an email is verified deliverable).
2. **Domain-Level FinOps Deduplication:** Hash queries `SHA256(provider + ":" + domain)` with 30-day TTL in Redis and Postgres `enrichment_cache`.
3. **Headless Scraper Worker:** Build Playwright scraper with resource interception (block images/fonts/CSS) and 640MB memory fencing.
4. **Idea Validator Decomposition:** Ingest 2-sentence raw hypotheses and output structured ICP criteria, micro-page copy, and validation outreach sequences.

---

## 4. Context Checkpoint Protocol
Before writing code:
1. Read the last 20 lines of `docs/context/SYNC_FEED.md`.
2. Inspect `docs/adr/004-dag-waterfall-early-exit.md` and `docs/adr/003-single-vps-finops-docker.md`.
3. Load designated skill before editing service files.
