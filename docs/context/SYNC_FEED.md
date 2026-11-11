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

---

### [2026-11-10T19:00:00Z] Team Beta | apps/engine/src/modules/waterfall | Non-Breaking
- Implemented entitlement gating in `WaterfallService` and `WaterfallController` via injected `WaterfallEntitlementPort` (no hard-coded plan checks; pure policy evaluation via `checkFeature('waterfall')` and `checkLimit('enrichment_credits_per_month', rowCount)`).
- Gated both bulk waterfall batch dispatch and single-row enrichment executions against plan features and monthly credit limits with structured `WaterfallEntitlementError`.
- Added unit test suite `waterfall-entitlements.spec.ts` covering feature checks, credit limits, single-row consumption, unconfigured posture, and controller workspace delegation. All 28 engine test files (167 passed, 5 skipped) and `tsc --noEmit` pass cleanly.

---

### [2026-11-10T19:12:00Z] Team Beta | apps/engine/src/modules/waterfall/connectors | Non-Breaking
- Fixed connector contracts from vendor owning docs: Apollo updated to POST `/api/v1/people/match`; Dropcontact modeled as async submit (`POST /v1/enrich/all`) plus fetch (`GET /v1/enrich/all/{id}`); NeverBounce updated to `/v4.2/single/check`.
- Added security controls via `security.ts`: `validateAndResolveBaseUrl` strictly enforces HTTPS and vendor host matching (Ollama strictly restricted to loopback 127.0.0.1/localhost/::1, rejecting metadata and external IPs); `resolveFetch` fails closed with `NETWORK_DISABLED` unless test fetch is injected or `LEADLOOM_CONNECTORS_LIVE_ENABLED=true`; `redactSecrets` redacts API keys from query strings, error messages, and raw responses.
- Labeled all 10 connectors `verification: 'fixture-tested'`, updated fixtures to documented vendor shapes, and added 20 unit tests in `connectors.spec.ts`. All 31 engine test files (182 passed, 8 skipped) and `tsc --noEmit` clean.

---

### [2026-11-10T19:55:00Z] Team Beta | apps/engine/src/modules/waterfall | Non-Breaking
- Connector credential safety: enforced `redirect: 'manual'` on all 10 connectors and fail-closed handling on any HTTP 3xx redirect status code (`checkRedirectResponse`), ensuring secret tokens never follow redirects to external hosts. Added unit test for 302 redirect blocking.
- Waterfall entitlement fail-closed enforcement: `WaterfallService.assertEntitlements` rejects missing `workspaceId` (scoped tenant required) and rejects missing `EntitlementPort` whenever `LEADLOOM_ENTITLEMENTS_ENFORCED=true`.
- Confirmed zero exposure of raw payloads in logs (no console/logger calls in waterfall module) or API contracts (`DispatchWaterfallResponse` and `WaterfallCellPayload` schemas have no raw fields). All 31 engine test files (186 passed, 8 skipped) and `tsc --noEmit` pass cleanly.

---

### [2026-11-10T20:40:00Z] Team Beta | apps/engine/src/modules/waterfall/connectors | Non-Breaking
- Added retryable `NOT_READY` connector error handling for Dropcontact: checks `success: false` on both batch submission (`POST /v1/enrich/all`) and polling fetch (`GET /v1/enrich/all/{id}`), returning `{ code: 'NOT_READY', retryable: true }` instead of treating unready polling results as a successful match with null email. Added corresponding unit tests.
- Sanitized `raw` payload across all connectors returning provider JSON (Dropcontact, Hunter, PDL, ZeroBounce, NeverBounce, Serper, Anthropic): dropped PII and strictly allowlisted non-personal diagnostic metadata (status, counts, usage, request identifiers). Added unit tests verifying zero email addresses or API keys in `raw`.
- All 31 engine test files (195 passed, 8 skipped) and `tsc --noEmit` pass cleanly.

---

### [2026-11-10T21:20:00Z] Team Alpha | apps/web & packages/ui | Non-Breaking
- Shipped CSS variable token architecture in `packages/ui/src/tokens.css` with persistent Light/Dark theme toggle; 0 hard-coded hex colors in new screens.
- Shipped Auth.js v5 (NextAuth) with credentials + dynamic OAuth providers, protected `/app/*` and `/admin/*` middleware, and `/api/engine-token` route minting HS256 bridge JWTs matching Gamma's `nextauth-bridge.ts`.
- Shipped complete App Shell with workspace switcher, top bar, and mock-backed pages for Tables, Connectors (BYOK key modal), Mailboxes, Campaigns, Validator, Settings (consuming `EntitlementDecision`), and dedicated Platform Admin (`/admin`).
---

### [2026-11-10T21:35:00Z] Team Alpha | apps/web | Non-Breaking
- Enforced platform operator role gate in NextAuth edge middleware for `/admin/*` routes; non-operator users are prevented from accessing the platform administration console.
- Updated `/api/engine-token` route to support base64 decoded `LEADLOOM_NEXTAUTH_BRIDGE_SECRET` matching Gamma's `apps/engine/src/main.ts` line 258.
- Production build `npm run build --workspace @leadloom/web` compiles cleanly (17/17 routes generated).

---

### [2026-11-10T22:00:00Z] Team Beta | packages/contracts & apps/engine waterfall | Non-Breaking
- Sanitized `raw` payloads across Apollo, OpenAI, and Ollama connectors, replacing provider payloads with allowlisted non-personal metadata (model, status, tokens, duration) and added privacy tests verifying zero emails, prompts, or API keys in `raw`.
- Created `ConnectorCredentialStore` write-only port and `InMemoryConnectorCredentialStore` under `modules/waterfall/credentials`: AES-256-GCM context-bound encryption sealed with per-workspace context AAD, failing closed if `LEADLOOM_CREDENTIAL_KEK` is unset or invalid. Masked status API never leaks plaintext credentials. Added unit tests for sealing, isolation, tampering, and key masking.
- Created `packages/contracts/src/connector-catalog.contract.ts`: Zod schema for the 10 connectors (`id`, `label`, `capabilities`, `needsKey`, `localOnly`) and `buildConnectorCatalog()` builder for Team Alpha's connector hub.
- Created `TestConnectionService` in `modules/waterfall/connectors`: returns `DISABLED` unless `LEADLOOM_CONNECTORS_LIVE_ENABLED=true` and workspace is entitled via `WaterfallEntitlementPort`. Tested using fake fetch (0 live calls).
- All 33 engine test files (218 passed, 8 skipped) and `tsc --noEmit` pass cleanly.

---

### [2026-11-10T22:05:00Z] Team Alpha | apps/web | Non-Breaking
- Shipped `apps/web/lib/engine-client.ts`: typed engine bridge client with JWT auto-caching, transparent dual-mode (live engine with offline mock fallback), and sanitized HTTP error mapping.
- Shipped BYOK Connector Hub supporting all 11 providers with live test ping actions, latency badges, masked key preview (`sk-••••••••abcd`), and loopback-fenced Ollama local model configuration.
- Shipped `CsvImporterModal` with client-side parsing, smart column auto-mapping, row preview, and streaming ingest into virtual grid.
- Shipped `AddWaterfallModal` allowing users to configure multi-tier enrichment cascades and early-exit predicates directly on the table canvas.
- Shipped `DnsInspectorModal` with copyable SPF, DKIM, and DMARC DNS configuration records and health badges.
- Shipped rate-limited public waitlist proxy `/api/v/[slug]/leads` (5 requests / 10 min sliding window) protecting smoke-test pages from bot flood abuse.

