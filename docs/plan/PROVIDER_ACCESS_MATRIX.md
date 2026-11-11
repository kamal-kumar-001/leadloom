# Provider-Access Matrix & Intent-Signals Feasibility (G6/G5 research)

Provenance: produced by Team B (Antigravity, leadloom project, research-only assignment) on 2026-11-12 ~00:45 IST; collected and reviewed by Instinct before integration.
Review performed:
- Codebase inventory claims VERIFIED against this repo (registry.ts registers exactly the 10 connectors listed; prospeo exists in waterfall.contract.ts + web catalog only, no engine connector class).
- Hunter free tier (50 credits/month, monthly reset, no rollover) VERIFIED live against https://hunter.io/pricing at review time.
- All other vendor pricing/terms claims carry Team B's official-source citations below and were NOT independently re-verified; treat as research input, not verified fact. Serper's free-credit count could not be verified at review time (JS-rendered page).
- Vendor pricing/terms change without notice; re-verify before any purchase decision. No purchases, accounts or API keys were made or are authorized by this document.

---

Provider-Access Matrix & Intent-Signals Feasibility Report

Scope & Governance: Research-only review conducted in accordance with Leadloom project directives. No files have been modified, no deployment or provisioning scripts have been executed, and no accounts or API keys have been generated.

1. Codebase Registry & Connector Inventory

In the Leadloom codebase, the provider connectors are defined and registered across the following core files:

Engine Connector Registry: 
apps/engine/src/modules/waterfall/connectors/registry.ts
 (instantiates createDefaultConnectorRegistry())
Shared Connector Catalog Contract: 
packages/contracts/src/connector-catalog.contract.ts
 (ConnectorIdSchema and buildConnectorCatalog())
Parked UI Catalog & Waterfall Contract: 
apps/web/app/app/connectors/page.tsx
 (ALL_CONNECTORS) and 
packages/contracts/src/waterfall.contract.ts
 (BYOKProviderEnum)
Canonical Registry Connectors (10 Connectors in Engine Registry)
apollo — Apollo.io (ApolloConnector)
hunter — Hunter.io (HunterConnector)
dropcontact — Dropcontact (DropcontactConnector)
pdl — People Data Labs (PdlConnector)
zerobounce — ZeroBounce (ZeroBounceConnector)
neverbounce — NeverBounce (NeverBounceConnector)
serper — Serper Google Search (SerperConnector)
openai — OpenAI (OpenAiConnector)
anthropic — Anthropic Claude (AnthropicConnector)
ollama — Ollama Local LLM (OllamaConnector)
Additional Connector from UI Catalog / Waterfall Contract
prospeo — Prospeo B2B (prospeo in waterfall.contract.ts and ALL_CONNECTORS in apps/web/app/app/connectors/page.tsx; connector class not yet written in apps/engine).

(Note: The web demo catalog in apps/web also contains aliases mapping anymail_finder to People Data Labs, deepseek to ZeroBounce, groq to NeverBounce, and perplexity to Serper, reflecting early contractual placeholding before connector-catalog.contract.ts unified the 10 canonical connectors).

2. Provider-Access Matrix

Each provider and intent-signal source is evaluated across four criteria:

