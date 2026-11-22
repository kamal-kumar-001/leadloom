# Legacy waterfall provider boundary

Checked against official documentation on2026-11-22. These are source-grounded protocol choices, not live account/provider verification.

- Hunter: https://hunter.io/api-documentation . The authentication section supports X-API-KEY instead of putting the secret in the query URL. Email Finder requires domain/company plus a name; this narrower adapter accepts domain and both first/last names. Verification values include valid, accept_all and unknown. Only explicit valid plus a bounded reported score can satisfy the existing verified-match threshold. Missing/unknown verification is not deliverable.
- Apollo: https://docs.apollo.io/reference/people-enrichment . Current endpoint is /api/v1/people/match. The adapter path now matches it. No personal-email/phone reveal flags or webhook calls are added. Existing confidence values remain internal heuristic weights, not a measured match probability or live provider validation.
- Dropcontact submit: https://developer.dropcontact.com/en/reference/enrich-a-batch-of-records/ . Current submission is asynchronous and returns a request ID.
- Dropcontact retrieve: https://developer.dropcontact.com/en/reference/fetch-enrichment-results/ . HTTP200 alone is not completed enrichment. Result readiness and success must be checked.
- Dropcontact fields: https://developer.dropcontact.com/en/reference/enriched-record/ . Address qualification combines local-part and domain classifications. The old equality check against nominative was not a safe delivery-verification test.

Until durable request-ID/result persistence is implemented, the default Dropcontact legacy adapter refuses without submitting any request, even with live networking enabled. Its injected transport path is only an explicit internal fixture seam. It does not provide production asynchronous execution.

Default legacy adapters now share a live-network switch, fixed endpoints, manual redirects, abort timeout,1MiB response bound, safe error strings and strict output checks. An explicit injected fetch is a trusted internal testing seam, never an HTTP request option. No credentials or raw provider payloads are returned in adapter results. The DAG uses a new verification-policy cache namespace, so historical false deliverability assertions are not reused.

Waterfall dispatch remains unavailable. A later internal durable snapshot/result/writeback foundation now exists (see durable-waterfall-foundation.md), but no production worker, provider cost authorization, verified pricing/account credit budget or real provider request/result reconciliation is wired. The registry connectors use a separate shared transport; see connector-registry-boundary.md for its bounds and live Dropcontact refusal. Numeric nominal provider costs remain legacy internal weights, not current prices or actual charges. No merchant/provider request was made during development or verification.
