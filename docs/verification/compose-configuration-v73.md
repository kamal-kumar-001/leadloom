# Compose product configuration and source entry guide, v73

22 November 2026. Configuration-source checkpoint, not a deployment.

## Fixed integration gap

The Compose application profile previously omitted existing engine flags for research, validator, DNS diagnostics, local entitlements, team/member controls, mailbox connection controls and the waterfall API mount. It also omitted the separate fetch, connector, worker and sending switches and related runtime settings. Native runtime tests could enable those features, but an operator setting the corresponding variables for ordinary Compose use would have the settings discarded by the application profile.

The profile now passes the supported variables through explicitly. Every feature/effect switch defaults to false. Private counter observation remains default false. The public API URL, worker interval and optional unsubscribe key also reach the engine. Development mail sinks, private-host bypasses and the legacy authentication issuer are intentionally not exposed.

This mounts existing implementations; it does not implement or enable paid waterfall execution, create a provider quote, approve a budget, sign into an account or authorize a send.

## Important deployment compatibility limit

Defaults only apply when a value is absent or empty. Existing environment files may already contain true values that older Compose versions ignored. Those values can begin taking effect after this source correction. Before any separately approved deployment, inspect the resolved configuration and current owner-approved worker/send/provider posture. Keep external fetch, live connector probes and outbound sending explicitly false unless their separate conditions and approvals have been met. No host environment has been read or changed in this checkpoint, and no present host posture is inferred.

## Verification

- A strengthened static checker first rejected the old source for missing the research flag.
- The corrected source passes the existing infrastructure limits, network, profile and security checks, plus exact default-false pass-through assertions for 12 switches and recognized engine variable names.
- Twenty-nine policy cases pass: current valid configuration, each missing switch, each default-on switch, three forbidden development/legacy controls and a web/engine password-policy mismatch.
- Actual freshly compiled engine processes were started with the literal Compose defaults, then with eight private/admin feature overrides. Only the local fixture database, test-only keys and loopback URL/port/binding settings were overridden. The default case kept research/validator/waterfall, entitlement enforcement and growth observation unmounted. The private/admin case mounted the expected routes/enforcement and observation worker. Both cases kept external fetch, live probes, outbound worker and sending off. This is a literal-environment runtime check, not Docker's interpolation or container execution.
- Engine and web build with the unchanged dependencies from v70's clean install. The initial fresh-tree web build hit the command time limit during type checking; its separate retry completed. The earlier source-tree build also completed. No new npm ci is claimed for v73.
- Nine Node release/identity tests and the actual compiled/native cross-feature browser runtime journey pass again on a newly bootstrapped schema40 database. The first attempted browser rerun used an already populated fixture DB and was refused by a fixed owner-email unique constraint; a fresh DB corrected the test setup. No app failure was concealed.

Both compiled services embed source identity 2eb33d9fbc1373a9842dfce7653b586a97b93daf8e7252ca5e16fc6e1ab7d624, covering 762 included files. ZIP manifests independently hash every included source file, including source documentation and Python checks outside that identity's extension/root policy.

## Scope carried forward

Application, contracts, database, worker, customer packs and runtime scripts are byte-identical to v72 apart from generated identity constants. The v72 full matrix applies unchanged: engine790/145 files plus one deliberate skip, web130/27, contracts14/6, database19/2, nine Node tests, fifteen compiled/native browser journeys and six provider configurations, plus schema40 whole synthetic restore/corruption/scoped-route/watch checks. Those full suites are not claimed as newly repeated for this configuration-only change.

The new root README explains the current private workflow, build and runtime prerequisites, configuration/approval boundaries, the existing database baseline caveat and the difference between liveness and business/provider readiness. It points to current evidence rather than treating historical planning text as the feature inventory. Static checks need Python3/PyYAML; full native tests additionally use installed Chrome, PostgreSQL16/vector, openssl and explicitly supplied local mail fixtures. These are not ordinary npm-ci-installed services.

Docker is unavailable here. No Docker config/image/container, host load, production migration/recovery, live OAuth/OTP delivery, paid provider execution or real sending is proved. Source only, not full-product or launch readiness. No lab modification, host/environment mutation, push, deployment, external send or spend occurred.