(a) Official API / access path
(b) Free tier or trial existence and published limits
(c) Public terms regarding B2B outbound prospecting
(d) Account or billing setup required
Lead Enrichment & Verification Connectors
1. Apollo.io (apollo)
(a) Official API Path: REST API endpoint POST https://api.apollo.io/api/v1/people/match (or POST /api/v1/mixed_people/search).
Citation: [Apollo API Documentation](https://docs.apollo.io/reference/people-match)
(b) Free Tier & Published Limits: Yes. Free accounts receive approximately 75 to 250 credits/month (annualized to ~900/year) depending on registration timing. Basic search is 0 credits; revealing a verified work email costs 1 credit. Free tier rate limits are restricted (typically 50–100 requests/minute).
Citation: [Apollo Pricing](https://www.apollo.io/pricing)
(c) Outbound Prospecting Terms: Permitted. Apollo's core business model is sales intelligence and B2B outbound prospecting. Terms permit internal sales and outreach, but strictly prohibit reselling, bulk database redistribution, or building competing data directories.
Citation: [Apollo Terms of Service](https://www.apollo.io/terms)
(d) Account & Billing Setup: Self-serve email sign-up. Free tier requires no credit card. Upgrades to paid tiers (Basic at $49/seat/mo, Pro at $79/seat/mo) require credit card billing.
Citation: [Apollo Pricing Plans](https://www.apollo.io/pricing)
2. Hunter.io (hunter)
(a) Official API Path: REST API endpoint GET https://api.hunter.io/v2/email-finder and GET https://api.hunter.io/v2/email-verifier.
Citation: [Hunter API Documentation](https://hunter.io/api-documentation/v2)
(b) Free Tier & Published Limits: Yes. A perpetual free tier provides 50 free searches/credits per month (resets monthly; non-rollover). An email search costs 1 credit; verification costs 0.5 credits. Rate-limited to 15 requests/second on standard keys.
Citation: [Hunter Pricing](https://hunter.io/pricing)
(c) Outbound Prospecting Terms: Permitted. Hunter explicitly provides data for B2B outreach and provides an integrated Data Processing Agreement (DPA) under GDPR. The user agrees not to send spam or violate anti-spam legislation (CAN-SPAM, GDPR).
Citation: [Hunter Terms of Service](https://hunter.io/terms-of-service)
(d) Account & Billing Setup: Self-serve email registration. No credit card required for the free tier. Paid plans start at $49/month (Starter, 2,000 credits/mo) with credit card / Stripe billing.
Citation: [Hunter Pricing Overview](https://hunter.io/pricing)
3. Dropcontact (dropcontact)
(a) Official API Path: Asynchronous REST API: Submit via POST https://api.dropcontact.com/v1/enrich/all, poll via GET https://api.dropcontact.com/v1/enrich/all/{request_id}.
Citation: [Dropcontact Developer Docs](https://developer.dropcontact.com/)
(b) Free Tier & Published Limits: Free trial only (no perpetual free tier). Registration provides 50 free test credits once upon account creation. Dropcontact charges on a "pay-on-success" model (credits are only deducted for validated professional emails).
Citation: [Dropcontact Pricing & FAQ](https://www.dropcontact.com/pricing)
(c) Outbound Prospecting Terms: Permitted. Dropcontact is architected exclusively for B2B outbound lead generation and CRM enrichment, operating as a 100% GDPR-compliant algorithmic resolver (no stored databases of personal emails).
Citation: [Dropcontact Terms of Service](https://www.dropcontact.com/terms-of-service)
(d) Account & Billing Setup: Requires account registration (corporate email required; personal webmail domains often rejected). Free trial requires no credit card. Ongoing usage requires a monthly subscription starting at €79/month.
Citation: [Dropcontact Pricing](https://www.dropcontact.com/pricing)
4. People Data Labs (pdl)
(a) Official API Path: REST API endpoint POST https://api.peopledatalabs.com/v5/person/enrich.
Citation: [People Data Labs Enrichment Docs](https://docs.peopledatalabs.com/docs/person-enrichment-api)
(b) Free Tier & Published Limits: Partial / Masked Free Tier. PDL offers a free tier of 100 records/month, but masks all direct contact fields (emails and phone numbers return boolean true/false rather than the plaintext string). Real emails are inaccessible on the free tier.
Citation: [People Data Labs Starter Bundle & Pricing](https://www.peopledatalabs.com/pricing)
(c) Outbound Prospecting Terms: Permitted on paid tiers. PDL provides developer-licensed enterprise data intended for B2B applications, CRM enrichment, and sales prospecting. Data redistribution and customer-facing enrichment are supported under commercial contracts.
Citation: [People Data Labs Terms of Service](https://www.peopledatalabs.com/terms)
(d) Account & Billing Setup: Developer account sign-up. Free tier needs no credit card (for schema testing). Unmasking live contact data requires upgrading to the Pro plan starting at $98/month (350 credits/mo) with credit card on file.
Citation: [People Data Labs Pricing](https://www.peopledatalabs.com/pricing)
5. ZeroBounce (zerobounce)
(a) Official API Path: REST API endpoint GET https://api.zerobounce.com/v2/validate?api_key={api_key}&email={email}.
Citation: [ZeroBounce API Reference](https://www.zerobounce.net/docs/email-validation-api-quickstart/)
(b) Free Tier & Published Limits: Yes. 100 free email validations replenished monthly (freemium plan, resets every 30 days). Includes full API access, MX checks, and deliverability status.
Citation: [ZeroBounce Pricing](https://www.zerobounce.net/pricing/)
(c) Outbound Prospecting Terms: Permitted. ZeroBounce exists specifically to scrub and verify cold outbound B2B email lists to protect sender IP/domain reputation.
Citation: [ZeroBounce Terms of Use](https://www.zerobounce.net/terms-of-use/)
(d) Account & Billing Setup: Self-serve email sign-up. No credit card required for the 100 free monthly credits. Pay-as-you-go credit packs start at $39 for 2,000 credits (no expiration).
Citation: [ZeroBounce Pay-As-You-Go Pricing](https://www.zerobounce.net/pricing/)
6. NeverBounce (neverbounce)
(a) Official API Path: REST API endpoint GET https://api.neverbounce.com/v4.2/single/check?key={key}&email={email}.
Citation: [NeverBounce API Documentation](https://neverbounce.com/api)
(b) Free Tier & Published Limits: Minimal one-time trial credits (10 free check credits upon account creation). Does not provide a recurring monthly free allowance.
Citation: [NeverBounce Help Center & Pricing](https://neverbounce.com/pricing)
(c) Outbound Prospecting Terms: Permitted. Purpose-built for verifying and cleaning B2B outbound prospect lists prior to cold delivery.
Citation: [NeverBounce Terms of Service](https://neverbounce.com/terms-of-service)
(d) Account & Billing Setup: Requires account creation. Using API keys without throttling or testing beyond initial credits requires a valid credit card on file. Pay-as-you-go credit purchases start at $8 (for 1,000 verifications at $0.008/check).
Citation: [NeverBounce Pricing](https://neverbounce.com/pricing)
7. Serper Google Search (serper)
(a) Official API Path: REST API endpoint POST https://google.serper.dev/search (and POST https://google.serper.dev/jobs for job postings).
Citation: [Serper Documentation](https://serper.dev/)
(b) Free Tier & Published Limits: Yes. 2,500 free search queries granted upon initial registration (one-time developer allowance). Each query returns up to 10–100 organic search results with knowledge graph and rich snippets.
Citation: [Serper Pricing](https://serper.dev/pricing)
(c) Outbound Prospecting Terms: Permitted. Terms allow programmatic search for research, account identification, news monitoring, and social profile discovery. Does not provide raw personal contact details directly.
Citation: [Serper Terms and Conditions](https://serper.dev/terms)
(d) Account & Billing Setup: Self-serve sign-up with email and password. No credit card required for the 2,500 free queries. Additional usage is prepaid: $50 for 50,000 queries ($0.001 per query; packs expire after 6 months).
Citation: [Serper Pricing Overview](https://serper.dev/pricing)
8. OpenAI (openai)
(a) Official API Path: REST API endpoint POST https://api.openai.com/v1/chat/completions.
Citation: [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
(b) Free Tier & Published Limits: No recurring free tier. Automatic free trial credits for new accounts have been discontinued. API requests require a prepaid balance (or active ChatGPT Business/Pro seat credits tied to the organization).
Citation: [OpenAI API Pricing](https://openai.com/api/pricing/)
(c) Outbound Prospecting Terms: Permitted with strict conditions. Under the OpenAI Usage Policy, using models for market research, company analysis, and drafting personalized business communications is allowed. However, generating spam, deceptive mass messaging, or fraudulent outreach is explicitly prohibited.
Citation: [OpenAI Usage Policies](https://openai.com/policies/usage-policies/)
(d) Account & Billing Setup: Requires an OpenAI Developer account with an active credit card or debit card. Standard accounts must prepay credits (minimum $5 deposit plus local taxes) before the API key can be used.
Citation: [OpenAI Billing Documentation](https://platform.openai.com/docs/guides/production-best-practices/api-keys)
9. Anthropic Claude (anthropic)
(a) Official API Path: REST API endpoint POST https://api.anthropic.com/v1/messages.
Citation: [Anthropic API Documentation](https://docs.anthropic.com/en/api/getting-started)
(b) Free Tier & Published Limits: $5 one-time trial credit available upon initial registration and SMS phone verification in supported jurisdictions. Once consumed, there is no recurring free quota.
Citation: [Anthropic Console Overview](https://console.anthropic.com/)
(c) Outbound Prospecting Terms: Permitted with strict conditions. Anthropic’s Commercial Terms and Usage Policy permit B2B analysis, entity extraction, and copy drafting, but expressly forbid using models to generate or distribute spam, fraudulent campaigns, or deceptive automated communications.
Citation: [Anthropic Acceptable Use Policy](https://www.anthropic.com/legal/aup)
(d) Account & Billing Setup: Account creation on Anthropic Console with phone number verification. To continue beyond the $5 initial credit, users must add a payment method and purchase prepaid credits (minimum $5).
Citation: [Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms)
10. Ollama Local LLM (ollama)
(a) Official API Path: Local HTTP REST endpoint POST http://127.0.0.1:11434/api/chat.
Citation: [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
(b) Free Tier & Published Limits: 100% Free and Unlimited. Open-source software running locally on host hardware. No API rate limits or credit quotas (bounded only by local CPU/GPU compute and RAM).
Citation: [Ollama GitHub Repository](https://github.com/ollama/ollama)
(c) Outbound Prospecting Terms: Permitted. Licensed under the MIT License. Model weights (such as Llama 3 or Mistral) are subject to their respective upstream community licenses (e.g., Meta Llama 3 Community License), which permit commercial B2B applications under 700M monthly active users.
Citation: [Ollama License](https://github.com/ollama/ollama/blob/main/LICENSE)
(d) Account & Billing Setup: None. No account, no credit card, no external network connection, and $0 external billing.
Citation: [Ollama Official Site](https://ollama.com/)
11. Prospeo (prospeo) (Parked in UI/Contracts)
(a) Official API Path: REST API endpoint POST https://api.prospeo.io/email-finder and POST https://api.prospeo.io/enrichment.
Citation: [Prospeo API Reference](https://prospeo.io/api)
(b) Free Tier & Published Limits: Free tier gives 75–100 free credits/month in the web dashboard, but full programmatic API access is restricted to paid plans (Starter and above).
Citation: [Prospeo Pricing](https://prospeo.io/pricing)
(c) Outbound Prospecting Terms: Permitted. Prospeo is designed specifically for finding corporate emails and mobile phone numbers for B2B outbound prospecting.
Citation: [Prospeo Terms of Service](https://prospeo.io/terms-of-service)
(d) Account & Billing Setup: Self-serve email sign-up. Unlocking production API enrichment requires the Starter subscription starting at $49/month with a credit card.
Citation: [Prospeo Pricing](https://prospeo.io/pricing)
Intent-Signal Sources
12. Job Postings / Hiring Pages
(a) Official API / Access Path:
Direct Public ATS Job Board Feeds (Zero-Auth):
Greenhouse: GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs
Lever: GET https://api.lever.co/v0/postings/{company}
Workable: GET https://apply.workable.com/api/v3/accounts/{subdomain}/jobs
Aggregated Search (Serper Jobs): POST https://google.serper.dev/jobs
Aggregator Platform APIs (Indeed): https://developer.indeed.com (Requires partner approval).
Citations: Greenhouse Job Board API
, Lever Postings API
, Serper Google Jobs API
, Indeed Developer Portal
(b) Free Tier & Published Limits:
ATS Public Feeds: 100% free and open public JSON endpoints provided by employers for career page rendering. No auth keys or rate quotas beyond standard IP flood controls.
Serper Jobs: Covered by Serper’s 2,500 free queries (1 query = 1 credit).
Indeed: No public self-serve free tier for third-party market research.
Citations: Greenhouse Job Board Docs
, Serper Pricing
(c) Outbound Prospecting Terms:
ATS Public Feeds: Permitted. Public job descriptions and titles may be ingested as intent signals (e.g. "Hiring DevOps" -> relevance score). Note: ATS feeds contain job descriptions, not direct hiring manager email addresses.
Serper Jobs: Permitted for search and indexing under Serper terms.
Indeed: Prohibited. Indeed Developer Terms expressly prohibit using job posting or seeker data for unauthorized third-party commercial marketing, data commingling, or cold sales outreach.
Citation: [Indeed Developer Terms](https://developer.indeed.com/)
(d) Account & Billing Setup:
ATS Feeds: $0 spend, no account or billing needed.
Serper: Standard Serper account (free 2,500 credits).
Indeed: Enterprise application and vetting required; self-serve signup unavailable.
13. Funding Announcements
(a) Official API / Access Path:
SEC EDGAR Form D Submissions API (Venture & Equity Financings): Official SEC REST endpoint https://data.sec.gov/submissions/CIK{cik}.json and full-text search https://efts.sec.gov/LATEST/search-index. Form D filings represent all legally mandated US private equity/venture capital funding rounds.
Crunchbase API (v4): REST endpoint https://api.crunchbase.com/api/v4/entities/organizations/{permalink}.
Citations: SEC EDGAR Developer Documentation
, Crunchbase API Documentation
(b) Free Tier & Published Limits:
SEC EDGAR: 100% free public government service. Rate limit: 10 requests per second per client IP.
Crunchbase: No free tier. The legacy free API has been permanently discontinued; Crunchbase Pro/Business web subscriptions do not include API access.
Citations: SEC Data APIs & Fair Access
, Crunchbase API Access Terms
(c) Outbound Prospecting Terms:
SEC EDGAR: Permitted. Federal regulatory filings are in the public domain and free of copyright or commercial use restrictions.
Crunchbase: Gated. Commercial data licensing agreements tightly govern downstream export and prohibit unauthorized automated harvesting or reselling.
Citations: SEC Website Privacy and Security Policy
, Crunchbase Terms of Service
(d) Account & Billing Setup:
SEC EDGAR: $0 spend, no account, no API key. Requires only a declared User-Agent string adhering to the SEC format (e.g. User-Agent: Leadloom Research dev@leadloom.local).
Crunchbase: Custom enterprise sales contract (typically $5,000–$20,000+/year); no self-serve API access.
Citations: SEC EDGAR Access Policy
, Crunchbase Enterprise
14. X / Twitter (x_twitter)
(a) Official API Path: X API v2 endpoints GET https://api.x.com/2/tweets/search/recent and GET https://api.x.com/2/users/by/username/{username}.
Citation: [X Developer Platform Docs](https://developer.x.com/en/docs/x-api)
(b) Free Tier & Published Limits: No functional free tier for data ingestion/search. The legacy free search tier is retired. Free tier access is restricted to write-only bot testing (1,500 posts/month write) and Public Utility applications. Read access operates under a Pay-Per-Use model ($0.005 per post read).
Citation: [X Developer Platform Pricing](https://developer.x.com/en/docs/x-api)
(c) Outbound Prospecting Terms: Restricted. Reading public tweets to detect intent keywords is technically compliant through paid API endpoints, but automated mass DMing, unsolicited @mentions, or scraping without API credentials directly violates the X Automation Rules and Developer Agreement.
Citation: [X Developer Agreement & Policy](https://developer.x.com/en/developer-terms/agreement-and-policy)
(d) Account & Billing Setup: Requires an approved X Developer account, Developer Portal app creation, and a credit card loaded with prepaid developer credits.
Citation: [X Developer Console](https://console.x.ai/)
15. LinkedIn (linkedin)
(a) Official API Path: LinkedIn Developer Portal (https://developer.linkedin.com). Standard available products are limited to "Sign In with LinkedIn" (openid, profile) and "Share on LinkedIn" (w_member_social). Granular profile search and lead discovery are gated behind closed partner programs (LinkedIn Talent Solutions and Sales Navigator Enterprise APIs).
Citation: [LinkedIn Developer Documentation](https://learn.microsoft.com/en-us/linkedin/)
(b) Free Tier & Published Limits: Standard OAuth identity APIs are free, but 0 public API endpoints exist for B2B member search, profile enrichment, or prospect extraction on free or self-serve tiers.
Citation: [LinkedIn Partner Programs](https://developer.linkedin.com/partner-programs)
(c) Outbound Prospecting Terms: Strictly Prohibited via direct scraping/crawling. Section 8.2 of the LinkedIn User Agreement and the LinkedIn Developer Terms strictly forbid scraping, crawling, bots, automated data harvesting, or extracting member profile data to build external databases or cold prospecting tools. Automated headless scraping of LinkedIn profiles violates terms and has been the subject of ongoing civil litigation.
Citation: [LinkedIn User Agreement Section 8.2](https://www.linkedin.com/legal/user-agreement)
(d) Account & Billing Setup: Self-serve API keys do not exist for lead prospecting. Access requires formal corporate partnership vetting, manual review by LinkedIn business development, and enterprise licensing.
Citation: [LinkedIn Developer Portal](https://developer.linkedin.com/)
3. Split Feasibility List
Group A: Buildable Now Without Purchases ($0 Out-of-Pocket / Zero Paid Plans)

These services and signal sources can be built and fixture- or smoke-tested immediately using existing free tiers, public domain APIs, or local engines without requiring any credit card commitments or manual enterprise approvals:

Ollama (ollama) — 100% local, $0 cost, open source (MIT), no API key or account needed. Built and tested directly against http://127.0.0.1:11434.
SEC EDGAR Intent Signals (funding_event) — Official US government REST API (data.sec.gov), 100% free, 10 req/s, legal public domain data. Requires only a declared User-Agent header; no account, credit card, or approval needed.
Public ATS Job Board Feeds (job_posting) — Public JSON endpoints on Greenhouse (boards-api.greenhouse.io) and Lever (api.lever.co). $0 cost, no authentication or keys required to pull published job descriptions and technical stack hiring keywords.
Hunter.io (hunter) — Perpetual free tier with 50 free searches/month via standard API key. No credit card required to register and generate an active key.
ZeroBounce (zerobounce) — Freemium plan with 100 free email validations/month via standard API key. No credit card required.
Serper Google Search (serper) — 2,500 free search queries upon sign-up. No credit card required; supports both general web search and the /jobs endpoint.
Apollo.io (apollo) — Free tier (~75 credits/month) available via self-serve sign-up without credit card for basic testing.
Dropcontact (dropcontact) — One-time 50 free test credits on new corporate registration without credit card (sufficient for initial connector test suite; paid subscription required for production).
Group B: Needs a Paid Plan, Credit Card on File, or Closed Partner Approval

These connectors and signal sources cannot be activated for live production pipelines without an active credit card deposit, monthly subscription, or formal corporate application:

OpenAI (openai) — Requires a payment card on file and a minimum $5 prepaid credit deposit; automatic free trial credits have been phased out for new developer accounts.
Anthropic Claude (anthropic) — Offers a one-time $5 trial credit upon phone verification, but quickly requires prepaid credit card funding (minimum $5) for sustained development.
NeverBounce (neverbounce) — Requires a credit card on file to unlock the API key without restrictive throttling; only 10 initial trial credits provided.
People Data Labs (pdl) — Free tier obfuscates/masks all email addresses and phone numbers. Live contact enrichment requires upgrading to the Pro plan ($98/month minimum).
Prospeo (prospeo) — API access is locked behind paid plans (Starter plan at $49/month); free tier is restricted to the browser extension/dashboard.
X / Twitter API v2 (x_twitter) — Search endpoints require prepaid Pay-Per-Use credits with a credit card on file; free tier is restricted to write-only bots.
LinkedIn (linkedin) — Closed partner ecosystem. No public or self-serve API for lead enrichment or prospecting; automated scraping violates the LinkedIn User Agreement (Section 8.2). Requires formal enterprise partnership approval.
Crunchbase (funding_announcements) — Free API is discontinued; programmatic access requires an Enterprise data licensing contract ($5k–$20k+/yr) negotiated with sales.
Ambiguities & Undocumented Constraints
Dropcontact Registration Guardrails: Dropcontact frequently rejects non-business email domains (e.g. @gmail.com, @yahoo.com) during registration. Activating the 50 free credits requires an authentic custom domain email.
People Data Labs Match Billing on Paid Tiers: While PDL does not bill for 404 responses, any 200 response that returns an entity consumes a credit, even if specific requested fields (e.g. direct mobile phone) are null.
OpenAI / Anthropic Cold Outreach Ambiguity: Both model providers permit "personalized B2B outreach" and "lead analysis," but reserve the right to suspend API keys if outbound emails are flagged as unsolicited bulk spam by receiving mail systems.

Report compiled directly from official vendor documentation and terms of service.

12:45 AM

Context: this project's Leadloom clone has a parked G6 lead-enrichment waterfall with about 11 provider connectors (see the provider registry under apps/engine/src/modules/) and a parked G5 intent-signals item.
12:34 AM
Thought for 8s

The complete Provider-Access Matrix and feasibility breakdown for the 11 waterfall connectors and 4 intent-signal sources (G6 & G5) has been compiled directly above based on the registry in 
apps/engine/src/modules/waterfall/connectors/registry.ts
, the UI catalog in 
apps/web/app/app/connectors/page.tsx
, and current vendor documentation.

Key takeaways from the report:

Zero-Spend / Immediately Runnable (Group A): Ollama (local LLM), SEC EDGAR filings (funding events), public ATS feeds (Greenhouse/Lever for hiring signals), Hunter.io (50 free/mo), ZeroBounce (100 free/mo), and Serper (2,500 free search queries).
Requires Paid Plans or Paid Setup (Group B): OpenAI, Anthropic (beyond $5 trial), People Data Labs (masked emails on free plan), NeverBounce (card required for API), Prospeo (API locked to paid), X API v2 (metered read fees), Crunchbase (enterprise-only API), and LinkedIn (closed partner ecosystem / anti-scraping policy).

Let me know if you would like to drill into any specific connector or investigate further bounded items.

12:57 AM