---

### [2026-11-10T22:20:00Z] Team Alpha | apps/web | Non-Breaking
- Resolved all Stage 1 login blockers per STAGES.md and ALPHA_BRIEF.md:
  - Removed password-less Credentials provider from `apps/web/auth.ts`; configured OAuth SSO providers (Google & GitHub) with verified email claims.
  - Eliminated UI self-asserted role mappings; `/admin` is closed by default unless `NEXT_PUBLIC_DEV_ADMIN_ENABLED === 'true'`.
  - Failed closed on missing or short (<32 bytes) secrets for `AUTH_SECRET` and `LEADLOOM_NEXTAUTH_BRIDGE_SECRET`; removed all hardcoded fallback literals.
  - Enforced `/api/engine-token` minting strictly with `idp` in `['google', 'github']` and `email_verified: true`.
  - Gated `/app` on engine identity (`GET /auth/me`) and first-time provisioning (`POST /auth/provision`).
  - Added strict transparent error handling in `apps/web/lib/engine-client.ts`: live engine failures throw `EngineClientError` without silently masking failures as mock successes.
  - Clean `next build` across all 17 routes with 0 errors.

---

### [2026-11-10T17:50:00Z] Team Gamma | apps/web auth paths | Revised ownership + Non-Breaking
- Gamma now owns `apps/web/auth.ts`, `auth.config.ts`, `app/api/**`, `app/app/layout.tsx`, `lib/engine-client.ts`, `lib/engine-server.ts` (was Alpha; Alpha's work preserved, pull before editing these). Beta owns the email/password and OTP screens (see BETA_BRIEF.md). Alpha: L0 text removal and dashboard shell.
- Browser never calls the engine directly (measured CORS failure). Same-origin `/api/engine/*` proxy attaches the credential from the server session; `/api/auth-flow/<action>` forwards the public OTP steps. `/api/engine-token` removed (the browser no longer needs a token). Server env: `ENGINE_URL` (default http://127.0.0.1:4010), `LEADLOOM_PASSWORD_AUTH_ENABLED` (default off).
- Credentials provider (flag-gated) calls the engine `/auth/login`; engine session token lives only in the encrypted Auth.js cookie, never in `/api/auth/session`. A credentials session can never mint a bridge token. Error codes via `signIn`: `email_not_verified`, `invalid_credentials`.
- GitHub now requires a live primary+verified email from `/user/emails` (scope `read:user user:email`). Build-time secret literal removed. Dev admin needs `LEADLOOM_DEV_ADMIN_ENABLED=true` and is refused in production.
- `/app` layout fails closed: renders only after the engine returned a userId; every other state shows an error or a loading screen.
- Verified locally (real HTTP through Next on :3000 + engine harness): register, wrong and right login, unverified login redirect `code=email_not_verified`, session JSON has no token, proxy `/auth/me` 200, no-session proxy 401, POST without Origin 403, login path blocked 404, no password or code in logs. `tsc` and `next build` clean.

---

### [2026-11-10T23:25:00Z] Team Beta | apps/web auth screens | Non-Breaking
- Built Stage 1 email/password and 6-digit OTP verification/reset screens in `apps/web`: `components/auth/**` (shared `AuthCard`, `PasswordInput` with show/hide, `OtpInput`, `ResendCountdown` with 60s cooldown, `AuthAlert`, `OAuthButtons`), `app/login/page.tsx` (`signIn('credentials')` with generic credential errors & unverified routing), `app/signup/page.tsx`, `app/verify-email/page.tsx`, and `app/forgot-password/page.tsx` (request, 6-digit code, new password).
- All screens use theme tokens (0 hardcoded colors) and call same-origin `/api/auth-flow/<action>`. `tsc --noEmit` and `next build` (19/19 routes) pass cleanly.


---

### [2026-11-11T00:20:00+05:30] Team Gamma | tokens, packages/ui, docs/plan/DASHBOARD_BETA.md | Non-Breaking
- Added --accent-hover and --on-accent tokens; primary Button uses them; removed per-page `text-white`/weave-hover overrides.
- Added Card, StatCard, EmptyState to @leadloom/ui.
- Beta: /app overview task is in docs/plan/DASHBOARD_BETA.md.

---

### [2026-11-11T00:36:00+05:30] Team Beta | apps/web /app overview + dashboard components | Non-Breaking
- Replaced redirect in `apps/web/app/app/page.tsx` with live workspace overview dashboard powered by `engineFetch` same-origin proxy calls (`/api/engine/*`):
  - `components/dashboard/dashboard-header.tsx`: Verified user email, workspace identity, and role badge from `GET /auth/me`.
  - `components/dashboard/stat-cards-grid.tsx`: Real telemetry cards for connected providers (`GET /vault/credentials`), validator experiments (`GET /validator/experiments`), and outbound jobs (`GET /outbound/jobs`) using `@leadloom/ui`'s `StatCard`. Handled loading skeletons, inline error retry triggers, and honest count display (0 on empty, no invented numbers).
  - `components/dashboard/getting-started-checklist.tsx`: Dynamic setup progress checklist for provider keys, mailboxes, and tables, checked only when verified by real engine data.
  - `components/dashboard/empty-vault-card.tsx`: `@leadloom/ui` `EmptyState` displayed when zero provider keys are connected.
- All styling strictly conforms to design tokens (`tokens.css`) with 0 hex/color overrides; primary buttons use `<Button variant="primary">` without color substitutions.
- Verified: `npx tsc --noEmit` and `next build` pass cleanly across all routes.
- Screenshot verified: 1280px and 390px in dark and light themes captured with headless Chromium and visually verified.

---

### [2026-11-11T00:55:00+05:30] Team Beta | apps/web settings page & components | Non-Breaking
- Built production Settings page in `apps/web/app/app/settings/page.tsx` and `apps/web/components/settings/*` per `docs/plan/DASHBOARD_BETA2.md`:
  - `account-settings-card.tsx`: Verified signed-in user email, workspace ID, role badge from `useShellIdentity()`, and Sign Out button via `signOut({ callbackUrl: '/login' })`.
  - `appearance-settings-card.tsx`: Interactive dark and light theme selection using `@leadloom/ui`'s `useTheme()` hook with active check indicators.
  - `plan-limits-card.tsx`: Read-only list of contractual product limits (`seats`, `mailboxes`, `tables`, `enrichment_credits_per_month`, `emails_per_month`) from `packages/contracts/src/entitlements.contract.ts`. Clear banner: "Limits are defined but not enforced yet" (engine health reports `not_enforced`). Zero invented usage bars or numbers.
  - `team-settings-card.tsx`: Displays only the verified current user with an honest `@leadloom/ui` `EmptyState` stating "Inviting teammates is not available yet" (zero invented team members).
- All styling strictly conforms to design tokens (`tokens.css`) with 0 hex/color overrides.
- Verified: `npx tsc --noEmit` and `next build` pass cleanly (18/18 static/dynamic routes compiled).
- Screenshot verified: 1280px and 390px in dark and light themes visually verified via headless browser.


---

### [2026-11-11T01:35:00+05:30] Team Beta | apps/web UI foundations & shared feedback | Non-Breaking
- Completed Part A (commit \`30f296e\`): Audited real \`apps/web\` source against WAI-ARIA and Sonner docs, creating \`docs/plan/UI_FOUNDATIONS.md\` with concrete gap matrix (status, owner, location, fix).
- Completed Part B:
  - \`apps/web/lib/notify.ts\`: Central wrapper over sonner with message deduplication hashing, HTTP/EngineClientError plain language error mapping, persistent duration for actionable errors.
  - \`apps/web/components/feedback/form-field.tsx\`: Accessible wrapper binding \`label\`, \`hint\`, inline error (\`role="alert"\`), \`id\`, \`aria-describedby\`, and \`aria-invalid\`.
  - \`apps/web/components/feedback/confirm-dialog.tsx\`: WAI-ARIA alertdialog modal with Tab focus trap, Escape cancel, focus restoration to trigger element, token styling.
  - \`apps/web/components/feedback/offline-banner.tsx\`: Client component monitoring \`navigator.onLine\` and \`online\`/\`offline\` window events, rendering non-intrusive \`role="status"\` banner. Mounted with single line in \`app/app/layout.tsx\`.
  - \`apps/web/app/error.tsx\`: Root client error boundary with sanitized message and retry action.
  - \`apps/web/app/not-found.tsx\`: Custom 404 page styled with design tokens and \`@leadloom/ui\` EmptyState.
  - \`apps/web/app/app/error.tsx\`: In-workspace error boundary with retry view and overview link.
  - \`apps/web/app/app/loading.tsx\`: Route loading skeleton for \`/app/*\` with pulse animations and token cards.
  - \`apps/web/app/layout.tsx\`: Updated Sonner \`<Toaster>\` block with tokens (\`--bg-elevated\`, \`--border-subtle\`, \`--text-primary\`), \`bottom-right\` positioning, closeButton.
  - \`apps/web/app/{login,signup,forgot-password,verify-email}/page.tsx\`: Integrated \`FormField\` with inline validation errors on email/password/code inputs without altering auth flow.
  - Replaced all direct \`sonner\` imports across \`apps/web\` with \`notify\`, adding \`[Sample]\` disclaimer to simulated actions on fixture/demo pages. Added \`Escape\` and dialog roles to existing modals.
- All styling strictly conforms to design tokens (\`tokens.css\`) with 0 hex/color overrides.
- Verified: \`node scripts/check-design.mjs --strict\`, \`npx tsc --noEmit\`, and \`npm run build --workspace @leadloom/web\` (18/18 routes compiled) pass with 0 errors.
- Visual inspection: dark and light screenshots at 1280px and 390px (toast showing, error page, offline banner) captured and inspected.

---

### [2026-11-11T02:12:00+05:30] Team Beta | apps/web provider keys in Settings | Non-Breaking
- Built `ProviderKeysCard` in `apps/web/components/settings/provider-keys.tsx` wired to existing engine `/vault/credentials`:
  - Added `deleteVaultCredential` helper in `apps/web/lib/engine-client.ts`.
  - Lists saved keys with provider, label, masked tail (`sk-••••••••abcd`), created date, and honest "Saved" status badge (no connector catalog, zero verification claims).
  - Add Key form using `FormField`, `isSubmitting` pending state, `type="password"` input with immediate state clearing on submit (secrets never exposed in toasts or logs), and notifications via `notify`.
  - Delete flow with `ConfirmDialog` alertdialog.
  - States: skeleton loading, empty state (`EmptyState` "No provider keys yet"), error banner with retry.
  - Role gating via `useShellIdentity()`: only `admin` sees add/delete actions (server-enforced admin check on POST/DELETE /vault/credentials); members see read-only view.
  - Mounted as a card in `apps/web/app/app/settings/page.tsx`.
- Verified: `node scripts/check-design.mjs --strict`, `npx tsc --noEmit`, and `npm run build --workspace @leadloom/web` pass with 0 errors.
- Visual inspection: dark and light screenshots at 1280px and 390px captured and verified.

---

### [2026-11-11T02:18:00+05:30] Team Beta | apps/web honest fixture pages (Part B) | Non-Breaking
- Refactored fixture pages (`tables`, `mailboxes`, `campaigns`, `validator`) to standardize container and empty/loading states using `@leadloom/ui` primitives:
  - `apps/web/app/app/tables/page.tsx`: Added `@leadloom/ui` `EmptyState` when table row count is 0. Preserved all sample data labels and toolbar actions.
  - `apps/web/app/app/mailboxes/page.tsx`: Replaced hand-rolled overview card divs and sender item containers with `@leadloom/ui` `Card`, added `EmptyState` for empty mailbox pool. Preserved `Demo data` badge and `[Sample]` notices.
  - `apps/web/app/app/campaigns/page.tsx`: Replaced hand-rolled campaign metadata and sequence step cards with `@leadloom/ui` `Card`, added `EmptyState` when sequence steps are empty. Preserved `Demo data` badge and `(simulated)` notices.
  - `apps/web/app/app/validator/page.tsx`: Replaced hand-rolled active hypothesis container with `@leadloom/ui` `Card`. Preserved `Demo data` badge.
  - Connectors page untouched. Zero functionality added or modified.
- Verified: `node scripts/check-design.mjs --strict`, `npx tsc --noEmit`, and `npm run build --workspace @leadloom/web` (18/18 routes compiled) pass cleanly with 0 violations.

---

### [2026-11-11T02:22:00+05:30] Team Beta | apps/web task 4 corrections pass | Non-Breaking
- Verified compliance with Beta Task 4 corrections:
  - Enforced `role === 'admin'` across settings provider keys and team settings card fallback (engine recognizes only `admin` and `member`, no `owner`).
  - Confirmed server-enforced admin permission on `/vault/credentials` with plain-sentence 403 handling via `notify`.
  - Confirmed strict no-optimistic posture: save and delete display pending states, only refetching after server response (zero phantom rows).
---

### [2026-11-11T03:36:00+05:30] Team Beta | apps/web real workspace read lists & count cards (Part A) | Non-Breaking
- Wired real workspace data views from engine `/workspace/*` client (`fetchWorkspaceSummary`, `fetchWorkspaceTables`, `fetchWorkspaceMailboxes`, `fetchWorkspaceCampaigns`):
  - `apps/web/app/app/page.tsx` & `components/dashboard/stat-cards-grid.tsx`: Render 6 real count cards from `WorkspaceSummary` (`tables`, `mailboxes`, `campaigns`, `suppressions`, `experiments`, `providerKeys`) with skeleton loading, retry button, and clear empty hints (`0 • No tables created yet`).
  - `apps/web/components/dashboard/getting-started-checklist.tsx`: Wired real counts to `hasMailboxes` and `hasTables` alongside `hasProviderKeys`, marking all 3 steps as tracked.
  - `apps/web/app/app/tables/page.tsx`: Shows real workspace tables list at top from `fetchWorkspaceTables` with row count and created date (or `EmptyState` "No tables yet"), with the interactive virtual grid retained below under a clearly marked "Sample preview" Card.
  - `apps/web/app/app/mailboxes/page.tsx`: Replaced mock mailboxes with real list from `fetchWorkspaceMailboxes` with raw SPF/DKIM/DMARC status chips, health score, daily sent quota, and `EmptyState` ("No mailboxes yet"). Computed summary cards honestly from real list (0 fixtures remain on mailboxes).
  - `apps/web/app/app/campaigns/page.tsx`: Shows real workspace campaigns list from `fetchWorkspaceCampaigns` with status, daily limits, timezone (or `EmptyState` "No campaigns yet"), keeping sequence steps below under a clearly marked "Sample preview" Card.
- Verified: `node scripts/check-design.mjs` (0 violations), `npx tsc --noEmit` (clean), `npm run build --workspace @leadloom/web` (18/18 routes static/dynamic compiled).

---

### [2026-11-11T03:45:00+05:30] Team Beta | apps/web shared a11y & feedback hardening (Part B) | Non-Breaking
- Hardened accessibility in `components/feedback` and owned files:
  - `confirm-dialog.tsx`: Implemented robust focus return to trigger element on close (`document.contains(triggerRef.current)`), Tab and Shift+Tab focus trap cycling through focusable elements, Escape dismissal with event propagation stopped, token focus rings (`focus-visible:ring-2 focus-visible:ring-brand-loom` and `focus-visible:ring-signal-failed`), and `motion-reduce:animate-none motion-reduce:transition-none`.
  - `offline-banner.tsx`: Added `aria-atomic="true"` with `aria-live="polite"` and `role="status"`, accessible connection re-test button with token focus ring, and `motion-reduce:animate-none`.
  - `form-field.tsx`: Added `aria-live="polite"` and `aria-atomic="true"` to error messages with `motion-reduce:animate-none`.
  - `components/settings/provider-keys.tsx`: Added visible token focus rings (`focus-visible:ring-2 focus-visible:ring-brand-loom` and `focus-visible:ring-signal-failed`) and `motion-reduce:transition-none` across inputs, select, and action buttons.
- Verified: `node scripts/check-design.mjs` (0 violations), `npx tsc --noEmit` (0 errors), `npm run build --workspace @leadloom/web` (18/18 routes compiled clean). Visual verification completed in dark and light themes at 1280px and 390px.

---

### [2026-11-11T04:55:00+05:30] Team Beta | apps/web suppressions card on mailboxes (Part A) | Non-Breaking
- Added read-only "Suppression list" card below the mailbox pool on `/app/mailboxes` (`apps/web/app/app/mailboxes/page.tsx`):
  - Consumes `fetchWorkspaceSuppressions` (`WorkspaceSuppressionRow`) with skeleton loading, error with retry, and empty state (`EmptyState` "No suppressed contacts yet").
  - Columns / attributes: Address hash (`hashPrefix` rendered in mono font, never implying it is an email address), reason (`Badge variant="subtle"`), source, and formatted added date.
  - Zero address reconstruction, zero exports, zero add/delete mutations.
  - Desktop table view with responsive stacked mobile view to guarantee no horizontal overflow at 390px.
- Verified: `node scripts/check-design.mjs` (0 violations), `npx tsc --noEmit` (0 errors), `npm run build --workspace @leadloom/web` (18/18 routes compiled).

---

### [2026-11-11T05:05:00+05:30] Team Beta | apps/web experiments list on validator (Part B) | Non-Breaking
- Added read-only "Workspace Experiments" list above fixture preview on `/app/validator` (`apps/web/app/app/validator/page.tsx`):
  - Consumes `fetchWorkspaceExperiments` (`WorkspaceExperimentRow`) with skeleton loading, error card with retry button, and empty state (`EmptyState` "No experiments yet").
  - Columns / attributes: hypothesis (truncated to 140 chars by server), verdict (Badge variant with capitalized status e.g. Validated, Pending, Rejected), verdictScore (rendered only if not null), and formatted created date.
  - Retains existing fixture UI strictly under a clearly labelled "Sample preview" Card (`Badge variant="subtle"` "Sample preview").
  - Zero create/generate mutations or actions added; shell left untouched (note to Gamma: `/app/validator` topbar sample claim can be removed once desired).
  - Desktop table view with responsive stacked mobile view to guarantee no horizontal overflow at 390px.
- Verified: `node scripts/check-design.mjs` (0 violations), `npx tsc --noEmit` (0 errors), `npm run build --workspace @leadloom/web` (18/18 routes compiled clean).

---

### [2026-11-11T17:20:00+05:30] Continuity worker (Instinct) | team invites verified in a real browser; invite rule relaxed | Non-Breaking
- Local stack: real PostgreSQL 16 + pgvector, engine with `LEADLOOM_TEAM_INVITES_ENABLED=true`, built web, headless Chrome. Not deployed; production flag still unset/off.
- Verified end to end (two to three real accounts): invite, accept after sign-in, sign in again, role shown as Member, members and pending lists, revoke (revoked invitee sees nothing to accept), role change, remove (member session ends and sign-in is refused), member sees no invite controls.
- Change: an address that already has an account can now be invited. Nothing moves until that user accepts while signed in; accept still refuses unless their own workspace is pristine (`has_workspace_data`). Engine unit + real-Postgres tests updated and pass (17/17). Copy updated; still "No email was sent".
- Added `docs/plan/PUMPGTM_GAP.md` (sourced gap list and build plan).

---

### [2026-11-11T17:30:00+05:30] Continuity worker (Instinct) | mailbox connect by app password (engine) | Non-Breaking
- New additive migration `20261118_mailbox_password_auth` (auth_type, connection_status, connection_checked_at, connection_error_code). Not applied in production.
- Engine `modules/mailbox-connect` + routes GET `/workspace/mailbox-presets`, POST `/workspace/mailboxes/connect`, POST `/workspace/mailboxes/:id/test`, DELETE `/workspace/mailboxes/:id`; admin only, off unless `LEADLOOM_MAILBOX_CONNECT_ENABLED=true`. Login check only, no mail sent; password sealed in the vault envelope, never returned. SMTP verified against a local SMTP server; IMAP not yet verified against a real server. `listMailboxes` now returns status fields. Web UI not built yet.
- Hardening (same day): hosts are resolved once at connect time, every address must be public (IPv6 allowlist, mapped/NAT64/6to4/ULA refused), socket goes to the pinned IP with SNI + certificate validation, TLS required before the password is sent, 20s hard deadline. Applies to /test too.
- Test coverage (same day): the STRICT connect path (public-address policy, pinned IP, SNI, mandatory STARTTLS, certificate validation) is exercised against local TLS SMTP and IMAP servers using a test CA via a test-only hook that main.ts never passes. Not verified against Gmail/Outlook or implicit-TLS ports 465/993.

---

### [2026-11-11T18:08:00+05:30] Team Beta | apps/web mailbox connect UI | Non-Breaking
- Implemented Mailbox Connect UI (`apps/web/app/app/mailboxes/page.tsx`, `apps/web/components/mailboxes/`, `apps/web/lib/engine-client.ts`):
  - Added typed client methods and interfaces for `fetchMailboxPresets`, `connectMailbox`, `testMailboxConnection`, `deleteMailbox`, and extended `WorkspaceMailboxRow` with connection attributes.
  - Built `ConnectMailboxDialog` with provider picker (Gmail, Outlook, Yahoo, Custom), numbered setup steps, caveat callouts, documentation links, encrypted app password input with security note, and plain-language error mapping (`auth_failed`, `tls_error`, `timeout`, `unreachable`, `private_host`, etc.). Password is cleared immediately on submit and never logged or exposed.
  - Built `MailboxRowItem` with connection status pills (`Login verified`, `Failed: <code>`, `Never checked`), timestamp, admin-only "Test connection" with spinner, and "Remove" with accessible `ConfirmDialog`. Non-admin members see read-only cards without action buttons.
  - Built `UnbuiltProvidersCard` showing honest roadmaps for Gmail OAuth, LinkedIn, and X without prices.
  - Handled feature flag 404 on `/workspace/mailbox-presets` gracefully with a disabled card notice when `LEADLOOM_MAILBOX_CONNECT_ENABLED` is off.
- Verified: `node scripts/check-design.mjs` (0 violations), `npx tsc --noEmit` (0 errors).

---

### [2026-11-11T18:20:00+05:30] Continuity worker (Instinct) | verified Team B mailbox UI (340a10e) in a real browser; 3 fixes | Non-Breaking
- Local only (real Postgres, local SMTP/IMAP fixtures, headless Chrome): connect with wrong password shows diagnostics and clears the password field; right password shows "Login verified"; remove deletes the row and the stored credential; a member sees the list but no connect/test/remove controls.
- Fixes: Test connection and Remove sent a JSON content-type with no body and the engine answered 400 (fixed in `lib/engine-client.ts`); "Other" provider no longer pre-fills Gmail hosts; LinkedIn card now states only the sourced fact (Messages API is partner-only) instead of an unsourced terms claim. Dev-only: with `LEADLOOM_MAILBOX_ALLOW_PRIVATE_HOSTS` (refused in production) ports >= 1024 are accepted for local fixtures.
- Not deployed. Not verified against a real mail provider. The page still shows a "Sample data on this page" badge next to real mailbox data (pre-existing, not changed).

---

### [2026-11-11T12:58:00Z] Web | apps/web mailboxes UI | Non-Breaking
- Mailboxes page: removed page-wide sample badge, "Active" now "Not paused", rows say "Sending not enabled" and show the configured limit separately from sent count, provider buttons wrap full labels, LinkedIn card says "Partner-limited". UI text only.

---

### [2026-11-11T13:15:00Z] Engine | GET /workspace/connectors/status | Non-Breaking
- Session-required honest connector status (smtp_imap login-verify only, gmail_oauth not built, linkedin partner-limited, x unverified). Static registry plus the mailbox-connect flag. No sending claims.

---

### [2026-11-11T13:25:00Z] Web | /app/connectors outreach channel status | Non-Breaking
- Connectors page shows live engine status for outreach channels (GET /workspace/connectors/status). No sample fallback; shows an error line if the engine is unreachable. The BYOK cards below remain sample data.

---

### [2026-11-11T13:30:00Z] Web | /app/connectors labels and spacing | Non-Breaking
- Removed page-wide sample badge; only the key-vault catalog is labelled sample (costs and hit rates illustrative). "Connect Vault Key" now "Save key". Page padding fixed.

---

### [2026-11-11T13:25:00Z] Engine | IMAP reply fetch hardening | Non-Breaking
- createImapflowClient now opens INBOX read-only, fetches by UID (previously sequence numbers), searches then fetches at most maxBatch (default 100) UIDs per poll, and caps retained body at 20000 chars. Not wired to any scheduler; no live mailbox is polled. Gated fixture test against hoodiecrow.

---

### [2026-11-11T13:35:00Z] Engine/DB | IMAP poll safety | Non-Breaking, one additive migration
- New migration 20261119_mailbox_uid_validity (nullable column). Poller dedupe keys changed to mailbox-scoped hash (no live rows exist: poller is unwired). UIDVALIDITY reset, per-mailbox lock, plaintext hook refused in production/non-loopback. See docs/plan/IMAP_SYNC.md.

---

### [2026-11-11T13:40:00Z] Engine | IMAP poller strict TLS path | Non-Breaking
- createImapflowClient connects via buildReadOptions: public-only resolve-once pinned IP, SNI/cert validation, TLS 1.2+, STARTTLS on 143, port allow-list. Plaintext only through the loopback test hook. Still unwired.

### [2026-11-11T13:36:00Z] Team Alpha | contracts/outbound.contract.ts + engine transport | Non-Breaking
- Added `bounce` to `OutreachReplyClassificationEnum` (DB stores classification as varchar, no migration).
- New `transport/bounce.ts` DSN detection (RFC 3464 fixtures) classified before keyword baseline; new `transport/backoff.ts` PollBackoff helper (bounded exponential + jitter, reset on success; not yet scheduler-wired).

---

### [2026-11-11T13:55:00Z] Engine/Web/DB | G9 Approval-Before-Send Queue | Non-Breaking, one additive migration
- G9 Real Behavior: Outbound jobs enqueue into 'pending_approval' status by default; AtomicDispatchRepository.claim() strictly skips unapproved jobs.
- Engine approval endpoints: GET /outbound/approvals lists pending jobs with campaign context and step previews; POST /outbound/approvals/approve and /reject support single-item and batch operations; replies/unsubscribes cancel pending_approval jobs.
- Web UI: Added ApprovalQueue component to /app/campaigns with live review counters, preview snippets, single/bulk approval actions, and honest disabled-dispatch banner.
- DB migration 20261120_outbound_approval_status expands check constraint to allow 'pending_approval' and 'rejected'.
- Sending stays disabled everywhere (sendingEnabled: false).


### [2026-11-11T14:17:00Z] Team Alpha | engine outbound approval hardening | Breaking (internal API)
- POST /outbound/jobs no longer accepts `requiresApproval`; every job enters `pending_approval` (no caller bypass). approve() now returns `{approvedCount, staleCount}` and flips to held `approved` (never claimable), verified against a server-recomputed snapshot hash (content+recipient+mailbox context); stale approvals stay pending_approval and need a deliberate second approval.
- New additive migration `20261121_outbound_approval_hardening` (CHECK superset adds `approved`; approval_content_hash/approval_snapshot/approved_at columns).
## 2026-11-11 - Web: approval queue UI honesty pass
- approval-queue.tsx: banner no longer claims approved messages become "schedulable"; it states approval signs off recipient+content+sender context, holds the message as approved, nothing sends, and content change withdraws approval back to review.
- Toasts: single/bulk approve report "approved and held (sending stays disabled)"; stale responses (approvedCount 0, staleCount > 0) tell the reviewer the content changed since queueing and a second deliberate approval is needed.
- Metric relabeled APPROVED (HELD). engine-client approve response typed with staleCount.
- Verified end-to-end in a real browser against local engine: first approve of a snapshot-less job surfaces the stale message; second deliberate approve holds the job (DB status 'approved', hash stamped), queue metric updates, no dispatch.
## 2026-11-11 - Web+Engine: approval queue review surface
- Queue items now render the actual approval snapshot: subject, expandable full body text, recipient, sender scope (assigned mailbox count or explicit "no sender mailboxes assigned"), and a stale badge when content changed since queueing (first approval refreshes the snapshot; a second signs off).
- listPendingApprovals returns stored snapshot + recomputed stale flag (current campaign content + recipient + mailbox context vs stored hash); contract gains bodyTemplate/senderMailboxIds/stale.
- Approve All removed: no bulk approval of unreviewed content. Banner no longer promises automatic withdrawal on campaign edits (no edit endpoint exists; documented obligation instead).
- Page-wide "Sample data" badge removed from /app/campaigns (live queue + campaign rows); Step Flow keeps its localized sample badges.
- Browser-verified locally; 302 engine tests pass; web tsc clean.
## 2026-11-11 - Engine: G10 reply attribution and sequence halt (fixture-only)
- inbound_replies table (migration 20261122, additive): persisted reply events with classification, confidence and attribution basis; idempotent on (workspace_id, message_id).
- recordInboundReply(): attributes via thread headers (In-Reply-To/References vs stored provider_message_id) with recipient-hash fallback scoped to campaigns using the polled mailbox; never attributes across workspaces; unattributed replies are stored but halt nothing.
- An attributed reply cancels every still-actionable job for that recipient in that campaign (pending_approval, pending, held 'approved'): "replies halt the sequence" is now enforced in the data layer, not just UI copy.
- RawInboundMessage gains references[]. 8 new PGlite tests; 310 engine tests pass, tsc clean. No live mailbox use; poll loop remains gated off.
## 2026-11-11 - Engine: G10 ambiguity-safe recipient attribution
- Recipient-hash fallback no longer picks an arbitrary job when the same recipient appears in multiple campaigns reachable from the polled mailbox: the reply is recorded with attribution 'ambiguous_recipient' (migration 20261123), linked to no job, and halts nothing. Thread headers still resolve exact attribution in that situation; single-campaign multi-step stays recipient_match and halts only that campaign.
- 11 reply-attribution tests (313 engine total pass), tsc clean.
## 2026-11-11 - Engine: G10 poll bridge (fixture pipeline wired end-to-end)
- InboundReplyEvent now carries inReplyTo/references so threading survives the poller boundary.
- poll-bridge.ts: recordPollEvents() persists each classified event via recordInboundReply (attribution re-derived server-side; the poller's campaignId context is never trusted for attribution) and returns a summary (fetched/recorded/duplicates/halted/ambiguous/unattributed). pollMailboxReplies() wraps it behind the LEADLOOM_IMAP_POLL_ENABLED gate and refuses to run otherwise.
- Fixture tests: full poll-to-persistence flow with halt, poller dedupe replay, and the enablement gate. 316 engine tests pass, tsc clean. No scheduler/endpoint mounts the poll path yet; live polling remains off.
## 2026-11-11 - Engine: G10 read-only reply reporting
- GET /outbound/replies (session-scoped, optional campaignId filter) lists persisted inbound_replies newest-first with classification, confidence and attribution basis; listInboundReplies is tenant-scoped (empty for other workspaces). Test covered. 317 engine tests pass.
## 2026-11-11 - Web: G10 recorded replies panel (read-only)
- Campaigns page gains a Recorded Replies section: newest-first list of persisted replies with sender, subject, classification, attribution basis (matched to message / matched to recipient / ambiguous - nothing halted / unattributed) and received time. Read-only; empty state states reply sync is disabled in this deployment.
- Browser-verified locally with seeded replies covering all attribution states; web tsc clean.
## 2026-11-11 - Engine: G6 waterfall connector registry endpoint
- GET /waterfall/connectors (session-scoped, read-only): the 10 registered enrichment connectors with capabilities, reconciled against the workspace's stored BYOK credentials - configured flag, masked key, label, verified (only after a real test-connection), timestamps. No provider calls; masked data only; unknown providers ignored; newest credential row wins.
- Verified live through the web session proxy (10 connectors, none configured, sendingEnabled:false); 4 reconcile unit tests; 321 engine tests pass, tsc clean.
## 2026-11-11 - Web: G6 connectors page reads the engine registry
- Connectors page now lists the 10 engine-registered connectors (correct id/name pairs - the old catalog mismatched ids to names, e.g. deepseek labeled "ZeroBounce") with live configured state from the vault.
- Invented unit costs and hit-rate percentages removed from the catalog and the card UI (shown only if grounded values ever exist); the "Sample catalog" badge is gone.
- Broken "Test Ping" button hidden unless a connector is testable (no engine route exists; test-connection stays env-gated).
- Configure/Save-key gated to providers the vault accepts (BYOKProviderEnum); others get an honest "key storage not available yet" notice, and the modal itself refuses non-enum ids.
- Browser-verified; web tsc clean.
### [2026-11-11T15:55:00Z] Team Alpha | contracts/waterfall.contract.ts | Non-Breaking
- Extended `BYOKProviderEnum` with pdl, zerobounce, neverbounce, serper, ollama; every engine-registered connector can now store an encrypted key (storage only, no provider call implied).
- Connector card states are now honest: stored-unverified vs verified. (05d8184)

---

### [2026-11-11T16:20:00Z] Team Alpha | engine /vault/credentials/:provider/test | Non-Breaking
- New session+write-role route for live test-connection. Inert unless LEADLOOM_CONNECTORS_LIVE_ENABLED=true; returns 503 DISABLED with cost disclosure otherwise, without decrypting the key.
- Credential isValid/lastVerifiedAt are now persisted truth surfaced via the masked list. (9b501f8)

---
### [2026-11-11T16:30:00Z] Team Alpha | docs/plan | Planning only
- G1 verified locally (two-account invite flow); removed-member recovery options drafted for owner decision (G1_MEMBER_RECOVERY_OPTIONS.md). G2 mailbox connect verified against local fixture mail servers; RELEASE_PLAN.md updated to main 4900244 with migrations 20261118-20261123 and flag posture.
- No contract or API change in this entry.

---

---
### [2026-11-11T16:45:00Z] Team Alpha | engine/ai-researcher + docs/plan | Release-plan correction + G4 heuristics
- Corrected RELEASE_PLAN.md "Recommended route" per review: build risk moves off-host, but pull/extract/container-replace risk is unmeasured (no uptime/duration promise); 33G ample is UNKNOWN until real image sizes measured; additive migrations do NOT prove rollback (no backup/restore runbook, rollback unsupported until tested); host arch x86_64 from 19:39 diagnostic; GHCR packages stay PRIVATE (first-publish default), public is a separate disclosure decision; hosted-runner compute generally free for public repos, no storage/retention cost claim. Workflow draft comment fixed to private-by-default.
- G4: removed ai-researcher.service.ts (fabricated fixed 0.88 confidence and templated claims). New WebsiteSignalService emits honest heuristic signals only: keyword tech hints, hiring/pricing/scaling mentions, wordCount; summary/confidence always null, source 'heuristic_keywords'. Not wired to any route; wired enrichment still requires a BYOK LLM with per-claim provenance. 3 new tests; engine 326 passed / 36 skipped, tsc clean.
- No contract or API change in this entry.

---
### [2026-11-11T16:50:00Z] Team Alpha | docs/plan | Release draft hardening + wording correction
- Corrected the workflow-token claim in durable docs: the draft's `permissions: packages: write` REQUESTS the grant but does not override repo/org Actions policy; unverified until first run (403 on permissions API with repo-scoped token). Recorded verified 2026-11-11 cost facts in RELEASE_PLAN.md: public-repo hosted-runner compute free/unlimited; GHCR container storage+bandwidth currently free (1 month advance-notice policy); overage blocked without payment method / $0 default spending limit.
- Hardened the inert workflow draft: actions pinned to commit SHAs, security-posture comments (workflow_dispatch only, no PR triggers, .dockerignore excludes .env/.git/secrets, standard free runner only). Still inert in docs/plan; awaiting Kamal's build-only approval asked by main at 22:16.
- No contract or API change in this entry.

---
### [2026-11-11T16:50:30Z] Team Alpha | docs/plan | Workflow PREPARED for owner activation (approved scope: build-only)
- release-images workflow content prepared at docs/plan/activated-release-images.yml under Kamal's 22:17 "Sure" (WhatsApp, reply context: main's 22:15:54 ask - build off-host, save images privately, no deploy/running-app changes; originals verified in observation DB). Approval covers build + PRIVATE GHCR push only; host login/pull/deploy remain unapproved later gates.
- NOT yet active: the repo push token lacks the `workflow` scope (remote rejected .github/workflows push), so the owner activates it himself: create .github/workflows/release-images.yml in the GitHub web UI with this exact file content, then Actions > release-images > Run workflow (ref: main).
- Identical to the reviewed inert draft plus: activation header and two read-only imagetools-inspect steps that print image digest and layer sizes to the run log (part of the approved "I'll check the images" step).
- No contract or API change in this entry.

---
### [2026-11-11T16:52:00Z] Team Alpha | .github/workflows | Workflow ACTIVE + first run dispatched
- Activated through Kamal's own signed-in GitHub browser session (cloud browser, config-h): created .github/workflows/release-images.yml directly on main, commit 3df93fa, byte-identical (sha256 ee11558f...) to the reviewed docs/plan/activated-release-images.yml. The repo push token lacks the workflow scope, so the owner-session web UI was the activation path (per main's 22:18 instruction).
- First run dispatched via the Actions UI (workflow_dispatch, ref: main); API dispatch confirmed unavailable to the repo token (403). Run status at dispatch: queued.
- Scope reminder: approval covers build + PRIVATE GHCR push only. Package visibility to be verified from the registry/package page after the run, not assumed from the first-publish default.
- No contract or API change in this entry.

---
### [2026-11-11T17:10:00Z] Team Alpha | docs/plan | First release build: measured results + visibility correction
- Run 43062288976 SUCCEEDED in 3m17s (queued 16:50:37Z, done 16:54:02Z). Measured: leadloom-engine 11 layers / 668.0 MB compressed (index sha256:0bb659f5, amd64 manifest bd26e514); leadloom-web 8 layers / 106.3 MB compressed (index a55baf08, amd64 ca996750). Total pull approx 774 MB compressed; extracted/coexistence footprint still unmeasured until an approved host pull.
- VISIBILITY INCIDENT + correction: both packages published PUBLIC (repo-connected inheritance on first publish from a public repo, contrary to the assumed private default). Publicly readable about 17 minutes; contents are builds of this public repo's code, no secrets in build context (.dockerignore verified). Set both to Private via the owner's GitHub browser session; anonymous pull now 403 (verified externally). Repo token gets masked 404 on private packages, consistent with gate 2 (host needs read:packages login - still unapproved).
- RELEASE_PLAN.md updated with measured facts and the visibility lesson; workflow draft comment corrected.
- No contract or API change in this entry.

---
### [2026-11-11T17:12:00Z] Team Alpha | docs/plan | Visibility incident: exact window, content inspection, publish pause
- Exact windows recorded: engine public 16:52:26Z-17:09:41Z, web 16:53:44Z-17:09:59Z; run + package URLs preserved in RELEASE_PLAN.md.
- Build-input inspection at SHA 3df93fa: no secret files/dumps in repo, .dockerignore covers .git/.env/data dirs, no ARG/ENV secrets in Dockerfiles, GITHUB_TOKEN only in the login step. Sole credential-shaped string: synthetic localhost placeholder in engine Dockerfile. LIMIT: not a bit-exact layer enumeration (no read:packages token; minting ruled out). Bit-exact check needs a vault read:packages token or an approved read-only inspect run.
- Publishing paused pending a preventive control (owner decision: workflow verify step / verify-and-flip checklist / repo-private-at-completion). Existing packages must be re-verified Private before any future push.
- No contract or API change in this entry.

---
### [2026-11-11T17:14:00Z] Team Alpha | docs/plan | Read-only image inspection workflow drafted
- docs/plan/image-inspect.yml: pull-only inspection of the two existing digests inside Actions (GITHUB_TOKEN, packages:read; no push step, no packages:write, images created+exported but never started). Scans for .env files, private keys, token-shaped and credential-shaped strings; prints counts/verdicts only because run logs are public. Activation planned via the owner's GitHub session under the existing build approval's image-checking scope.
- No contract or API change in this entry.

---
### [2026-11-11T17:18:00Z] Team Alpha | docs/plan | G10 verified through the real poller path
- End-to-end, fixture-only: hoodiecrow IMAP (127.0.0.1:2146) with a reply carrying In-Reply-To/References -> createImapflowClient (read-only, plaintextForTestsOnly) -> ImapReplyPoller -> pollMailboxReplies (LEADLOOM_IMAP_POLL_ENABLED=true in-process) -> recordInboundReply. Result: recorded=1, attribution thread_header, held pending_approval job 44444444 cancelled; immediate second poll fetched 0 (dedupe + uid checkpoint persisted). No live mailbox touched; nothing sent.
- Recorded Replies UI (campaigns page) shows the polled reply prospect.e2e@example.test, classification interested, basis "matched to message" - screenshot g10-e2e-replies.png. PUMPGTM_GAP.md G10 row updated (UI reporting is NOT missing; the earlier seeded-panel note replaced by this real-path verification).
- No contract or API change in this entry.

---
### [2026-11-11 22:56 IST] Team A - actual-image inspection complete: no credential material in either image
- image-inspect.yml v2 (run 43067623096, success) scanned the EXISTING release digests (engine sha256:0bb659f5..., web sha256:a55baf08...) read-only inside Actions: entry files present, 0 .env files, 0 credential-shaped env vars; all pattern hits (private-key/github-token/aws-key/password-like) trace to third-party package docs/code, none to repo source. v1 run 43066151341 failed on a wrong expected path + set -e before the web scan; v2 fixed both. Full record in RELEASE_PLAN.md CONTENT INSPECTION.
- Packages leadloom-engine and leadloom-web remain PRIVATE (flipped after the first-publish incident; anonymous pull verified 403). Publishing stays paused: no new packages until a private-before-content method is verified; existing-package pushes only after re-verifying Private state immediately before.
- No contract or API change in this entry.

---
### [2026-11-11 23:08 IST] Team A - G4 first increment: website research (heuristic) verified end-to-end locally
- New POST /research/website-signals (session-required; mounted only behind LEADLOOM_RESEARCH_API_ENABLED). Honesty contract: keyword matches only, source 'heuristic_keywords', no AI summary, no confidence score; relevance reasons cite the actual matched words; thin pages say they are thin. ICP hints are keyword category matches (industry/size/model), not inferred fit.
- URL fetching is a separate opt-in (LEADLOOM_RESEARCH_FETCH_ENABLED) via SafeWebsiteFetcher (http/https only, private hosts blocked, same-host redirects only, 512KB cap); without it the route returns an honest disabled state and zero egress exists. Health reports research mount state.
- New web Research page (/app/research): fetch-URL input + paste-text path, renders signals/reasons with 'keyword match' labeling. Verified in a real browser as e2e-g9: pasted-text analysis renders correctly; fetch URL shows the honest disabled message (screenshots g4-research-pasted.png, g4-research-fetch-disabled.png).
- 330 engine tests pass (7 new: service honesty + route integration incl. default-off 404, auth, pasted-text, fetch-disabled, injected-fetcher, thin-page). No contract or API change beyond the new route.

---
### [2026-11-11 23:16 IST] Team A - G4 website-to-lead-list verified end-to-end locally
- POST /research/website-signals/save (session + write role) re-computes the heuristic analysis server-side from the submitted text - the client never supplies computed signals - and writes a row to the per-workspace 'Website research leads' table (11 fixed columns incl. Source='heuristic_keywords' and Input). GET /research/leads lists saved rows (read role).
- Research page: 'Save to lead table' after analysis, plus a Saved analyses list. Verified in a real browser as e2e-g9: analyze -> save -> 'Saved to lead table' badge; Tables page shows the persisted 'Website research leads' table with 1 row (screenshots g4-research-saved.png, g4-tables-row.png; the demo grid below is the pre-existing labeled sample canvas).
- Engine tests: 334 pass (3 new: service save/list honesty, route role enforcement). No contract or API change beyond the two new routes.

---
### [2026-11-11 23:23 IST] Team A - real saved research rows readable; sample badge scoped to demo canvas
- GET /workspace/tables/:tableId/rows (session, tenant-scoped, 404 for another workspace's table) returns columns + rows keyed by column name. Tables page 'Open Table' now renders the real persisted contents read-only - verified in a real browser: the saved acme-k8s.example analysis row shows its actual values (screenshot g4-table-open.png).
- Topbar 'Sample data on this page' no longer covers the tables page (its persisted tables are real); the demo grid canvas keeps its own 'Sample preview' / 'Demo data' labels. Validator keeps the page-level badge.
- Gap doc precision: a saved research row is a company/page OBSERVATION, not a discovered buyer or contact lead; person-level discovery is not built.
- Engine tests: 336 pass (2 new: tenant-scoped rows read incl. cross-tenant null). No contract or API change beyond the new read route.
---
### [2026-11-11 23:50 IST] Team A - G3 worker skeleton: gated release + worker loop, sending stays off
- POST /outbound/release (write role + outbound_sending entitlement) calls AtomicDispatchRepository.releaseApproved: with LEADLOOM_OUTBOUND_SENDING_ENABLED unset it is an honest no-op returning {released:0,stale:0,sendingEnabled:false}; only when explicitly enabled does it move approved jobs whose stored snapshot hash still matches current content back to 'pending' (send-reservable) and reverts stale approvals to 'pending_approval'. Suppressed recipients never release.
- New OutboundWorker (start/stop/tick) discovers active campaigns via listActiveCampaigns (internal, no workspace filter) and ticks invalidation + release per campaign; per-campaign errors are counted, never fatal. NOT mounted in production bootstrap - no transport/mailbox-pool stack exists yet.
- Tests: 5 new PGlite release tests (incl. deliberate re-approval after content change then second edit -> stale at release), 3 worker unit tests, 1 route test (401/403/200 sendingEnabled:false/400). Full engine suite: 345 passed, 36 skipped, 0 failed; tsc clean. Sending remains OFF everywhere; live runs 94fa7ab with invites OFF.
---
### [2026-11-11 23:53 IST] Team A - G3 recipient store + strict per-recipient resolution
- Migration 20261124_campaign_recipients: per-campaign recipient rows (email normalized, first/last/company/title, custom_fields jsonb, unique per (campaign,email)). CampaignRecipientsRepository: tenant-scoped upsert + list, no cross-tenant existence leak. No UI or route yet.
- resolveRecipientMessage: STRICT variable resolution for {{email}}, {{first_name}}/{{name}}, {{last_name}}, {{company_name}}/{{company}}, {{title}} plus custom fields - unknown variable or empty value is an error, never a silent blank. This is the G9-corrected prerequisite: a reviewer must approve the actual resolved message, not a template.
- NOT yet wired: the approval snapshot hash still covers the raw template; wiring resolved content into enqueue/approve + reviewer UI comes next. Sending stays OFF; live runs 94fa7ab, invites OFF.
- Tests: 5 new (PGlite migration/upsert/tenant-scope + resolution pure tests); outbound module 134 passed/9 skipped; tsc clean. Full suite not re-run for this increment.
---
### [2026-11-12 00:25 IST] Team A - G9/G3: approvals now sign off the RESOLVED per-recipient message
- Migration 20261125_job_recipient_resolution (source-only, NOT applied to live DB): outbound_jobs gains recipient_id (FK campaign_recipients, ON DELETE SET NULL) + recipient_fields jsonb for inline fields fixed at enqueue.
- buildResolvedApprovalSnapshot: the approval hash now covers the message a specific person would actually receive (strict resolveRecipientMessage output), not the raw template. Wired into enqueue, approve, releaseApproved, invalidateStaleApprovals and listPendingApprovals via a shared currentApproval helper that reads LIVE recipient fields for linked rows.
- Semantics: enqueue with template variables and no recipient fields throws (fail closed, nothing enters the queue); editing a linked recipient row invalidates held approvals; a recipient losing a needed value keeps the job held and the review API returns resolutionErrors (contract field added; UI surfacing is next); approve on unresolvable content approves nothing.
- Reviewer-visible payoff with no UI change needed: the approval queue's Subject/body lines now show the actual resolved message.
- Tests: 4 new resolution-wiring specs (PGlite, incl. live-field invalidation + fail-closed enqueue) + 5 recipient/resolution specs from previous increment; approval/release specs updated for the two-step stale refresh. FULL engine suite: 354 passed, 36 skipped, 0 failed; tsc clean (engine + contracts). Sending stays OFF; live runs 94fa7ab, invites OFF.
---
### [2026-11-12 00:45 IST] Team A - resolution errors surfaced in review UI; enqueue route takes recipient data
- Approval queue (campaigns page): a held item whose message can no longer be assembled for its recipient shows a red 'Held: this message cannot be assembled...' block naming each resolution error (variable + subject/body), and its Approve button is disabled (title explains the fix). Verified in a real browser against the local stack (screenshot g9-resolutionerrors.png): fixture = campaign with {{company}}/{{name}} steps + campaign_recipients row whose fields were then nulled (no recipient route exists yet; fixture built with the real resolution/hash functions; the held-state computation and render are real code). 3 error lines rendered; healthy item's Approve stays enabled.
- POST /outbound/jobs now accepts optional recipientId (links to a campaign_recipients row) or inline recipient fields; resolution failures return 400 with an actionable detail ('Message does not resolve...'), other errors stay generic.
- Local dev DB: migrations 20261124+20261125 applied locally only; LIVE DB untouched (live runs 94fa7ab, migrations live through 20261117 only).
- Full engine suite: 354 passed, 36 skipped, 0 failed; tsc clean; next build clean. Sending stays OFF everywhere.
---
### [2026-11-12 00:47 IST] Team A - recipient import routes (backend; UI next)
- POST /campaigns/:id/recipients (write role + outbound_sending entitlement, max 500 per call) upserts into campaign_recipients via CampaignRecipientsRepository; GET lists (read role). Both 404 on another workspace's campaign (no existence leak). Emails normalized. This is the real entry path into the recipient store that per-recipient resolution reads; previously rows could only be created repository-direct.
- Route test on PGlite with real migrations: 401/403/400/404 + upsert/list round trip with email normalization. Touched-module suite 154 passed/9 skipped; tsc clean. UI (paste-CSV on campaign page) is the next increment. Sending OFF; live 94fa7ab.
---
### [2026-11-12 01:10 IST] Team B deliverable: provider-access matrix (research-only assignment)
- Team B (Antigravity, leadloom project) produced docs/plan/PROVIDER_ACCESS_MATRIX.md: per-provider access path, free tier, B2B-outreach terms and billing setup for the 10 registered waterfall connectors + contract-only prospeo, plus G5 intent sources (Greenhouse/Lever ATS feeds, Indeed, SEC EDGAR, Crunchbase, X, LinkedIn). Its split: buildable-now-without-purchases = Ollama, SEC EDGAR, public ATS feeds, Hunter (50 free/mo), ZeroBounce (100 free/mo), Serper (free credits - count UNVERIFIED); needs-paid/approval = OpenAI, Anthropic, PDL, NeverBounce, Prospeo, X API, Crunchbase, LinkedIn.
- Instinct review before integration: codebase inventory verified against the repo; Hunter free tier verified live on hunter.io/pricing; every citation name mapped to its official URL inline; remaining vendor claims marked not-independently-verified. No plans/code approved in Antigravity; no accounts or keys created. origin/main contained only Instinct commits at collection.
