-- CASPER Proactive Intelligence: persistent insight store
-- Agents write here; frontend reads here; actions execute from here.

CREATE TABLE IF NOT EXISTS app.casper_insights (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  uuid         NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    insight_type     text         NOT NULL,
    severity         text         NOT NULL CHECK (severity IN ('critical','warning','notice','info')),
    title            text         NOT NULL,
    body             text,
    action_type      text,           -- what action CASPER recommends
    action_payload   jsonb        NOT NULL DEFAULT '{}',
    ref_type         text,           -- 'asset', 'license', 'contract'
    ref_id           uuid,
    ref_label        text,           -- human-readable ref (asset_tag, product name, etc.)
    is_dismissed     bool         NOT NULL DEFAULT false,
    dismissed_at     timestamptz,
    dismissed_by     uuid         REFERENCES auth.users(id),
    auto_actioned    bool         NOT NULL DEFAULT false,
    auto_actioned_at timestamptz,
    created_at       timestamptz  NOT NULL DEFAULT now(),
    refreshed_at     timestamptz  NOT NULL DEFAULT now(),
    expires_at       timestamptz,
    -- Prevent duplicate insights for same entity
    UNIQUE (organization_id, insight_type, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_casper_insights_active
    ON app.casper_insights(organization_id, is_dismissed, severity, created_at DESC)
    WHERE is_dismissed = false;

CREATE INDEX IF NOT EXISTS idx_casper_insights_ref
    ON app.casper_insights(organization_id, ref_type, ref_id);

-- Track when CASPER last scanned each org
CREATE TABLE IF NOT EXISTS app.casper_agent_runs (
    organization_id  uuid         NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    agent_name       text         NOT NULL,
    last_run_at      timestamptz  NOT NULL DEFAULT now(),
    insights_created int          NOT NULL DEFAULT 0,
    insights_updated int          NOT NULL DEFAULT 0,
    run_duration_ms  int,
    error_message    text,
    PRIMARY KEY (organization_id, agent_name)
);
