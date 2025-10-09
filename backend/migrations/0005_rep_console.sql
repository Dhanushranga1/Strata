-- Phase 5: Rep Console & Escalation
-- Extend tickets table with escalated status, needs_attention flag, priority field

CREATE SCHEMA IF NOT EXISTS app;

-- Extend status enum to include 'escalated'
ALTER TABLE app.tickets
  DROP CONSTRAINT IF EXISTS app_tickets_status_check;
ALTER TABLE app.tickets
  ADD CONSTRAINT app_tickets_status_check
  CHECK (status IN ('open','in_progress','resolved','closed','escalated'));

-- Add triage fields
ALTER TABLE app.tickets
  ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high'));

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tickets_needs_attention ON app.tickets(needs_attention);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON app.tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON app.tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_tickets_last_message_at ON app.tickets(last_message_at DESC);

-- Optional view for quick ticket glance
CREATE OR REPLACE VIEW app.v_ticket_glance AS
SELECT 
  t.id,
  t.title,
  t.status,
  t.needs_attention,
  t.priority,
  t.assignee_id,
  t.message_count,
  t.last_message_at,
  t.created_by,
  t.created_at
FROM app.tickets t;