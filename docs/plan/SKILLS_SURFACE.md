# Leadloom Skills & Tool Surface Specification

> **Document Version:** 1.0.0  
> **Status:** Active  
> **Audience:** External Coding Agents (Claude Code, Cursor, Windsurf, Antigravity, OpenHands), Engineering Teams (Alpha, Beta, Gamma), Founders.

---

## 1. Executive Summary & Core Philosophy

Leadloom is an **open-core, high-performance plugin and execution substrate for the customer's coding agent**.

```
┌─────────────────────────────────────────────────────────────┐
│                 Customer's Coding Agent                     │
│    (Claude Code / Cursor / Windsurf / Antigravity / etc.)    │
│                                                             │
│              [ THE BRAIN & REASONING ENGINE ]               │
└──────────────────────────────┬──────────────────────────────┘
                               │
            Calls Instruction Packs, Tools & Endpoints
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Leadloom Plugin                        │
│                                                             │
│   • Instruction Packs (`skills/*/SKILL.md`)                 │
│   • Multi-Project Account State & Decision Memory           │
│   • High-Performance Execution Endpoints & Connectors       │
│   • Verification Fences, Rate Limiters & AES-256 Vault      │
└─────────────────────────────────────────────────────────────┘
```

### Invariant Rules
1. **The Coding Agent is the Brain:** The external agent performs all reasoning, LLM generation, synthesis, decision evaluation, and user prompting. Leadloom **never** launches, wraps, or drives the agent.
2. **Leadloom is the System of Record & Tool Provider:** Leadloom provides deterministic instruction packs (`skills/*/SKILL.md`), authenticated API endpoints, database persistence, and external service connectors.
3. **No Hallucinated Endpoints:** Skill packs only cite endpoints that physically exist in the codebase (`apps/web/app/api/` and `apps/engine/src/main.ts`). Missing capabilities are cataloged under explicit `## Gaps` sections.

---

## 2. The Two Core Architectural Invariants

### 2.1. Account-Level Persistent Project Memory
A major failure mode in autonomous coding agents is context amnesia between sessions: every new prompt requires the founder to re-explain the business model, past decisions, experiment results, and customer feedback.

Leadloom acts as the persistent, account-level memory layer:
- **Project Memory Store:** All historical runs, experiment setups, scorecards, competitor leads, intent signals, and outbound campaigns are saved to persistent Leadloom tables in PostgreSQL/local run-registry.
- **Session State Restoration (Step 1 of Every Skill):** Before taking any action, the coding agent calls Leadloom's read endpoints to hydrate the project's historical context, active experiments, and previous decisions.
- **Session State Persistence (Final Step of Every Skill):** After completing work, the coding agent records its conclusions, experiment variants, outreach events, and run metadata back to Leadloom.

### 2.2. Multi-Project Account Architecture
One founder account runs **many independent projects** simultaneously.
- A single workspace houses multiple distinct ventures, each identifiable by an experiment ID, slug, table, or project tag.
- All tools and endpoints are multi-tenant and project-aware: metrics, waitlists, and outreach campaigns for "Project A" never collide with or pollute "Project B".
- Founders can run concurrent agent sessions on different repositories or ideas under the same master Leadloom account.

---

## 3. The 7-Stage Venture Journey

Leadloom's skill architecture supports the founder and coding agent through every phase of building a company from zero to venture-scale:

```
  Stage 1: Idea (Feasibility, TAM, Problem-Solution fit, Smoke-test design)
     │
  Stage 2: Research (Competitor mining, Buyer discovery, Intent signals)
     │
  Stage 3: Build (Codebase generation, Architecture, MVP development)
     │
  Stage 4: Launch (Smoke-test landing pages, Domain activation)
     │
  Stage 5: Customers (Waitlist capture, Lead qualification, Feedback loops)
     │
  Stage 6: Growth (Outreach sequencing, Conversion tracking, Scheduled posting)
     │
  Stage 7: Investor Outreach (Traction scorecards, Metrics export, Pitch proofs)
```

