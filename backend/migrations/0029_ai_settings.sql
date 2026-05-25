-- Runtime AI settings — allows admin to configure models/keys via UI
-- instead of relying solely on environment variables.
CREATE TABLE IF NOT EXISTS app.ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Enforce singleton: only one row allowed
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_settings_singleton ON app.ai_settings((true));

-- Insert default row (no-op if already exists)
INSERT INTO app.ai_settings (id, config)
VALUES (gen_random_uuid(), '{}'::jsonb)
ON CONFLICT DO NOTHING;
