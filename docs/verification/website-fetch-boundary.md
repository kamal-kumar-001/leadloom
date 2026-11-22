# Website research fetch boundary

URL fetching remains independently opt-in behind the existing research/fetch flags. Pasted-text analysis still works without network access. Neither these settings nor this document grants a caller authority to retrieve a website, spend, contact a person or treat website text as instructions.

## Transport

Production website requests use Node HTTP(S) directly, without a proxy or ambient cookies/authentication. URLs must be http/https with a public DNS hostname and standard protocol port. IP literals, embedded credentials, fragments, nonstandard ports and other schemes are rejected. The production resolver requires every returned address to pass the shared public-unicast policy; empty/private/mixed results fail closed. The connection uses the selected validated address directly, preserving the original HTTP Host and TLS servername. It does not re-resolve the hostname when connecting. HTTPS retains certificate/hostname validation and TLS1.2minimum.

Same-host redirects are allowed only up to three hops, with loop detection, no HTTPS downgrade, a fresh public-address validation/pin for each hop, and one total operation deadline. Cross-host redirects are rejected rather than followed. Non-success bodies are not buffered. No retry, cookie jar or auth forwarding is introduced. HTTP remains available for public sites and is not claimed confidential or integrity-protected.

The full operation, including DNS lookup, headers, redirects and streaming body, has a bounded deadline, default10seconds and maximum30seconds. At most512KiBof response-body prefix is retained. A larger stream is destroyed/cancelled and returns truncated:truewith that bounded prefix. It is not a complete page. Response headers are limited to16KiB. Production requests ask for identity encoding, reject other content encoding and accept HTML/plain text (or absent Content-Type), not arbitrary binary types. This is a restrictive text collector, not a browser: compressed-only sites, client-rendered pages, cross-host canonical redirects and unusual ports can fail. Paste authorized page text rather than silently weakening the policy.

Tag/script/style stripping is heuristic text reduction, not HTML sanitization for rendering, a semantic extractor or an authenticity check. The output feeds labeled keyword heuristics only. Website content is untrusted data; it cannot grant tool/communication authority, turn its claims into verified facts or select unrelated work. Errors are bounded generic messages, never raw transport/DNS/TLS internals or URL credentials.

## Fixtures and limits

Constructor-only resolver/address-remap/CA and fetch injection are trusted test seams, not HTTP fields. Production main passes none of them. Existing allowPrivateHosts remains restricted by main to non-production plus the pre-existing explicit local-fixture flag; it is not a production bypass. The injected fetch seam is bounded for redirects/body/deadline but is not the production DNS-pinned implementation.

Local HTTP/TLS tests remap a synthetic validated public address to loopback, never contact that public address. They prove one-resolution pinning, private/mixed DNS refusal, redirect revalidation/loop/hop bounds, bounded body truncation/cancellation, stalled DNS/header/body deadlines, generic errors, content restrictions, TLS hostname validation and rejection of untrusted certificates. An authenticated Nest route test composes the real pinned transport with actual heuristic analysis and refuses a later private resolution without an analysis/save receipt. Fixtures are not evidence that any live website was fetched successfully.

This does not sandbox the entire host, prove all future reserved IP classifications, remove network/firewall responsibilities, authorize live fetching, validate source claims, or establish provider/sending readiness. DNS trust relies on the configured resolver and the shared public-address classifier. A final URL is provenance, not proof of source authenticity or that its whole page was read.
