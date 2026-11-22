-- Read-only guard for a new Leadloom database, never a repair or upgrade step.
-- Existing user relations in any schema, or a separate user schema, require
-- independent target review. A preinstalled pgvector extension alone is allowed.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL search_path = pg_catalog;
DO $leadloom_fresh_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_namespace
    WHERE nspname !~ '^pg_' AND nspname NOT IN ('public', 'information_schema')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S', 'c')
  ) THEN
    RAISE EXCEPTION 'Fresh bootstrap refused: target contains existing user relations or schemas. No baseline migration was run.';
  END IF;
END;
$leadloom_fresh_guard$;
COMMIT;
