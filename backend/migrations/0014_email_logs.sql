-- Migration 0014: Email audit log
-- Tracks every email sent to prevent duplicates and support auditing.

create table if not exists app.email_logs (
  id          uuid        primary key default gen_random_uuid(),
  ticket_id   uuid        references app.tickets(id) on delete set null,
  org_id      uuid        references app.organizations(id) on delete cascade,
  email_type  text        not null,   -- 'new_ticket' | 'ai_failure' | 'overdue' | 'overdue_reminder'
  to_email    text        not null,
  subject     text,
  success     boolean     not null default true,
  sent_at     timestamptz not null default now()
);

create index if not exists idx_email_logs_ticket on app.email_logs(ticket_id)
  where ticket_id is not null;
create index if not exists idx_email_logs_org on app.email_logs(org_id);
create index if not exists idx_email_logs_type_sent on app.email_logs(email_type, sent_at desc);
