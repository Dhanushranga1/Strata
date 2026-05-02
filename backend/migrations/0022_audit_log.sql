-- Migration 0022: Platform-wide audit log (Sprint 4)
-- Read-only append-only log. Never DELETE rows.

CREATE TABLE IF NOT EXISTS app.audit_log (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id      UUID,
    actor_email   TEXT        NOT NULL DEFAULT '',
    action        TEXT        NOT NULL,
    resource_type TEXT        NOT NULL DEFAULT '',
    resource_id   TEXT        NOT NULL DEFAULT '',
    org_id        UUID,
    metadata      JSONB       NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at  ON app.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id      ON app.audit_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id    ON app.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action      ON app.audit_log (action);
