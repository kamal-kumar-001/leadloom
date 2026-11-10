# LeadLoom — Modular Dependency Graph & EGM Index (MODULE_MAP)

This document serves as the **Extended Graph Memory (EGM)** index for AI agents and engineers. It defines the module boundaries, state ownership, communication topologies, and required specialized Agent Skills across the LeadLoom codebase.

---

## 1. High-Level Module Topology & Data Flow

```
                      ┌────────────────────────────────────────┐
                      │          Landing & Marketing           │
                      │  useleadloom.com / 3D Living Loom Core │
                      │  [Skill: landing-page-design]         │
                      │  [Skill: animate] [Skill: apple-design]│
                      └───────────────────┬────────────────────┘
                                          │ Direct Web
                      ┌───────────────────▼────────────────────┐
                      │         Web Client (Next.js 14)        │
                      │  • Virtual Grid Canvas (TanStack)      │
                      │  • Waterfall DAG Builder (React Flow)  │
                      │  • Split Sequencer ("Loom View")       │
                      │  • Idea Validator (/v/[slug] routes)   │
                      │  • 3D WebGL Canvas (@react-three/fiber)│
                      │  • State: Zustand Normalized Slices    │
                      │  [Skill: frontend-patterns]            │
                      └──────────────┬──────────────────▲──────┘
                                     │ tRPC / REST      │ WebSockets
                      ┌──────────────▼──────────────────┴──────┐
                      │        Core API Engine (NestJS)        │
                      │  • Workspace & RBAC Controller         │
                      │  • Vault & BYOK Encryption Manager     │
                      │  • Pre-Product Idea Validator Engine   │
                      │  • Telemetry & FinOps Cost Tracker     │
                      │  [Skill: backend-patterns]             │
                      └──────────────┬─────────────────────────┘
                                     │ Redis BullMQ Jobs
      ┌──────────────────────────────┼──────────────────────────────┐
      │                              │                              │
┌─────▼────────────────────────┐ ┌───▼────────────────────────┐ ┌───▼────────────────────────┐
│   Waterfall Engine Worker    │ │   Signal Scraping Worker   │ │     Sequencer Worker       │
│ • DAG Cascade Resolver       │ │ • Playwright Headless Bot  │ │ • SMTP/IMAP Mailbox Pool   │
│ • Provider Connectors (BYOK) │ │ • Career/TechStack Watcher │ │ • Deliverability / Warmup  │
│ • 30-Day Domain Cache        │ │ • Markdown Extraction      │ │ • Bounce & Spam Tracker    │
│ [Skill: backend-patterns]    │ │ • RAM-fenced cgroups       │ │ • OAuth2 Token Rotator     │
│ [Skill: tdd-workflow]        │ │ [Skill: backend-patterns]  │ │ [Skill: security-review]   │
└──────────────┬───────────────┘ └───┬────────────────────────┘ └───┬────────────────────────┘
               │                     │                              │
               └─────────────────────┼──────────────────────────────┘
                                     │
                      ┌──────────────▼─────────────────────────┐
                      │       Persistence & Broker Tier        │
                      │  • PostgreSQL 16 (Relational + JSONB)  │
                      │  • pgvector (ICP & Embeddings)         │
                      │  • Redis 7 (Queues, Tokens, Edge Cache)│
                      └────────────────────────────────────────┘
```

---

## 2. Module Directory & Responsibility Matrix

