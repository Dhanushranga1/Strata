-- FlowBot: IF/THEN automation rule engine

CREATE TABLE IF NOT EXISTS app.automation_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  trigger_event    text NOT NULL,
  conditions       jsonb NOT NULL DEFAULT '[]',
  actions          jsonb NOT NULL DEFAULT '[]',
  is_active        bool NOT NULL DEFAULT true,
  run_count        int NOT NULL DEFAULT 0,
  last_run_at      timestamptz,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rules_org_active_trigger
  ON app.automation_rules(organization_id, trigger_event)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_rules_org_created
  ON app.automation_rules(organization_id, created_at DESC);

COMMENT ON TABLE app.automation_rules IS 'FlowBot: IF/THEN automation rules evaluated on ticket events';
