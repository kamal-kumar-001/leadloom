# Local integration checkpoint

Use Node 22.13 or newer. The root npm lockfile is tracked. From a clean checkout:

```
npm ci
npm run prisma:generate --workspace @leadloom/database
npm run build
npm test
```

Prisma schema validation needs DATABASE_URL, but validate/generate do not connect.
Never put real credentials in examples. Apply reviewed migrations only to an
explicitly selected database, with backups; no db push is included in these commands.
The SQL tests use isolated PGlite + pgvector and synthetic fixtures.

`npm run dev --workspace @leadloom/engine` runs the engine health endpoint on
127.0.0.1:4000. With no credentials it deliberately exposes no mutations. To mount
credential/job/suppression routes, supply DATABASE_URL, a 32-byte master key and a
separate session-signing key. Session tokens must come from an authenticated
issuer (not implemented here); never accept a workspace ID from request bodies.
`/ready` intentionally reports 503 while the complete provider worker is absent.
No actual outbound transport is started by these commands.

`npm run dev --workspace @leadloom/web` runs the web preview on localhost:3000.
Workspace rows/actions and the smoke-page form remain explicit demos until live
APIs are connected. A preview signup must not claim to save anything. No paid API
call occurs without configured credentials. Provider adapters no longer invent
"deliverable" email addresses when keys are missing.

The dependency upgrade includes Next15.5.29, Nest12.4.2, Zod4.6.7 and a PostCSS
security override. Node22 production build, route smoke tests, strict fixture
validation and local browser rendering are tested. Old Zod3 fixtures with invalid
UUIDs were fixed rather than weakening UUID validation. Next15 dynamic params
are handled asynchronously; Three rendering is lazy/client-only. Root production
dependency audit was clear at this checkpoint; this is not a security certification.

Release still needs native PostgreSQL16/Prisma concurrency tests, full auth issuer,
real queue lifecycle/transport/reply integration, safe send-boundary suppression
checks, Docker builds/health/load tests and verification on the actual live URL.
No remote push or deployment is included in this checkpoint.
