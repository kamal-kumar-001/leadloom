# Connector catalogue (public-docs based)

Method: public vendor API docs and open-source SDKs only. Each connector implements the same interface and is tested against recorded fixtures. Keys are BYOK.

| Group | Connectors | Auth | Notes |
|---|---|---|---|
| People and company data | Apollo, Hunter, Dropcontact, People Data Labs, Prospeo, Findymail, Snov.io, Lusha | API key | Waterfall order set per workspace; early exit on a verified hit |
| Email verification | ZeroBounce, NeverBounce, MillionVerifier | API key | Verify before a send job is allowed |
| Company intel | Clearbit-style domain lookup (vendor TBD), BuiltWith, public site metadata fetch | API key / none | Public pages only, robots.txt honored |
| Web search and signals | Serper, Brave Search API, news RSS, job-board public feeds | API key / none | Intent signals |
| AI | OpenAI, Anthropic, Ollama (local) | API key / URL | Researcher column, personalization |
| Mailboxes | Gmail, Microsoft 365, generic SMTP/IMAP | OAuth2 / password | OAuth connect library already on main |
| CRM sync | HubSpot, Salesforce, Pipedrive, Google Sheets, CSV | OAuth2 / file | Export and push, no destructive writes |
| Notifications and hooks | Slack, generic signed webhooks (HMAC-SHA256) | OAuth2 / secret | Inbound HMAC endpoint not built yet |

Not planned: scraping LinkedIn or any site whose terms forbid it; bypassing logins or captchas.
