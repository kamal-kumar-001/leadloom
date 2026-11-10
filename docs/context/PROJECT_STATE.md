# LeadLoom — Project State & Operational Ledger

* **Current Architecture Phase:** Phase 1: 3-Team Parallel Monorepo Bootstrap
* **Current Schema Version:** `v0.1.1-alpha` (PostgreSQL 16 + pgvector + Idea Validator)
* **Last Updated:** 2026-11-10
* **Master KEK Status:** Local Dev Ephemeral Key Configured
* **Active Working Branch:** `main`
* **Shared Contracts Version:** `@leadloom/contracts@1.0.0`

---

## 1. Epic Execution State Machine (3-Team Matrix)

| Epic ID | Title | Status | Primary Team Owner | Physical Path | Blockers / Active Considerations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **EPIC-01** | The Reactive Data Canvas (Grid UI) | 🟢 Complete & Verified | **Team Alpha** | `apps/web/components/grid` | Shipped with TanStack Virtual 3.x & Zustand slice state |
| **EPIC-02** | BYOK Adaptive Waterfall Engine | 🟡 Spec Ready | **Team Beta** | `apps/engine/src/modules/waterfall` | Token bucket rate-limiter per provider; DAG early-exit short-circuiting |
| **EPIC-03** | Multi-Signal Intent Ingestion | ⚪ Backlog | **Team Beta** | `workers/scraper` | Playwright memory envelope fencing on 4GB VPS |
| **EPIC-04** | Autonomous AI Researcher Column | ⚪ Backlog | **Team Beta** | `apps/engine/src/modules/ai-researcher` | Structured JSON extraction schemas; Ollama/DeepSeek routing layer |
| **EPIC-05** | Smart Sequencing & Unified Deliverability | ⚪ Backlog | **Team Gamma** | `apps/engine/src/modules/outbound` | IMAP/SMTP OAuth2 token refresh jitter; SPF/DKIM/DMARC DNS lookup caching |
| **EPIC-06** | Pre-Product Idea Validator (Smoke-Test Engine) | 🟢 Complete (Alpha UI) | **Team Beta & Alpha** | `apps/engine/src/modules/validator`<br>`apps/web/app/v/[slug]` | /v/[slug] smoke-test route and ValidationRadarCard shipped |
| **EPIC-07** | Living 3D WebGL Canvas & Scrollytelling | 🟢 Complete & Verified | **Team Alpha** | `apps/web/components/marketing/3d` | Shipped with R3F canvas, procedural fibers, and Lenis scroll |
| **EPIC-08** | AES-256 Vault & FinOps Infrastructure | 🟡 Spec Ready | **Team Gamma** | `apps/engine/src/modules/vault`<br>`docker-compose.yml` | AES-256-GCM envelope encryption; 4GB RAM VPS resource quotas |

*Status Legend:*
- 🟢 Complete & Verified
- 🟡 Spec Ready / In Development
- ⚪ Backlog / Unscheduled
- 🔴 Blocked

---

## 2. Active Technical Blockers & Decisions

1. **Monorepo Directory Isolation:**
   - Physical directory boundaries locked via `AGENTS.md`. Cross-team communication is restricted to `@leadloom/contracts`.
2. **3D WebGL Performance Budget (500KB Cap):**
   - R3F canvas is lazy-loaded in `<Suspense>` after hydration with zero-JS CSS/SVG ambient fallback.
   - Draco compression mandated for `.glb` models; assets served via static CDN / Cloudflare R2 free tier.
3. **Zero-Marginal-Cost Smoke-Test Micro-Sites:**
   - `/v/[slug]` dynamic routes are backed by a 1-hour Redis edge cache (`SETEX page:slug 3600`) to prevent DB contention during traffic spikes.
4. **Memory Budget on Budget VPS (4GB RAM):**
   - Playwright Chromium instances must run sequentially or with max concurrency = 2 to avoid Linux cgroup OOM kills. Host swapfile (2GB) is mandatory.

---

## 3. Schema Version & Migration Registry

* **Schema Epoch:** `20261110_init_v2`
* **Core Tables:**
  - `workspaces`: Tenant boundaries, billing flags, local preferences.
  - `users`: Authentication, RBAC (`admin`, `member`, `read_only`).
  - `tables`, `columns`, `rows`, `cells`: Dynamic spreadsheet engine.
  - `validation_experiments`, `smoke_test_pages`, `waitlist_leads`: Pre-product idea validation.
  - `byok_credentials`: AES-256-GCM encrypted API keys.
  - `enrichment_cache`: Global domain-level cache (30-day TTL).
  - `campaigns`, `mailboxes`, `outreach_events`: Sequencer & deliverability.
  - `suppression_list`: SHA-256 hashed opt-outs.

---

## 4. Context Preservation Checkpoint for AI Agents

> **Rule for AI Agents:** Before editing any service or component, inspect `docs/context/TEAM_CONTEXT_{ALPHA|BETA|GAMMA}.md` and read the last 20 entries of `docs/context/SYNC_FEED.md`. Never refactor cross-team contracts or database models without consulting the assigned team capsule and referencing the corresponding ADR.
