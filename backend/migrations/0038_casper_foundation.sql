-- CASPER Foundation Layer
-- Tracks entity embeddings for cross-entity semantic search
-- and logs tool executions for auditability.

-- ── Entity embedding index ────────────────────────────────────────────────────
-- Tracks which entities have been embedded and their FAISS IDs.
-- Supports: ticket, asset, contract, kb_article, knowbase_article, procurement
CREATE TABLE IF NOT EXISTS app.entity_embeddings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    entity_type     text NOT NULL, -- 'ticket', 'asset', 'contract', 'kb_article', ...
    entity_id       uuid NOT NULL,
    faiss_id        integer,
    last_embedded   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_emb_org_type
    ON app.entity_embeddings (organization_id, entity_type);

-- ── CASPER tool call audit log ────────────────────────────────────────────────
-- Every tool execution is logged for observability and debugging.
CREATE TABLE IF NOT EXISTS app.casper_tool_calls (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    ticket_id       uuid REFERENCES app.tickets(id) ON DELETE SET NULL,
    user_id         uuid,
    tool_name       text NOT NULL,
    params          jsonb DEFAULT '{}',
    result_success  boolean,
    result_action   text,
    result_message  text,
    executed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_casper_tool_calls_org
    ON app.casper_tool_calls (organization_id, executed_at DESC);

-- ── Entity correlation cache ──────────────────────────────────────────────────
-- Cached cross-entity correlations surfaced on ticket creation.
CREATE TABLE IF NOT EXISTS app.casper_correlations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    source_type     text NOT NULL, -- 'ticket'
    source_id       uuid NOT NULL,
    target_type     text NOT NULL, -- 'kb_chunk', 'asset', 'contract', ...
    target_id       text NOT NULL,
    target_label    text,
    score           numeric(5,4),
    snippet         text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, source_type, source_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_casper_correlations_source
    ON app.casper_correlations (organization_id, source_type, source_id);

COMMENT ON TABLE app.entity_embeddings IS
    'CASPER Foundation: tracks FAISS IDs for all embedded entities across modules';
COMMENT ON TABLE app.casper_tool_calls IS
    'CASPER Foundation: audit log of all tool executions triggered by the AI engine';
COMMENT ON TABLE app.casper_correlations IS
    'CASPER Foundation: cached cross-entity correlations surfaced on ticket creation';
