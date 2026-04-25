-- Migration 0015: Overdue tracking on tickets
-- is_overdue: set to true by the background scan when ticket exceeds threshold
-- overdue_notified_at: updated each time a notification email is sent (first + reminders)

alter table app.tickets
  add column if not exists is_overdue           boolean     not null default false,
  add column if not exists overdue_notified_at  timestamptz;

-- Partial index for the background scan query
create index if not exists idx_tickets_overdue_scan
  on app.tickets(organization_id, is_overdue, overdue_notified_at)
  where status not in ('resolved', 'closed');
