-- Migration 0011: Organization Invite System
-- Creates the app.invites table to support email-based rep onboarding.
-- Invites are scoped to an organization and expire after 7 days.

CREATE TABLE IF NOT EXISTS app.invites (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid       NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  email          text        NOT NULL,
  role           text        NOT NULL DEFAULT 'rep'
                             CHECK (role IN ('admin', 'rep', 'member')),
  token          text        NOT NULL UNIQUE
                             DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by     uuid        NOT NULL,   -- auth.users.id of the inviter
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at     timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at     timestamptz          DEFAULT now()
);

-- Fast token lookups (primary access pattern: /invite/{token})
CREATE INDEX IF NOT EXISTS idx_invites_token
  ON app.invites(token);

-- Quick duplicate-invite check per org+email
CREATE INDEX IF NOT EXISTS idx_invites_org_email
  ON app.invites(organization_id, email);

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE app.invites ENABLE ROW LEVEL SECURITY;

-- Org owners/admins can see all invites for their org
DROP POLICY IF EXISTS invites_select_policy ON app.invites;
CREATE POLICY invites_select_policy ON app.invites
  FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM app.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Org owners/admins can create invites for their org
DROP POLICY IF EXISTS invites_insert_policy ON app.invites;
CREATE POLICY invites_insert_policy ON app.invites
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM app.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Org owners/admins can update invite status (e.g. mark expired)
DROP POLICY IF EXISTS invites_update_policy ON app.invites;
CREATE POLICY invites_update_policy ON app.invites
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM app.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Note: the backend service-role connection bypasses RLS for the public
-- GET /api/invites/{token} endpoint (no auth.uid() available there).
