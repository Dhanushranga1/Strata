-- Migration 0013: Numeric priority level (1–7) on tickets
-- priority_level replaces the old low/normal/high enum over time.
-- 1 = lowest urgency (1 week SLA), 7 = highest (7 hrs SLA).
-- The old `priority` enum column is kept for backward compat.

alter table app.tickets
  add column if not exists priority_level int check (priority_level between 1 and 7);

-- Index for the attention-threshold background scan
create index if not exists idx_tickets_priority_level
  on app.tickets(organization_id, priority_level)
  where priority_level is not null and status not in ('resolved', 'closed');
