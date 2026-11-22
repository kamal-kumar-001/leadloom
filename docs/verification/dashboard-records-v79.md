# v79: truthful workspace setup records

## Corrected claims

The ordinary workspace dashboard previously marked “project & agent token” complete using only project existence. It also represented failed project reads as an empty list and failed/loading summary reads as ordinary incomplete checklist steps.

The checklist now describes saved record types, not readiness. A saved project does not prove an agent token or agent access. Provider keys, mailboxes and tables are optional inputs; their presence does not prove connection, credits, pricing, deliverability or permission to act.

Each source distinguishes loading, unavailable, saved record and confirmed absence. Unknown sources do not receive a completion percentage. Project and summary reads fail independently, so a failed summary cannot erase a successfully confirmed project. Failed or malformed summaries remove counts and the empty-provider-key prompt rather than turning failure into zero. Summary counts must be exact nonnegative safe integers; malformed, coerced, fractional or unsafe counts are rejected. Project lists are checked against the existing response contract.

Manual refresh clears prior state. Generation fencing on identity and record requests prevents older responses from replacing a newer refresh or an unmounted page. No automatic polling, backend mutation or new endpoint was added.

## Current verification

- Ten new model/render cases pass. The complete web suite passes 144 cases across 29 files.
- Engine and web rebuild successfully. Dependencies/lock and migrations are unchanged.
- Actual compiled engine and standalone web run against disposable native PostgreSQL fixtures. One stored project and zero agent tokens produce only a saved-project claim, not token readiness.
- Actual browser checks cover failed project reads, independent valid summary zeroes, failed summary reads, malformed negative counts, loading-state clearing and a delayed earlier response arriving after a fresh successful read. No earlier response restores fabricated positive counts or readiness claims.
- Inspected actual dashboard screenshots for the loaded and unavailable states. Labels remain readable. The failed-summary state removes old counts, the old percentage and the empty-key prompt while preserving the independently confirmed project.
- Browser requests stayed local. Owned dashboard fixture workspaces are removed in cleanup. No tokens were issued by this dashboard proof.
- A fresh native database reaches all 40 migrations. The rebuilt broad application/customer-CLI/browser journey and rebuilt private KeepCue journey pass, including current matching health identities and fail-closed unavailable/mixed-engine checks.

The v78 engine matrix (804 unique passing cases across 147 files, plus one inactive-gate marker), contracts 16/7, database 19/2 and Node 14 are carried, not claimed rerun. Engine implementation is unchanged except generated build identity. Their original logs are included in evidence with their original version names. No full engine rerun was needed for this web-only record-state change.

The first new browser harness run passed the real project/token fixture check, then hit a serialized test-helper naming issue before fault tests. The harness was corrected without changing product behavior or weakening assertions. Its failed log is preserved.

## Delivery and limits

Complete source and cumulative overlay accompany the checkpoint. All source bytes match the clean build tree. Archive bytes/modes and independently extracted build identity are checked. Full per-file manifests cover source outside the build-identity extension policy as well.

This remains private local verification, not Docker/container execution, live OAuth/provider validation or production readiness. The KeepCue scenario remains app-first and draft-only. No lab changes, pushes, deployments, account creation, production migration, spend, external post or outreach occurred.
