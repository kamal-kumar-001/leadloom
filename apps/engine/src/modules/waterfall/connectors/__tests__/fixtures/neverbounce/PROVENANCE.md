# NeverBounce fixture provenance

SYNTHETIC fixtures, hand-authored from NeverBounce's public API docs. NOT
recorded provider responses; no live NeverBounce call has ever been made
from this repo. The connector stays 'fixture-tested'.

Grounding (fetched 2026-11-20):
- Endpoint /v4.2/single/check, result enum (valid / invalid / disposable /
  catchall / unknown) and the flags vocabulary (free_email_host,
  contains_alias, accepts_all, ...): NeverBounce API reference "POST /check"
  (https://developers.neverbounce.com/reference/single-check), read directly.
- The key query parameter name and status/execution_time wrapper fields:
  carried from the connector's implementation; the parameter table was only
  partially visible in the fetched page - marked unverified.
- Confidence numbers in the connector's mapping are OURS, not NeverBounce's.
