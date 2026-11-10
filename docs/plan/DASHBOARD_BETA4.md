# Beta task 4: Provider keys in Settings (real), honest fixture pages

Binding first: docs/plan/DESIGN_RULES.md, then run `node scripts/check-design.mjs` before pushing (must stay at 0). Use `lib/notify`, `components/feedback`, `@leadloom/ui`. Do not touch tokens, tailwind config, packages/ui, the shell, gating components, emails or the landing page.

## Part A: Provider keys card in Settings (components/settings/provider-keys.tsx)
Engine already has GET/POST/DELETE /vault/credentials and `apps/web/lib/engine-client.ts` has the masked list and save functions (read them; add a delete helper only if missing, in engine-client.ts).
- List saved keys: provider, label, masked tail, created date. Never show or log a secret. Value input is type=password, cleared after submit, never put in a toast.
- Add key (FormField, pending state, toast via notify). Delete with ConfirmDialog.
- Loading, empty ("No provider keys yet"), error with retry. Role: only owner/admin see add/delete (use useShellIdentity role); others see the list read-only.
- Mount it as one card in app/app/settings/page.tsx. No connector catalog, no provider verification claims ("Saved", never "Verified").

## Part B: honest fixture pages (tables, mailboxes, campaigns, validator)
Only where it is cheap: replace hand-rolled empty/loading blocks with EmptyState/Card from @leadloom/ui. Keep the sample-data labels. Do not add functionality, do not touch connectors.

## Done means
tsc and next build pass, checker at 0, you looked at settings in dark and light at 1280 and 390, commit hashes reported. Pull --rebase before each push.

## Corrections (binding, supersede the text above)
- Engine roles are only `admin` and `member`. There is no `owner`. Add/delete are admin-only on the SERVER (authorize(..., true)); hiding the controls for members is cosmetic only. Show the server's 403/error honestly via notify.
- No optimistic updates. A save or delete shows pending, and only after the engine returns success you refetch the list. A failed or pending request never shows success or a phantom row.
- Never test with real keys or call any provider. Plaintext is never returned, logged, toasted or kept in state after submit. A saved entry means "Saved", never "connected" or "verified".
- This is a bounded Settings card. No connector catalog, no provider calls.
