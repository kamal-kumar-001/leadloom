# PDL (People Data Labs) fixture provenance

SYNTHETIC fixtures, hand-authored from the connector's own implementation.
NOT recorded provider responses; no live PDL call has ever been made from
this repo. The connector stays 'fixture-tested'.

Doc grounding attempt (2026-11-20): docs.peopledatalabs.com pages returned
only site chrome / failed to yield field references in two fetch attempts.
POST /v5/person/enrich, the X-Api-Key header, the 404-as-not-found-success
behavior, and the response fields (full_name, work_email, personal_emails,
job_title, job_company_name, linkedin_url, likelihood) are ALL carried from
the connector's implementation, unverified against current docs.
Confidence numbers are OURS, not PDL's.
