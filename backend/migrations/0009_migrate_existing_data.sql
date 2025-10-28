-- Migration 0009: Migrate Existing Data to Default Organization
-- Purpose: Create a default organization and assign all existing data to it
-- Date: Phase 2 Implementation
-- Dependencies: Requires 0008_add_organization_id.sql

-- ============================================================================
-- STEP 1: CREATE DEFAULT ORGANIZATION
-- ============================================================================

-- Check if default organization already exists
do $$
declare
  default_org_id uuid;
begin
  -- Try to find existing default organization
  select id into default_org_id
  from app.organizations
  where slug = 'default-org'
  limit 1;
  
  -- If not found, create it
  if default_org_id is null then
    insert into app.organizations (name, slug, domain, settings, is_active)
    values (
      'Default Organization',
      'default-org',
      null,
      jsonb_build_object('auto_created', true, 'migration_date', now()::text),
      true
    )
    returning id into default_org_id;
    
    raise notice 'Created default organization with ID: %', default_org_id;
  else
    raise notice 'Default organization already exists with ID: %', default_org_id;
  end if;
end $$;

-- ============================================================================
-- STEP 2: MIGRATE EXISTING USERS TO DEFAULT ORGANIZATION
-- ============================================================================

-- Add all existing users as members of the default organization
insert into app.organization_members (organization_id, user_id, role, joined_at)
select
  (select id from app.organizations where slug = 'default-org'),
  user_id,
  case
    when role = 'admin' then 'owner'  -- Admins become owners of default org
    when role = 'rep' then 'rep'      -- Reps stay as reps
    else 'member'                     -- Customers become members
  end as org_role,
  created_at
from app.user_roles
where user_id not in (
  select user_id from app.organization_members
)
on conflict (organization_id, user_id) do nothing;

-- Log the migration
do $$
declare
  migrated_count int;
begin
  select count(*) into migrated_count
  from app.organization_members
  where organization_id = (select id from app.organizations where slug = 'default-org');
  
  raise notice 'Migrated % users to default organization', migrated_count;
end $$;

-- ============================================================================
-- STEP 3: MIGRATE EXISTING TICKETS
-- ============================================================================

-- Update all tickets without organization_id
update app.tickets
set organization_id = (select id from app.organizations where slug = 'default-org')
where organization_id is null;

-- Verify migration
do $$
declare
  migrated_count int;
  total_count int;
begin
  select count(*) into migrated_count from app.tickets where organization_id is not null;
  select count(*) into total_count from app.tickets;
  raise notice 'Migrated % of % tickets to default organization', migrated_count, total_count;
end $$;

-- ============================================================================
-- STEP 4: MIGRATE EXISTING MESSAGES
-- ============================================================================

-- Update all messages without organization_id
-- Inherit from parent ticket's organization
update app.messages m
set organization_id = t.organization_id
from app.tickets t
where m.ticket_id = t.id
  and m.organization_id is null;

-- Verify migration
do $$
declare
  migrated_count int;
  total_count int;
begin
  select count(*) into migrated_count from app.messages where organization_id is not null;
  select count(*) into total_count from app.messages;
  raise notice 'Migrated % of % messages to default organization', migrated_count, total_count;
end $$;

-- ============================================================================
-- STEP 5: MIGRATE EXISTING DOCUMENTS (Knowledge Base)
-- ============================================================================

-- Update all documents without organization_id
update app.documents
set organization_id = (select id from app.organizations where slug = 'default-org')
where organization_id is null;

-- Verify migration
do $$
declare
  migrated_count int;
  total_count int;
begin
  select count(*) into migrated_count from app.documents where organization_id is not null;
  select count(*) into total_count from app.documents;
  raise notice 'Migrated % of % documents to default organization', migrated_count, total_count;
end $$;

-- ============================================================================
-- STEP 6: MIGRATE EXISTING CHUNKS
-- ============================================================================

-- Update all chunks without organization_id
-- Inherit from parent document's organization
update app.chunks c
set organization_id = d.organization_id
from app.documents d
where c.doc_id = d.id
  and c.organization_id is null;

-- Verify migration
do $$
declare
  migrated_count int;
  total_count int;
begin
  select count(*) into migrated_count from app.chunks where organization_id is not null;
  select count(*) into total_count from app.chunks;
  raise notice 'Migrated % of % chunks to default organization', migrated_count, total_count;
end $$;

-- ============================================================================
-- STEP 7: MIGRATE OTHER TABLES (IF EXIST)
-- ============================================================================

-- AI Chats
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'ai_chats') then
    execute 'update app.ai_chats set organization_id = (select id from app.organizations where slug = ''default-org'') where organization_id is null';
    raise notice 'Migrated ai_chats to default organization';
  end if;
end $$;

-- AI Chat Messages
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'ai_chat_messages') then
    execute 'update app.ai_chat_messages set organization_id = (select id from app.organizations where slug = ''default-org'') where organization_id is null';
    raise notice 'Migrated ai_chat_messages to default organization';
  end if;
end $$;

-- AI Feedback
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'ai_feedback') then
    execute 'update app.ai_feedback set organization_id = (select id from app.organizations where slug = ''default-org'') where organization_id is null';
    raise notice 'Migrated ai_feedback to default organization';
  end if;
end $$;

-- Rep Stats
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'rep_stats') then
    execute 'update app.rep_stats set organization_id = (select id from app.organizations where slug = ''default-org'') where organization_id is null';
    raise notice 'Migrated rep_stats to default organization';
  end if;
end $$;

-- ============================================================================
-- STEP 8: MAKE ORGANIZATION_ID NOT NULL
-- ============================================================================

-- After migration, make organization_id required on core tables
alter table app.tickets
  alter column organization_id set not null;

alter table app.messages
  alter column organization_id set not null;

alter table app.documents
  alter column organization_id set not null;

alter table app.chunks
  alter column organization_id set not null;

-- For optional tables, only make NOT NULL if they exist and have data
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'ai_chats') then
    execute 'alter table app.ai_chats alter column organization_id set not null';
  end if;
  
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'ai_chat_messages') then
    execute 'alter table app.ai_chat_messages alter column organization_id set not null';
  end if;
  
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'ai_feedback') then
    execute 'alter table app.ai_feedback alter column organization_id set not null';
  end if;
  
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'rep_stats') then
    execute 'alter table app.rep_stats alter column organization_id set not null';
  end if;
end $$;

-- ============================================================================
-- STEP 9: VERIFICATION QUERIES
-- ============================================================================

-- Verify no NULL organization_ids remain
do $$
declare
  null_tickets int;
  null_messages int;
  null_documents int;
  null_chunks int;
begin
  select count(*) into null_tickets from app.tickets where organization_id is null;
  select count(*) into null_messages from app.messages where organization_id is null;
  select count(*) into null_documents from app.documents where organization_id is null;
  select count(*) into null_chunks from app.chunks where organization_id is null;
  
  if null_tickets > 0 or null_messages > 0 or null_documents > 0 or null_chunks > 0 then
    raise exception 'Migration incomplete: Found NULL organization_ids (tickets: %, messages: %, documents: %, chunks: %)',
      null_tickets, null_messages, null_documents, null_chunks;
  else
    raise notice 'Migration verification complete: No NULL organization_ids found';
  end if;
end $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Status: All existing data migrated to default organization
-- All organization_id columns are now NOT NULL
-- Next step: Run 0010_enable_rls.sql to enable row-level security
