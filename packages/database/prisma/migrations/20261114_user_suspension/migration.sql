-- Per-user suspension marker. Additive and nullable: NULL = not suspended.
-- Workspace suspension already exists as workspaces.is_active.
ALTER TABLE users ADD COLUMN disabled_at TIMESTAMPTZ;
