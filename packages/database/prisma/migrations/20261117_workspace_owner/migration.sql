-- Workspace owner marker. Additive. No new role: the creator of a workspace is its owner.
-- The owner cannot be demoted or removed by anyone else, and only the owner may grant or
-- take the admin role. Ownership transfer is intentionally not built.
ALTER TABLE workspaces ADD COLUMN owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
-- Backfill only where provenance is unambiguous. The engine's own audit log records who created each
-- workspace (user.provisioned or user.registered, written in the same transaction as the workspace).
-- A workspace gets an owner only when exactly one such creation record exists for it, that user still
-- belongs to it and is an admin. Anything else (operator-created, fixtures, several or no records)
-- stays NULL and is reported; with no owner, owner-only actions are denied. Nothing is guessed from age.
UPDATE workspaces w SET owner_user_id = c.id
  FROM (
    SELECT a.workspace_id, (array_agg(DISTINCT a.target))[1] AS target, count(DISTINCT a.target) AS n
      FROM audit_log a WHERE a.action IN ('user.provisioned', 'user.registered') AND a.target = a.actor_user_id::text
     GROUP BY a.workspace_id
  ) rec
  JOIN users c ON c.id::text = rec.target AND c.workspace_id = rec.workspace_id AND c.role = 'admin'
 WHERE w.id = rec.workspace_id AND rec.n = 1 AND w.owner_user_id IS NULL;
