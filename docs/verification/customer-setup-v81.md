# v81: correct-target, project-first customer setup

## Reproduced before the correction

With actual compiled v80 engine/web and disposable native PostgreSQL fixtures, the web process had AUTH_URL set to its local deployment, with legacy origin variables empty. This matches the web environment shape in Compose. Both the visible Projects setup and its downloaded bundle instead named the fixed production gateway. No credential was issued during that before check, no CLI request was made to that destination, and outside browser requests were blocked. The before result recorded zero outside requests.

The setup also described eight workflow packs as six autonomous skills, told customers two credentials were required, used any active token as a configuration indicator without checking its scopes, and recommended an unconditional context replacement. A fresh context snapshot's valid 404 was presented as a connection check.

## Correction

- One shared resolver selects the customer endpoint from trusted server configuration. Explicit LEADLOOM_PUBLIC_API_URL takes priority, followed by a configured application origin, AUTH_URL, and legacy NEXTAUTH_URL. Request Host and forwarded headers never choose it. Compose now passes the explicit public endpoint to the web service too.
- Missing or invalid configuration does not select a fixed server. Bundle generation returns an uncached 503 with no download. The Projects server page passes only the resolved destination to its client workbench. Unsafe protocols, credentials, query/fragment components and shell-sensitive values are refused. Application-origin settings must be root origins; use the explicit endpoint for a direct engine or other supported gateway.
- Shell and environment snippets show that same resolved endpoint. Download and copy controls require a selected project and a valid destination. A missing destination is visibly unavailable, not replaced by the current browser Host.
- Project-only work starts with one project-bound credential. The context preset remains context:read plus context:write. Optional project operations need their separately selected scopes. Workspace-wide tools remain optional and wider in scope. Neither existing preset nor a backend authorization rule was widened.
- Credential badges now describe scope records, not configured access. They check binding, matching scopes, expiry and revocation. Loading or failed metadata is unconfirmed; absence is limited to the loaded records. The bounded list is not a complete inventory or live access test.
- The eight packs are described as customer-agent workflow support. The customer's coding agent still reasons and chooses actions. Saved drafts do not authorize publication or sending.
- Setup instructions use revision-guarded context save-file, not unconditional replacement. CLI history brief is the first connection check. Empty history is valid; a never-saved snapshot can correctly return 404. The CLI loads .env.local itself, so the comment-breaking shell/xargs command was removed.
- The downloaded CLI no longer guesses a fixed server when its endpoint is missing. It validates the configured destination before fetch.

## Current verification

- Web: 170 passing cases across 31 files, including 14 added cases. This includes explicit-destination precedence, actual AUTH_URL support, missing/unsafe configuration, spoofed Host refusal, scope metadata checks and generated-CLI no-request guards.
- Current engine and standalone web builds pass. Installed dependencies were reused; no new npm-ci claim.
- Actual compiled native/browser after proof shows both setup and downloaded bundle use the AUTH_URL-only fixture's gateway. The unsafe replacement and six-autonomous-skills wording are absent. Outside browser requests: zero.
- A real downloaded CLI and its actual environment file use one disposable context-read/write project credential, no workspace tool token, through a local-only request guard. Fresh history succeeds; the never-saved snapshot returns the expected 404. Temporary credential-bearing files are removed and the owned workspace fixtures are cleaned up. No raw fixture credential is in the evidence or screenshots.
- Current compiled Projects concurrency controls still pass: stale refresh cannot undo the new selection or its unsaved text; late issuance cannot reveal after a switch or confirmed revocation; normal reveal/hide/revoke controls still work.
- Fresh native bootstrap: 40 migrations, pgvector 0.8.7. Current compiled broad application/customer CLI/browser journey, private KeepCue workflow, dashboard record-state journey and read-only platform overview all pass. Matching source identities and unavailable/mixed-engine health refusal are exercised.
- Actual setup header, eight-pack download, environment block and refreshed credential-scope card screenshots were inspected. The configured local destination, canonical project ID, project-first comments, scope-record label and optional workspace boundary are readable. Environment snippets contain placeholders rather than raw secrets; the credential list shows only its masked prefix.

The engine implementation is unchanged apart from generated identity. The v78 engine matrix, 804 unique passes across 147 files plus one inactive-gate marker, is carried rather than rerun. Contracts 16/7, database 19/2 and Node 14 are also carried with their original evidence. Dependencies, lockfile and migrations are unchanged.

A one-off visual-capture driver initially failed module lookup before starting a runtime. It then passed from the web package's dependency context. That diagnostic is retained; no product change was made for it.

## Limits

This is private source and disposable-runtime verification, not a deployment, production sign-in test, Docker/container verification, provider access test or complete-product/readiness claim. KeepCue's scenario stays private and draft-only, with synthetic discovery inputs and no proved demand. No remote server, repository, account, provider, spending or sending change was made. Existing live-effect gates remain.
