-- AssetLog — IT Asset & License Management
-- Complete schema: hardware assets, software licenses, lifecycle, repairs, history, alerts.

-- ── Per-org asset tag auto-numbering ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.asset_tag_sequences (
    organization_id uuid PRIMARY KEY REFERENCES app.organizations(id) ON DELETE CASCADE,
    prefix          text NOT NULL DEFAULT 'ASSET',
    next_number     int  NOT NULL DEFAULT 1
);

-- ── Core assets table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.assets (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    asset_tag        text NOT NULL,
    name             text NOT NULL,

    category         text NOT NULL DEFAULT 'other'
        CHECK (category IN (
            'laptop','desktop','server','phone','tablet','monitor',
            'network','printer','peripheral','software','cloud',
            'vehicle','furniture','other'
        )),

    status           text NOT NULL DEFAULT 'active'
        CHECK (status IN (
            'pending','active','deployed','in_repair','in_storage',
            'lost','retired','disposed'
        )),

    condition_rating text DEFAULT 'good'
        CHECK (condition_rating IN ('excellent','good','fair','poor','damaged')),

    -- Assignment
    assigned_to      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    department       text,
    location         text,   -- building / room / desk

    -- Flexible specs stored as JSONB
    -- Typical keys: serial_number, model, manufacturer, cpu, ram_gb,
    --               storage_gb, os, os_version, screen_size, color, imei,
    --               mac_address, ip_address
    specs            jsonb NOT NULL DEFAULT '{}',

    -- Purchase details
    purchase_date    date,
    purchase_price   numeric(12,2),
    currency         text NOT NULL DEFAULT 'USD',
    vendor_name      text,
    po_number        text,
    invoice_number   text,

    -- Warranty
    warranty_expiry  date,
    warranty_type    text NOT NULL DEFAULT 'manufacturer'
        CHECK (warranty_type IN ('manufacturer','extended','third_party','none')),
    warranty_notes   text,

    -- Lifecycle
    deployed_at      timestamptz,
    last_audited_at  timestamptz,
    retirement_date  date,
    disposal_method  text
        CHECK (disposal_method IN ('resale','donation','recycling','destroyed','returned_vendor') OR disposal_method IS NULL),
    disposal_notes   text,

    -- Depreciation (straight-line)
    depreciation_years int NOT NULL DEFAULT 3,

    -- Meta
    notes            text,
    tags             text[]        NOT NULL DEFAULT '{}',
    custom_fields    jsonb         NOT NULL DEFAULT '{}',

    created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now(),

    -- Asset tags must be unique within an org
    UNIQUE (organization_id, asset_tag)
);

