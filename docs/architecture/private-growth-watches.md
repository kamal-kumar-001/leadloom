# Private growth aggregate watches

Source implementation, not an operator instruction to enable a live service.

Migration40 (`20261218_project_growth_watches`) is additive and required by schema preflight. It creates no watch and starts no worker. `LEADLOOM_GROWTH_WATCHES_ENABLED` defaults to false, including the Compose application profile. With a database-backed engine, history/list/pause routes remain mounted; starting/resuming requires the local observation worker to be mounted by that flag. Turning it off does not remove saved configuration or history. Configured active watches will not run while it is off.

Human-only engine routes:

- `GET /projects/:projectId/growth-watches`: at most20 exact-project configurations and current process worker availability.
- `POST /projects/:projectId/growth-watches`: strict `{requestId,experimentId,intervalMinutes}`. Current writer, owned project/experiment and local worker required. Saves baseline and watch in one repeatable-read transaction. The request UUID becomes the watch ID. One watch per experiment and at most20 per project.
- `PATCH /projects/:projectId/growth-watches/:id`: strict `{expectedRevision,state,intervalMinutes?}`, active/paused only. A current writer can pause without a mounted worker. Resume validates the owned source and records the current writer as authorizer. A stale configuration revision is refused. A later interval change does not change the immutable original creation receipt.

All routes reject agent-token substitution, query overrides and caller-chosen actor/workspace. No new bearer-gateway route or token scope exists. Existing work-record readers can retrieve explicitly created research entries under existing project restrictions.

A watch is an interval, not a clock-time appointment or notification. Bounds are60..10080 minutes. The local loop checks once per minute, at most20 due configurations per pass, and drains an in-flight operation at shutdown. There is no model, network, provider, mailbox or publisher dependency. Checks after downtime observe the present stored counters, never invent missed history. The process being mounted is not a promise of punctual execution or persistent availability.

Each observation rechecks active workspace and current admin/member authorizer. Parent workspace/user/project/experiment locks precede watch mutation, to fence role loss and avoid child-before-parent deletion locks. Retryable transaction serialization/uniqueness races are bounded. The stored aggregate service can read inside the same repeatable-read transaction as its append. Append plus digest/next-due bookkeeping commit together; a failed transaction leaves no partial history. Unchanged aggregate counts only advance bookkeeping. Decreases are recorded without a causal inference. Access loss or invalid source counts blocks future observations until deliberate resume. No principal or source is silently replaced.

The research entry is a historical receipt with exact experiment/project/asOf, aggregate counts, ratios, provenance and limits. It excludes contacts, per-page breakdown, hypothesis text and generated conclusions. Raw page loads are not unique people, stored submissions are not paying customers/consent, and outreach/replies remain owner-recorded replacement totals, not delivery evidence. No visitor/lead/campaign/outbound job or external action is created by an observation.

The browser keeps an unconfirmed creation request immutable for exact retry. Changing the selected experiment cannot retarget it. Clearing that local retry does not cancel a possibly committed watch. List failures remove stale actionable configurations; project changes fence late responses. An invalid unsaved interval cannot prevent a pause, which uses the saved interval. Historical detail is rendered as inert text and labeled historical.

Verification uses disposable native PostgreSQL and compiled local processes with synthetic data. Such proof does not establish production deployment, operator enablement, account/provider readiness or current live customer demand.
