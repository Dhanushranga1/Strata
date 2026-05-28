-- IncidentBridge: Incident management + post-mortem

CREATE TABLE IF NOT EXISTS app.incidents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text,
  severity            text NOT NULL CHECK (severity IN ('p1','p2','p3','p4')),
  status              text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','investigating','identified','monitoring','resolved')),
  commander_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  root_cause          text,
  resolution          text,
  timeline            jsonb NOT NULL DEFAULT '[]',
  affected_services   text[] NOT NULL DEFAULT ARRAY[]::text[],
  linked_ticket_ids   uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  linked_change_id    uuid REFERENCES app.changes(id) ON DELETE SET NULL,
  declared_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  postmortem_done     bool NOT NULL DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.incident_postmortems (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id          uuid NOT NULL REFERENCES app.incidents(id) ON DELETE CASCADE UNIQUE,
  timeline_summary     text,
  root_cause           text NOT NULL DEFAULT '',
  contributing_factors text,
  what_went_well       text,
  what_went_poorly     text,
  action_items         jsonb DEFAULT '[]',
  written_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_org_status
  ON app.incidents(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_org_severity
  ON app.incidents(organization_id, severity, status);
CREATE INDEX IF NOT EXISTS idx_incidents_org_declared
  ON app.incidents(organization_id, declared_at DESC);

COMMENT ON TABLE app.incidents IS 'IncidentBridge: incident war room with live timeline';
COMMENT ON TABLE app.incident_postmortems IS 'IncidentBridge: post-incident review';
