-- Org plan tier + AI usage metering
ALTER TABLE app.organizations
  ADD COLUMN IF NOT EXISTS plan_id text
    NOT NULL DEFAULT 'community'
    CHECK (plan_id IN ('community','starter','business','enterprise'));

CREATE TABLE IF NOT EXISTS app.org_usage (
  organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  month_start     date NOT NULL,
  ai_queries_used int  NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, month_start)
);
