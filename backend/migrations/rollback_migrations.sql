-- Rollback Script for Phase 2 Multi-Tenancy Migrations
-- Purpose: Safely rollback database changes if migration fails or needs to be reversed
-- Usage: Run via psql: psql $SUPABASE_DB_URL -f rollback_migrations.sql
-- WARNING: This will remove all organization data and relationships

-- ============================================================================
-- STEP 1: DISABLE RLS POLICIES (Reverse of 0010_enable_rls.sql)
-- ============================================================================

-- Drop all RLS policies
drop policy if exists organizations_select_policy on app.organizations;
drop policy if exists organizations_update_policy on app.organizations;
drop policy if exists organizations_insert_policy on app.organizations;
drop policy if exists organizations_delete_policy on app.organizations;

drop policy if exists org_members_select_policy on app.organization_members;
drop policy if exists org_members_insert_policy on app.organization_members;
drop policy if exists org_members_update_policy on app.organization_members;
drop policy if exists org_members_delete_policy on app.organization_members;

drop policy if exists tickets_select_policy on app.tickets;
drop policy if exists tickets_insert_policy on app.tickets;
drop policy if exists tickets_update_policy on app.tickets;
drop policy if exists tickets_delete_policy on app.tickets;

drop policy if exists messages_select_policy on app.messages;
drop policy if exists messages_insert_policy on app.messages;

drop policy if exists documents_select_policy on app.documents;
drop policy if exists documents_insert_policy on app.documents;
drop policy if exists documents_update_policy on app.documents;
drop policy if exists documents_delete_policy on app.documents;

drop policy if exists chunks_select_policy on app.chunks;
drop policy if exists chunks_insert_policy on app.chunks;
drop policy if exists chunks_delete_policy on app.chunks;

-- Disable RLS on tables
alter table app.organizations disable row level security;
alter table app.organization_members disable row level security;
alter table app.tickets disable row level security;
alter table app.messages disable row level security;
alter table app.documents disable row level security;
alter table app.chunks disable row level security;

-- Drop helper function
drop function if exists app.user_organizations(uuid);

-- Optional tables
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'ai_chats') then
    execute 'drop policy if exists ai_chats_select_policy on app.ai_chats';
    execute 'drop policy if exists ai_chats_insert_policy on app.ai_chats';
    execute 'alter table app.ai_chats disable row level security';
  end if;
  
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'ai_feedback') then
    execute 'drop policy if exists ai_feedback_select_policy on app.ai_feedback';
    execute 'drop policy if exists ai_feedback_insert_policy on app.ai_feedback';
    execute 'alter table app.ai_feedback disable row level security';
  end if;
end $$;

-- ============================================================================
-- STEP 2: REMOVE ORGANIZATION_ID COLUMNS (Reverse of 0008_add_organization_id.sql)
-- ============================================================================

-- Drop constraints and indexes first
alter table app.tickets drop constraint if exists fk_tickets_organization;
drop index if exists app.idx_tickets_organization;
drop index if exists app.idx_tickets_org_status;
drop index if exists app.idx_tickets_org_created;

alter table app.messages drop constraint if exists fk_messages_organization;
drop index if exists app.idx_messages_organization;
drop index if exists app.idx_messages_org_ticket;

alter table app.documents drop constraint if exists fk_documents_organization;
drop index if exists app.idx_documents_organization;
drop index if exists app.idx_documents_org_created;

alter table app.chunks drop constraint if exists fk_chunks_organization;
drop index if exists app.idx_chunks_organization;
drop index if exists app.idx_chunks_org_doc;

-- Drop organization_id columns
alter table app.tickets drop column if exists organization_id;
alter table app.messages drop column if exists organization_id;
alter table app.documents drop column if exists organization_id;
alter table app.chunks drop column if exists organization_id;

-- Optional tables
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'app' and table_name = 'ai_chats' and column_name = 'organization_id') then
    execute 'alter table app.ai_chats drop constraint if exists fk_ai_chats_organization';
    execute 'drop index if exists app.idx_ai_chats_organization';
    execute 'alter table app.ai_chats drop column organization_id';
  end if;
  
  if exists (select 1 from information_schema.columns where table_schema = 'app' and table_name = 'ai_chat_messages' and column_name = 'organization_id') then
    execute 'alter table app.ai_chat_messages drop constraint if exists fk_ai_chat_messages_organization';
    execute 'drop index if exists app.idx_ai_chat_messages_organization';
    execute 'alter table app.ai_chat_messages drop column organization_id';
  end if;
  
  if exists (select 1 from information_schema.columns where table_schema = 'app' and table_name = 'ai_feedback' and column_name = 'organization_id') then
    execute 'alter table app.ai_feedback drop constraint if exists fk_ai_feedback_organization';
    execute 'drop index if exists app.idx_ai_feedback_organization';
    execute 'alter table app.ai_feedback drop column organization_id';
  end if;
  
  if exists (select 1 from information_schema.columns where table_schema = 'app' and table_name = 'rep_stats' and column_name = 'organization_id') then
    execute 'alter table app.rep_stats drop constraint if exists fk_rep_stats_organization';
    execute 'drop index if exists app.idx_rep_stats_organization';
    execute 'alter table app.rep_stats drop column organization_id';
  end if;
end $$;

-- ============================================================================
-- STEP 3: DROP ORGANIZATIONS TABLES (Reverse of 0007_organizations.sql)
-- ============================================================================

-- Drop triggers
drop trigger if exists ensure_organization_has_owner on app.organization_members;
drop trigger if exists update_organizations_updated_at on app.organizations;

-- Drop functions
drop function if exists app.check_organization_has_owner();
drop function if exists app.update_updated_at_column();

-- Drop views
drop view if exists app.v_user_organizations;
drop view if exists app.v_organization_members;

-- Drop tables (cascade will handle foreign keys)
drop table if exists app.organization_members cascade;
drop table if exists app.organizations cascade;
drop table if exists app.reserved_slugs cascade;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify tables are dropped
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'organizations') then
    raise exception 'Rollback failed: organizations table still exists';
  end if;
  
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'organization_members') then
    raise exception 'Rollback failed: organization_members table still exists';
  end if;
  
  -- Check organization_id columns are removed
  if exists (select 1 from information_schema.columns where table_schema = 'app' and table_name = 'tickets' and column_name = 'organization_id') then
    raise exception 'Rollback failed: tickets.organization_id still exists';
  end if;
  
  raise notice 'Rollback completed successfully';
end $$;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
-- Database restored to pre-Phase 2 state
-- All organization data and relationships removed
-- Original schema structure restored
