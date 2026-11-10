# Team Beta brief (Antigravity, lab PC)

Read first: `docs/plan/PHASES.md`, `docs/plan/CONNECTORS.md`, `docs/context/TEAM_CONTEXT_BETA.md`.
Write only in `apps/engine/src/modules/{waterfall,signals,ai-researcher,validator}/**` and `workers/**`. `git pull origin main` first, push to `main`, never reset --hard, never touch `.env`, never run update.sh.

Tasks:
1. Connector SDK in `apps/engine/src/modules/waterfall/connectors/`: interface `{id, capabilities, auth, rateLimit, run(input, ctx)}`, a registry, and an explicit error result (never fake success) when no key is present.
2. Implement from public docs: Apollo, Hunter, Dropcontact, PDL, ZeroBounce, NeverBounce, Serper, OpenAI, Anthropic, Ollama. One file each plus a vitest spec with recorded fixtures (no live calls in tests).
3. Keys arrive only through the vault port; never log them.
4. Report via `docs/context/SYNC_FEED.md`.
Done: `npx vitest run` and `npx tsc --noEmit` pass in `apps/engine`.
