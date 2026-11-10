-- Plan assignment and usage counters for server-side entitlement enforcement.
-- Additive only. No row exists = no plan = deny by default. Plan definitions
-- live in config (not here); this table only says which plan a workspace is on.
CREATE TABLE workspace_plans (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('none','trialing','active','past_due','canceled')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- period is 'YYYY-MM' (UTC) for monthly limits and 'total' for absolute ones.
CREATE TABLE usage_counters (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  limit_key VARCHAR(48) NOT NULL,
  period VARCHAR(7) NOT NULL,
  used BIGINT NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY (workspace_id, limit_key, period)
);
