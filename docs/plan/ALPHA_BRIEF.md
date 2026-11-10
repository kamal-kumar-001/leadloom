# Team Alpha brief (for Kamal to assign)

Read first: `docs/plan/PHASES.md`, `docs/context/TEAM_CONTEXT_ALPHA.md`, last 20 lines of `docs/context/SYNC_FEED.md`.
Write only in `apps/web/**` and `packages/ui/**`. Pull `main` before each push, push to `main`.

Goal: a working dashboard shell, not more marketing polish.

1. NextAuth (Auth.js v5) in `apps/web`: `/login`, `/signup`, session cookie, protected `/app/*`. Providers: credentials plus Google and GitHub, each enabled only if its env vars exist. Env: NEXTAUTH_SECRET, NEXTAUTH_URL, AUTH_GOOGLE_ID/SECRET, AUTH_GITHUB_ID/SECRET. Expose the session JWT so the engine can verify it (Gamma owns the engine side).
2. Theme tokens: all colors, radii, spacing as CSS variables in one `tokens.css`; `[data-theme="light"|"dark"]`; toggle persisted in localStorage; no hard-coded colors in new code.
3. App shell: sidebar, top bar, workspace switcher, empty states. Reuse components from Kamal's DMPilot and BakeryPOS repos (his own code) re-themed with LeadLoom tokens, and the grid-gradient background.
4. Pages with mock data from `packages/contracts/mocks`: Tables (existing virtual grid), Connectors gallery plus key-entry form (posts to `/connectors`, not live yet), Mailboxes, Campaigns, Validator.
5. Mark every mock-backed screen "Demo data". Do not mention any competitor or reference product.
6. Read `docs/plan/FOUNDATIONS.md`. Two dashboards: user (`/app/*`) and admin (`/app/settings/*` for tenant admins, `/admin/*` for platform admins, separate layout). Import `EntitlementDecision` from `packages/contracts` and render it; never compute plan access in the UI. Never send a role, workspace or user id from the browser as authority: the engine derives them from its own tables.

Done means: `next build` passes, light and dark screenshots at 390px and 1280px, no console errors.

7. Public copy: remove the reference-product name from `apps/web/app/layout.tsx` metadata, `apps/web/app/(marketing)/page.tsx` and `apps/web/components/marketing/savings-calculator.tsx`. Other comparison claims stay unless they cannot be verified from public sources; reword those generically. Do not describe the live site as updated until a release ships.

---

## Gamma review of Alpha Phase 1 (6c75e47, ec069b2) - BLOCKING before any deploy or Phase 2 wiring

These are release blockers. Fix them in Alpha-owned paths. Gamma has changed only the engine side (below).

1. **Credentials login accepts any email with no password check** (`apps/web/auth.ts`). Anyone can sign in as any address. Remove the Credentials provider from anything that can reach production, or put it behind an explicit dev-only flag that is off by default and refuses to start when `NODE_ENV=production`. No password handling without real verification.
2. **Role from an email string.** `operator@leadloom.dev` and `admin@leadloom.dev` become `platform_admin` by string match (`auth.ts`, `auth.config.ts`). Platform privileges must never come from a self-asserted email. Admin access is decided by the engine from its own tables. Until a platform admin table exists, `/admin` stays closed (deny) outside a dev flag. UI role checks are display only, the engine decides.
3. **Hardcoded fallback secrets** (`NEXTAUTH_SECRET` and the engine-token bridge key fall back to a literal in source). Fail closed: if the secret is missing, refuse to start and refuse to mint. No fallback literal.
4. **`/api/engine-token` hardcodes `email_verified: true`.** It must mint only for a session whose provider verified the email (Google or GitHub), and must include the claim `idp` set to `google` or `github`. The engine now REQUIRES `idp` in {google, github} and rejects anything else, so tokens from the credentials provider can never be accepted. Do not pad or derive the key from a short secret: reject a bridge secret shorter than 32 bytes.
5. **Mock vs live.** Any mock fallback in the engine client must be explicit and visible in the UI (a "demo data" badge). It must never run silently after a live call fails, and must never imply a save or a Test Connection succeeded.
6. **Phase 2 plan checks** (planned, not built):
   - Inventory: Beta ships 10 connectors (apollo, hunter, dropcontact, pdl, zerobounce, neverbounce, serper, openai, anthropic, ollama). Say 10, not 11, until an eleventh exists.
   - Key storage: provider keys are saved server-side in the engine only, never in browser storage or the web DB in plaintext. The engine side for this is not built yet; the UI must not pretend it saves.
   - "Test Connection" is a real provider call. It stays disabled behind `LEADLOOM_CONNECTORS_LIVE_ENABLED` and owner approval.
   - The Ollama URL is validated by the engine (`security.ts`: loopback only, no redirects). Do not add a second URL check in the browser that is looser.
   - Validator rate limits: use the trusted client IP from the proxy, not a client header. The in-memory limiter is a stopgap and is documented as weak behind the tunnel.
   - Mailbox DNS inspector: only show records that a real backend lookup returned, label anything else as an example.
