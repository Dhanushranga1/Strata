-- ─── Portal: customer-facing ticket submission ────────────────────────────────
-- Add submitter info columns so guest (unauthenticated) portal submissions
-- can store the customer's name + email without requiring a Supabase account.
-- source column tracks how the ticket entered the system.

ALTER TABLE app.tickets
  ADD COLUMN IF NOT EXISTS submitter_email TEXT,
  ADD COLUMN IF NOT EXISTS submitter_name  TEXT,
  ADD COLUMN IF NOT EXISTS source          TEXT DEFAULT 'internal'
    CHECK (source IN ('internal', 'portal', 'email', 'api'));

CREATE INDEX IF NOT EXISTS idx_tickets_submitter_email
  ON app.tickets(organization_id, submitter_email)
  WHERE submitter_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_source
  ON app.tickets(organization_id, source);

-- ─── API Keys: per-org programmatic access ────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL,
  name            TEXT NOT NULL,
  key_prefix      TEXT NOT NULL,           -- first 8 chars shown in UI (e.g. "sk_live_")
  key_hash        TEXT NOT NULL UNIQUE,    -- SHA-256 of full key — never stored plain
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org
  ON app.api_keys(organization_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_api_keys_hash
  ON app.api_keys(key_hash)
  WHERE is_active = true;
