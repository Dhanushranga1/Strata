create schema if not exists app;

create table if not exists app.user_roles (
  user_id uuid primary key,
  role text not null check (role in ('customer','rep','admin')),
  created_at timestamptz default now()
);

-- Optional helper view to join email from auth.users
create or replace view app.v_user_roles as
select
  ur.user_id,
  ur.role,
  u.email,
  ur.created_at
from app.user_roles ur
left join auth.users u on u.id = ur.user_id;