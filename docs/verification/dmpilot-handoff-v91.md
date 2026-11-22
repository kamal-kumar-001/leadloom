# DMPilot posting handoff, v91

Checked 2026-11-23, private disposable-local verification only.

## What changed

Project asset writers can prepare an exact supported DMPilot preview request through `project-posts prepare-file`, and save an exact matching caller-reported preview through `project-posts record-preview-file`. The human project draft editor renders the saved account, media, caption and requested time in a readable panel. It distinguishes saved copy from unsaved editor changes and unverified reported previews from approval/publication.

The existing DMPilot connector owns its account and credentials. Leadloom introduces no provider token store, Meta app, auth flow or publication transport. Supported handoffs are IMAGE, REEL and VIDEO. CAROUSEL is refused because the inspected DMPilot publisher does not implement carousel children/container creation despite accepting that enum in its DTO.

Both routes require the existing explicit project assets-write scope. Project identity comes from the credential. Unknown fields, credentials, override controls, inappropriate media URLs, caption-edge changes and naive timestamps are refused. Stable unchanged request IDs use existing transactional asset receipts. The exact immutable brief and draft versions are retained. A generic asset revision cannot substitute a different or non-preview DMPilot request while retaining the original displayed copy. Such an inconsistent stored handoff is refused.

## Evidence

- Runtime source identity: `30eb1f27accfcddd700c3fdc9753a9488fd3490b9cbbb92fc8579c5cd6284c23`, 877 included files.
- Contracts: 35 tests passed.
- Handoff service: 13 tests passed, including altered stored request/digest, changed preview fields, project isolation and retries.
- Web: 271 tests passed, including the private-route gateway and saved-copy rendering.
- Engine production compilation passed. Standalone clean web TypeScript checking passed.
- Default combined Next build attempts exceeded the command time cap during checking. Root cause is not established. Next's documented `--experimental-build-mode compile` and `generate` stages completed separately with `--no-lint`, after the separate clean typecheck. No production build configuration was changed to bypass checks.
- Actual compiled engine and standalone web server, fresh PostgreSQL16 fixture, downloaded customer CLI and browser UI passed the expanded marketing rehearsal. The test created a new uniquely named database and dropped only that database afterward.
- The actual inspected DMPilot publisher class from canonical main `b4dce1b44d633b0ce08ec37bbc1c22b1578bf3f6` was composed with isolated account/storage/entitlement/framework dependencies. Its forced key-preview behavior stayed preview even with requested `dryRun:false`. Its write and provider dependencies were never called. This is not a running DMPilot API, authentication or real-account test.
- Native checks refused changed copy, foreign-project preview recording, unsupported carousel, publication-as-preview, a tampered external request and publish/approve/schedule/upload/release gateway routes.
- Native rehearsal retained six sourced research paraphrases plus a separately labeled fictional negative control, private campaign copy, exact retries, restart recovery, project isolation, HN human-only text restrictions and token revocation.
- Final fixture effects: zero recipients, sender bindings, mailboxes, outbound jobs, visitors or submissions. The experiment page remained draft.
- Actual saved-handoff pixels were inspected. The separate reported-preview panel was also inspected. Both show the no-approval/no-publication boundary and exact saved words clearly.

## Reproduction

`apps/web/scripts/keepcue-dmpilot-v91.synthetic.mts` requires both synthetic test opt-ins, a caller-supplied private research-input JSON, a local PostgreSQL16 admin connection restricted to an allowed temporary socket, and a read-only DMPilot source checkout at the exact commit above. The harness never uses a real DMPilot key or account. It stages Next standalone static/public assets before starting the local servers. Existing dependencies were used; no fresh dependency installation is certified.

## Not proven or authorized

No live DMPilot API/account eligibility, current key scope/tester status, actual media format/bytes/public reachability, actual KeepCue semantic Ask/DM/native mobile/import functionality, human publication approval, delivery, qualified buyer, contact consent or market demand was verified by this rehearsal. The caller-reported preview is shape/equality checked, not authenticated as provider execution. No real publication, account change, production DB change, product push, deployment, spending or Mac process occurred.