| Stage | Focus & Value Proposition | First-Slice Skill Pack | Leadloom Substrate |
| :--- | :--- | :--- | :--- |
| **1. Idea** | Stress-test concept, evaluate unit economics, design smoke tests | `skills/idea-feasibility/` | `modules/idea-qa`, `modules/validator` |
| **2. Research** | Uncover competitor pain points, scrape intent signals, discover buyers | `skills/competitor-review-mining/` | `modules/ai-researcher`, `modules/signals-ingest` |
| **3. Build** | Agent writes code, Leadloom provides contracts, mocks & connectors | *Agent native coding* | `packages/contracts`, `apps/engine` |
| **4. Launch** | Deploy smoke-test pages to test market demand before writing full app | `skills/landing-publish/` | `modules/validator`, `modules/landing-render` |
| **5. Customers** | Capture early waitlist leads, measure conversion velocity | `skills/lead-capture/` | `modules/validator`, `modules/workspace-read` |
| **6. Growth** | Scale validated offers via controlled outbound and scheduled posts | `skills/outreach-recording/`<br>`skills/scheduled-posting/` | `modules/outbound`, `modules/signals-ingest` |
| **7. Investor Outreach** | Export verified traction scorecards and conversion metrics | *Future Pack (Stage 7)* | `modules/validator`, `modules/workspace-read` |

---

## 4. Skill Pack Anatomy (`SKILL.md` Standard)

Every skill pack in the `skills/` directory conforms to the following specification:

```markdown
---
name: <kebab-case-skill-name>
description: <Short description of capability>
stage: <Idea | Research | Build | Launch | Customers | Growth | Investor Outreach>
---

# <Human-Readable Skill Title>

## When to Use
<Specific trigger scenarios for when the coding agent should load and run this pack>

## Multi-Project Context & State Protocol
<How the agent maintains state across multiple projects within the account>

## Numbered Agent Execution Protocol
1. **Step 1: State Restoration (Query Leadloom):** Query current project history.
2. **Step 2..N: Agent Reasoning & Execution:** Agent conducts analysis using its own LLM.
3. **Final Step: State Persistence (Save to Leadloom):** Record output, decisions, and run logs.

## Exact Leadloom Endpoints Called
<Exclusively verified existing routes under apps/web/app/api/ and apps/engine/src/main.ts>

## Gaps
<Explicitly documented missing endpoints required for complete end-to-end automation>
```

---

## 5. First-Slice Skill Directory Index

The initial slice implements 6 foundational packs spanning Stages 1, 2, 4, 5, and 6:

1. **`skills/idea-feasibility/SKILL.md` (Stage 1: Idea):**  
   Evaluates venture feasibility, checks historical experiment records, generates smoke-test experiments with value proposition variants, and reads validation scorecards.
2. **`skills/competitor-review-mining/SKILL.md` (Stage 2: Research):**  
   Analyzes competitor domain text and hiring-board intent fixtures, derives ICP hints and relevance reasons, searches live Hacker News posts, and saves leads.
3. **`skills/landing-publish/SKILL.md` (Stage 4: Launch):**  
   Manages the lifecycle of smoke-test landing pages, toggling published status and verifying live public page rendering.
4. **`skills/lead-capture/SKILL.md` (Stage 5: Customers):**  
   Records waitlist leads, tracks conversion rates on active experiments, and retrieves captured lead rows from workspace tables.
5. **`skills/outreach-recording/SKILL.md` (Stage 6: Growth):**  
   Records outreach attempts against smoke-test pages to update conversion metrics, and stages controlled outbound email campaigns into the approval queue.
6. **`skills/scheduled-posting/SKILL.md` (Stage 6: Growth):**  
   Enqueues timed outbound jobs with scheduled release timestamps, manages approval queues, and stages social signal outreach drafts.

