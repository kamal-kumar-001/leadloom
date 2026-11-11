-- Shared-store hit log for public-route rate limiting (validator /v/ pages).
-- Replaces the per-process in-memory limiter so the limit holds across
-- replicas and restarts. Rows are ephemeral: hits older than the window are
-- deleted opportunistically by the limiter.
CREATE TABLE "public_rate_limit_hits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(255) NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_rate_limit_hits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "public_rate_limit_hits_key_ts_idx" ON "public_rate_limit_hits"("key", "ts");
CREATE INDEX "public_rate_limit_hits_ts_idx" ON "public_rate_limit_hits"("ts");
