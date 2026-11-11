# LeadLoom vs PumpGTM: gap list and build plan (2026-11-11)

Scope: a plan only. It authorizes no deploy, real send, provider call, spend or account change.
Basis: `MISSING_WORK.md` (source state at `bfe8c60`), plus public PumpGTM pages read on 2026-11-11.
PumpGTM is a proprietary SaaS. We compare behavior from its public pages. Marketing claims are
labelled as claims; nothing here assumes how PumpGTM is built. Its public GitHub repo
(`gigacatalyst/pumpgtm`) holds only a README, so there is no code to reuse.

## 1. What PumpGTM says it does (claims, with sources)

| Area | Claim | Source |
|---|---|---|
| Find buyers | Enter your website; it works out who buys and lists people showing intent (hiring, funding, tooling changes, post engagement, competitor comment sections), each with a "relevant because" reason | https://github.com/gigacatalyst/pumpgtm/blob/main/README.md , https://pumpgtm.com/llms.txt |
| Channels | LinkedIn, X and email share one sequence. Email sends from the customer's own Gmail, Microsoft 365 or IMAP mailbox. WhatsApp is beta by request | https://pumpgtm.com/llms.txt |
| LinkedIn | Connection requests and follow-ups from the user's own account, paced "inside LinkedIn's limits", paused on reply | README above; https://pumpgtm.com/api/markdown?p=%2Fyc%2Ffounders |
| X | Paced DM sequences to likers, repliers and new followers from the connected X account; no follow/like automation; delivery depends on recipient settings | https://pumpgtm.com/integrations/x |
| Approval | Human approves the first list and messages before anything sends; replies stop the sequence | README above |
| Learning | Replies and meetings are tracked back to their source to improve targeting | README above |
| Agent access | Hosted MCP server and REST API, workspace key | https://pumpgtm.com/llms.txt |
| Verified email only | "Email only to verified addresses" | https://pumpgtm.com/api/markdown?p=%2Fyc%2Ffounders |
| Pricing | 7-day trial, then $75/month per LinkedIn account (reach up to 1,000 people a month) or $149 (10,000) | https://pumpgtm.com/llms.txt |

## 2. Provider facts that decide what we can build (verified from sources)

- **Gmail, OAuth route.** An external Google OAuth app in "Testing" status is capped at 100 test users, and authorizations by test users expire after 7 days (refresh tokens too) unless only name/email/profile scopes are used. Gmail send/read scopes are sensitive or restricted and need Google verification for production. Source: https://support.google.com/cloud/answer/15549945 , https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification . So an own-use Gmail OAuth connect works for Kamal and a few teammates, but re-consent every 7 days until the app is verified.
- **Gmail, IMAP/SMTP route.** Needs an App Password (account must have 2-Step Verification). Google calls app passwords "not recommended" but they are available. Source: https://support.google.com/mail/answer/185833 . Works with no Google Cloud app. Workspace admins can disable it.
- **LinkedIn.** The official Messages API is "restricted to approved partners" and a message must tie to a specific member action, not an automated or scheduled event. Source: https://learn.microsoft.com/en-us/linkedin/shared/integrations/communications/messages . A normal developer app gets Sign In and Share only (secondary source: https://www.leadshark.io/blog/linkedin-api). So there is no official route for sequenced DMs. Tools that do it drive the member's own session, which is account automation outside the official API; we have not confirmed PumpGTM's mechanism. Our connectors doc already lists this as not planned. LeadLoom will not build session scraping or automation of LinkedIn.
- **X.** Official API v2 includes DMs. Since 2026-02 new developers use prepaid pay-per-use credits; secondary sources list DM event read about $0.010 and DM create about $0.015 per request, user-authorized OAuth. Sources (secondary, not X docs; the X docs page could not be fetched): https://www.getxapi.com/blogs/send-twitter-dms-via-api , https://postgate.studio/how-to/x-api-pricing-tiers-2026 . Needs an X developer app and prepaid credits (spend). Not built until both exist and Kamal approves the spend.