---

## 6. Verified Codebase Endpoints Catalog

External coding agents interact with Leadloom through two network interfaces:
- **Web App API (`apps/web/app/api/**`):** Requires a signed NextAuth browser session cookie or proxying to engine.
- **Engine Direct API (`apps/engine/src/main.ts`):** Fastify microservice accepting either:
  1. An engine session Bearer token (`Authorization: Bearer <sessionToken>`) minted for human users.
  2. A project-bound or workspace-scoped Agent Token (`Authorization: Bearer lld_agt_...`) minted via the Projects setup UI (`/app/projects`) or `POST /agent-tokens`.
- **Authentication Status (Verified & Active):**
  - External coding agents authenticate autonomously using scoped `Bearer lld_agt_...` tokens.
  - State restoration and persistence are executed via canonical endpoints: `GET /agent/context` and `POST /agent/context`.
  - Tokens are stored SHA-256 hashed at rest and revealed only once upon issuance.
  - Token scopes (`project:context:read`, `project:context:write`) and canonical project UUIDs are enforced server-side. Human administrative routes (e.g. project creation) remain strictly forbidden to agent tokens.

### 6.1. Workspace, Tables & State Restoration
- `GET /api/engine/workspace/summary` — High-level workspace counters and statistics.
- `GET /api/engine/workspace/tables` — Lists all persisted data tables in the workspace.
- `GET /api/engine/workspace/tables/:tableId/rows` — Returns all rows for a given table.
- `GET /api/engine/workspace/experiments` — Lists all smoke-test experiments across projects.
- `GET /api/runs` — Returns local run registry history for the user session.

### 6.2. Idea & Validation Module (`modules/validator/`)
- `POST /api/engine/validator/experiments` — Creates an experiment from `rawHypothesis` (10-500 chars) with optional `preferredSlug`; decomposes hypothesis into smoke-test page copy and initial scorecard.
- `GET /api/engine/validator/experiments/:id/page` — Owner view of the experiment and copy.
- `POST /api/engine/validator/experiments/:id/publish` — Sets experiment status to `published` (requires strict `{ expectedRevision }` matching the reviewed owner-page revision; missing/invalid revision400, changed copy409; returns `{ experimentId, slug, status }`).
- `POST /api/engine/validator/experiments/:id/unpublish` — Sets experiment status to `draft` (requires strict `{ expectedRevision }` matching the reviewed owner-page revision; missing/invalid revision400, changed copy409; returns `{ experimentId, slug, status }`).
- `POST /api/engine/validator/experiments/:id/outreach` — Updates observed outreach metrics via exact non-negative integers `{ outreachSent, replies, positiveReplies }` and returns updated scorecard.
- `GET /api/engine/validator/experiments/:id/scorecard` — Returns validation scorecard and conversion rates (visits and leads live strictly under `metrics`).
- `GET /api/v/[slug]` (proxies to `/validator/pages/:slug`) — Public page data for rendering smoke tests.
- `POST /api/v/[slug]/leads` (proxies to `/validator/pages/:slug/leads`) — Public waitlist lead submission.

### 6.3. Research & Buyer Discovery Module (`modules/ai-researcher/`)
- `POST /api/engine/research/website-signals` — Heuristic keyword extraction on competitor domain and page text.
- `POST /api/engine/research/website-signals/save` — Persists analyzed domain lead to workspace research table.
- `GET /api/engine/research/leads` — Lists saved research leads.
- `POST /api/engine/research/intent-fixture` — Heuristic analysis on hiring-board JSON fixtures.
- `POST /api/engine/research/intent-fixture/save` — Persists intent fixture analysis to workspace table.
- `GET /api/engine/research/intent-signals` — Lists saved intent analyses.

