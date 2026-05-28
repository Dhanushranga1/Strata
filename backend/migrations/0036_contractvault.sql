-- ContractVault: Vendor directory + contract lifecycle management
-- Connects to AssetLog (linked_assets), tickets, and CASPER insights.

-- ── Vendors ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app.vendors (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid         NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    name             text         NOT NULL,
    category         text         CHECK (category IN (
                                    'hardware','software','saas','services',
                                    'telecom','cloud','maintenance','other')),
    website          text,
    support_email    text,
    support_phone    text,
    account_manager  text,
    account_manager_email text,
    address          text,
    notes            text,
    is_preferred     bool         NOT NULL DEFAULT false,
    created_by       uuid         REFERENCES auth.users(id),
    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_org ON app.vendors(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON app.vendors(organization_id, name);

CREATE OR REPLACE FUNCTION app.trg_vendors_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_vendors_updated ON app.vendors;
CREATE TRIGGER trg_vendors_updated
    BEFORE UPDATE ON app.vendors
    FOR EACH ROW EXECUTE FUNCTION app.trg_vendors_updated();


-- ── Contracts ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app.contracts (
    id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      uuid         NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    vendor_id            uuid         REFERENCES app.vendors(id) ON DELETE SET NULL,
    contract_number      text,
    title                text         NOT NULL,
    status               text         NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('draft','active','expired','terminated','renewed')),
    contract_type        text         CHECK (contract_type IN (
                                       'service','hardware','software_license','maintenance',
                                       'support','lease','nda','sla','cloud','other')),
    description          text,
    start_date           date,
    end_date             date,
    renewal_date         date,
    auto_renews          bool         NOT NULL DEFAULT false,
    renewal_notice_days  int          NOT NULL DEFAULT 30,

    -- Financials
    total_value          numeric(14,2),
    currency             text         NOT NULL DEFAULT 'USD',
    payment_schedule     text         CHECK (payment_schedule IN ('one_time','monthly','quarterly','annual','custom')),
    payment_amount       numeric(14,2),

    -- Key terms stored as structured JSON
    key_terms            jsonb        NOT NULL DEFAULT '{}',
    -- e.g. {"sla_response_hours": 4, "uptime_guarantee": "99.9%", "support_hours": "24x7"}

    -- Document link (Supabase Storage URL or external)
    document_url         text,

    -- Responsible person
    owner_id             uuid         REFERENCES auth.users(id),

    created_by           uuid         REFERENCES auth.users(id),
    updated_by           uuid         REFERENCES auth.users(id),
    created_at           timestamptz  NOT NULL DEFAULT now(),
    updated_at           timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_org        ON app.contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_vendor     ON app.contracts(organization_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status     ON app.contracts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date   ON app.contracts(organization_id, end_date) WHERE end_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_renewal    ON app.contracts(organization_id, renewal_date) WHERE renewal_date IS NOT NULL;

CREATE OR REPLACE FUNCTION app.trg_contracts_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_contracts_updated ON app.contracts;
CREATE TRIGGER trg_contracts_updated
    BEFORE UPDATE ON app.contracts
    FOR EACH ROW EXECUTE FUNCTION app.trg_contracts_updated();


-- ── Contract ↔ Asset junction ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app.contract_assets (
    contract_id  uuid NOT NULL REFERENCES app.contracts(id) ON DELETE CASCADE,
    asset_id     uuid NOT NULL REFERENCES app.assets(id)    ON DELETE CASCADE,
    linked_at    timestamptz NOT NULL DEFAULT now(),
    linked_by    uuid REFERENCES auth.users(id),
    PRIMARY KEY (contract_id, asset_id)
);


-- ── Contract history (audit trail) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app.contract_history (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id   uuid         NOT NULL REFERENCES app.contracts(id) ON DELETE CASCADE,
    organization_id uuid       NOT NULL,
    changed_by    uuid         REFERENCES auth.users(id),
    event_type    text         NOT NULL,
    field_changed text,
    old_value     text,
    new_value     text,
    note          text,
    created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_history_contract
    ON app.contract_history(contract_id, created_at DESC);
