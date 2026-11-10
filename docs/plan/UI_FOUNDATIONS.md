# UI Foundations Audit & Roadmap (`apps/web`)

Audited against real source files in `apps/web`, WAI-ARIA Authoring Practices, and Sonner documentation.
This document lists real gaps identified in the codebase, concrete fixes, status (`todo` / `done` / `not needed`), and owning team.

---

## 1. Route-Level Error Boundaries & Not-Found

| Scope / Gap | Location (File / Route) | Concrete Fix | Status | Owner |
| :--- | :--- | :--- | :--- | :--- |
| **Root Error Boundary**<br>Missing root `error.tsx`. Uncaught client runtime errors in root layout crash into Next.js unstyled error overlay. | `apps/web/app/error.tsx` | Implement Next.js App Router root client error boundary using `@leadloom/ui` `Card`/`EmptyState`, sanitized error messages (no stack traces or engine internals), and a "Try again" action calling `reset()`. | `todo` | Team Beta |
| **Root 404 Not Found**<br>Missing custom `not-found.tsx`. Non-existent paths render Next.js default monochrome unstyled page. | `apps/web/app/not-found.tsx` | Create custom 404 page styled with design tokens (`--bg-canvas`, `--text-primary`), `@leadloom/ui` `Card`, clear navigation back to `/app` or `/login`. | `todo` | Team Beta |
| **Workspace Error Boundary**<br>Missing `/app` boundary. Runtime crashes inside any app tab crash the entire shell layout. | `apps/web/app/app/error.tsx` | Add workspace error boundary rendering within `AppLayout` frame with clear error description, retry button calling `reset()`, and return-to-dashboard link. | `todo` | Team Beta |

---

## 2. Route Loading States & Skeletons

| Scope / Gap | Location (File / Route) | Concrete Fix | Status | Owner |
| :--- | :--- | :--- | :--- | :--- |
| **Workspace Route Loading**<br>Missing `app/loading.tsx`. Tab switches and suspense transitions in `/app/*` lack a standardized tokenized skeleton. | `apps/web/app/app/loading.tsx` | Create route loading skeleton using `@leadloom/ui` tokens with pulse-animated placeholder cards matching grid/overview layouts. | `todo` | Team Beta |
| **In-page Async Loading**<br>Connectors and engine identity have custom loading states (`isLoading`, `checking`). | `apps/web/app/app/connectors/page.tsx`<br>`apps/web/app/app/layout.tsx` | Already renders inline loading states and messages while fetching engine credentials/identity. | `done` | Team Beta / Gamma |

---

## 3. Toast Notifications & Live Regions (Sonner)

| Scope / Gap | Location (File / Route) | Concrete Fix | Status | Owner |
| :--- | :--- | :--- | :--- | :--- |
| **Toaster Styling & Mobile Positioning**<br>`<Toaster>` in root layout references non-standard variables (`--bg-elevated`, `--border-muted`) and `top-right` positioning obstructs primary actions on mobile viewports. | `apps/web/app/layout.tsx` | Update `<Toaster>` options: style exclusively with `--bg-canvas-elevated`, `--border-subtle`, `--text-primary`, `--accent-loom`, set `position="top-right"` on desktop with mobile responsiveness, configure `role="region"` and accessible label. | `todo` | Team Beta |
| **Safe `notify` Abstraction Layer**<br>Components call `toast.*` directly from `sonner`, causing raw error leaks (e.g. unhandled `EngineClientError` strings, HTTP statuses), duplicate rapid-click toasts, and transient errors that vanish before users can act. | `apps/web/lib/notify.ts` | Create centralized `notify` wrapper exporting `success`, `info`, `warning`, `error` with: (1) content-hash stable IDs to deduplicate identical messages, (2) safe error message mapper translating HTTP status codes and engine errors into concise plain English, (3) persistent duration for errors requiring user action or containing a `retry` button. | `todo` | Team Beta |
| **Direct Toast Migration & Sample Honesty**<br>Direct `toast.*` calls across 11 files without message deduplication or error sanitization. Some simulated actions claim live verification without a sample disclaimer. | `apps/web/components/mailboxes/dns-inspector-modal.tsx`<br>`apps/web/components/sequencer/loom-view-drawer.tsx`<br>`apps/web/components/validation/new-experiment-modal.tsx`<br>`apps/web/components/connectors/connector-card.tsx`<br>`apps/web/components/connectors/byok-vault-modal.tsx`<br>`apps/web/components/grid/pre-flight-bar.tsx`<br>`apps/web/components/grid/add-waterfall-modal.tsx`<br>`apps/web/components/grid/csv-importer-modal.tsx`<br>`apps/web/app/v/[slug]/page.tsx`<br>`apps/web/app/app/mailboxes/page.tsx`<br>`apps/web/app/app/campaigns/page.tsx` | Mechanically migrate all `toast.*` calls to `notify.*`. For simulated actions on fixture/demo pages (e.g., DNS health check simulation, sequencer dispatch demo), explicitly prefix notices with `[Sample]` or `(simulated)` so no mock work is misrepresented as live. Remove unused `toast` imports from `connectors/page.tsx` and `validator/page.tsx`. | `todo` | Team Beta |

---

## 4. Form Accessibility & Inline Errors (`FormField`)

