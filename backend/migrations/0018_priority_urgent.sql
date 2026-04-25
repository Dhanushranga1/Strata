-- Migration 0018: Add 'urgent' to the priority check constraint
-- The original constraint only allowed low|normal|high.
-- We now support low|normal|high|urgent (added with ticket creation priority selector).

ALTER TABLE app.tickets
  DROP CONSTRAINT IF EXISTS tickets_priority_check;

ALTER TABLE app.tickets
  ADD CONSTRAINT tickets_priority_check
    CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
