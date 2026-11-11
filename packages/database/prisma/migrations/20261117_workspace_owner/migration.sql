-- Workspace owner marker. Additive. No new role: the creator of a workspace is its owner.
-- The owner cannot be demoted or removed by anyone else, and only the owner may grant or
-- take the admin role. Ownership transfer is intentionally not built.
ALTER TABLE workspaces ADD COLUMN owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
-- Backfill: the earliest-created admin of each existing workspace (for current data, its creator).
UPDATE workspaces w SET owner_user_id = u.id
  FROM (SELECT DISTINCT ON (workspace_id) workspace_id, id FROM users WHERE role = 'admin' ORDER BY workspace_id, created_at ASC) u
 WHERE u.workspace_id = w.id AND w.owner_user_id IS NULL;
