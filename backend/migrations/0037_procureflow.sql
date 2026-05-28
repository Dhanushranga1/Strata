-- ProcureFlow: Purchase requests, approvals, PO tracking
-- Linked to ContractVault vendors and AssetLog assets

CREATE TABLE IF NOT EXISTS app.purchase_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  requested_by     uuid NOT NULL REFERENCES auth.users(id),
  approved_by      uuid REFERENCES auth.users(id),
  vendor_id        uuid REFERENCES app.vendors(id) ON DELETE SET NULL,
  title            text NOT NULL,
  description      text,
  quantity         int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price       numeric(12,2),
  department       text,
  justification    text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected','ordered','delivered','cancelled')),
  po_number        text,
  ordered_at       timestamptz,
  delivered_at     timestamptz,
  linked_asset_id  uuid REFERENCES app.assets(id) ON DELETE SET NULL,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_org_status
  ON app.purchase_requests(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_org_requester
  ON app.purchase_requests(organization_id, requested_by);

COMMENT ON TABLE app.purchase_requests IS 'ProcureFlow: purchase request lifecycle tracking';
