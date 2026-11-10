# LeadLoom — Cross-Team Sync Feed (Append-Only Ledger)

> **Notice to AI Agents:** This is an append-only differential changelog. When initiating any work, **DO NOT scan foreign team directories**. Read ONLY the last 20 entries below to acquire cross-team awareness. Whenever your team updates a contract in `packages/contracts` or deploys a cross-boundary API, append a 3-line entry using the exact format.

---

### [2026-11-10T12:00:00Z] Team Gamma | contracts/vault.contract.ts | Non-Breaking
- Added AES-256-GCM BYOK credential envelope schema (`MaskedBYOKCredentialSchema`).
- Teams Alpha & Beta can consume masked keys via `packages/contracts`.

---

### [2026-11-10T12:15:00Z] Team Beta | contracts/waterfall.contract.ts | Non-Breaking
- Added Pre-Flight Cost Estimator and Waterfall Trace Schemas (`PreFlightEstimateResponseSchema`).
- Team Alpha can mock `<PreFlightBar/>` using `MOCK_PREFLIGHT_RESPONSE`.

---

### [2026-11-10T12:30:00Z] Team Beta | contracts/validation.contract.ts | Non-Breaking
- Initialized Epic 6 Pre-Product Idea Validator schemas (`ValidationScorecardResponseSchema`).
- Team Alpha can render `<ValidationRadarCard/>` and `/v/[slug]` dynamic routes.

---

### [2026-11-10T12:45:00Z] Team Gamma | contracts/outbound.contract.ts | Non-Breaking
- Defined `MailboxHealthStatusSchema` with SPF/DKIM/DMARC health score properties.
- Team Alpha can render `<MailboxHealthBar/>` in campaign composer.

---

### [2026-11-10T13:30:00Z] Team Beta | apps/engine & workers/scraper | Non-Breaking
- Implemented DAG waterfall early-exit engine, 30-day domain cache deduplication, and pre-flight estimator.
- Implemented Pre-Product Idea Validator hypothesis decomposition, waitlist ingestion, and weighted scorecard scoring.
- Implemented headless scraper worker with strict resource interception and memory fencing.

---

### [2026-11-10T13:30:00Z] Team Alpha | apps/web & packages/ui | Non-Breaking
- Shipped 3D WebGL Living Loom Core, Lenis inertial scroll, Loom Virtual Grid (50k rows), and /v/[slug] smoke-test route.
- Fully wired to `@leadloom/contracts` mock fixtures; ready for live backend API binding by Teams Beta & Gamma.

---

### [2026-11-10T08:57:12Z] Team Gamma | local checkpoint, not pushed | Compatible additions
- packages/database: all 15 registry tables plus campaign_mailboxes join, pgvector, generated initial migration and separate integrity checks; composite tenant FKs for cell table membership, campaign-table linkage and mailbox pools. Prisma validate/generate and TypeScript checks pass. 8 SQL migration tests pass on an isolated in-memory PGlite PostgreSQL engine, NOT the target native PostgreSQL 16 deployment.
- modules/vault: true DEK/KEK envelope encryption with authenticated tenant/credential/provider context, rotation by DEK rewrap, scoped credential repository port, contract-valid masked responses. Buffer overwriting is best-effort only. No real secrets or provider verification calls. 26 vault/credential tests pass.
- modules/outbound: bounded DNS diagnostic cache, explicit DKIM selectors, temporary DNS errors mapped unknown; SPF/DKIM/DMARC record diagnostics are NOT send-time SPF/signature/alignment verification. Rotation and 45-180s jitter policy, dispatch tick with atomic repository claim port and uncertain-send handling; no real transport supplied. 25 outbound tests pass.
- Full engine suite including Beta regression tests: 63/63 passing; engine TypeScript passes. Database SQL tests: 8/8 separately.
- Compose: default DB/Redis only; application profile explicitly blocked on runnable app/worker entrypoints and Dockerfiles. Static policy checks pass, no Docker build/runtime test available. Shared Redis uses noeviction+AOF rather than ADR-003 allkeys-lru because queue keys cannot be evicted safely. See docker/README.md.
- Remaining: database repository adapters, atomic dispatch reservation implementation, auth/RBAC boundary, SMTP/IMAP OAuth/inbound/unsubscribe integration, native PostgreSQL16 concurrency/migration tests and full container smoke/load tests. No remote push or deployment.

---

### [2026-11-10T11:15:00Z] Team Gamma | apps/engine auth + apps/web smoke | Non-Breaking
- modules/auth: RBAC hierarchy helper (admin > member > read_only), scrypt password hashing (self-describing format, timing-safe verify), session issuer minting tokens in the verifySession format (TTL-bounded), and a UserDirectory port with Prisma adapter (role validation, email normalization).
- POST /auth/login mounted ONLY when a UserDirectory is provided AND LEADLOOM_AUTH_ISSUER_ENABLED=true; generic 401s, unknown-user timing normalization, 5-attempts/5-min per-IP throttle. Public deployment posture unchanged (issuer off by default). 12 auth tests pass; engine suite 91/91; tsc clean.
- apps/web: production smoke regression (scripts/smoke-production.mjs) boots next start and loads / and /workspace in headless Chrome, failing on client-side exceptions/error boundaries/missing key elements. Added app/icon.svg (favicon was 404). Smoke passes on the React 19 + fiber 9 stack.
- Deployment configs version-controlled (update.sh, .env.example, port parametrization, prisma binaryTargets, outputFileTracingRoot, demo banner) at commits 58cac88 + 54563af; lab PC working tree clean at origin/main.
- Remaining: SMTP/IMAP transport adapters with test doubles (OAuth2 token refresh loop, inbound reply processing, unsubscribe), mailbox OAuth2 flows (real credentials user-gated), native PostgreSQL16 concurrency/migration tests, full container smoke/load tests (Docker environment needed).

