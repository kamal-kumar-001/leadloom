BEGIN;
-- Keep the original request binding after table deletion. A retry must not recreate it.
ALTER TABLE table_import_receipts ADD COLUMN project_id UUID;
UPDATE table_import_receipts r SET project_id=t.project_id FROM tables t
 WHERE t.id=r.table_id AND t.workspace_id=r.workspace_id;
ALTER TABLE table_import_receipts DROP CONSTRAINT table_import_receipts_table_id_workspace_id_fkey;
-- Deliberately no table/project FK. Workspace deletion still removes the receipt.
COMMIT;
