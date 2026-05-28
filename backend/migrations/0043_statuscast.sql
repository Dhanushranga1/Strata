-- StatusCast: Public service status page

CREATE TABLE IF NOT EXISTS app.status_services (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  sort_order       int NOT NULL DEFAULT 0,
  is_active        bool NOT NULL DEFAULT true,
  current_status   text NOT NULL DEFAULT 'operational'
                   CHECK (current_status IN (
                     'operational','degraded','partial_outage','major_outage','maintenance'
                   )),
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.status_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  service_id       uuid REFERENCES app.status_services(id) ON DELETE SET NULL,
  title            text NOT NULL,
  body             text,
  status_impact    text NOT NULL DEFAULT 'none'
                   CHECK (status_impact IN (
                     'none','degraded','partial_outage','major_outage','resolved','maintenance'
                   )),
  incident_id      uuid REFERENCES app.incidents(id) ON DELETE SET NULL,
  posted_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_services_org
  ON app.status_services(organization_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_status_history_org
  ON app.status_history(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_history_svc
  ON app.status_history(service_id, created_at DESC);

COMMENT ON TABLE app.status_services IS 'StatusCast: tracked services with current status';
COMMENT ON TABLE app.status_history IS 'StatusCast: append-only incident/update history';