### 6.4. Signals & Discussion Discovery (`modules/signals-ingest/`)
- `GET /api/signals/live-hn?q={query}` — Bounded search over live Hacker News discussions matching ICP terms.
- `GET /api/signals/drafts` — Lists staged signal outreach drafts.
- `POST /api/signals/drafts` — Stages a new signal response draft.
- `POST /api/signals/drafts/:id/decision` — Approves or rejects a staged signal draft.

### 6.5. Outbound & Campaign Module (`modules/outbound/`)
- `POST /api/engine/workspace/campaigns` — Creates an outbound campaign draft.
- `GET /api/engine/workspace/campaigns` — Lists outbound campaigns.
- `POST /api/engine/campaigns/:campaignId/recipients` — Adds recipients to campaign.
- `GET /api/engine/campaigns/:campaignId/recipients` — Lists recipients in campaign.
- `POST /api/engine/outbound/jobs` — Enqueues outbound message job (enters `pending_approval`).
- `GET /api/engine/outbound/approvals` — Lists jobs waiting for human approval.
- `POST /api/engine/outbound/approvals/approve` — Explicit bounded reviewed jobIds plus exact expectedRevisions map; stale review cannot approve newer unseen copy/sender. ID-only/approve-all rejected. Per-job `/outbound/approvals/:id/approve` requires expectedRevision. Both are human-session-only and approval remains held.
- `POST /api/engine/outbound/approvals/reject` — Rejects held jobs.
- `POST /api/engine/outbound/approvals/:id/sender` — Pins message to specific sender mailbox.
- `POST /api/engine/outbound/release` — Releases approved jobs to send worker (if enabled).
- `POST /api/engine/outbound/suppressions` — Suppresses an email address.
- `GET /api/engine/outbound/replies` — Checks inbound replies.

---

## 7. Consolidated Gaps Registry

To preserve architecture integrity, the following endpoints are identified as missing and must **never** be called or invented by an agent until formally implemented in the engine:

