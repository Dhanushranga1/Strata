-- PatchWatch: Patch status tracking by device and severity

CREATE TABLE IF NOT EXISTS app.patch_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  asset_id         uuid REFERENCES app.assets(id) ON DELETE SET NULL,
  patch_name       text NOT NULL,
  cve_id           text,               -- e.g. CVE-2024-1234
  patch_severity   text NOT NULL DEFAULT 'medium'
                   CHECK (patch_severity IN ('critical','high','medium','low')),
  status           text NOT NULL DEFAULT 'needed'
                   CHECK (status IN ('needed','scheduled','applied','deferred','not_applicable')),
  scheduled_at     timestamptz,
  applied_at       timestamptz,
  applied_by       uuid REFERENCES auth.users(id),
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patch_records_org_status_sev
  ON app.patch_records(organization_id, status, patch_severity);

CREATE INDEX IF NOT EXISTS idx_patch_records_org_asset
  ON app.patch_records(organization_id, asset_id);

COMMENT ON TABLE app.patch_records IS 'PatchWatch: patch status per asset and severity';
