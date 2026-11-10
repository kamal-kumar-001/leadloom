# Gamma infrastructure checkpoint

Local preparation only. No deployment or live database mutation has been run.

## What can run

The default Compose profile defines PostgreSQL 16 + pgvector and Redis 7.
Use a locally supplied unique POSTGRES_PASSWORD, then run `docker compose up -d`.
No database or Redis ports are published to the host. Keep local env files out of git.
Starting infrastructure does not apply Prisma migrations.

The `application` profile now has engine and standalone Next.js Dockerfiles.
The engine is a real Nest/Fastify process. With DATABASE_URL, LEADLOOM_MASTER_KEY
and LEADLOOM_SESSION_KEY configured it mounts tenant-scoped credential storage,
pending-job creation and suppression routes. Those APIs require a signed session.
There is no login/identity issuer yet. Health is not readiness: `/ready` stays 503
until the full provider/worker runtime is connected. No SMTP transport starts.
The separate `scraper-unconfigured` profile still lacks a long-running scraper
entrypoint/Dockerfile and must not be enabled as a working service.
Dockerfiles are not build-tested here because Docker is unavailable.

## Resource and security settings

Memory ceilings: Postgres 1024 MiB + Redis 320 MiB + engine 960 MiB + web 512 MiB +
scraper 640 MiB = 3456 MiB. These are limits, not measured usage or proof the stack
fits a 4 GiB VPS under load. PostgreSQL has 50 connection slots; callers must bound
their own pools. Scraper concurrency is one until measured on the target host.
Host swap setup is an operator action and is not performed by this repository.

DB and Redis sit on an internal network. App services also have an egress network
for authorized provider calls. HTTP ports bind loopback pending a TLS reverse proxy.
Logs rotate; services set no-new-privileges and PID limits. Before production,
measure memory, verify non-root app images and read-only filesystems, pin tested
image digests, add backups and recovery tests, and supply secrets securely.

The master key has no insecure fallback. VaultService rejects missing/malformed
keys. Application startup must call it before accepting work. DATABASE_URL must
be explicitly supplied with percent-encoded password characters, not made by
interpolating a raw password into a URI.

## Redis decision conflict with ADR-003

The old Compose used allkeys-lru and disabled persistence. A shared Redis serving
BullMQ cannot safely evict arbitrary queue/lock keys. This checkpoint therefore
uses noeviction and AOF every second, with maxmemory below the container ceiling.
This intentionally differs from ADR-003's cache-only eviction setting. Cache
callers must tolerate OOM errors, bound keys and set TTLs. If automatic cache
LRU eviction is required, split cache and queue Redis into separate instances and
revisit the RAM budget with the project owners.

Source: https://docs.bullmq.io/guide/going-to-production

## Verification boundaries

YAML/config checks are local static checks. Docker is unavailable in the current
build environment: no image builds, container healthchecks, load tests, SMTP,
IMAP, live DNS, paid APIs or production database changes were performed.
