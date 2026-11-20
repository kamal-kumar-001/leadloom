# Serper fixture provenance

SYNTHETIC fixtures, hand-authored from the connector's own implementation.
NOT recorded provider responses; no live Serper call has ever been made from
this repo. The connector stays 'fixture-tested'.

Doc grounding attempt (2026-11-20): serper.dev pages are behind a login wall
in fetches (playground/api-keys returned login markup). POST /search, the
X-API-KEY header, the q/num/gl/hl request fields, and the organic[] /
knowledgeGraph response shape are ALL carried from the connector's
implementation, unverified against current docs.
