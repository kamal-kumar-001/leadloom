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

7. Public copy: remove competitor and reference-product names from `apps/web/app/layout.tsx` metadata, `apps/web/app/(marketing)/page.tsx` and `apps/web/components/marketing/savings-calculator.tsx`. Keep a comparison claim only if it can be verified from public sources; otherwise reword it generically ("hosted GTM platforms"). Do not describe the live site as updated until a release ships.
