create schema if not exists app;

-- 1) Tickets
create table if not exists app.tickets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,                              -- auth.users.id (ticket owner)
  assignee_id uuid,                                      -- future use (rep assignment)
  title text not null check (length(title) between 3 and 120),
  description text not null check (length(description) between 10 and 4000),
  status text not null default 'open' check (status in ('open','closed')),
  message_count int not null default 0,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tickets_created_at on app.tickets(created_at desc);
create index if not exists idx_tickets_status on app.tickets(status);
create index if not exists idx_tickets_owner on app.tickets(created_by);
create index if not exists idx_tickets_last_message on app.tickets(last_message_at desc);

-- 2) Messages
create table if not exists app.messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references app.tickets(id) on delete cascade,
  sender_id uuid not null,
  sender_role text not null check (sender_role in ('customer','rep','system')),
  body text not null check (length(body) between 1 and 8000),
  created_at timestamptz default now()
);

create index if not exists idx_messages_ticket_time on app.messages(ticket_id, created_at);
create index if not exists idx_messages_sender on app.messages(sender_id);