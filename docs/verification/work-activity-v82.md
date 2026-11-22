# v82: project work history and stored campaign attention

## Reproduced on compiled v81

Actual compiled engine/web with disposable native PostgreSQL records showed two disconnected activity surfaces:

- A real project progress entry was readable through the current project-history API, but Runs still read a separate legacy local registry and promised current research, landing drafts and agent runs would appear there.
- With real stored job counts of one awaiting approval, one uncertain and one rejected, the notification bell reported All caught up and no active job failures. An unavailable legacy read also produced the same healthy claim. Its footer described live BullMQ telemetry, although that was not its source.

These were private fixture checks, not observations of a live user account. No provider action or outside browser request was made.

## Correction

### Project work history

The existing /app/runs route now reads the current authenticated project list and work-record entry APIs. Navigation names it Work history. A project must be selected explicitly; none is guessed or selected automatically.

Search and kind filters return ten short summaries per page, with at most 360-character excerpts. Full detail is fetched only after opening an entry. Response validation checks the expected project, exact detail ID, bounded fields, valid timestamps and nonoverlapping pages. Current request generations fence old project, filter, detail and unmounted callbacks. Reads have bounded waits. Failed or malformed reads clear prior data and are unavailable, not confirmed empty history.

This is a reader for entries explicitly saved to a project's work record. It is not an automatic log of every action. Draft assets, research tables and campaign jobs have their own views and are not included. A recorded blocker or next step does not prove its current state or authorize action. History remains append-only through the existing Projects editor.

Legacy per-email local registry files and their compatibility API are unchanged. They are not imported, deleted or silently reclassified as workspace/project history. No security exposure or cross-workspace migration is being claimed.

### Campaign attention

The bell now reads stored campaign job-state aggregates through the existing authenticated workspace API. It covers up to the 100 newest campaign records and says that boundary explicitly:

- Awaiting message review means stored pending-approval records, not permission to release or send.
- Provider outcome uncertain warns that an attempt may have reached a provider and should be reconciled before deciding whether to retry.
- Cancelled or rejected describes those stored terminal records, not a live queue-health or delivery result.

Only names, IDs, labeled counts and their notes enter notification state. Campaign copy and unused fields are not retained in that projection. Missing, malformed, failed and timed-out reads are unavailable, never All caught up. An empty result covers only the stated categories in the bounded loaded campaigns, not all work or older campaigns.

Reads happen on open or manual refresh, not polling. Hiding flags is local to the visit, not a persisted read receipt or resolved job. Refresh/reopen restores current stored flags. Closing invalidates and aborts the old request; an already-completed old read cannot replace a newer result after reopening.

No backend authorization rule, credential preset, human role or agent scope was changed. No queue, dispatch or customer-agent control was added.

## Verification

- Twelve new normalizer/contract cases pass. Complete web suite: 182 passing cases across 32 files.
- Current engine and standalone web builds pass. Existing installed dependencies were reused; this is not a new installation claim.
- Actual compiled/native/browser history proof reads 27 Alpha records in pages of 10, 10 and 7. Beta and foreign-workspace entries are excluded. Summaries omit the full-body marker; opening detail fetches it. Explicit selection, search and kind filters work. Late Alpha data cannot replace Beta, and old detail cannot return after a filter change.
- Failed and wrong-project history responses remove old rows/detail and do not claim no matching records. Failed project-list refresh removes the selected history and does not invent an empty workspace.
- The bell displays exact native stored counts of one pending approval, one uncertain and one rejected record. Hide/refresh behavior works. Failed and malformed campaign reads remain unavailable. A completed old count-one response is held while the fixture gains another pending-approval row; after close/reopen, the current count two remains even when the old read finishes.
- The activity driver observes zero browser engine mutations and zero outside browser requests. The four final job rows are explicit test-fixture inserts, not sends or work created by the UI. Owned workspaces and fixtures are removed during cleanup.
- Current compiled broad application/customer CLI/browser journey, private KeepCue journey, dashboard records, read-only operator overview, Projects credential concurrency and configured customer setup all pass. Fresh native bootstrap reaches 40 migrations with pgvector 0.8.7. Matching source identities and fail-closed unavailable/mixed-engine health cases pass.
- Actual current project history, history-unavailable, attention-record and attention-unavailable pixels were inspected. Source boundaries, counts, controls and error states are readable; old records are absent in unavailable states.

The unchanged engine implementation's v78 matrix is carried, not rerun: 804 unique passes across 147 files plus one inactive-gate marker. Contracts 16/7, database 19/2 and Node 14 are also carried with original evidence. Engine changes are limited to generated identity. Dependencies, lockfile and migrations are unchanged.

The first activity-driver assembly selected the wrong cleanup block and failed to parse before starting a runtime. Only the driver was corrected; that initial diagnostic is retained.

## Limits

This is private source and disposable-runtime verification. It is not a deployment, production sign-in or provider test, live queue monitor, delivery confirmation or complete-product/readiness claim. KeepCue remains a private draft-only workflow with synthetic discovery inputs and no proved demand. No remote server, repository, account, provider, spending or sending change was made. Existing live-effect gates remain.
