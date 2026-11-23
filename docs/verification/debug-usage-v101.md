# Opt-in customer CLI debug usage, 2026-11-23

Use `LEADLOOM_DEBUG_USAGE=1 node cli.mjs entries brief` from the downloaded bundle. The same indicator works across JSON-reading CLI commands. It writes one line to stderr at exit, leaving stdout machine-readable. No storage, background service, model call or extra fetch. It is off by default, including on existing installs. Download the new bundle to get this code.

Measured: requests attempted, transport failures, UTF8 request string-body bytes and actual decoded JSON response UTF8 bytes/code points read in this CLI invocation. HTTP errors remain actual HTTP responses, not transport failures. Non-JSON streamed/feed data is excluded from JSON counters. No bodies, secrets, headers, query strings or endpoints are logged.

Estimated: received JSON code points divided by4, rounded up. This is a rough context-size heuristic, not the model tokenizer. Unicode/language and JSON encoding can change actual token count considerably. Response bytes do not establish that the agent consumed the content. No claim of token savings or billed spend follows. Pretty-print expansion, headers/TLS, agent instructions/history/reasoning/cache/output and other tools are outside the observation. Antigravity provider tokens stay null/unobservable, not zero. This does not alter or intercept the coding agent or its credentials.

A generated-CLI real HTTP fixture verifies default silence, opt-in output, exact Unicode byte counts, preserved stdout, no extra request and absence of credential/private body/endpoint in debug output. Earlier product workflow proofs remain bounded to their exact versions; fresh full root build applies to this candidate.
