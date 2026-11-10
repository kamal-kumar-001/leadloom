# Landing page and navigation plan

Source: Kamal, 2026-11-10 22:40 IST. LeadLoom is proprietary (not open source). Light theme, current colors kept, gradient backgrounds, an email CTA in the hero, and a mega menu on every nav item except Pricing. The structure takes inspiration from a reference product's information architecture only. No copied text, code, layout assets or imagery. We study public pages only; no access-control bypass.
Goal: be better than the reference in every aspect. That is a build target, not a public claim. No page says "better than X" until we can show a sourced, measured comparison.

**Order stays as set in `STAGES.md`: Stage 1 login, Stage 2 dashboard, Stage 3 connectors. The landing page is Stage 4 and does not start earlier, except item L0 below.**

## L0 (small, do now, Alpha, no new design)
Remove from `apps/web` the open-source and self-host positioning and the reference-product and competitor names: the marketing page (badge, subtitle, "Deploy Self-Hosted ($0)", footer "MIT / Apache 2.0", FAQ answer), the signup page line "Self-hosted & Open-Core", the savings calculator and architecture-tabs wording, and the connector card "$0 Self-Hosted" label (an Ollama local model is fine to describe as "runs on your machine"). Keep third-party license notices. Gamma already cleaned `docs/prd.md` and `docs/uiux.md`. Do not delete LICENSE or NOTICE files of dependencies.

## Rules for every landing element
- Nav menu items link only to pages that exist. A menu entry for something not built is labelled "Coming soon" with no link and no fake success. A page that is a stub is not linked.
- No invented numbers, logos, testimonials, star counts or savings claims.
- Hero email CTA, fully defined before build: purpose = start sign-up (the email prefills `/signup`), nothing else. No storage on the landing page and no email sent from it. Sign-up itself is the existing OTP flow, to the requester only. Any waitlist or newsletter storage needs its own consent text and Kamal's decision; not built by default. No marketing sends.
- Light theme for marketing via the design tokens (CSS variables); dark stays for the app. Gradient backgrounds from tokens, no hard-coded colors.
- Menu content comes from `packages/contracts` feature and pricing config where numbers appear (central pricing, see `FOUNDATIONS.md`).

## Mega menu map (honest status)
| Nav item | Sections to include | What exists now | Destination rule |
|---|---|---|---|
| Features | Signals, waterfall enrichment, tables, sequences, validator, mailboxes and deliverability, team and roles | engine pieces partly built; UI partly mock | link only to a page describing real, working behavior; others "Coming soon" |
| Use cases | founder idea validation, outbound for startups, agencies, sales teams | validator and waterfall in progress | link to an honest page per case once it works |
| Industries | only industries we can show a real workflow for | none | omit until real |
| Integrations | one entry per connector in `CONNECTORS.md` (Apollo, Hunter, Dropcontact, PDL, ZeroBounce, NeverBounce, Serper, OpenAI, Anthropic, Ollama) with status: Available, Beta, Coming soon, read from the connector registry | Beta stage 3 | the status badge is generated from the registry, never typed |
| Resources | docs, changelog, guides, comparison pages | docs not published | add only published content; comparison pages only with sourced facts |
| Pricing | single page, no mega menu | plans in central config | numbers from the config |
The same component serves the marketing nav and later the in-app help menu.

## Capability gaps to study (reference vs ours), staged
Method: read the reference's public site and public docs only. Record what each public feature does in `docs/plan/REFERENCE_MAP.md` (the reference is not named there either; call it "reference product"). Columns: capability, evidence (public URL and date), our status (working, partial, mock, none), our stage. Candidate areas to map: people and company data, signal sources, sequencing, API/MCP access, skills/templates library, directories and indexes, multi-channel, analytics, pricing model, onboarding speed. Unverified items stay marked "unverified". Do not infer a competitor's internals.

## Stage allocation
- **Gamma (now):** Stage 1 engine and wiring, harness evidence, docs cleanup (done), `REFERENCE_MAP.md` skeleton and public-source review, after Stage 1 evidence. Hero-email backend: none needed (the CTA prefills sign-up).
- **Alpha:** Stage 1 web fixes first (see ALPHA_BRIEF.md list), L0 text removal, then Stage 2 dashboard (user and admin separate, light and dark), then Stage 4 landing (light theme, gradients, hero email CTA, mega menus per the table).
- **Beta:** stays paused until Stage 3; then connectors per `CONNECTORS.md`, and exposes connector status in the registry for the Integrations menu. No UI.
- Unresolved intent that blocks nothing now: whether hero email should also join a waitlist or newsletter. Default: no.
