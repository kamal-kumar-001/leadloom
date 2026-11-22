# Review access, 2026-11-23

## Answer

Ship a truthful limited source path, not a promise that four platforms are scraped. The candidate can support a single explicit public Apple RSS page and source-linked caller intake. Google Play and Apple official developer APIs serve authorized apps; they are not automatic competitor access. Reddit API use needs platform approval and commercial use written approval. X's canonical pricing documentation was not verified in this run, so do not call a paid API or promise free access. General public web research by the customer agent remains separate, with source and access caveats.

## Ranked implementation choices

| Choice | Fit | Limit |
| --- | --- | --- |
| One-shot fixed-origin Apple public RSS, explicit app/storefront | Immediate narrow compatibility feature, no account credentials | Best effort public feed, incomplete history, no verified product identity or source authenticity |
| Caller-provided permitted source excerpts into review intake | Works across source types without invented collectors | Collector/method/permission remain caller responsibility; caller labels are not proof |
| Official Apple/Google review APIs | Useful later for authorized owned-app feedback | Need correct app/account authority; Google recent-review window documented |
| Reddit API integration | Only after approved platform access and relevant commercial agreement | Not enabled, no access request or scraping bypass attempted |
| X API integration | Defer until canonical account/access/price/cost approval grounded | Preview-host pricing found, canonical page failed; no current official price asserted |

## Criteria and assumptions

The requested new idea is unknown. This is technical collection research, not competitor selection, market validation, legal advice or permission certification. Avoid paid requests, unnecessary identifiers, account changes, brittle internal APIs, access-control bypass, broad scraping or background polling. A public response establishes technical reachability, not all reuse rights.

## Findings and sources

1. Apple official customer review endpoint identifies an app resource representing the developer's app and documents authenticated errors, rating/territory/sort filters. It does not establish arbitrary competitor access. https://developer.apple.com/documentation/AppStoreConnectAPI/GET-v1-apps-_id_-customerReviews
2. Apple's ratings/reviews help describes viewing one's app and required App Store Connect roles. https://developer.apple.com/help/app-store-connect/monitor-ratings-and-reviews/view-ratings-and-reviews/
3. Google official Reply to Reviews documentation states authorized production-app feedback, commented reviews only and a recent created/modified window, with Console CSV for full history. Its own app language and OAuth/service-account permission requirements matter. https://developers.google.com/android-publisher/reply-to-reviews
4. Reddit official Responsible Builder Policy, visible update October5,2026, requires explicit approval before API access, forbids access-limit evasion and requires written approval for commercial use. https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy
5. Reddit developer-access help and Data API terms reinforce the separate commercial permission/agreement boundary. https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data and https://redditinc.com/policies/data-api-terms
6. Independent open-source package documentation describes the public Apple RSS path and contrasts it with authenticated owned-app APIs and undocumented Google web scraping. Its feed depth/rate claims remain third-party and are not assumed as a supported guarantee. https://0xfirattamur.github.io/app-reviews/reference/how-it-works/
7. Direct public Apple feed observation returned structured dated reviews with review IDs, ratings, excerpts and source links. The selected ID was a compatibility example from package docs, unrelated to the user's undisclosed idea. No author identities need be stored by our reader. https://itunes.apple.com/us/rss/customerreviews/id=324684580/sortBy=mostRecent/page=1/json
8. X preview documentation returned credit/per-resource pricing claims. This is not treated as current canonical pricing: the canonical page at https://docs.x.com/x-api/getting-started/pricing returned SOURCE_NOT_AVAILABLE and no official price was verified. Preview source: https://x-preview.mintlify.app/x-api/getting-started/pricing

## Implementation judgment

Use customer-side CLI one-shot Apple retrieval with a fixed HTTPS hostname/path template, no arbitrary destination/header/credential/redirect, timeout, byte and item limits, one page only, explicit incomplete coverage, optional rating selection and clear bias. Stop on any throttle/challenge. Do not auto-store or auto-analyze. Retain review IDs, selected feed timestamps and feed URL; omit author identity. Label product name caller-supplied. The caller can inspect selections and save only needed permitted excerpts in review intake. That report remains caller judgment. Do not claim all platforms, full history, latest market state, authentic customers, permission or demand.

## Open uncertainties

Apple RSS is not established here as a documented supported official competitor API or unrestricted commercial license. The endpoint can change or throttle. No rate guarantee, semantic clustering, full review history or product identity verification. Reddit/X access is unconfigured/unverified; Google competitor collection is not implemented. Current account-side access or a paid licensed data provider could change the recommendation after authority and cost are grounded.