## 3. Gap list (LeadLoom today vs the PumpGTM claims)

Status words follow `MISSING_WORK.md`: Live, Wired, Parked, Sample, Missing.

| # | Capability | LeadLoom today | Gap |
|---|---|---|---|
| G1 | Workspace, sign-in, team invites | Live: password auth, OTP. Invites built in engine behind a flag, off in production | Flag off; no way to enable and no invitee-notification path; roles/remove not exercised |
| G2 | Mailbox connect (Gmail/M365/IMAP) | Parked library only (SMTP/IMAP, OAuth2 loop). No connect route, no UI | Connect routes, encrypted credential storage, test, UI with setup steps |
| G3 | Send engine and sequences | Parked. Queue enqueues, no worker consumes. Sending off | Worker, pacing, reply detection, suppression, approval gate |
| G4 | Buyer discovery from a website | Missing | Website-to-ICP step, intent sources, relevance reason per lead |
| G5 | Intent signals (hiring, funding, post engagement) | Parked scraper/signals code | Mounted sources with permitted terms; LinkedIn/X engagement sources need official access |
| G6 | Lead enrichment waterfall | Parked connectors (11 providers), UI shows sample numbers | Registry endpoint, vault reconcile, test connection, real cascade |
| G7 | LinkedIn outreach | Missing | No official API route. Not buildable as sequenced DMs without account automation; LeadLoom will stay out of that |
| G8 | X DM outreach | Missing | Needs X developer app, prepaid credits, OAuth |
| G9 | Approval-before-send | Missing in UI | Approval queue for list and messages |
| G10 | Reply tracking and source attribution | Missing | Inbox sync (IMAP poller exists), reply classifier, attribution to source |
| G11 | MCP/REST agent access | Missing | Out of scope tonight |
| G12 | Billing and plans | Parked entitlements | Plan decisions are Kamal's |

## 4. Build plan (ordered, continuous; no morning deadline; each item verified locally before it counts)

1. **Invites usable (G1).** Run the engine with real PostgreSQL, drive the Settings team card in a browser with two real accounts: invite, signup, accept, role limits, remove, revoke, expiry. Fix what breaks. Production enablement is a separate approved release step.
2. **Mailbox connect (G2).** Provider-neutral design: `MailboxConnection` with kinds `imap_smtp` (app password, no third-party app) and `google_oauth`/`microsoft_oauth` (built behind "needs your OAuth app" status). Secrets are collected in the Leadloom app's own masked form and stored in LeadLoom's AES-256-GCM vault; never through chat. "Test connection" does a login only (no mail sent). UI shows exact setup steps per provider.
3. **Honest connection cards (G7, G8).** LinkedIn and X appear with real status ("provider-blocked: needs X app and credits", "no official API for sequenced DMs") and setup guidance, not working-looking buttons.
4. **Approval queue skeleton (G9)** and **registry endpoint for connectors (G6/C1)** if time allows.
5. Write the findings and status to `docs/context/SYNC_FEED.md` after each verified step.

## 5. What each step needs from Kamal (only when reached)

- Invites: approval of the release that sets `LEADLOOM_TEAM_INVITES_ENABLED=true` on the host. No invite email is sent; admins tell invitees to sign up with the invited address.
- Gmail via app password: he creates an App Password in his own Google account and types it into the Leadloom form (masked). Gmail via OAuth: a Google Cloud OAuth client (we can set it up with his authorization, expect 100-user/7-day limits).
- X: a developer app plus prepaid credits (spend, his approval).
- LinkedIn: none; no supported route.
- Any real send: explicit approval of sender mailbox, recipients and wording.

## 6. Release safety

The 2026-11-11 deploy stalled for about an hour in Docker's image export on the lab PC (88% disk, shared with BakeryPOS and FeeFree). No further deploy until a low-load approach is agreed. No Docker cleanup or restart without Kamal's approval.
