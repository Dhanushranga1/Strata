-- ServiceHub: Self-service employee portal catalog

CREATE TABLE IF NOT EXISTS app.service_catalog (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  category         text,
  icon             text DEFAULT 'LayoutGrid',
  form_schema      jsonb NOT NULL DEFAULT '[]',
  auto_assign_role text,
  sla_priority     int NOT NULL DEFAULT 3,
  estimated_time   text,
  sort_order       int NOT NULL DEFAULT 0,
  is_active        bool NOT NULL DEFAULT true,
  is_public        bool NOT NULL DEFAULT false,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_org_active
  ON app.service_catalog(organization_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_catalog_org_public
  ON app.service_catalog(organization_id, is_public, is_active)
  WHERE is_public = true;

COMMENT ON TABLE app.service_catalog IS 'ServiceHub: IT service catalog items for the employee portal';
