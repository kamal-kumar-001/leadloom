# v97 one-shot public Apple feed, 2026-11-23

Private source candidate only. No push, deploy, Mac, production storage, account change, model or paid request.

The downloaded customer CLI adds `apple-reviews fetch-file` with strict public app ID/storefront/caller product label, optional rating filter and1-20 result limit. It makes one fixed-origin HTTPS public Apple RSS request, no Leadloom or provider credential, no redirect/fallback/pagination/poll/retry. Timeout15seconds; response cap512KB; at most50 inspected entries/20 returned excerpts;1500 characters each with truncation metadata. Valid numeric review IDs deduplicate within the page. Author names/identifiers are omitted. Source update time and fetch observation time are distinct. Product identity is explicitly unverified, coverage incomplete, all text untrusted. Fetch never persists or analyzes.

One focused test plus the15 bundle tests passed, covering strict input/origin/header behavior, zero credential exposure, identity omission, rating/duplicate/invalid/truncation counts and throttled/HTML/oversized/missing-feed failures. Clean web typecheck, engine compilation and documented Next compile/generate passed. Normal combined build is not certified.

Actual compiled application/fresh disposable PostgreSQL16/authenticated nine-pack bundle download then actual downloaded CLI made one selected public feed request. The unrelated compatibility app ID324684580/us returned50 valid inspected entries,34 above selected maxRating3,5 returned,0 truncated; incomplete:true remains explicit. No product asset was saved. Fixture database removed. Source:
https://itunes.apple.com/us/rss/customerreviews/id=324684580/sortBy=mostRecent/page=1/json

The first actual CLI attempt correctly refused an unrecognized content type. A bounded diagnostic confirmed Apple served JSON as text/javascript; the allowlist now accepts JSON or JavaScript MIME but parses only JSON, never evaluates it. Fixture updated, both apps rebuilt and actual downloaded-CLI proof rerun successfully. Before that, one public source verification and one header diagnostic occurred; do not describe this entire research session as only one network request. The passing reader invocation itself issued exactly one request, no background checking.

Source identity48b0a2bbf7695a7bdb2209a1ed8a2e10a4e4e9aef3fd1b0fa8aea16ba6d5b4b4,899 included files. No new visual UI in this slice; v95/v96 panels remain separately inspected.

Review-platform-access-v97.md preserves official/independent/direct-source grounding and remaining permission/support gaps. Apple official/Google developer APIs do not supply generic competitor access; Reddit approval/commercial terms cannot be bypassed. X canonical pricing not verified, no price claim or paid integration. RSS technical reachability is not legal reuse permission, official API support, authentic customer identity, full history, new-idea demand or a working Google/Reddit/X collector. Source selection and permitted storage stay caller-owned.
