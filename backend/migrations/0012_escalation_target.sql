-- Migration 0012: Add escalation target tracking to tickets
-- Allows reps to specify who a ticket is escalated to, and record when escalation happened.

alter table app.tickets
  add column if not exists escalated_to uuid references auth.users(id) on delete set null,
  add column if not exists escalated_at timestamptz;

-- Partial index — only tickets that are actually escalated to someone
create index if not exists idx_tickets_escalated_to
  on app.tickets(escalated_to)
  where escalated_to is not null;
