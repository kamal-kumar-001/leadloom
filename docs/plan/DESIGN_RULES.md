# Design and UI rules (binding for every team and every task)

Source: Kamal's repeated direction. He should never have to restate these. Every brief points here; every change is checked against them. Run `node scripts/check-design.mjs` before pushing (add `--strict` once the baseline is clean).

## One source of truth
1. All colors, radii, shadows come from `apps/web/app/tokens.css` (dark and light). Kamal plans to replace the indigo accent: it must be a one-file change. No hex, no `text-white`/`text-black`, no raw Tailwind palette classes (`indigo-500`, `slate-800`) in app code.
2. Email palettes derive from the same file (`scripts/gen-brand.mjs` generates `EMAIL_BRAND`). Never hand-copy colors into a template.
3. Landing is light by default and has gradients; dashboard supports dark and light. Both themes are checked for every screen.

## Components
4. Use `@leadloom/ui` (Button, Badge, Card, StatCard, EmptyState, LockBadge, GatedButton) and the shared pieces in `components/feedback`, `components/shell`. Do not restyle a primary button with classes. A primary (accent) button always has `text-onAccent` text: this is built into `<Button variant="primary">`. Never an accent button with dark text, never a different hover color per page.
5. Missing component: add it to `packages/ui` (Gamma) or write the need in SYNC_FEED. Do not make a one-off lookalike.
6. Forms: `FormField` with label, inline error tied by aria-describedby. Toasts are for events (via `lib/notify`), not for every field error. Errors show safe plain sentences, never raw engine text or stacks.
7. Same logic and components for the same job (signup OTP and reset OTP, shared). Reuse Kamal's own component repos (DMPilot, BakeryPOS) re-themed, check their license-free status (his own code).

## Honesty
8. No hardcoded fake data or fake users, no invented numbers, badges or capabilities. Fixture pages are labelled "Sample data on this page". Not-built is "Not available yet" (no lock). Plan-locked is a lock with a reason (docs/plan/GATING.md). No fake success.
9. No open-source positioning (proprietary product). Never name the reference product. No "zero-knowledge" claims. Third-party license notices stay.

## States and accessibility
10. Every data view has loading, empty, error-with-retry. Buttons show pending and disable on submit. Destructive actions confirm. Modals trap focus and close on Escape. Toasts are announced politely, errors needing action do not auto-dismiss.
11. Visible keyboard focus everywhere, adequate contrast in both themes, tap targets usable at 390px, no horizontal scroll at 390px.

## Process
12. Check actual rendered pixels (dark and light, 1280 and 390) for every UI change. A spot fix is not "consistent": run the checker and list exceptions in `docs/plan/DESIGN_EXCEPTIONS.md`.