| Scope / Gap | Location (File / Route) | Concrete Fix | Status | Owner |
| :--- | :--- | :--- | :--- | :--- |
| **Shared Accessible FormField**<br>No shared form field primitive. Input labels, hints, and error messages lack programmatic `id`, `aria-describedby`, and `aria-invalid` associations. | `apps/web/components/feedback/form-field.tsx` | Create reusable `FormField` component that renders accessible `<label>`, helper text (`hint`), and inline `<p role="alert">` error text with automatic `aria-describedby` and `aria-invalid` bindings on child inputs. | `todo` | Team Beta |
| **Auth Forms Field-Level Error Wiring**<br>Auth pages (`login`, `signup`, `forgot-password`, `verify-email`) render validation errors only in high-level top banners (`AuthAlert`), without inline field-level errors or focus redirection to the first invalid field. | `apps/web/app/login/page.tsx`<br>`apps/web/app/signup/page.tsx`<br>`apps/web/app/forgot-password/page.tsx`<br>`apps/web/app/verify-email/page.tsx` | Integrate `FormField` into auth pages for email, password, and verification code inputs. Keep auth logic, callbacks, and server submission untouched; wire field-specific error states inline with `aria-describedby` while reserving top alerts for general server responses. | `todo` | Team Beta |

---

## 5. Destructive Action Confirmation (`ConfirmDialog`)

| Scope / Gap | Location (File / Route) | Concrete Fix | Status | Owner |
| :--- | :--- | :--- | :--- | :--- |
| **Accessible Destructive Confirm Dialog**<br>No shared confirmation modal exists for irreversible actions (e.g., deleting a waterfall column, removing a BYOK vault key, clearing imported leads). | `apps/web/components/feedback/confirm-dialog.tsx` | Build `ConfirmDialog` meeting WAI-ARIA Modal Dialog requirements: `role="alertdialog"`, `aria-modal="true"`, focus trap within modal, Escape key cancellation, returning focus to trigger element on dismiss, and distinctive token-styled destructive action button (`bg-signal-failed`). | `todo` | Team Beta |

---

## 6. Offline Detection & Notice (`OfflineBanner`)

| Scope / Gap | Location (File / Route) | Concrete Fix | Status | Owner |
| :--- | :--- | :--- | :--- | :--- |
| **Network Disconnect Visibility**<br>No visual indicator appears when client loses network connection; subsequent API requests fail with abrupt generic errors. | `apps/web/components/feedback/offline-banner.tsx`<br>`apps/web/app/app/layout.tsx` | Create `OfflineBanner` component monitoring `navigator.onLine` and `window.addEventListener('online'/'offline')`. Mount via a single line inside `AppLayout`. Displays a non-intrusive banner styled with `--signal-warning` tokens notifying users of offline status until connection recovers. | `todo` | Team Beta |

---

## 7. Pending Submissions & Double-Submit Protection

| Scope / Gap | Location (File / Route) | Concrete Fix | Status | Owner |
| :--- | :--- | :--- | :--- | :--- |
| **Auth Forms Submission State**<br>Users double-clicking submit button during authentication requests. | `apps/web/app/login/page.tsx`<br>`apps/web/app/signup/page.tsx`<br>`apps/web/app/forgot-password/page.tsx`<br>`apps/web/app/verify-email/page.tsx` | Verified: All 4 forms maintain `isSubmitting` boolean state that immediately disables submit button and inputs during in-flight network requests. | `done` | Team Beta |
| **Modal Async Submissions**<br>Vault credential saving. | `apps/web/components/connectors/byok-vault-modal.tsx` | Verified: `saving` state disables submit button and shows loading state during asynchronous vault encryption. | `done` | Team Beta |

---

## 8. Modal Keyboard & Focus Handling

| Scope / Gap | Location (File / Route) | Concrete Fix | Status | Owner |
| :--- | :--- | :--- | :--- | :--- |
| **Modal Escape & Dialog Roles**<br>Existing modal dialogs (`ByokVaultModal`, `DnsInspectorModal`, `AddWaterfallModal`, `CsvImporterModal`, `NewExperimentModal`) lack `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and Escape key dismiss listeners. | `apps/web/components/connectors/byok-vault-modal.tsx`<br>`apps/web/components/mailboxes/dns-inspector-modal.tsx`<br>`apps/web/components/grid/add-waterfall-modal.tsx`<br>`apps/web/components/grid/csv-importer-modal.tsx`<br>`apps/web/components/validation/new-experiment-modal.tsx` | Ensure modals specify `role="dialog"` and `aria-modal="true"`. Add Escape key listener to close modals gracefully and return focus. `ConfirmDialog` implements the full reference focus trap. | `todo` | Team Beta |

---

## 9. Reduced Motion

| Scope / Gap | Location (File / Route) | Concrete Fix | Status | Owner |
| :--- | :--- | :--- | :--- | :--- |
| **Motion Accessibility**<br>CSS keyframes (`animate-fade-in`, pulse animations) should respect user preference for reduced motion. | `apps/web/app/globals.css` | Verified: `@media (prefers-reduced-motion: reduce)` in CSS can disable keyframe animations or reduce transition duration to 0s across all modal overlays and toasts. | `done` | Team Alpha / Beta |

---

## 10. Page Titles and Metadata

| Scope / Gap | Location (File / Route) | Concrete Fix | Status | Owner |
| :--- | :--- | :--- | :--- | :--- |
| **Application Titles**<br>Root layout provides standard title and description. Dynamic routes (`/v/[slug]`) provide experiment titles. | `apps/web/app/layout.tsx`<br>`apps/web/app/v/[slug]/page.tsx` | Root layout metadata defines product branding; sub-routes inherit or provide route-specific title metadata. | `done` | Team Alpha / Gamma |

---

## 11. Empty States

| Scope / Gap | Location (File / Route) | Concrete Fix | Status | Owner |
| :--- | :--- | :--- | :--- | :--- |
| **Honest Empty State Usage**<br>Pages with 0 records or no data should avoid inventing filler rows. | `apps/web/components/settings/team-settings-card.tsx`<br>`apps/web/app/app/tables/page.tsx` | Uses `@leadloom/ui` `EmptyState` component with honest explanations (e.g. "Inviting teammates is not available yet"). | `done` | Team Beta |
