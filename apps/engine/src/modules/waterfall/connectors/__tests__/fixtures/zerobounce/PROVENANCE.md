# ZeroBounce fixture provenance

SYNTHETIC fixtures, hand-authored from ZeroBounce's public docs. NOT recorded
provider responses; no live ZeroBounce call has ever been made from this
repo. The connector stays 'fixture-tested'.

Grounding (fetched 2026-11-20):
- Status enum (valid / invalid / catch-all / spamtrap / abuse / do_not_mail /
  unknown) and sub-status structure: ZeroBounce "Status Code (v2)" doc page
  (https://www.zerobounce.net/docs/email-validation-api-quickstart/v2-status-codes).
  The docs overview page itself failed to fetch (CRAWL_UNKNOWN_ERROR); the
  status-codes page was reached via search and read directly.
- Endpoint /v2/validate with api_key + email query params and the
  mx_found / free_email / did_you_mean / account / domain fields: carried
  from the connector's implementation; the exact response field set was NOT
  fully re-verified in the 2026-11-20 fetch - marked unverified.
- Confidence numbers in the connector's mapping are OURS, not ZeroBounce's.
