# Anthropic fixture provenance

SYNTHETIC, hand-authored from the connector's implementation. NOT recorded
provider traffic; no live Anthropic call from this repo. 'fixture-tested'
stays.
Doc grounding attempt (2026-11-20): docs.anthropic.com API reference is
JS-rendered and yielded no readable content in fetch. POST /v1/messages,
x-api-key + anthropic-version headers, content[] text-block selection,
stop_reason and usage.{input,output}_tokens shapes are carried from the
connector, unverified in this fetch round.
