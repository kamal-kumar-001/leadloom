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
