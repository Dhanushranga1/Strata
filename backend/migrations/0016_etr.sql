-- Migration 0016: Expected Time to Resolve (ETR) on tickets
-- Reps set expected_resolve_at to prevent tickets going overdue prematurely.
-- etr_reminder_sent prevents duplicate "1 hour before" reminder emails.

alter table app.tickets
  add column if not exists expected_resolve_at  timestamptz,
  add column if not exists etr_set_by           uuid references auth.users(id) on delete set null,
  add column if not exists etr_set_at           timestamptz,
  add column if not exists etr_reminder_sent    boolean not null default false;

-- Partial index for background ETR reminder scan
create index if not exists idx_tickets_etr
  on app.tickets(expected_resolve_at, etr_reminder_sent)
  where expected_resolve_at is not null and status not in ('resolved', 'closed');
