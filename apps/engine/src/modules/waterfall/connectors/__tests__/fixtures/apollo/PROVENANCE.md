# Apollo fixture provenance

These fixtures are SYNTHETIC, hand-authored from Apollo's public API docs.
They are NOT recorded provider responses: no live Apollo call has ever been
made from this repo (no keys, no approval), and nothing here may be described
as "recorded" traffic. The connector's verification label stays
'fixture-tested'.

Grounding:
- Endpoint, auth header, and snake_case request parameters (first_name,
  last_name, email, organization_name, domain, linkedin_url): Apollo docs
  "People Enrichment", https://docs.apollo.io/reference/people-enrichment,
  fetched 2026-11-20.
- match_confidence values (high/medium/low/none): same source.
- person.email_status values (verified/extrapolated/catchall): carried from
  the connector's existing implementation; NOT confirmed in the 2026-11-20
  doc fetch. Treated as an unverified contract assumption.

Doc-grounded contract finding (2026-11-20, recorded not fixed): the docs
state PERSONAL emails are not returned unless the request sets
reveal_personal_emails=true, which consumes credits. The connector sends no
reveal flag, and reveal flags stay DISABLED (credit spend is Kamal's
decision, recorded in DECISIONS_NEEDED.md item 3's scope - not made here).
Careful scope of the finding: the fetched page restricts PERSONAL emails; it
does NOT establish whether business/work emails return by default, and we do
not infer that they don't. The match-no-email fixture is one documented
possible shape (e.g. only a personal email on file); the
match-verified/extrapolated/catchall fixtures remain plausible shapes for
work-email responses. Which shape dominates live traffic is UNKNOWN until an
approved live call.
