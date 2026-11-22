# v80: project and credential response races

## Reproduced before the correction

Actual compiled v79 engine/web with disposable native PostgreSQL fixtures showed:

- An older project refresh restored Alpha after Beta had been successfully created and selected. This could unmount the new project's editor.
- An Alpha credential's delayed creation response restored its raw one-time reveal after the user had switched to Beta.
- A credential was created, its metadata was read, and the user explicitly revoked it before the earlier creation response arrived. That response restored a raw reveal and duplicate/inconsistent metadata even though the native database confirmed revocation.

These are separate owned fixture instances, not observations of a production account. Before logs and token-free JSON are retained. No raw credential was written to logs, screenshots, source archives or the JSON evidence.

## Correction

The Projects page now fences data reads and one-time credential reveals separately. Successful local create/issue/revoke callbacks invalidate earlier reads. Successful reads reconcile the current selection through a state update, not the selection captured before the request. An earlier success, error or completion cannot overwrite later work. Page exit invalidates pending callbacks.

An issuance callback retains its selection ticket. Changing project, including A to B to A, prevents a late raw secret from reappearing. The successful backend operation is not pretended canceled: sanitized saved metadata is merged and an explicit notice plus immediate notification says the secret was hidden and whether the credential may still need revocation. No mutation is automatically retried or revoked.

Known revocations remain monotonic within the page. A delayed issuance cannot undo an observed revocation, duplicate its metadata row or reveal its secret. Snapshot/issuance metadata is allow-listed through existing contracts; raw credentials and unexpected fields never enter list state. Malformed snapshots do not replace the prior records. Failed refreshes label those prior records as unconfirmed while retaining editors.

A missing project display name no longer labels a bound credential workspace-wide; its actual project ID is shown instead. No scope preset, backend authorization rule, expiry policy or permission was widened.

## Verification

- Twelve new request/selection/metadata cases pass. The complete current web suite passes 156 cases across 30 files.
- Current engine and web builds pass. Existing installed dependencies were reused, not a fresh-install claim.
- Actual compiled native/browser proof now keeps the newly created Beta selected after the older response and preserves its unsaved work-record text. This is same-page editor retention, not new autosave or persistence after exit.
- Delayed creation after project switch produces no raw reveal or raw secret in page text, but does show a clear created/hidden notice.
- Delayed creation after confirmed native revocation produces no reveal, one metadata row and preserved revoked status.
- Positive control: normal issuance under the unchanged selection still reveals correctly, its context-history request succeeds with 200, no raw secret enters local/session storage, explicit hide removes it from page text, and explicit revoke makes the same native request return 401.
- The final owned fixture has exactly three credentials and two explicit revocations, with zero campaigns/jobs and zero external browser requests. Cleanup removes the owned workspaces and their fixtures. This is not creation or revocation on a live user account.
- Inspected actual Beta editor, selection-change notice and revoked-result notice screenshots. Notices are readable and contain no raw token.
- Fresh native bootstrap reaches 40 migrations. Current compiled broad application/customer-CLI/browser, private KeepCue, dashboard record-state and read-only platform-overview journeys pass, including matching health identities and fail-closed unavailable/mixed-engine cases.

The unchanged engine implementation's v78 matrix, 804 unique passes across 147 files plus one inactive-gate marker, is carried rather than claimed rerun. Contracts 16/7, database 19/2 and Node 14 are also carried with original logs. Engine implementation changed only in generated build identity. Dependencies, lockfile and migrations are unchanged from v79.

Two harness assertions were corrected and their failed logs preserved: a partial row match could overlook duplicate active/revoked rows, so the check now requires exactly one revoked row; a never-saved context snapshot correctly returned 404, so token authorization is checked through the supported empty context-history list instead. Neither correction changed product behavior or weakened the verified invariant. An unrelated timestamp hypothesis was ruled out by the existing millisecond-precision column, and no speculative source change was retained.

## Delivery and limits

Complete source, cumulative overlay and evidence accompany this checkpoint. Source bytes match the clean build tree; source archive bytes/modes and independently extracted identity are checked. Per-file manifests cover the entire packaged source set, including files outside the narrower build-identity extension policy.

No lab changes, push, deploy, real account mutation, production migration, paid action, external post, provider send or outreach occurred. KeepCue remains app-first and private, with draft-only posts/outreach. This is not Docker execution, live OAuth/provider certification, full product completion or production readiness.
