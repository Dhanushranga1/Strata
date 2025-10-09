-- Phase 5A: Admin Roles and Role Requests (Idempotent)
-- This migration can be safely run multiple times

create schema if not exists app;
create extension if not exists pgcrypto;

-- 1) User roles table (server-side source of truth)
create table if not exists app.user_roles (
  user_id uuid primary key,
  role text not null check (role in ('customer','rep','admin')),
  created_at timestamptz default now()
);

-- 2) Role requests table (optional workflow)
create table if not exists app.role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','denied','cancelled')),
  created_at timestamptz default now(),
  decided_at timestamptz
);

-- Unique constraint: only one pending request per user
create unique index if not exists ux_role_requests_user_pending
  on app.role_requests(user_id) where status = 'pending';

-- Index for admin queries
create index if not exists idx_role_requests_status on app.role_requests(status);
create index if not exists idx_role_requests_created_at on app.role_requests(created_at desc);

-- 3) Convenience view for admin interface
create or replace view app.v_users_roles as
select
  u.id as user_id,
  u.email,
  coalesce(r.role, 'customer') as role,
  coalesce(r.created_at, u.created_at) as role_updated_at
from auth.users u
left join app.user_roles r on r.user_id = u.id;

-- 4) Function to normalize role values (helper)
create or replace function app.normalize_role(input_role text)
returns text as $$
begin
  return lower(trim(input_role));
end;
$$ language plpgsql immutable;

-- Note: Run manually to create your first admin:
-- insert into app.user_roles (user_id, role)
-- values ('YOUR_UUID', 'admin')
-- on conflict (user_id) do update set role = excluded.role, created_at = now();