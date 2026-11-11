# Engineering rules and per-change checklist

Source: Kamal, 2026-11-12 voice direction - a project-wide checklist applied to every change, so the product stays industry-standard maintainable rather than accumulating vibe-coded debt. This file is the ruleset; every builder (human or agent) reads it before building and checks it before calling a change done. Keep it concrete: each rule has a check that can actually be run or inspected. Amend it when a real failure teaches something new (see "How rules get added").

## 1. Design tokens and styling
- Colors, spacing and motion come from shared tokens (`apps/web/app/tokens.css` via `apps/web/tailwind.config.ts`), never hard-coded hex in components. Palette changes are token edits, not component edits.
- No opacity modifiers on CSS-var colors (`bg-canvas-elevated/40` drops silently and renders unstyled). Use plain tokens (`bg-canvas`, `border-border-subtle`). Check: after styling work, screenshot and confirm the element actually renders themed.
- Light theme for marketing, dark for the app; both come from the same tokens. Respect `prefers-reduced-motion`.

## 2. Components and file size
- Reusable UI lives in named components under `apps/web/components/<area>/`; pages compose them. A block of JSX with its own state/handler that appears inside another component's render is a candidate to extract (done: `SenderPinSelect` out of the approval queue).
- No oversized files: a component past ~300 lines or a page doing data + layout + forms all at once gets split before new features pile on. Engine modules keep their existing boundaries (repository / service / routes); new query logic goes in the module's repository, not inline in `main.ts` route bodies (thin routes: parse, authorize, delegate).
- No copy-pasted near-duplicates: two occurrences of the same non-trivial logic means a shared helper.

## 3. UI/UX consistency (every interactive surface)
- Navigation: consistent placement via the app shell; menu entries link only to pages that exist, unbuilt entries are labeled, never dead links.
- Hierarchy and contrast: one clear primary action per view; body text and muted text keep readable contrast on their backgrounds (verify on the screenshot, both themes when both apply).
- Responsive: layouts verified at mobile width (~390px) and desktop; grids collapse to single column, nothing overflows or clips action buttons.
- Keyboard and focus: interactive elements are real buttons/links/selects (keyboard-reachable), focus visible, no click-only divs for actions.
- Forms: inline validation with clear messages (existing pattern: field errors under inputs); invalid input never silently no-ops; destructive actions confirm first.
- States: every async panel has loading (skeleton/spinner), empty (EmptyState with next step), error (message + retry), and success feedback (toast via `lib/notify`). A silent success or a spinner that never resolves is a bug.
- Action feedback names the consequence honestly ("approved and held (sending stays disabled)"), including permission states - disabled controls say why (title/hint), not just greyed.
- Check: the real-browser pass exercises these states where the change touches them, and screenshots are inspected for readability, not just presence.

## 4. Data handling and SQL
- Raw SQL with uuid/jsonb/timestamptz parameters uses explicit casts (`$1::uuid`, `$9::jsonb`). PGlite/pg-mem accept wrong types silently; only the local real-Postgres stack proves them. Check: exercise every new raw query through the real browser/API e2e, not just the unit suite.
- Tenant scoping on every query: `workspace_id` from the session, never from the client. Cross-tenant reads must return 404/[] without existence leaks.
- Migrations are additive files in `packages/database/prisma/migrations/`, named `YYYYMMDD_topic`; every spec that boots its own DB lists the migrations it needs (update the lists when adding one). Live DB is never reset; local dev DB is disposable.

## 5. Permissions and trust boundaries
- Every route: `authorize` first, write routes with role check, entitlement check where a plan gate exists. New routes fail closed (4xx), never open-by-default.
- UI copy must not promise what code does not do. Sample/demo data is labeled at the point of display ("Sample preview"), and fixture setup in tests is named as fixture with the real path under test identified.
- Sending, invites, provider egress and live deploys stay behind their env flags and explicit owner approvals; code keeps honest no-ops when a gate is off (e.g. release returns `sendingEnabled:false`).
- Secrets only via the vault; never in code, chat, or the repo.

## 6. Server load (shared host)
- Reads are paginated or capped (`LIMIT` on list queries), no unbounded scans. N+1 patterns batched.
- Rate limiting on mutation routes; heavy work goes to the worker, not request paths.
- Builds and tests run off-host; the shared host only runs the deployed services.

## 7. Verification before "done" (the real app, not the suite alone)
- Engine changes: `node node_modules/.bin/vitest run --root apps/engine` green.
- Web changes: `npx next build` clean, standalone static refreshed, then exercised in a real browser against the local stack (real Postgres) - click the actual flow, assert the visible result, and inspect a screenshot of the final pixels.
- Suite-green is necessary, not sufficient: two production-shaped bugs (SQL casts, dropped Tailwind classes) passed the suite and were caught only by real-app checks.
- Reports distinguish live vs source-only, verified vs unverified, measured vs estimated. Claims about what users can do today are checked against the deployed commit and live flags, not HEAD.

## 8. Git and docs hygiene
- `main` only, no force-push, dirty tree committed before `git pull --rebase`. One SYNC_FEED entry per change and the gap-doc row updated when a gap moves.
- Commit messages name the gap/feature and the substance.

## How rules get added
A rule is added when a real failure or a direct owner decision teaches it, with the check that would have caught the failure. Well-supported industry-standard preventive checks (researched UI/UX or engineering practice) may be added the same way, with the source noted. No aspirational rules without a runnable or inspectable check. This checklist is process support, not certification: it does not prove compliance by itself - the real-browser and suite checks are the evidence.
