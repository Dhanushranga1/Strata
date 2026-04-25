-- Fix: Add 'escalated' status and missing fields to tickets table
-- This is a partial execution of migration 0005_rep_console.sql

-- 1. Update status constraint to allow 'escalated'
ALTER TABLE app.tickets
  DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE app.tickets
  DROP CONSTRAINT IF EXISTS app_tickets_status_check;

ALTER TABLE app.tickets
  ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('open','in_progress','resolved','closed','escalated'));

-- 2. Add triage fields (if they don't exist)
ALTER TABLE app.tickets
  ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE app.tickets
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';

-- Add priority constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'app.tickets'::regclass 
    AND conname = 'tickets_priority_check'
  ) THEN
    ALTER TABLE app.tickets
      ADD CONSTRAINT tickets_priority_check
      CHECK (priority IN ('low','normal','high'));
  END IF;
END $$;

-- 3. Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tickets_needs_attention ON app.tickets(needs_attention);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON app.tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON app.tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_tickets_last_message_at ON app.tickets(last_message_at DESC);

-- 4. Create view for quick ticket glance
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

-- Verify the changes
SELECT 
  'Status Constraint' as check_type,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'app.tickets'::regclass
  AND contype = 'c'
  AND conname LIKE '%status%'

UNION ALL

SELECT 
  'Priority Constraint' as check_type,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'app.tickets'::regclass
  AND contype = 'c'
  AND conname LIKE '%priority%';

-- Show added columns
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'app'
  AND table_name = 'tickets'
  AND column_name IN ('needs_attention', 'priority')
ORDER BY column_name;
