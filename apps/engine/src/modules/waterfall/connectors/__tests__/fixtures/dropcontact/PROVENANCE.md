# Dropcontact fixture provenance

SYNTHETIC fixtures, hand-authored from the connector's own implementation.
NOT recorded provider responses; no live Dropcontact call has ever been made
from this repo. The connector stays 'fixture-tested'.

Doc grounding attempt (2026-11-20): docs.dropcontact.dev reference fetch
FAILED (CRAWL_UNKNOWN_ERROR). The two-step flow (POST /v1/enrich/all ->
request_id -> GET /v1/enrich/all/{request_id}), the X-Access-Token header,
the success:false "not ready" signal, and the email qualification values
(nominative / generic) are ALL carried from the connector's implementation,
unverified against current docs.
Confidence numbers are OURS, not Dropcontact's.
