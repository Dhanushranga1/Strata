-- Phase 4: AI Chat with RAG - Database Migration
-- Extends messaging for AI chat functionality

-- 1) Allow AI/system roles in messages
ALTER TABLE app.messages
  DROP CONSTRAINT IF EXISTS app_messages_sender_role_check;

ALTER TABLE app.messages
  ADD CONSTRAINT app_messages_sender_role_check
  CHECK (sender_role IN ('customer','rep','system','ai'));

-- 2) Add metadata column for citations & confidence
ALTER TABLE app.messages
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

-- Create index on meta for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_meta ON app.messages USING gin(meta);

-- 3) Optional audit table for AI observability
CREATE TABLE IF NOT EXISTS app.ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES app.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  model TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  top_k INTEGER NOT NULL,
  confidence NUMERIC,
  suggest_escalation BOOLEAN,
  input_chars INTEGER,
  output_chars INTEGER,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for performance on AI runs
CREATE INDEX IF NOT EXISTS idx_ai_runs_ticket_time ON app.ai_runs(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_user_time ON app.ai_runs(user_id, created_at DESC);