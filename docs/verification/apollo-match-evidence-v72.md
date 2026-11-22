# Apollo identity evidence, candidate v72

Checked 22 November 2026 against the official Apollo people-enrichment reference, tutorial and authentication documentation.

## Concrete mismatch

The reference distinguishes the confidence that a person was matched from the deliverability of that person's email. Its embedded OpenAPI response example puts `match_confidence` on `person`. The older tutorial's sample omits that field. The previous Leadloom adapter and connector assigned a local confidence score of 0.95 whenever `email_status` was `verified`, even if the person match was weak or unknown. That could let an address for the wrong person satisfy the waterfall exit rule.

## Changed behavior

- The shared parser keeps `person.match_confidence` separate from email deliverability. Only a known `high` identity match plus a `verified` email reaches the existing acceptance threshold. Medium, low, none, missing, malformed and future confidence values cannot become accepted matches.
- The numeric confidence remains a local acceptance-policy score, not an Apollo probability, price, promise or measured accuracy. Missing identity evidence scores zero. The connector exposes the categorical `matchConfidence` separately.
- Existing tutorial fixtures are not silently upgraded to contain evidence they never had. Their identity confidence is now unknown, and their score is zero.
- Both lookup paths require bounded person identifiers before making a request. The adapter needs person names and a valid employer domain. The connector supports an email address or first and last names plus an employer. Unused identifier fields cannot satisfy validation for an input that the selected path does not transmit.
- Both request bodies explicitly disable personal-email reveal, phone reveal and Apollo's asynchronous email/phone waterfall options. This does not make a basic lookup free or approve it.
- Malformed person/email payloads fail rather than looking like completed no-match results. Valid null-person results remain valid no-match responses. Raw connector metadata contains no email, name or credential.
- A new cache namespace prevents old deliverability-only cache entries from bypassing the new identity policy. Current-policy high-confidence cache reuse still works.

Paid waterfall dispatch, provider pricing, budget/authority reservation and external result reconciliation are not enabled by this change. No live Apollo request was made. Existing network and human-access gates remain in place.

## Evidence

The new regression file first reproduced five failures against the old implementation. The initial six tests included one already-passing deliverability constraint. Eight focused regression tests now cover the new behavior, including old-cache refusal and current-cache reuse. They use local synthetic response transports only. The existing tutorial/privacy tests now explicitly retain unknown identity evidence instead of asserting a confidence invented from email verification.

## Official sources

- https://docs.apollo.io/reference/people-enrichment supports the meaning of high/medium/low/none, the person-level field in its embedded example, request opt-in defaults, and the warning that basic and waterfall requests may consume credits. Published credit rules are not an account-specific quote.
- https://docs.apollo.io/docs/enrich-people-data supports the email/name-and-employer lookup shapes, JSON request bodies and header authentication. Its visible sample omits the newer identity-confidence field, so it is not evidence of a high-confidence match.
- https://docs.apollo.io/reference/authentication supports the API-key header and distinguishes workspace-key authentication from per-person OAuth. No ownership-changing API operation is introduced here.

The public documentation was read; no provider account, API key, customer record or live enrichment result was accessed.

## Consolidated verification

Candidate production components built with the unchanged dependencies from v70's standard clean install. The first whole build command reached web type checking but hit the execution time limit; no failure was hidden. Contracts, database, engine and scraper had completed. The web build was then rerun separately and completed, including type checking and standalone output. Both generated identities match b2a347c1533cd1f2ade8b6b2957901be92a44952c657d4a3f87a2b822eb035e9, covering 762 files.

Final native regression: engine 790 tests in 145 files plus the existing deliberate skip, web 130/27, contracts 14/6, database 19/2, Node release/identity nine. All 15 compiled/native browser journeys and six provider configurations pass against a new schema40 database. Whole synthetic schema40 restore/corruption/scoped-read/watch proof also passes again. Native mail explicitly uses separately installed local smtp-server3.21.7/hoodiecrow-imap3.3.1 fixtures; Chrome, PostgreSQL16/vector and openssl are system prerequisites. No new clean npm installation is claimed for v72; manifests and lock remain unchanged from v70.

Fresh screenshots of the existing watch and frozen-review views were inspected for readable controls and historical receipts. There is no UI change in this provider-boundary fix. Container, deployment, live provider/auth/mail and production recovery remain unproved. Source only, not a full-product or launch-readiness claim.
