# AGENTS.md — AI Engineering Guidelines & 3-Team Monorepo Orchestrator

> **Notice to AI Agents & LLM Coders:** This repository is an open-core, high-performance Go-To-Market and enrichment engine developed concurrently by **3 independent teams (Alpha, Beta, Gamma)**. Context degradation will break mission-critical concurrency, memory fencing, and encryption guarantees. Before executing any modifications, follow this routing protocol strictly.

---

## 1. Context Protocol & Memory Checkpoint

Before generating or modifying any code in this repository:
1. **Identify Your Assigned Team Persona:**
   - **Team Alpha:** Frontend, 3D WebGL Canvas, Virtual Grid, Idea Validator Micro-Pages.
   - **Team Beta:** Core Data Engine, DAG Enrichment Waterfalls, Headless Signal Scrapers.
   - **Team Gamma:** Outbound Sequencer, SPF/DKIM Deliverability, AES-256 Vault, FinOps & DB.
2. **Consult Team Context Capsule:** Read your team's specific capsule (`docs/context/TEAM_CONTEXT_{ALPHA|BETA|GAMMA}.md`).
3. **Read Cross-Team Differential Feed:** Read ONLY the last 20 lines of `docs/context/SYNC_FEED.md`. **NEVER scan foreign team application code.**
4. **Inspect ADRs:** If modifying team boundaries, encryption, grid virtualization, Docker FinOps, DAG waterfalls, or 3D WebGL, inspect `docs/adr/` before touching code.
5. **Load Required Skills:** Consult the Skill-to-Domain mapping below and load the designated skill before writing files.

---

## 2. Team-to-Directory Ownership Matrix (Zero-Conflict Guardrail)

| Team | Physical Directory Ownership | Prohibited Directories | Primary Contract Interfaces |
| :--- | :--- | :--- | :--- |
| **Team Alpha** | `apps/web/**`<br>`packages/ui/**`<br>`packages/webgl-scenes/**` | `apps/engine/**`<br>`workers/**`<br>`packages/database/**` | Consumes `packages/contracts` & `packages/contracts/src/mocks.ts` |
| **Team Beta** | `apps/engine/src/modules/{waterfall,signals,ai-researcher,validator}/**`<br>`workers/scraper/**`<br>`workers/enrich/**` | `apps/web/**`<br>`packages/ui/**`<br>`apps/engine/src/modules/vault/**` | Implements `waterfall.contract.ts`, `validation.contract.ts` |
| **Team Gamma** | `apps/engine/src/modules/{outbound,auth,vault}/**`<br>`packages/database/**`<br>`docker/**`<br>`docker-compose.yml` | `apps/web/**`<br>`apps/engine/src/modules/waterfall/**` | Implements `outbound.contract.ts`, `vault.contract.ts`, Prisma Client |

> **Contract Lock Rule:** Any cross-team schema or API modification must be made first in `packages/contracts`, followed by an append-only entry in `docs/context/SYNC_FEED.md`.

---

## 3. Skill-to-Domain Routing Matrix

| Scope / Task Type | Files Affected | Designated Skill |
| :--- | :--- | :--- |
| **Landing Page & Marketing Copy** | `apps/web/app/(marketing)/**` | `[Recommended Skill: landing-page-design]` |
| **3D WebGL Living Loom Core & Shaders** | `apps/web/components/marketing/3d/**` | `[Recommended Skill: animate]` `[Recommended Skill: apple-design]` `[Recommended Skill: animation-performance]` |
| **Inertial Scroll & Scrollytelling** | `apps/web/components/marketing/smooth-scroll*` | `[Recommended Skill: animate]` `[Recommended Skill: apple-design]` |
| **Idea Validator & Smoke-Test Pages** | `apps/engine/src/modules/validator/**`, `apps/web/app/v/**` | `[Recommended Skill: backend-patterns]` `[Recommended Skill: landing-page-design]` |
| **UI Polish, Micro-interactions, Craft** | `apps/web/components/**` | `[Recommended Skill: emil-design-eng]` |
| **Animation, Framer Motion, Transitions** | `apps/web/components/animations/**` | `[Recommended Skill: animate]` `[Recommended Skill: animation-performance]` |
| **Virtual Grid Canvas & High-Density UI** | `apps/web/components/grid/**` | `[Recommended Skill: frontend-patterns]` `[Recommended Skill: apple-design]` |
| **Toast Notifications & Interactive Banners** | `apps/web/components/ui/sonner*` | `[Recommended Skill: ask-sonner]` |
| **Core Backend, NestJS, tRPC & BullMQ** | `apps/engine/src/**`, `workers/**` | `[Recommended Skill: backend-patterns]` `[Recommended Skill: coding-standards]` |
| **AES-256-GCM Vault, OAuth, SPF/DKIM** | `apps/engine/src/modules/{vault,outbound}/**`| `[Recommended Skill: security-review]` |
| **Enrichment DAG & Waterfall Tests** | `apps/engine/src/modules/waterfall/**` | `[Recommended Skill: tdd-workflow]` |
| **Edge-Case & Stress-Testing Data Grids**| `apps/web/components/grid/__tests__/**` | `[Recommended Skill: break-ui]` |
| **Mobile & Responsive Viewport Adaptation** | `apps/web/styles/**` | `[Recommended Skill: mobile-native]` |

