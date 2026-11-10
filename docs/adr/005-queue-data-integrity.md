# 005: Shared Redis queue integrity and bounded cache memory

Status: implemented locally, pending review before release.

ADR-003 uses one Redis for cache and BullMQ with allkeys-lru. BullMQ requires
noeviction so queue/lock keys are not arbitrarily lost; its production guide also
recommends AOF. The local Compose checkpoint switches to noeviction and AOF
`everysec`, with 192 MiB Redis maxmemory inside a 320 MiB container. Cache callers
must bound keys and handle write failures. Engine memory is 960 MiB and the total
five-service ceilings sum to 3456 MiB. This is a budget, not measured performance.
If an evicting cache is required, split queues/cache and re-budget resources.

Person-level provider responses must never use a global domain-only cache key.
The waterfall now scopes those entries to authenticated workspace + full lookup
identity. Without tenant scope, personal response caching is disabled. Generic
non-personal domain facts may use separate cache keys after privacy review.

Durable send reservation locks campaign then mailbox rows, rechecks quotas,
cooldown, due job and suppression, and reserves counters/job atomically. Provider
results can be uncertain: automatic retries are disabled. Crashed/reserved jobs
need reconciliation before any resend. Suppression between reservation and SMTP
submission still needs a final execution-boundary check in the future transport.

Source: https://docs.bullmq.io/guide/going-to-production
No native PostgreSQL16 multi-connection or Redis crash-recovery/load test has run.
