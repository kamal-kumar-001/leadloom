# Leadloom v86: exact workflow save confirmations

Private source checkpoint, November 22, 2026. This is not a deployment, launch or complete-product readiness claim.

## Corrected workflow

Growth-review history, structured discovery profiles and private discovery replies now confirm a save against the exact project, kind and submitted words. Profile revisions also require the exact asset and expected next version. New profiles/replies require a first-version receipt. The existing strict workbench readers are reused rather than creating another receipt format.

Previously, these three browser paths accepted any nonempty response as Saved. The actual compiled native-PostgreSQL/proxy/browser reproduction committed each correct owned fixture write, changed only its returned project ID, and observed all three paths claim success. This was an acknowledgement-validation defect, not demonstrated cross-project server access.

After the fix, all three reject the unconfirmed receipt, retain the editor and stable request, and allow an unchanged retry. Native storage proves one growth entry, one profile and one reply, with one version per asset after retries. The reviewed text is not locked merely because an invalid response arrived. A 15-second acknowledgement bound is not cancellation of work that may already have committed.

Discovery's profile list and exact detail reads also validate the returned project/ID/version/kind and bounded page shape. Malformed lists become unavailable without clearing the profile editor. Overlapping offset pages after a concurrent revision are refused; reloading returned all 12 unique fixture profiles. Loading a returned detail for the wrong project leaves the existing editor/target unchanged. Local profile edits clear the previous saved notice. List errors and editor/save errors are separate.

## Verification

- Current web suite: 205 passing tests across 34 files, including three additional exact workflow-receipt cases. The existing timeout, pagination, identity and revision reader tests also pass.
- Current engine and web builds pass, with matching embedded source identity. Engine implementation is unchanged except its generated build identity.
- Fresh PostgreSQL 16 bootstrap applies all 40 migrations, pgvector 0.8.7.
- Current compiled broad application/customer-CLI/browser workflow, private KeepCue app-first draft workflow, dashboard, operator, Projects credential concurrency, configured setup, history/attention, provider-key selection, workbench races and observed scorecard counters pass again.
- The new native/proxy/browser driver proves all three committed invalid acknowledgements are refused and unchanged retries do not duplicate records. It also proves exact-detail refusal, changing-page refusal, 12 unique profiles after reload and malformed-list unavailability. Zero outside browser requests. Owned scenario fixtures are removed.
- Carried from the complete v85 checkpoint, not rerun here: engine 810 passing tests across 149 files plus one inactive-gate marker; contracts 18/8; database 19/2; Node operational tests 14. No relevant engine/contract/database/operational implementation changed.

The evidence archive includes before/after reports and current native logs. Actual browser pixels for the retained growth-review and private-reply editors were inspected: the submitted text, retry controls and unconfirmed warning are readable, without a false Saved claim.

## Limits and unchanged boundaries

Changing pages are not frozen snapshots. The user must reload after a detected overlap. No autosave was added: unsaved words and request IDs can still be lost on page reload, project switch or exit. A timeout or malformed acknowledgement does not prove that server work was cancelled; retry unchanged or inspect saved records before deliberately creating new work.

Source-only changes. Existing dependencies were reused, not freshly installed. No migration, dependency, lockfile, authentication preset or permission changed. No lab/live-host change, push, deploy, account creation, provider call, spend or external send. Private reply drafts remain unapproved and unsent. Saved research and heuristic scores do not establish demand, consent, revenue or readiness. KeepCue's separate launch-plan owner is unchanged.
