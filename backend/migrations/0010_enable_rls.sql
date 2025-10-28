-- Migration 0010: Enable Row-Level Security (RLS) for Multi-Tenancy
-- Purpose: Enable RLS policies to enforce organization-level data isolation at the database level
-- Date: Phase 2 Implementation
-- Dependencies: Requires 0009_migrate_existing_data.sql

-- ============================================================================
-- IMPORTANT: ROW-LEVEL SECURITY OVERVIEW
-- ============================================================================
-- RLS enforces data isolation at the PostgreSQL level, ensuring:
-- 1. Users can only see data from organizations they're members of
-- 2. Even if application code has bugs, database prevents cross-org access
-- 3. Service role can bypass RLS for admin/migration operations
-- 4. Supabase Auth automatically provides user context via auth.uid()

-- ============================================================================
-- STEP 1: ENABLE RLS ON ALL MULTI-TENANT TABLES
-- ============================================================================

-- Enable RLS on organizations (users can only see orgs they're members of)
alter table app.organizations enable row level security;

-- Enable RLS on organization_members (users can see their own memberships)
alter table app.organization_members enable row level security;

-- Enable RLS on tickets (users can only see tickets from their orgs)
alter table app.tickets enable row level security;

-- Enable RLS on messages (users can only see messages from their orgs)
alter table app.messages enable row level security;

-- Enable RLS on documents (users can only see documents from their orgs)
alter table app.documents enable row level security;

-- Enable RLS on chunks (users can only see chunks from their orgs)
alter table app.chunks enable row level security;

-- ============================================================================
-- STEP 2: HELPER FUNCTION - GET USER'S ORGANIZATIONS
-- ============================================================================

-- Function to get all organization IDs that a user is a member of
create or replace function app.user_organizations(user_uuid uuid)
returns table(organization_id uuid) as $$
begin
  return query
  select om.organization_id
  from app.organization_members om
  where om.user_id = user_uuid;
end;
$$ language plpgsql stable security definer;

-- ============================================================================
-- STEP 3: RLS POLICIES FOR ORGANIZATIONS TABLE
-- ============================================================================

-- Policy: Users can view organizations they are members of
drop policy if exists organizations_select_policy on app.organizations;
create policy organizations_select_policy on app.organizations
  for select
  using (
    id in (select organization_id from app.user_organizations(auth.uid()))
  );

-- Policy: Only organization owners can update organization details
drop policy if exists organizations_update_policy on app.organizations;
create policy organizations_update_policy on app.organizations
  for update
  using (
    id in (
      select organization_id
      from app.organization_members
      where user_id = auth.uid()
        and role = 'owner'
    )
  );

-- Policy: Any authenticated user can create an organization
drop policy if exists organizations_insert_policy on app.organizations;
create policy organizations_insert_policy on app.organizations
  for insert
  with check (true);  -- Will be validated in application code

-- Policy: Only owners can delete (soft delete via is_active recommended)
drop policy if exists organizations_delete_policy on app.organizations;
create policy organizations_delete_policy on app.organizations
  for delete
  using (
    id in (
      select organization_id
      from app.organization_members
      where user_id = auth.uid()
        and role = 'owner'
    )
  );

-- ============================================================================
-- STEP 4: RLS POLICIES FOR ORGANIZATION_MEMBERS TABLE
-- ============================================================================

-- Policy: Users can view members of organizations they belong to
drop policy if exists org_members_select_policy on app.organization_members;
create policy org_members_select_policy on app.organization_members
  for select
  using (
    organization_id in (select organization_id from app.user_organizations(auth.uid()))
  );

-- Policy: Owners and admins can add members to their organizations
drop policy if exists org_members_insert_policy on app.organization_members;
create policy org_members_insert_policy on app.organization_members
  for insert
  with check (
    organization_id in (
      select om.organization_id
      from app.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

-- Policy: Owners and admins can update member roles
drop policy if exists org_members_update_policy on app.organization_members;
create policy org_members_update_policy on app.organization_members
  for update
  using (
    organization_id in (
      select om.organization_id
      from app.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

-- Policy: Owners and admins can remove members (with owner protection from trigger)
drop policy if exists org_members_delete_policy on app.organization_members;
create policy org_members_delete_policy on app.organization_members
  for delete
  using (
    organization_id in (
      select om.organization_id
      from app.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

-- ============================================================================
-- STEP 5: RLS POLICIES FOR TICKETS
-- ============================================================================

-- Policy: Users can view tickets from their organizations
drop policy if exists tickets_select_policy on app.tickets;
create policy tickets_select_policy on app.tickets
  for select
  using (
    organization_id in (select organization_id from app.user_organizations(auth.uid()))
  );

-- Policy: Users can create tickets in their organizations
drop policy if exists tickets_insert_policy on app.tickets;
create policy tickets_insert_policy on app.tickets
  for insert
  with check (
    organization_id in (select organization_id from app.user_organizations(auth.uid()))
  );

-- Policy: Ticket owners, reps, and admins can update tickets
drop policy if exists tickets_update_policy on app.tickets;
create policy tickets_update_policy on app.tickets
  for update
  using (
    organization_id in (select organization_id from app.user_organizations(auth.uid()))
    and (
      created_by = auth.uid()  -- Ticket owner can update
      or exists (
        select 1 from app.organization_members om
        where om.organization_id = tickets.organization_id
          and om.user_id = auth.uid()
          and om.role in ('rep', 'admin', 'owner')  -- Reps/admins can update any ticket
      )
    )
  );

-- Policy: Only admins and owners can delete tickets
drop policy if exists tickets_delete_policy on app.tickets;
create policy tickets_delete_policy on app.tickets
  for delete
  using (
    exists (
      select 1 from app.organization_members om
      where om.organization_id = tickets.organization_id
        and om.user_id = auth.uid()
        and om.role in ('admin', 'owner')
    )
  );

-- ============================================================================
-- STEP 6: RLS POLICIES FOR MESSAGES
-- ============================================================================

-- Policy: Users can view messages from their organizations
drop policy if exists messages_select_policy on app.messages;
create policy messages_select_policy on app.messages
  for select
  using (
    organization_id in (select organization_id from app.user_organizations(auth.uid()))
  );

-- Policy: Users can create messages in their organizations' tickets
drop policy if exists messages_insert_policy on app.messages;
create policy messages_insert_policy on app.messages
  for insert
  with check (
    organization_id in (select organization_id from app.user_organizations(auth.uid()))
    and sender_id = auth.uid()  -- Can only send messages as yourself
  );

-- Policy: Users cannot update or delete messages (immutable)
-- If you need to support editing, add policies here

-- ============================================================================
-- STEP 7: RLS POLICIES FOR DOCUMENTS (Knowledge Base)
-- ============================================================================

-- Policy: Users can view documents from their organizations
drop policy if exists documents_select_policy on app.documents;
create policy documents_select_policy on app.documents
  for select
  using (
    organization_id in (select organization_id from app.user_organizations(auth.uid()))
  );

-- Policy: Admins, owners, and reps can create documents
drop policy if exists documents_insert_policy on app.documents;
create policy documents_insert_policy on app.documents
  for insert
  with check (
    organization_id in (
      select om.organization_id
      from app.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('rep', 'admin', 'owner')
    )
  );

-- Policy: Admins and owners can update documents
drop policy if exists documents_update_policy on app.documents;
create policy documents_update_policy on app.documents
  for update
  using (
    exists (
      select 1 from app.organization_members om
      where om.organization_id = documents.organization_id
        and om.user_id = auth.uid()
        and om.role in ('admin', 'owner')
    )
  );

-- Policy: Admins and owners can delete documents
drop policy if exists documents_delete_policy on app.documents;
create policy documents_delete_policy on app.documents
  for delete
  using (
    exists (
      select 1 from app.organization_members om
      where om.organization_id = documents.organization_id
        and om.user_id = auth.uid()
        and om.role in ('admin', 'owner')
    )
  );

-- ============================================================================
-- STEP 8: RLS POLICIES FOR CHUNKS
-- ============================================================================

-- Policy: Users can view chunks from their organizations
drop policy if exists chunks_select_policy on app.chunks;
create policy chunks_select_policy on app.chunks
  for select
  using (
    organization_id in (select organization_id from app.user_organizations(auth.uid()))
  );

-- Policy: Admins, owners, and reps can create chunks (via document upload)
drop policy if exists chunks_insert_policy on app.chunks;
create policy chunks_insert_policy on app.chunks
  for insert
  with check (
    organization_id in (
      select om.organization_id
      from app.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('rep', 'admin', 'owner')
    )
  );

-- Policy: Admins and owners can delete chunks
drop policy if exists chunks_delete_policy on app.chunks;
create policy chunks_delete_policy on app.chunks
  for delete
  using (
    exists (
      select 1 from app.organization_members om
      where om.organization_id = chunks.organization_id
        and om.user_id = auth.uid()
        and om.role in ('admin', 'owner')
    )
  );

-- ============================================================================
-- STEP 9: RLS POLICIES FOR OPTIONAL TABLES
-- ============================================================================

-- AI Chats (if exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'ai_chats') then
    execute 'alter table app.ai_chats enable row level security';
    
    -- Users can view their org's chats
    execute 'drop policy if exists ai_chats_select_policy on app.ai_chats';
    execute 'create policy ai_chats_select_policy on app.ai_chats
      for select
      using (organization_id in (select organization_id from app.user_organizations(auth.uid())))';
    
    -- Users can create chats in their orgs
    execute 'drop policy if exists ai_chats_insert_policy on app.ai_chats';
    execute 'create policy ai_chats_insert_policy on app.ai_chats
      for insert
      with check (organization_id in (select organization_id from app.user_organizations(auth.uid())))';
    
    raise notice 'Enabled RLS on ai_chats';
  end if;
end $$;

-- AI Feedback (if exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'ai_feedback') then
    execute 'alter table app.ai_feedback enable row level security';
    
    execute 'drop policy if exists ai_feedback_select_policy on app.ai_feedback';
    execute 'create policy ai_feedback_select_policy on app.ai_feedback
      for select
      using (organization_id in (select organization_id from app.user_organizations(auth.uid())))';
    
    execute 'drop policy if exists ai_feedback_insert_policy on app.ai_feedback';
    execute 'create policy ai_feedback_insert_policy on app.ai_feedback
      for insert
      with check (organization_id in (select organization_id from app.user_organizations(auth.uid())))';
    
    raise notice 'Enabled RLS on ai_feedback';
  end if;
end $$;

-- ============================================================================
-- STEP 10: BYPASS RLS FOR SERVICE ROLE
-- ============================================================================

-- The service role (used by application backend) can bypass RLS
-- This is configured in Supabase settings, not in SQL
-- Ensure your backend uses the service role key for operations that need full access

-- ============================================================================
-- STEP 11: VERIFICATION QUERIES
-- ============================================================================

-- Check that RLS is enabled on all core tables
do $$
declare
  rls_status record;
begin
  for rls_status in
    select tablename, rowsecurity
    from pg_tables
    where schemaname = 'app'
      and tablename in ('organizations', 'organization_members', 'tickets', 'messages', 'documents', 'chunks')
  loop
    if not rls_status.rowsecurity then
      raise exception 'RLS not enabled on table: %', rls_status.tablename;
    else
      raise notice 'RLS enabled on table: %', rls_status.tablename;
    end if;
  end loop;
  
  raise notice 'RLS verification complete';
end $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Status: Row-Level Security enabled on all multi-tenant tables
-- All policies enforce organization-level data isolation
-- Service role can bypass RLS for admin operations
-- Next step: Implement organization middleware and API in application code
