# Dashboard stage - Team Beta task 2: real Settings page

Binding first: docs/plan/DESIGN_RULES.md (run `node scripts/check-design.mjs` before pushing). Same rules as docs/plan/DASHBOARD_BETA.md (tokens only, @leadloom/ui components, dark and light, 390 and 1280, no invented data, pull --rebase before push, main only, commits as Kamal, no secrets, no deploy).

Files you own for this task: apps/web/app/app/settings/page.tsx and apps/web/components/settings/* (new). Gamma has moved the shell identity into components/shell/identity.tsx (`useShellIdentity()` gives email, workspaceId, role from the engine). Do not edit the shell, tokens, packages/ui or the overview page.

Replace the current settings page, which shows made-up team members ("Alex Chen"), made-up usage numbers and a fake owner name. Build:
1. Account: signed-in email, workspace id, role (from useShellIdentity). Sign out button (`signOut({ callbackUrl: '/login' })` from next-auth/react).
2. Appearance: dark/light choice using the existing ThemeProvider from @leadloom/ui (same control the topbar toggle uses).
3. Plan and limits: show the limits defined in packages/contracts/src/entitlements.contract.ts as a read-only list of what the product defines. Label clearly: "Limits are defined but not enforced yet" (the engine health reports entitlements not_enforced). No usage bars, no used/remaining numbers, because nothing measures usage.
4. Team: show only the current user. A line "Inviting teammates is not available yet". No invented people.
Use Card and EmptyState from @leadloom/ui. Check tsc, next build, and view dark and light at 1280 and 390 yourself. Push to main, report the commit hash.
