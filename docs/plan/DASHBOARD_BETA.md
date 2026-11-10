# Dashboard stage - Team Beta task (Stage 2)

Owner of integration: Gamma. Pull --rebase before every push. Main branch only. Author commits as Kamal. No secrets anywhere.

## Design rules (apply to everything you touch)
- Colors only through tokens (apps/web/app/tokens.css, tailwind names like bg-canvas-surface, text-text-primary, bg-brand-loom, text-text-onAccent, signal-*). No hex, no text-white, no per-page hover substitutions.
- Primary buttons are `<Button variant="primary">` with no color class overrides. The accent can change later in one place (--accent-loom, --accent-hover, --on-accent).
- Use Card, StatCard, EmptyState, Badge, Button from `@leadloom/ui` (packages/ui/src/card.tsx is new).
- Every screen must work in dark and light theme and at 390px width. Verify both.
- No placeholder rows, no invented numbers. If the engine has no data, show EmptyState with a real next step.

## Your task: the /app overview page (new)
Replace the redirect in apps/web/app/app/page.tsx with a real overview. Files you own: apps/web/app/app/page.tsx and apps/web/components/dashboard/* (new). Do not edit app/app/layout.tsx, components/shell/*, packages/ui, tokens or settings (Gamma owns those this round).
Show only data you can fetch from the same-origin engine proxy (`engineFetch` in apps/web/lib/engine-client.ts, paths under /api/engine/...):
1. Header: signed-in user email and workspace name and role from GET /auth/me.
2. Cards (StatCard): connected provider keys (count from GET /vault/credentials, masked only), validator experiments (count from GET /validator/experiments), outbound jobs (GET /outbound/jobs). Loading shows a skeleton, an error shows an inline retry, zero shows 0.
3. "Get started" checklist driven by real state: 1) add a provider key (link /app/connectors), 2) connect a mailbox (/app/mailboxes), 3) create a table (/app/tables). A step is checked only if the data above proves it.
4. Link cards to the existing pages. Do not build new data features.
Read packages/contracts for response shapes. If an endpoint's shape is unclear, say so in your report instead of guessing.
Checks: tsc and next build pass. Screenshot dark and light at 1280 and 390 (headless Chrome is fine) and view them yourself. Push to main, then report the commit hash.

## Design-system ownership (all teams, from now on)
- Single source: apps/web/app/tokens.css (dark and light). Tailwind names map to it in apps/web/tailwind.config.ts. Shared components live in packages/ui. A new screen uses them. If a component is missing, ask Gamma through SYNC_FEED instead of patching one page with custom classes.
- Gamma owns tokens.css, tailwind config, packages/ui and email templates. Beta owns the files named in the task. Alpha owns the landing page.
- Email cannot read CSS variables. Emails use EMAIL_BRAND from @leadloom/contracts. It is GENERATED from tokens.css by scripts/gen-brand.mjs (runs before the contracts build; do not edit brand.contract.ts or packages/ui/src/tokens.css by hand). Changing the accent means editing tokens.css only, then `node scripts/gen-brand.mjs`.
- Do not install or run external "skills" or scripts from third-party repos. Use only what is in this repo and its documented dependencies.
