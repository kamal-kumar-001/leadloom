-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "plan" VARCHAR(32) NOT NULL DEFAULT 'free',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(255),
    "password_hash" TEXT,
    "role" VARCHAR(16) NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tables" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "columns" (
    "id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "order_index" INTEGER NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 200,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rows" (
    "id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cells" (
    "table_id" UUID NOT NULL,
    "id" UUID NOT NULL,
    "row_id" UUID NOT NULL,
    "column_id" UUID NOT NULL,
    "value" JSONB,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_experiments" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "verdict" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "verdict_score" INTEGER,
    "actionable_summary" TEXT,
    "icp_spec" JSONB,
    "sequence_subject" TEXT,
    "sequence_body" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "validation_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smoke_test_pages" (
    "id" UUID NOT NULL,
    "experiment_id" UUID NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "headline" TEXT NOT NULL,
    "subheadline" TEXT NOT NULL,
    "hero_cta_text" VARCHAR(255) NOT NULL DEFAULT 'Request Early Access',
    "survey_questions" JSONB NOT NULL DEFAULT '[]',
    "custom_domain" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "smoke_test_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_leads" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(255),
    "company" VARCHAR(255),
    "survey_responses" JSONB NOT NULL DEFAULT '{}',
    "referrer" VARCHAR(512),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "byok_credentials" (
    "masked_key" TEXT NOT NULL,
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "label" VARCHAR(255),
    "encrypted_key_ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "auth_tag" BYTEA NOT NULL,
    "wrapped_dek" BYTEA NOT NULL,
    "dek_iv" BYTEA NOT NULL,
    "dek_auth_tag" BYTEA NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "algorithm" VARCHAR(32) NOT NULL DEFAULT 'aes-256-gcm',
    "is_valid" BOOLEAN NOT NULL DEFAULT false,
    "quota_remaining" INTEGER,
    "last_verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "byok_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrichment_cache" (
    "id" UUID NOT NULL,
    "cache_key" VARCHAR(255) NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "payload" JSONB NOT NULL,
    "embedding" vector(1536),
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrichment_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "next_dispatch_at" TIMESTAMPTZ,
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "table_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'draft',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "daily_limit_total" INTEGER NOT NULL DEFAULT 50,
    "schedule_timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailboxes" (
    "next_dispatch_at" TIMESTAMPTZ,
    "last_sent_at" TIMESTAMPTZ,
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "smtp_host" VARCHAR(255) NOT NULL,
    "smtp_port" INTEGER NOT NULL DEFAULT 587,
    "imap_host" VARCHAR(255),
    "imap_port" INTEGER DEFAULT 993,
    "encrypted_access_token" BYTEA,
    "access_token_iv" BYTEA,
    "access_token_auth_tag" BYTEA,
    "encrypted_refresh_token" BYTEA,
    "refresh_token_iv" BYTEA,
    "refresh_token_auth_tag" BYTEA,
    "wrapped_access_dek" BYTEA,
    "access_dek_iv" BYTEA,
    "access_dek_auth_tag" BYTEA,
    "wrapped_refresh_dek" BYTEA,
    "refresh_dek_iv" BYTEA,
    "refresh_dek_auth_tag" BYTEA,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "token_expires_at" TIMESTAMPTZ,
    "spf_status" VARCHAR(16) NOT NULL DEFAULT 'unknown',
    "dkim_status" VARCHAR(16) NOT NULL DEFAULT 'unknown',
    "dmarc_status" VARCHAR(16) NOT NULL DEFAULT 'unknown',
    "health_score" INTEGER NOT NULL DEFAULT 0,
    "daily_send_limit" INTEGER NOT NULL DEFAULT 50,
    "sent_today" INTEGER NOT NULL DEFAULT 0,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "last_health_check_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_mailboxes" (
    "campaign_id" UUID NOT NULL,
    "mailbox_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,

    CONSTRAINT "campaign_mailboxes_pkey" PRIMARY KEY ("campaign_id","mailbox_id")
);

-- CreateTable
CREATE TABLE "outreach_events" (
    "id" UUID NOT NULL,
    "campaign_id" UUID,
    "mailbox_id" UUID,
    "type" VARCHAR(32) NOT NULL,
    "lead_email" VARCHAR(320),
    "classification" VARCHAR(32),
    "confidence" DOUBLE PRECISION,
    "message_id" VARCHAR(512),
    "subject" TEXT,
    "body_text" TEXT,
    "event_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppression_list" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "email_hash" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(255),
    "source" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppression_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_jobs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "mailbox_id" UUID,
    "recipient_email" VARCHAR(320) NOT NULL,
    "recipient_hash" VARCHAR(64) NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "step_number" INTEGER NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "reserved_at" TIMESTAMPTZ,
    "provider_message_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "outbound_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_daily_usage" (
    "campaign_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "reserved_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "campaign_daily_usage_pkey" PRIMARY KEY ("campaign_id","day")
);

-- CreateTable
CREATE TABLE "mailbox_daily_usage" (
    "mailbox_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "reserved_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "mailbox_daily_usage_pkey" PRIMARY KEY ("mailbox_id","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_workspace_id_idx" ON "users"("workspace_id");

-- CreateIndex
CREATE INDEX "tables_workspace_id_idx" ON "tables"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "tables_id_workspace_id_key" ON "tables"("id", "workspace_id");

-- CreateIndex
CREATE INDEX "columns_table_id_idx" ON "columns"("table_id");

-- CreateIndex
CREATE UNIQUE INDEX "columns_id_table_id_key" ON "columns"("id", "table_id");

-- CreateIndex
CREATE INDEX "rows_table_id_idx" ON "rows"("table_id");

-- CreateIndex
CREATE UNIQUE INDEX "rows_id_table_id_key" ON "rows"("id", "table_id");

-- CreateIndex
CREATE UNIQUE INDEX "cells_row_id_column_id_key" ON "cells"("row_id", "column_id");

-- CreateIndex
CREATE INDEX "validation_experiments_workspace_id_idx" ON "validation_experiments"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "smoke_test_pages_slug_key" ON "smoke_test_pages"("slug");

-- CreateIndex
CREATE INDEX "waitlist_leads_page_id_idx" ON "waitlist_leads"("page_id");

-- CreateIndex
CREATE INDEX "byok_credentials_workspace_id_provider_idx" ON "byok_credentials"("workspace_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "enrichment_cache_cache_key_key" ON "enrichment_cache"("cache_key");

-- CreateIndex
CREATE INDEX "enrichment_cache_domain_idx" ON "enrichment_cache"("domain");

-- CreateIndex
CREATE INDEX "enrichment_cache_expires_at_idx" ON "enrichment_cache"("expires_at");

-- CreateIndex
CREATE INDEX "campaigns_workspace_id_idx" ON "campaigns"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_id_workspace_id_key" ON "campaigns"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "mailboxes_id_workspace_id_key" ON "mailboxes"("id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "mailboxes_workspace_id_email_key" ON "mailboxes"("workspace_id", "email");

-- CreateIndex
CREATE INDEX "outreach_events_campaign_id_event_at_idx" ON "outreach_events"("campaign_id", "event_at");

-- CreateIndex
CREATE INDEX "outreach_events_mailbox_id_event_at_idx" ON "outreach_events"("mailbox_id", "event_at");

-- CreateIndex
CREATE UNIQUE INDEX "suppression_list_workspace_id_email_hash_key" ON "suppression_list"("workspace_id", "email_hash");

-- CreateIndex
CREATE INDEX "outbound_jobs_workspace_id_campaign_id_status_scheduled_at_idx" ON "outbound_jobs"("workspace_id", "campaign_id", "status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_jobs_workspace_id_idempotency_key_key" ON "outbound_jobs"("workspace_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "columns" ADD CONSTRAINT "columns_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rows" ADD CONSTRAINT "rows_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cells" ADD CONSTRAINT "cells_row_id_table_id_fkey" FOREIGN KEY ("row_id", "table_id") REFERENCES "rows"("id", "table_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cells" ADD CONSTRAINT "cells_column_id_table_id_fkey" FOREIGN KEY ("column_id", "table_id") REFERENCES "columns"("id", "table_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_experiments" ADD CONSTRAINT "validation_experiments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smoke_test_pages" ADD CONSTRAINT "smoke_test_pages_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "validation_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_leads" ADD CONSTRAINT "waitlist_leads_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "smoke_test_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "byok_credentials" ADD CONSTRAINT "byok_credentials_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_table_id_workspace_id_fkey" FOREIGN KEY ("table_id", "workspace_id") REFERENCES "tables"("id", "workspace_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_mailboxes" ADD CONSTRAINT "campaign_mailboxes_campaign_id_workspace_id_fkey" FOREIGN KEY ("campaign_id", "workspace_id") REFERENCES "campaigns"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_mailboxes" ADD CONSTRAINT "campaign_mailboxes_mailbox_id_workspace_id_fkey" FOREIGN KEY ("mailbox_id", "workspace_id") REFERENCES "mailboxes"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_events" ADD CONSTRAINT "outreach_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_events" ADD CONSTRAINT "outreach_events_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppression_list" ADD CONSTRAINT "suppression_list_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_jobs" ADD CONSTRAINT "outbound_jobs_campaign_id_workspace_id_fkey" FOREIGN KEY ("campaign_id", "workspace_id") REFERENCES "campaigns"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_daily_usage" ADD CONSTRAINT "campaign_daily_usage_campaign_id_workspace_id_fkey" FOREIGN KEY ("campaign_id", "workspace_id") REFERENCES "campaigns"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_daily_usage" ADD CONSTRAINT "mailbox_daily_usage_mailbox_id_workspace_id_fkey" FOREIGN KEY ("mailbox_id", "workspace_id") REFERENCES "mailboxes"("id", "workspace_id") ON DELETE CASCADE ON UPDATE CASCADE;

