# Headroom review, 2026-11-23

## Decision

Ship the independent Leadloom debug indicator now. Do not install a transparent Antigravity wrapper/proxy, alter its model endpoints, intercept its login/TLS, or add a Mac background service. These are neither necessary for the indicator nor established safe for the user's consumer account. No Headroom dependency is added in this candidate.

The probable repository intended by the user is https://github.com/headroomlabs-ai/headroom/ . Identity match is descriptive, not user confirmation of a particular package/version. Its README and quickstart document a Python in-process compressor, proxy and MCP modes. The TypeScript SDK calls a Python service, so it is not a dependency-free in-process JS drop-in for the current CLI. Documentation says an anonymous upload beacon is on by default; offline mode and explicit beacon opt-out are necessary for any later private evaluation. Compression originals/retrieval storage need independent project isolation, TTL and access review.

## Compatibility and conflicting evidence

The repository has an October7 Antigravity IDE integration commit, but its own proof section does not establish actual IDE proxy traffic or real MCP installation. An open compatibility issue describes unsupported Cloud Code endpoints on Antigravity2.5.5. The separate CLI proposal uses selective TLS interception and is not a safe implied extension of Leadloom's tool-result boundary. These sources concern different versions/surfaces and cannot be collapsed into either universal support or universal failure.

Google's current FAQ warns third-party tools accessing Antigravity with its login can lead to suspension/termination and says consumer headless wrapping is unsupported. Native caller-owned use of Leadloom tools is distinct from routing the consumer login through Headroom. No inference of policy permission from an open-source integration is valid.

Headroom's README makes broad benchmark claims, while its limitations page says some older directional measurements were not traced to repeatable benchmarks, describes substantial passthrough and multiple safety gates. None establishes savings or fidelity for Leadloom's already compact briefs. No benchmark was executed here and no savings percentage is adopted.

## Lowest-risk next experiment

If pursued later, use an isolated offline Python invocation over copied synthetic Leadloom tool-result fixtures only, not provider credentials, user history or a consumer endpoint. Explicitly disable beacon/network/model downloads; pin/review package and dependency/license footprint first. Preserve exact originals, IDs, versions, source links, limitations and authority boundaries. Compare exact decision/issue/source retention and retrieval against uncompressed results, count with the actual selected tokenizer, and include startup/CPU/memory overhead. Skip short compact briefs rather than adding compression overhead to them. This is an experiment specification, not an implemented integration or measured saving.

## Sources read

- Repository README, vendor source: https://github.com/headroomlabs-ai/headroom/
- Quickstart, vendor source: https://github.com/headroomlabs-ai/headroom/blob/main/docs/content/docs/quickstart.mdx
- Proxy and telemetry behavior, vendor source: https://github.com/headroomlabs-ai/headroom/blob/main/docs/content/docs/proxy.mdx
- Architecture, vendor source: https://github.com/headroomlabs-ai/headroom/blob/main/docs/content/docs/architecture.mdx
- Limitations and measurement caveats, vendor source: https://github.com/headroomlabs-ai/headroom/blob/main/docs/content/docs/limitations.mdx
- IDE implementation/proof boundary: https://github.com/headroomlabs-ai/headroom/commit/cd4367b040bf80b7358f100da54994f6d5fbfcfe
- User protocol report, not independent reproduced proof: https://github.com/headroomlabs-ai/headroom/issues/2975
- CLI proposal, not adopted code: https://github.com/headroomlabs-ai/headroom/pull/1044
- Official account/policy boundary: https://antigravity.google/docs/faq

No independent benchmark matching this user's exact native Antigravity/Leadloom setup found. Repository docs and issue reports are not security certification.
