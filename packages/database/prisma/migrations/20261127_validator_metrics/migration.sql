-- Validator metrics persistence: raw counters the scorecard derives rates
-- from. waitlistCount/pageConversions come from waitlist_leads row counts, so
-- no duplicate counter is stored for those.
ALTER TABLE "smoke_test_pages" ADD COLUMN "visitors" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "validation_experiments" ADD COLUMN "outreach_sent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "validation_experiments" ADD COLUMN "replies" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "validation_experiments" ADD COLUMN "positive_replies" INTEGER NOT NULL DEFAULT 0;
