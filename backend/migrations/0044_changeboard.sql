-- ChangeBoard: Lightweight Change Management

CREATE TABLE IF NOT EXISTS app.changes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  risk_level       text NOT NULL DEFAULT 'standard'
                   CHECK (risk_level IN ('low','standard','high','emergency')),
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','pending_approval','approved','scheduled',
                                     'in_progress','completed','failed','cancelled')),
  requested_by     uuid REFERENCES auth.users(id),
  approved_by      uuid REFERENCES auth.users(id),
  scheduled_at     timestamptz,
  completed_at     timestamptz,
  rollback_plan    text,
  linked_ticket_id uuid REFERENCES app.tickets(id),
  blackout_check   bool DEFAULT false,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.change_blackouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  start_at         timestamptz NOT NULL,
  end_at           timestamptz NOT NULL,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_changes_org_status
  ON app.changes(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_changes_org_scheduled
  ON app.changes(organization_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_change_blackouts_org_range
  ON app.change_blackouts(organization_id, start_at, end_at);

COMMENT ON TABLE app.changes IS 'ChangeBoard: RFC workflow with risk levels and approval gates';
COMMENT ON TABLE app.change_blackouts IS 'ChangeBoard: blackout windows that block high-risk changes';
