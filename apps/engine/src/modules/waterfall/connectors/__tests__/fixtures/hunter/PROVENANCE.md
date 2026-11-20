# Hunter fixture provenance

SYNTHETIC fixtures, hand-authored from Hunter's public API docs. NOT recorded
provider responses: no live Hunter call has ever been made from this repo.
The connector's verification label stays 'fixture-tested'.

Grounding (fetched 2026-11-20):
- Endpoint and response skeleton: Hunter API Reference V2
  (https://hunter.io/api-documentation/v2) and the Email Finder page
  (https://hunter.io/api/email-finder), whose documented example returns
  data{ email, score, position, company, ... } with verification.status in
  valid / accept_all / unknown ("A verification is automatically performed on
  each email found", same source).
- finder-found.json mirrors that documented example's shape with fictional
  values.
- Cost note from the same source: "If no email can be found, no credit is
  charged."
- finder-not-found.json: the docs excerpts fetched do not show the exact
  no-find response body; the { data: { email: null } } shape is the
  connector's assumption - marked synthetic/unverified.
- Auth: VERIFIED 2026-11-20 against the reference's Authentication section -
  the key "can be passed in the api_key query parameter, in the X-API-KEY
  header, or in the Authorization header (Bearer YOUR_API_KEY)". The
  connector's X-API-KEY header is documented and correct (and preferable to
  the query parameter, which lands in URLs/logs). No change needed.
- Also grounded in the same fetch: responses carry X-Credits-Used /
  X-Credits-Unit cost headers (a future cost-observability hook, recorded
  not built), and a special `test-api-key` exists that returns a fixed dummy
  response on the three main endpoints (a possible future SANCTIONED smoke
  path - still a live call, needs the same approval).
