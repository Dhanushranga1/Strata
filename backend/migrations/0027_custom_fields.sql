-- Custom ticket field definitions per organisation
CREATE TABLE IF NOT EXISTS app.ticket_field_defs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID        NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
    label           TEXT        NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
    field_type      TEXT        NOT NULL CHECK (field_type IN ('text','number','select','date','boolean')),
    options         JSONB,
    is_required     BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    sort_order      INT         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_field_defs_org
    ON app.ticket_field_defs (organization_id, sort_order)
    WHERE is_active = TRUE;

-- Custom field values per ticket+field pair
CREATE TABLE IF NOT EXISTS app.ticket_field_values (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id    UUID        NOT NULL REFERENCES app.tickets(id) ON DELETE CASCADE,
    field_def_id UUID        NOT NULL REFERENCES app.ticket_field_defs(id) ON DELETE CASCADE,
    value_text   TEXT,
    value_number NUMERIC,
    value_date   DATE,
    value_bool   BOOLEAN,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ticket_id, field_def_id)
);

CREATE INDEX IF NOT EXISTS idx_field_values_ticket
    ON app.ticket_field_values (ticket_id);

CREATE INDEX IF NOT EXISTS idx_field_values_field_def
    ON app.ticket_field_values (field_def_id);
