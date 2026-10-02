-- 0036: Drop the stale 2-value ticket status constraint.
--
-- Migration 0003 created `tickets_status_check CHECK (status IN ('open','closed'))`.
-- Migration 0005_rep_console added the full constraint under the name
-- `app_tickets_status_check` but dropped the *wrong* name, so the legacy check
-- survives on any database migrated straight through (fresh deploys included).
-- Result: in_progress / resolved / escalated writes all 500.
--
-- `migrations/fixes/fix-escalated-status.sql` fixed this manually one-off;
-- this migration makes the fix permanent and auto-applied.
ALTER TABLE app.tickets
  DROP CONSTRAINT IF EXISTS tickets_status_check;
