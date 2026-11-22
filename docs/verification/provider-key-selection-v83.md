# v83: current provider-key selection and honest metadata

## What changed

The customer coding agent still reasons and calls Leadloom. This checkpoint repairs the connector hub's account-key metadata; it does not enable a provider or make a connection call.

An actual compiled v82 reproduction with two encrypted fake OpenAI keys found three inconsistent selectors. Execution selected the newest-created unverified key. The registry selected an older verified key because its update time was newer. The hub overwrote newest-first rows and displayed that older key as Connected. A failed metadata read also made the same nonempty vault look unconfigured.

The native repository's selected-key and list queries now use the same createdAt DESC, id DESC order. The registry uses that native order and preserves its first row per provider, rather than re-ranking by update time. Envelope maintenance or testing an older key does not select it. The hub validates the masked response and preserves the authoritative server order. It does not sort serialized timestamps, which can lose native sub-millisecond precision.

Failed, malformed, sample, missing and timed-out metadata reads are unavailable, not an empty vault. Old masked records are removed while reading and on failure. Changes are disabled until current metadata is available; manual reload is provided. Late request/unmount callbacks are fenced. Successful saves refetch current server metadata instead of assuming the returned stored row is selected. The header counts providers with stored keys, not key records or successful connections.

A stored successful test requires a valid flag and test timestamp. The card says Last test passed, includes that timestamp and says it is not a live connection check. The registry's verified flag is also a stored record, not live provider health. No new test button, provider call or background polling was enabled.

## Current verification

- Full engine matrix: 806 passing cases across 148 files, with native PostgreSQL integration gates enabled. Local SMTP/IMAP fixture gates were enabled in the shards that contain those tests. One existing inactive-gate marker is skipped. This is a current rerun, not the carried v78 matrix.
- Full web suite: 188 passing cases across 33 files. Six new response-selection cases pass. Backend additions cover native query-order equivalence and refusal to call a flag without a test timestamp verified.
- Engine and standalone web builds pass. Existing installed dependencies were reused, not newly installed. Dependencies, lockfile and migrations are unchanged.
- Actual final compiled native PostgreSQL/API/browser proof matches selected-key, list, registry and hub for two conflicting key fixtures. A later-updated verified older row cannot replace the current unverified key.
- A native sub-millisecond difference produces identical serialized timestamps but keeps the correct lower-ID, newer-native-time row. Exact native timestamp ties consistently use descending native ID order.
- Failed and malformed vault reads clear old keys, say unavailable and disable changes. Manual reload restores current metadata.
- One browser save creates an encrypted fake-key fixture while another fixture has a deliberately later creation timestamp. The hub refetches and keeps the authoritative selected record rather than blindly promoting the response from save.
- Historical successful-test display and unavailable card pixels were inspected. The complete card, masked key, timestamp, warning and disabled action are readable.
- Provider-key driver: zero provider/outside requests, one explicit browser fixture save, zero other browser engine mutations. Fake-key fixture workspaces are removed during cleanup.
- Fresh native bootstrap reaches 40 migrations with pgvector 0.8.7. Current compiled broad application/customer CLI/browser, private KeepCue, stored dashboard records, read-only operator overview, Projects credential concurrency, configured customer setup and work-history/campaign-attention journeys all pass. Matching compiled identities and unavailable/mixed-engine health cases pass.

Contracts 16/7, database 19/2 and Node operational suite 14 are carried from v78, not rerun here. No contract, migration, dependency or operational script implementation changed.

## Limits

This is private source and disposable-runtime verification, not a deployment, production sign-in, provider test, account verification, complete-product or readiness claim. The historical test flags and future/tied timestamps in the key driver are explicit fixture writes, not actual test-connection results. KeepCue remains private and draft-only with synthetic discovery inputs and no proved demand. No remote server, repository, account, provider, spending or sending change was made. Existing live-effect gates remain.