---

### [2026-11-10T11:40:00Z] Team Gamma | apps/engine outbound transport | Non-Breaking
- transport/: SMTP adapter behind an SmtpClient port (composer-resolved content, RFC 8058 one-click List-Unsubscribe headers, at-most-once semantics: client errors propagate so the dispatcher marks uncertain, never blind-retry). IMAP reply poller behind an ImapClient port with Message-ID dedupe store and uid checkpointing that only advances after recording (crash-safe replay). OAuth2 token loop (PRD 6.2): jittered pre-expiry refresh, refresh-token rotation preserved, fail-closed on missing tokens/provider errors. Deterministic keyword reply classification baseline (unsubscribe always wins for compliance); AI researcher owns deeper classification later.
- Unsubscribe links are HMAC-signed (unforgeable without login, lowercase-normalized email).
- No live wiring: no real SMTP/IMAP/OAuth2 clients, no env flips, no routes. Real credentials and send authority remain user-gated. 15 transport tests pass; engine suite 106/106; tsc clean.
- Remaining: Prisma adapters for mailbox token vault + seen-message store, nodemailer/imapflow client factories for the worker (vault-decrypted credentials at runtime), mailbox OAuth2 connect routes (need user provider apps), suppression HTTP endpoint consuming signed unsubscribe tokens, native PG16 concurrency/migration tests, container smoke/load tests.

## 2026-11-10 17:17 IST - Gamma: inbound persistence + one-click suppression endpoint
- PrismaMailboxTokenVault (ADR-001 envelope columns on Mailbox) + PrismaSeenMessageStore (reply dedupe via partial unique index, uid checkpoints in new mailbox_sync_state table); additive migration 20261110_inbound_sync (no existing rows touched).
- RFC 8058 endpoint: GET /outbound/unsubscribe renders a confirm page only (prefetch/scanner safe, no mutation); POST verifies the HMAC token and suppresses with no cookies, no auth, no redirect. Mounted ONLY when LEADLOOM_UNSUBSCRIBE_KEY (base64, >=16 bytes) is set; default posture unchanged, key unset on lab.
- Generic nodemailer/imapflow client factories (any provider; OAuth2 or password; lazy-loaded libs, no connections in tests).
- Unsubscribe tokens now carry workspaceId (w= param) so suppression is tenant-scoped.
- Engine suite 118/118, tsc clean. No live exposure, no sends, not deployed.

## 2026-11-10 17:28 IST - Gamma: marketing design repair (user-reported)
- Living Loom globe rebuilt: clean lat/long wireframe sphere + smooth fresnel glow body + 90 deterministic signal nodes + 3 restrained orbital threads (replaces spiky faceted orb and 36 chaotic fibers). Slow continuous rotation, subtle mouse parallax, matrix lighting state preserved.
- Responsive canvas heights (340/440/520px), dpr capped 1.75, fallback heights matched.
- Anchor sections get scroll-mt so the sticky header never covers section tops; mobile section padding tightened (py-14 sm:py-24) to kill dead gaps; hero padding responsive.
- PreFlightBar now solid bg (table content no longer bleeds through); hero sandbox table headers nowrap.
- Verified: next build clean, smoke-production.mjs PASSED (0 console/page errors), pixel-verified at 390px and 1440px.

## 2026-11-10 17:33 IST - Gamma: honesty labels + measured fps (review corrections)
- Sandbox CTA now "Run Simulated Waterfall on 5 Sample Accounts"; column "Sample Buying Signal"; validator card "Sample Validation Telemetry (simulated /v/k8s-cutter)". Point-of-action labels match the demo banner.
- Globe badge fps is now measured on-device per second (render loop sample), never hardcoded; hidden until first real sample.
- Anchor nav verified pixel-level: /#waterfall lands fully below the sticky header at desktop and mobile.
- Full-page pass: /, /workspace, /v/k8s-cutter at 390px and 1440px all render clean; smoke-production PASSED again.

## 2026-11-10 17:36 IST - Gamma: final honesty pass (review corrections)
- Social-proof bar no longer implies endorsement: "Illustrative sample ecosystem - no endorsement or live integration implied."
- Sandbox footer telemetry marked simulated at point of display ("Simulated example ... No real provider calls", "Simulated cost: $0.015") and stacks vertically on mobile (was cramped side-by-side).

---

### [2026-11-10T18:55:00Z] Team Beta | apps/engine/src/modules/waterfall/connectors | Non-Breaking
- Implemented Connector SDK (`Connector` interface, `ConnectorRegistry`, and standard barrel exports) with 10 public connectors: Apollo, Hunter, Dropcontact, People Data Labs, ZeroBounce, NeverBounce, Serper, OpenAI, Anthropic, and Ollama (local $0 spend).
- Enforced strict credential safety: all key-based connectors fail closed with `MISSING_CREDENTIAL` when credentials are omitted (never mock success), support custom fetch/retry/timeout, and never leak secret tokens in output.
- Added comprehensive test suite (`connectors.spec.ts`) with recorded fixtures and zero real provider calls. Engine vitest (148 passed across 22 test files) and `tsc --noEmit` pass cleanly.