---

## 4. Strict Tech Stack & Architecture Invariants

- **Web App:** Next.js 14+ (App Router, Standalone output, dynamic routes `/v/[slug]`).
- **Backend API:** NestJS (TypeScript, Fastify adapter preferred for low memory footprint).
- **ORM & DB:** Prisma ORM, PostgreSQL 16 with `pgvector` extension enabled.
- **Queues & Cache:** Redis 7 with BullMQ for job orchestration; Redis token buckets for rate limiting.
- **Virtual Grid:** `@tanstack/react-virtual` + `@tanstack/react-table` with Zustand state slices.
- **3D & Motion Stack:** `@react-three/fiber` + `@react-three/drei`, Three.js, `@studio-freight/lenis`, GSAP / Framer Motion.
- **UI System:** Tailwind CSS v3.4+, Radix UI headless primitives, Lucide icons, Sonner toasts.
- **Headless Worker:** Playwright Chromium in headless mode with resource blocking (images, fonts, stylesheets blocked).

---

## 5. Forbidden Patterns & Anti-Patterns (NEVER DO THIS)

1. ❌ **NEVER Violate Monorepo Team Boundaries:** Never commit edits outside your team's owned physical directory. Propose a change in `packages/contracts` instead.
2. ❌ **NEVER Store BYOK API Keys in Plaintext:** All credentials must be encrypted via `VaultService` using AES-256-GCM with a unique 12-byte IV and 16-byte auth tag.
3. ❌ **NEVER Expose Decrypted Keys to the Client:** Decryption must occur solely inside worker execution loops. API routes must return masked strings (`sk-••••••••abcd`).
4. ❌ **NEVER Render Un-Virtualised High-Volume Lists:** Never use plain `.map()` over rows in the grid canvas. Always use `@tanstack/react-virtual`.
5. ❌ **NEVER Bypass the Domain Cache:** Always check the 30-day domain cache before making an external paid API call (Apollo, Hunter, Dropcontact).
6. ❌ **NEVER Launch Un-Fenced Playwright Browsers:** Never launch headless Chromium without memory fences and resource interception (must block images and media) to prevent crashing budget 4GB VPS servers.
7. ❌ **NEVER Eagerly Load Heavy 3D WebGL Canvases on Initial Paint:** 3D canvases must be lazy-loaded in `<Suspense>` after hydration with an ultra-lightweight ambient CSS fallback. 3D asset bundles must never exceed $500\text{KB}$.
8. ❌ **NEVER Trigger React Re-Renders for Mouse-Tracking Shaders:** Spotlight card border glows must update CSS custom properties (`--mouse-x`, `--mouse-y`) directly on the DOM node.
9. ❌ **NEVER Emit Raw Stack Traces to Users:** Sanitize all external HTTP 429 and 500 error responses into user-friendly diagnostic pills with retry indicators.

---

## 6. Coding Standards & Conventions

- **Monorepo Layout:** Turborepo layout (`apps/web`, `apps/engine`, `workers/scraper`, `packages/contracts`, `packages/database`, `packages/ui`).
- **File Naming:** Kebab-case for all files (`waterfall-cell.tsx`, `token-bucket.service.ts`, `living-loom-canvas.tsx`).
- **Strict TypeScript:** No `any` types permitted. All external API payloads and webhook bodies must be validated with `zod` schemas.
- **Defensive Error Handling:** Every BullMQ worker processor must implement exponential backoff with randomized jitter.

## Design rules
Before any UI, email or copy change read docs/plan/DESIGN_RULES.md and run `node scripts/check-design.mjs`. These rules are binding for all teams and are never optional per task.
