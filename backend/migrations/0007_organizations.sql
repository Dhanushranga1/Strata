-- Migration 0007: Organizations and Multi-Tenancy Foundation
-- Purpose: Create organizations and organization_members tables to enable multi-tenant architecture
-- Date: Phase 2 Implementation
-- Dependencies: Requires 0001_user_roles.sql

create schema if not exists app;

-- ============================================================================
-- 1. ORGANIZATIONS TABLE
-- ============================================================================
-- The primary organizations table - each tenant gets one organization
create table if not exists app.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 100),
  slug text not null unique check (slug ~* '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  domain text,                                        -- Optional: custom domain for organization
  settings jsonb default '{}'::jsonb,                 -- Organization-specific settings
  is_active boolean default true,                     -- Soft delete / deactivation flag
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for organizations
create index if not exists idx_organizations_slug on app.organizations(slug);
create index if not exists idx_organizations_is_active on app.organizations(is_active);
create index if not exists idx_organizations_created_at on app.organizations(created_at desc);

-- ============================================================================
-- 2. ORGANIZATION MEMBERS TABLE
-- ============================================================================
-- Junction table linking users to organizations with roles
create table if not exists app.organization_members (
  organization_id uuid not null references app.organizations(id) on delete cascade,
  user_id uuid not null references app.user_roles(user_id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'rep', 'member')),
  joined_at timestamptz default now(),
  invited_by uuid,                                    -- User who invited this member
  
  -- Composite primary key
  primary key (organization_id, user_id)
);

-- Indexes for organization_members
create index if not exists idx_org_members_user on app.organization_members(user_id);
create index if not exists idx_org_members_org on app.organization_members(organization_id);
create index if not exists idx_org_members_role on app.organization_members(role);

-- ============================================================================
-- 3. HELPER VIEWS
-- ============================================================================

-- View to easily see organization members with user details
create or replace view app.v_organization_members as
select
  om.organization_id,
  om.user_id,
  om.role,
  om.joined_at,
  om.invited_by,
  o.name as organization_name,
  o.slug as organization_slug,
  u.email as user_email
from app.organization_members om
join app.organizations o on o.id = om.organization_id
left join auth.users u on u.id = om.user_id;

-- View to easily see user's organizations
create or replace view app.v_user_organizations as
select
  u.id as user_id,
  u.email,
  o.id as organization_id,
  o.name as organization_name,
  o.slug as organization_slug,
  o.is_active,
  om.role as role_in_org,
  om.joined_at
from auth.users u
join app.organization_members om on om.user_id = u.id
join app.organizations o on o.id = om.organization_id
order by om.joined_at desc;

-- ============================================================================
-- 4. FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
create or replace function app.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at on organizations
drop trigger if exists update_organizations_updated_at on app.organizations;
create trigger update_organizations_updated_at
  before update on app.organizations
  for each row
  execute function app.update_updated_at_column();

-- ============================================================================
-- 5. RESERVED SLUGS
-- ============================================================================
-- Prevent use of reserved slugs for organizations
create table if not exists app.reserved_slugs (
  slug text primary key,
  reason text
);

insert into app.reserved_slugs (slug, reason) values
  ('api', 'System reserved'),
  ('admin', 'System reserved'),
  ('app', 'System reserved'),
  ('auth', 'System reserved'),
  ('billing', 'System reserved'),
  ('default', 'System reserved'),
  ('docs', 'System reserved'),
  ('help', 'System reserved'),
  ('login', 'System reserved'),
  ('logout', 'System reserved'),
  ('pricing', 'System reserved'),
  ('register', 'System reserved'),
  ('settings', 'System reserved'),
  ('support', 'System reserved'),
  ('system', 'System reserved'),
  ('www', 'System reserved')
on conflict (slug) do nothing;

-- ============================================================================
-- 6. BUSINESS RULE CONSTRAINTS
-- ============================================================================

-- Function to ensure every organization has at least one owner
create or replace function app.check_organization_has_owner()
returns trigger as $$
declare
  owner_count int;
begin
  -- On DELETE or UPDATE to non-owner role, check if org still has owners
  if (tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.role != 'owner')) then
    select count(*) into owner_count
    from app.organization_members
    where organization_id = old.organization_id
      and role = 'owner'
      and (tg_op = 'DELETE' or user_id != old.user_id);
    
    if owner_count = 0 then
      raise exception 'Cannot remove last owner from organization';
    end if;
  end if;
  
  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql;

-- Trigger to enforce at least one owner per organization
drop trigger if exists ensure_organization_has_owner on app.organization_members;
create trigger ensure_organization_has_owner
  before delete or update on app.organization_members
  for each row
  when (old.role = 'owner')
  execute function app.check_organization_has_owner();

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================

comment on table app.organizations is 'Multi-tenant organizations table - each tenant is an organization';
comment on column app.organizations.slug is 'Unique URL-friendly identifier for organization (lowercase, alphanumeric, hyphens)';
comment on column app.organizations.settings is 'JSONB field for organization-specific settings and preferences';
comment on column app.organizations.is_active is 'Soft delete flag - inactive organizations are hidden but data preserved';

comment on table app.organization_members is 'Junction table for many-to-many user-organization relationship with roles';
comment on column app.organization_members.role is 'User role within organization: owner (full control), admin (manage users/settings), rep (handle tickets), member (basic access)';

comment on table app.reserved_slugs is 'System-reserved organization slugs that cannot be registered';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run 0008_add_organization_id.sql to add organization_id to existing tables
-- 2. Run 0009_migrate_existing_data.sql to migrate existing data
-- 3. Run 0010_enable_rls.sql to enable row-level security
