# OpenAI fixture provenance

SYNTHETIC, hand-authored from the connector's implementation. NOT recorded
provider traffic; no live OpenAI call from this repo. 'fixture-tested' stays.
Doc grounding attempt (2026-11-20): platform.openai.com API reference is
JS-rendered and yielded no readable content in fetch. POST
/v1/chat/completions, Bearer auth, choices[0].message.content / finish_reason
/ usage.{prompt,completion,total}_tokens shapes are carried from the
connector, unverified in this fetch round.
