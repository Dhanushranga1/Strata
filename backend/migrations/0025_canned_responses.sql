-- Canned responses: pre-written reply snippets for reps
CREATE TABLE IF NOT EXISTS app.canned_responses (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID        NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    title           TEXT        NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    body            TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
    tags            TEXT[]      NOT NULL DEFAULT '{}',
    created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canned_responses_org
    ON app.canned_responses (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_canned_responses_tags
    ON app.canned_responses USING GIN (tags);
