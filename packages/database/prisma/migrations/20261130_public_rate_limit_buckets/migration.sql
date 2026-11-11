-- Replace the per-hit log with fixed-window bucket counters. One atomic
-- upsert per request (no count-then-insert race), one row per key per window
-- (bounded storage; denied requests update the same row instead of adding
-- one), so write amplification under abuse stays flat.
DROP TABLE "public_rate_limit_hits";

CREATE TABLE "public_rate_limit_buckets" (
    "key" VARCHAR(255) NOT NULL,
    "window_start" BIGINT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "public_rate_limit_buckets_pkey" PRIMARY KEY ("key", "window_start")
);

CREATE INDEX "public_rate_limit_buckets_window_start_idx" ON "public_rate_limit_buckets"("window_start");
