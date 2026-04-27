-- Add per-org isolation to FAISS snapshots.
-- Previously the table had a single global snapshot; now each org owns its own rows.
-- Existing rows are migrated to the '__global__' sentinel org_id used by legacy callers.

ALTER TABLE app.faiss_snapshots
  ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT '__global__';

-- Back-fill existing rows
UPDATE app.faiss_snapshots
  SET organization_id = '__global__'
  WHERE organization_id = '__global__';  -- idempotent no-op after first run

-- Index for efficient per-org snapshot lookups (ORDER BY created_at DESC LIMIT 1)
CREATE INDEX IF NOT EXISTS idx_faiss_snapshots_org_created
  ON app.faiss_snapshots (organization_id, created_at DESC);

-- Remove the DEFAULT so future inserts must always supply an org_id
ALTER TABLE app.faiss_snapshots
  ALTER COLUMN organization_id DROP DEFAULT;
