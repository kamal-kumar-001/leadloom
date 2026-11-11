-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "first_name" VARCHAR(120),
    "last_name" VARCHAR(120),
    "company_name" VARCHAR(200),
    "title" VARCHAR(200),
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_recipients_campaign_id_email_key" ON "campaign_recipients"("campaign_id", "email");

-- CreateIndex
CREATE INDEX "campaign_recipients_workspace_id_idx" ON "campaign_recipients"("workspace_id");

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
