-- Add organization_id to ai_runs table for per-org AI analytics filtering
ALTER TABLE app.ai_runs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES app.organizations(id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_org_id ON app.ai_runs(organization_id);

-- Backfill organization_id from tickets table
UPDATE app.ai_runs ar
SET organization_id = t.organization_id
FROM app.tickets t
WHERE ar.ticket_id = t.id AND ar.organization_id IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE app.ai_runs ALTER COLUMN organization_id SET NOT NULL;