| Skill / Domain | Missing Endpoint / Capability | Proposed Route | Rationale & Requirements |
| :--- | :--- | :--- | :--- |
| **`all-skills` (IMPLEMENTED)** | Agent API Token Issuance & Auth (Slice A) | `POST /agent-tokens`, `GET /agent-tokens`, `POST /agent-tokens/:id/revoke` | **Implemented in Slice A:** External coding agents authenticate to engine routes using scoped `Bearer lld_agt_...` tokens. Stored SHA-256 hashed at rest and shown once at issuance. |
| **`all-skills` (IMPLEMENTED)** | Project Registry (Slice C) | `POST /projects`, `GET /projects` | **Implemented in Slice C:** Workspace-isolated projects registry with canonical UUIDs, slug ambiguity protection, and foreign-tenant access denial. |
| **`all-skills` (IMPLEMENTED)** | Project-Scoped Context Memory (Slice B) | `GET /agent/context`, `POST /agent/context` | **Implemented in Slice B:** Persistent, project-bound context storage (up to 256KB) for external agents to restore and persist state across sessions. |
| **`all-skills` (IMPLEMENTED)** | Customer Setup UI (Slice C) | Web `/app/projects` | **Implemented in Slice C:** Project create/select, token issue/reveal/revoke, and secure environment setup snippets for customer coding agents. |
| **`idea-feasibility`** | Structured Q&A HTTP Route | `POST /api/engine/idea-qa/intake` | Module `apps/engine/src/modules/idea-qa` exists with `intakeIdeaQa()`, but has no mounted Fastify route in `main.ts`. |
| **`idea-feasibility`** | Multi-Project Comparative Scorecard | `GET /api/engine/validator/comparative-scorecard` | Required to rank multiple venture ideas side-by-side on conversion velocity. |
| **`idea-feasibility`** | Project Tagging & Namespacing | `PATCH /api/engine/validator/experiments/:id/project` | Binds experiments explicitly to project slugs in multi-project accounts. |
| **`idea-feasibility`** | Rich Custom Variant Payload | `POST /api/engine/validator/experiments` | Endpoint currently accepts only `{ rawHypothesis, preferredSlug }` and strips unknown keys. Custom variant arrays, headline, subhead, ctaText, targetLeads not directly settable. |
| **`competitor-review-mining`** | Review Platform Ingestion | `POST /api/engine/research/reviews/ingest` | Scrapes or ingests G2, Capterra, Trustpilot, or ProductHunt reviews for automated mining. |
| **`competitor-review-mining`** | Sentiment & Complaint Extraction | `POST /api/engine/research/sentiment-extract` | Heuristic clustering of user complaints and unmet feature requests. |
| **`competitor-review-mining`** | Competitor Matrix Store | `POST /api/engine/research/competitor-matrix` | Stores structured competitive feature matrices in workspace tables. |
| **`landing-publish`** | Custom Domain / CNAME Binding | `POST /api/engine/validator/experiments/:id/domains` | Connects custom root/subdomains with automated SSL verification. |
| **`landing-publish`** | Static Bundle Export | `GET /api/engine/validator/experiments/:id/export` | Downloads self-contained HTML/CSS/JS export for hosting outside Leadloom. |
| **`landing-publish`** | OpenGraph Social Card Generator | `POST /api/engine/validator/experiments/:id/og-image` | Renders dynamic preview images for social sharing. |
| **`lead-capture`** | Direct CSV Lead Export | `GET /api/engine/validator/experiments/:id/leads/export` | Streams captured waitlist contacts as CSV. |
| **`lead-capture`** | Real-Time Lead Webhooks | `POST /api/engine/webhooks/leads` | Emits HTTP POST event to Slack/Discord/webhook URL upon new signup. |
| **`lead-capture`** | Inbound Lead Waterfall Enrichment | `POST /api/engine/leads/:id/enrich` | Triggers waterfall enrichment DAG on captured lead emails. |
| **`outreach-recording`** | Manual Multi-Channel Touchpoint Log | `POST /api/engine/outbound/touchpoints` | Logs non-email manual contacts (LinkedIn DMs, Twitter DMs, phone calls). |
| **`outreach-recording`** | CRM Two-Way Sync | `POST /api/engine/integrations/crm/sync` | Pushes touchpoint events to HubSpot / Salesforce. |
| **`scheduled-posting`** | Native Social API Dispatch | `POST /api/engine/social/publish` | Dispatches approved posts directly to Twitter/X, LinkedIn, or Threads. |
| **`scheduled-posting`** | Unified Editorial Calendar | `GET /api/engine/social/calendar` | Provides calendar-grid view of scheduled content and outbound touchpoints. |
| **`scheduled-posting`** | Recurring Schedule / Cron Manager | `POST /api/engine/schedules/cron` | Configures recurring execution triggers for automated scans. |

---

## 8. Summary for External Coding Agents

When executing tasks on Leadloom:
1. **Authenticated Context via Environment:** The external coding agent receives `LEADLOOM_AGENT_TOKEN` and `LEADLOOM_PROJECT_ID` configured via shell environment or `.env.local` (obtained from the `/app/projects` setup UI). Authenticate all engine requests using `Authorization: Bearer ${LEADLOOM_AGENT_TOKEN}`.
2. **Always read the relevant `skills/<skill-name>/SKILL.md` first.**
3. **Follow the State Restoration Protocol (Step 1):** Call `GET /agent/context` to hydrate the project's canonical state, active experiments, decisions, and milestones before taking action.
4. **Use the coding agent's native LLM capabilities:** The customer's coding agent is the brain; use your own reasoning to draft copy, design tests, and analyze signals.
5. **Follow the State Persistence Protocol (Final Step):** Call `POST /agent/context` to save updated decisions, hypotheses, and execution artifacts back to Leadloom's PostgreSQL store.
6. **Never attempt to call endpoints listed in the Gaps registry.**
