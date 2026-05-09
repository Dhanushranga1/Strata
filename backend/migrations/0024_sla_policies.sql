-- SLA policies: per-org, per-priority first-response and resolution targets
CREATE TABLE IF NOT EXISTS app.sla_policies (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID         NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    priority_level        INT          NOT NULL CHECK (priority_level BETWEEN 1 AND 7),
    first_response_hours  NUMERIC(6,2) NOT NULL DEFAULT 0,
    resolution_hours      NUMERIC(6,2) NOT NULL DEFAULT 24,
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, priority_level)
);

CREATE INDEX IF NOT EXISTS idx_sla_policies_org
    ON app.sla_policies (organization_id)
    WHERE is_active = TRUE;

-- Track first rep response time on tickets for SLA reporting
ALTER TABLE app.tickets
    ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_first_response
    ON app.tickets (organization_id, first_response_at)
    WHERE first_response_at IS NULL AND status NOT IN ('resolved', 'closed');