| Module Key | Directory Path | Core Responsibilities | State Owner | Primary Interfaces | Required Agent Skill |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`grid-ui`** | `apps/web/components/grid/` | High-density 50k+ row virtual table, column resize, cell hover micro-traces, inline editors | Zustand `useLoomStore` | TanStack Virtual, WebSocket cell sync | `[Recommended Skill: frontend-patterns]`<br>`[Recommended Skill: animation-performance]` |
| **`landing-ui`** | `apps/web/app/(marketing)/` | Conversion landing page, interactive playable hero grid, credit markup calculator, bento grid | React State / Local Storage | Client-side mock waterfall simulation | `[Recommended Skill: landing-page-design]`<br>`[Recommended Skill: apple-design]` |
| **`landing-3d-canvas`** | `apps/web/components/marketing/3d/` | Living Loom 3D Core, cursor-reactive fiber threads, WebGL shaders, Lenis inertial scroll | Three.js / WebGL Context | React Three Fiber, Lenis, GSAP ScrollTrigger | `[Recommended Skill: animate]`<br>`[Recommended Skill: apple-design]`<br>`[Recommended Skill: animation-performance]` |
| **`idea-validator`** | `apps/api/src/validation/`<br>`apps/web/app/v/[slug]/` | One-prompt hypothesis parsing, ICP derivation, smoke-test micro-page rendering, Go/No-Go scorecard | Postgres `validation_experiments` + Redis edge cache | Next.js dynamic route `/v/[slug]`, ValidationService | `[Recommended Skill: backend-patterns]`<br>`[Recommended Skill: landing-page-design]` |
| **`waterfall-engine`** | `apps/api/src/waterfall/` | DAG cascade execution, short-circuit exit conditions, provider adapters (Apollo, Hunter, Dropcontact) | Redis BullMQ + Postgres `cells` | BullMQ `waterfall-queue`, Redis token bucket | `[Recommended Skill: backend-patterns]`<br>`[Recommended Skill: tdd-workflow]` |
| **`vault`** | `apps/api/src/vault/` | BYOK credential lifecycle, AES-256-GCM encryption/decryption, provider validation pings, in-memory zeroing | Postgres `byok_credentials` | Crypto module, VaultService interface | `[Recommended Skill: security-review]` |
| **`signal-scrapers`** | `apps/workers/scrapers/` | Playwright headless DOM parsing, markdown conversion, job board monitoring, GitHub stargazer tracking | Ephemeral worker / Redis queue | Headless Chromium, Cheerio, Readability | `[Recommended Skill: backend-patterns]` |
| **`smtp-sequencer`** | `apps/api/src/sequencer/` | Mailbox rotation pool, jittered sending delays, SPF/DKIM/DMARC health verification, IMAP reply classification | Postgres `campaigns`, `mailboxes` | Nodemailer, ImapFlow, BullMQ `outbound-queue` | `[Recommended Skill: security-review]`<br>`[Recommended Skill: backend-patterns]` |
| **`finops-cache`** | `apps/api/src/cache/` | Domain-level 30-day response deduplication, external API cost counter, rate-limit token bucket | Redis + Postgres `enrichment_cache` | CacheService, TokenBucketLimiter | `[Recommended Skill: backend-patterns]` |

---

## 3. Communication Protocols & Contracts

### 3.1 Frontend-to-Backend
- **tRPC:** Type-safe RPC router for user mutations, workspace settings, column definitions, campaign triggers, and validation experiments.
- **WebSocket Gateway (`/ws/canvas`):** Bi-directional socket delivering high-frequency cell state updates (`PENDING -> RUNNING -> VERIFIED -> EXHAUSTED`) and real-time waitlist lead notifications.
- **Dynamic Micro-Site Route (`/v/[slug]`):** Next.js App Router server component rendering cached smoke-test pages at zero marginal compute cost.

### 3.2 Worker Job Topology (BullMQ)
- **`waterfall-queue`:** Processes individual row enrichment cascades. Concurrency: 20 per worker on 4GB VPS.
- **`scraper-queue`:** Dispatches headless browser scrapes. Strict concurrency: 2 instances max, RAM-fenced to prevent OOM.
- **`outbound-queue`:** Executes scheduled email dispatches with randomized jitter (e.g. 45–180s delay between emails on the same mailbox).
- **`validation-queue`:** Dispatches asynchronous idea decomposition, ICP audience matching, and automated reply sentiment analysis.
- **`dlq-queue` (Dead Letter Queue):** Holds unrecoverable failed jobs for operator inspection and retry.

---

## 4. Architectural Boundary Rules for AI Agents

1. **Isolation of Decryption:** Never import or invoke the `VaultService.decrypt()` method inside frontend components or API route serialization layers. Decryption is permitted strictly inside isolated BullMQ background worker executions.
2. **Virtualization Invariance:** Never render table rows via standard un-virtualized `<tbody>` mapping. All grid rows and high-cardinality column groups must pass through `@tanstack/react-virtual`.
3. **Cache-First Invariant:** Every waterfall node must check the `finops-cache` module before dispatching an outbound HTTP call to a paid external vendor API.
4. **Zero-Overhead 3D WebGL Budget:** The 3D Living Loom scene bundle must never exceed 500KB total. Always enforce lazy hydration with an ambient CSS fallback to keep First Contentful Paint $< 1.2\text{s}$.
5. **Zero Main-Thread Freezing:** Long computations (CSV parsing $> 1,000$ rows, formula evaluations, multi-column fuzzy filters) must run in Web Workers (`apps/web/workers/`).