-- ── Asset indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assets_org_status
    ON app.assets (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_org_category
    ON app.assets (organization_id, category);
CREATE INDEX IF NOT EXISTS idx_assets_org_assigned
    ON app.assets (organization_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_assets_warranty
    ON app.assets (warranty_expiry)
    WHERE warranty_expiry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_name_trgm
    ON app.assets USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_assets_tag_trgm
    ON app.assets USING gin (asset_tag gin_trgm_ops);

-- ── Asset change history ──────────────────────────────────────────────────────
-- Every state change, assignment, repair, or field edit is recorded here.
CREATE TABLE IF NOT EXISTS app.asset_history (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id        uuid NOT NULL REFERENCES app.assets(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL,
    changed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    -- event_type values:
    --   created, updated, assigned, unassigned, status_changed,
    --   repair_started, repair_returned, repair_cancelled,
    --   audited, retired, disposed, tag_changed
    event_type      text NOT NULL,
    field_changed   text,
    old_value       text,
    new_value       text,
    note            text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_history_asset
    ON app.asset_history (asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_history_org
    ON app.asset_history (organization_id, created_at DESC);

-- ── Repair records ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.asset_repairs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id        uuid NOT NULL REFERENCES app.assets(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL,
    sent_date       date NOT NULL,
    returned_date   date,
    vendor_name     text,
    description     text,
    repair_cost     numeric(12,2),
    ticket_id       uuid REFERENCES app.tickets(id) ON DELETE SET NULL,
    status          text NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent','returned','cancelled')),
    notes           text,
    created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_repairs_asset
    ON app.asset_repairs (asset_id);

-- ── Asset ↔ Ticket junction ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.asset_tickets (
    asset_id   uuid NOT NULL REFERENCES app.assets(id) ON DELETE CASCADE,
    ticket_id  uuid NOT NULL REFERENCES app.tickets(id) ON DELETE CASCADE,
    linked_at  timestamptz NOT NULL DEFAULT now(),
    linked_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    PRIMARY KEY (asset_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_tickets_ticket
    ON app.asset_tickets (ticket_id);

-- ── Software licenses ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.software_licenses (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    product_name     text NOT NULL,
    vendor           text,
    version          text,

    license_type     text NOT NULL DEFAULT 'subscription'
        CHECK (license_type IN (
            'perpetual','subscription','oem','volume','site','freeware','open_source'
        )),

    -- NULL seat_count = unlimited seats
    seat_count       int,
    seats_used       int NOT NULL DEFAULT 0,

    -- Masked in API responses (never returned in list, only in detail for admins)
    license_key      text,

    purchase_date    date,
    expiry_date      date,
    renewal_date     date,
    auto_renews      boolean NOT NULL DEFAULT false,

    cost_per_year    numeric(12,2),
    currency         text NOT NULL DEFAULT 'USD',
    vendor_contact   text,
    support_url      text,
    notes            text,

    created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licenses_org
    ON app.software_licenses (organization_id);
CREATE INDEX IF NOT EXISTS idx_licenses_expiry
    ON app.software_licenses (expiry_date)
    WHERE expiry_date IS NOT NULL;

-- ── License seat assignments ──────────────────────────────────────────────────
-- Each active (unassigned_at IS NULL) row = one seat consumed.
CREATE TABLE IF NOT EXISTS app.license_assignments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id      uuid NOT NULL REFERENCES app.software_licenses(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL,
    assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    asset_id        uuid REFERENCES app.assets(id) ON DELETE SET NULL,
    assigned_at     timestamptz NOT NULL DEFAULT now(),
    unassigned_at   timestamptz,
    assigned_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    notes           text,
    -- Must assign to a user OR an asset (or both)
    CONSTRAINT license_assignment_target CHECK (
        assigned_to IS NOT NULL OR asset_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_license_assignments_active
    ON app.license_assignments (license_id)
    WHERE unassigned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_license_assignments_user
    ON app.license_assignments (assigned_to)
    WHERE unassigned_at IS NULL;

-- ── Triggers ──────────────────────────────────────────────────────────────────

-- updated_at on assets
CREATE OR REPLACE FUNCTION app.touch_asset_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_assets_updated ON app.assets;
CREATE TRIGGER trg_assets_updated
    BEFORE UPDATE ON app.assets
    FOR EACH ROW EXECUTE FUNCTION app.touch_asset_updated();

-- updated_at on software_licenses
DROP TRIGGER IF EXISTS trg_licenses_updated ON app.software_licenses;
CREATE TRIGGER trg_licenses_updated
    BEFORE UPDATE ON app.software_licenses
    FOR EACH ROW EXECUTE FUNCTION app.touch_asset_updated();

-- Keep seats_used in sync automatically
CREATE OR REPLACE FUNCTION app.sync_license_seats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_TABLE_NAME = 'license_assignments' THEN
        UPDATE app.software_licenses
        SET seats_used = (
            SELECT COUNT(*) FROM app.license_assignments
            WHERE license_id = COALESCE(NEW.license_id, OLD.license_id)
              AND unassigned_at IS NULL
        )
        WHERE id = COALESCE(NEW.license_id, OLD.license_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_seats ON app.license_assignments;
CREATE TRIGGER trg_sync_seats
    AFTER INSERT OR UPDATE OR DELETE ON app.license_assignments
    FOR EACH ROW EXECUTE FUNCTION app.sync_license_seats();

-- ── Helper: mark overdue warranty alerts (callable via pg_cron) ───────────────
CREATE OR REPLACE FUNCTION app.get_warranty_alerts(p_org_id uuid)
RETURNS TABLE (
    asset_id        uuid,
    asset_name      text,
    asset_tag       text,
    warranty_expiry date,
    days_until      int,
    severity        text
) LANGUAGE sql AS $$
    SELECT
        id,
        name,
        asset_tag,
        warranty_expiry,
        (warranty_expiry - CURRENT_DATE)::int AS days_until,
        CASE
            WHEN warranty_expiry < CURRENT_DATE THEN 'expired'
            WHEN warranty_expiry <= CURRENT_DATE + 30  THEN 'critical'
            WHEN warranty_expiry <= CURRENT_DATE + 60  THEN 'warning'
            WHEN warranty_expiry <= CURRENT_DATE + 90  THEN 'notice'
        END AS severity
    FROM app.assets
    WHERE organization_id = p_org_id
      AND warranty_expiry IS NOT NULL
      AND warranty_expiry <= CURRENT_DATE + 90
      AND status NOT IN ('retired','disposed')
    ORDER BY warranty_expiry ASC;
$$;

COMMENT ON TABLE app.assets IS 'AssetLog: hardware and software assets with full lifecycle tracking';
COMMENT ON TABLE app.software_licenses IS 'AssetLog: software license pool with seat tracking';
COMMENT ON TABLE app.license_assignments IS 'AssetLog: active seat assignments per user/asset';
COMMENT ON TABLE app.asset_history IS 'AssetLog: immutable audit trail for every asset change';
COMMENT ON TABLE app.asset_repairs IS 'AssetLog: repair job records with cost and ticket linkage';
COMMENT ON TABLE app.asset_tickets IS 'AssetLog: many-to-many junction between assets and support tickets';
