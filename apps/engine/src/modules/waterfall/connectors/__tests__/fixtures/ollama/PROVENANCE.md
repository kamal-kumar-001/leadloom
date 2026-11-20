# Ollama fixture provenance

SYNTHETIC, hand-authored from the connector's implementation. NOT recorded
daemon traffic; no live Ollama call from this repo. 'fixture-tested' stays.
Ollama is the LOCAL-daemon connector: loopback-only base URLs are allowed
(see the security suite), and its result carries costMicrocents: 0 - that
means no per-request PROVIDER charge; the hosting/compute cost of the local
model is real and is NOT measured or claimed here. POST /api/chat with stream:false and the
message.content / total_duration / eval_count response shape are carried
from the connector; no separate doc fetch was made for this local API.
