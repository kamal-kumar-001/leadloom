# LeadLoom: sequential stages (supersedes the parallel phase plan)

Direction from Kamal, 2026-11-10 21:53 IST (voice note, relayed): too much is unfinished at once. Finish and test login end to end first, then the dashboard, then connectors. Pause later work. Remove unnecessary placeholders. No hardcoded fake functionality. No rush to show a demo.

This file wins over `PHASES.md`, `ALPHA_BRIEF.md` and `BETA_BRIEF.md` wherever they disagree. Their ownership rules and safety rules still apply.

## Rules for all three teams
- One stage at a time. A stage is done only when it runs and has been checked in a real browser (screenshot or recorded steps), not when tests pass.
- Nothing hardcoded that pretends to work. No fake users, no password-less sign-in, no fallback secrets, no mock data shown as live. Anything that is a sample is labelled "sample" in the UI.
- No new placeholder pages, no new routes, no new modules for a later stage.
- Keep working code. Do not delete or rewrite modules wholesale. Inventory first (see below).
- Main only, commits as Kamal, pull before push, never overwrite `.env`. No deploy, no real email, no spend, no provider calls, no account changes. Flags default off.

## Stage 1: login end to end (current)
Done means a person can sign up or sign in, land in their own workspace, see only their own data, sign out, and get clear errors when something fails. Checked in a browser on the web app talking to the real engine.

Alpha (`apps/web`, `packages/ui`):
1. Real identity only. Sign-in uses Google and/or GitHub through Auth.js, and an email and password path only if it checks a real password hash held by the engine. Remove the password-less Credentials provider. No email-string role rules, no fallback secrets: if `AUTH_SECRET` or the bridge secret is missing or short (under 32 bytes), refuse to start and refuse to mint.
2. `/api/engine-token`: mint only from the provider evidence of the authenticated session. `email` and `idp` come from the provider account (`account.provider` plus the provider's own verified-email signal), never from a form field or a default. If unavailable, fail closed with a visible error.
3. Sign-up and first login call the engine to provision (`POST /auth/provision`) and show the engine's real answers (created, already exists, suspended, rate limited, disabled).
4. Sign-out, expired session, error and denied screens that say what happened.
5. `/app` and `/admin` are gated by the engine's answer. `/admin` stays closed until the engine has a platform-admin record (not built). The UI never decides a role.
6. Sample or mock data in the dashboard is labelled, and never shown when the engine call failed.

Gamma (engine, auth, database, integration):
- Bridge, provisioning, access guard, tenant isolation, rate limits: built and tested (see FOUNDATIONS.md and MIGRATIONS.md). Gamma verifies Alpha's work against the real engine in a browser and reports gaps.
- Needs a deployed-like run: engine and web together on a local or lab-test setup with fixture data. No production deploy.
- `GET /auth/me` (bridge or session token) returns the engine's own userId, workspaceId and role, 401 otherwise. The web app uses it to gate `/app` and `/admin`.
- Local harness: `scripts/dev/stage1-harness.sh up` (local database, throwaway secrets, bridge and sign-up on).
- Login methods decided by Kamal: GitHub and email/password now, Google later (credentials not yet supplied).
- Email/password is built in the engine behind `LEADLOOM_PASSWORD_AUTH_ENABLED` (default off; needs `LEADLOOM_PASSWORD_AUTH_BASE_URL`, a mail sender, DB migration `20261115_password_auth`). The engine checks the scrypt hash itself and issues its own session. It never claims a provider identity; the bridge stays Google/GitHub only.
  - `POST /auth/register {email,password,name?}` -> 202 `check_your_email` always (no account listing). Creates an unverified admin of a new workspace, mails a one-time link.
  - `POST /auth/verify-email {token}` -> 200 / 400. `POST /auth/login {email,password}` -> 200 `{token,expiresAt}`; 403 `email_not_verified` until verified; 401 on bad credentials; 429 when limited.
  - `POST /auth/forgot-password {email}` -> 202 always; `POST /auth/reset-password {token,password}` -> 200 / 400. Tokens: 32 random bytes, only the SHA-256 is stored, single use, verify 24h, reset 1h. Password: 10 to 256 characters.
  - The links point to web pages `/verify-email?token=` and `/reset-password?token=` that Alpha must build; they post the token to the engine.
  - Alpha: Auth.js Credentials `authorize()` calls the engine `/auth/login` and keeps the engine session token for later engine calls (send it as `Authorization: Bearer`). Do not verify passwords in the web app. Show the engine's real errors, including "verify your email".
  - Local harness now also turns this on with a file mail sink (`/tmp/leadloom-stage1-mail.jsonl`, dev only, refused when `NODE_ENV=production`): verification links land in that file, nothing is sent.
  - Sessions: engine sessions carry `iat`; a password reset sets `users.sessions_valid_after`, and the access guard then refuses any engine session issued before it (seconds resolution). Verified over HTTP: old token 401 after reset, new login 200. Provider (bridge) tokens are unaffected.
  - Email provenance: the migration marks a user verified only when the audit log shows a provider-verified provisioning; operator-created or fixture users stay unverified and can verify by reset link. A provider-proven email taking over an unverified password account drops its password (pre-registration takeover guard).
  - Known limits: no captcha; per-IP limiting sees the proxy address until IP passthrough exists. Real mail needs an approved sender (Resend key, domain, from-address): not configured, nothing has been sent.
- Open engine work for login: client IP passthrough for the per-IP limiter.

Beta: paused. Finish only what is already in flight and safe to stop (commit it if tests pass, otherwise leave uncommitted). No new files for stage 3.

## Stage 2: dashboard (after stage 1 is verified)
Shell, theme tokens, light and dark, workspace and settings pages that show real engine data. Admin and user dashboards are separate. Plans, feature access and limits come from the engine (`EntitlementService`), never from the UI.

## Stage 3: connectors (after stage 2)
Connectors exist from Beta, fixture-tested only. Wiring, credential storage on the existing vault, test connection (live calls need Kamal's approval) and the connector hub come here, one connector at a time.

## Scaffolding inventory (what exists, reuse unless it blocks a stage)
Reuse as is: engine auth, bridge, provisioning, access guard, audit log, entitlements, vault, migrations and bootstrap. Alpha shell, tokens and layout (fix auth first). Beta connectors and security helpers (leave alone until stage 3).
Do not build now: connector catalog contract, credential facade, test-connection service, CSV importer, DNS inspector, validator edge limits, waterfall UI.

## Landed before the pause (Beta 38dc6e0, 2026-11-10 21:55 IST): unwired, parked until stage 3
Files: `waterfall/credentials/*` (own AES-GCM sealer, port, in-memory store), `waterfall/connectors/test-connection.service.ts`, `packages/contracts/src/connector-catalog.contract.ts`, raw allowlists in Apollo, OpenAI and Ollama.
- Nothing imports these from a route or from `main.ts`. They are not part of login or the dashboard and must not be wired now.
- `credential-sealer.ts` duplicates what `apps/engine/src/modules/vault` (VaultService, `docs/adr/001-byok-encryption.md`, `LEADLOOM_MASTER_KEY`, `key_version`) already does. In stage 3 it is reconciled onto the existing vault (thin write-only facade) rather than shipping a second key system. Do not use the sealer for real keys.
- Kept, not deleted: tests pass and the catalog and raw allowlists are reusable.
