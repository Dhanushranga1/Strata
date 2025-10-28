-- Migration 0008: Add organization_id to Existing Tables
-- Purpose: Add organization_id column to all user-data tables for multi-tenant data isolation
-- Date: Phase 2 Implementation
-- Dependencies: Requires 0007_organizations.sql

-- ============================================================================
-- 1. ADD ORGANIZATION_ID TO TICKETS
-- ============================================================================

-- Add organization_id column (nullable initially for migration)
alter table app.tickets
  add column if not exists organization_id uuid;

-- Add foreign key constraint
alter table app.tickets
  add constraint fk_tickets_organization
  foreign key (organization_id)
  references app.organizations(id)
  on delete cascade;

-- Add index for performance (tickets are frequently queried by organization)
create index if not exists idx_tickets_organization on app.tickets(organization_id);

-- Add composite index for common queries (org + status, org + created_at)
create index if not exists idx_tickets_org_status on app.tickets(organization_id, status);
create index if not exists idx_tickets_org_created on app.tickets(organization_id, created_at desc);

-- ============================================================================
-- 2. ADD ORGANIZATION_ID TO MESSAGES
-- ============================================================================

-- Add organization_id column (nullable initially)
alter table app.messages
  add column if not exists organization_id uuid;

-- Add foreign key constraint
alter table app.messages
  add constraint fk_messages_organization
  foreign key (organization_id)
  references app.organizations(id)
  on delete cascade;

-- Add index for performance
create index if not exists idx_messages_organization on app.messages(organization_id);

-- Add composite index (org + ticket_id for filtering messages by org)
create index if not exists idx_messages_org_ticket on app.messages(organization_id, ticket_id);

-- ============================================================================
-- 3. ADD ORGANIZATION_ID TO DOCUMENTS (Knowledge Base)
-- ============================================================================

-- Add organization_id column (nullable initially)
alter table app.documents
  add column if not exists organization_id uuid;

-- Add foreign key constraint
alter table app.documents
  add constraint fk_documents_organization
  foreign key (organization_id)
  references app.organizations(id)
  on delete cascade;

-- Add index for performance
create index if not exists idx_documents_organization on app.documents(organization_id);

-- Add composite index (org + created_at for listing documents by org)
create index if not exists idx_documents_org_created on app.documents(organization_id, created_at desc);

-- ============================================================================
-- 4. ADD ORGANIZATION_ID TO CHUNKS (Knowledge Base)
-- ============================================================================

-- Add organization_id column (nullable initially)
alter table app.chunks
  add column if not exists organization_id uuid;

-- Add foreign key constraint
alter table app.chunks
  add constraint fk_chunks_organization
  foreign key (organization_id)
  references app.organizations(id)
  on delete cascade;

-- Add index for performance (chunks are searched frequently)
create index if not exists idx_chunks_organization on app.chunks(organization_id);

-- Add composite index (org + doc_id for filtering chunks by org)
create index if not exists idx_chunks_org_doc on app.chunks(organization_id, doc_id);

-- ============================================================================
-- 5. CHECK FOR OTHER TABLES THAT NEED ORGANIZATION_ID
-- ============================================================================
-- Note: Additional tables from later migrations may need organization_id:
-- - Any AI chat tables
-- - Any rep console tables
-- - Any feedback tables
-- - Any future user-generated content tables

-- If tables exist, add organization_id to them as well:

-- AI Chat (if exists from 0004_ai_chat.sql)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'ai_chats') then
    alter table app.ai_chats
      add column if not exists organization_id uuid;
    
    alter table app.ai_chats
      add constraint fk_ai_chats_organization
      foreign key (organization_id)
      references app.organizations(id)
      on delete cascade;
    
    create index if not exists idx_ai_chats_organization on app.ai_chats(organization_id);
  end if;
end $$;

-- AI Chat Messages (if exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'ai_chat_messages') then
    alter table app.ai_chat_messages
      add column if not exists organization_id uuid;
    
    alter table app.ai_chat_messages
      add constraint fk_ai_chat_messages_organization
      foreign key (organization_id)
      references app.organizations(id)
      on delete cascade;
    
    create index if not exists idx_ai_chat_messages_organization on app.ai_chat_messages(organization_id);
  end if;
end $$;

-- AI Feedback (if exists from 0006_ai_feedback.sql)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'ai_feedback') then
    alter table app.ai_feedback
      add column if not exists organization_id uuid;
    
    alter table app.ai_feedback
      add constraint fk_ai_feedback_organization
      foreign key (organization_id)
      references app.organizations(id)
      on delete cascade;
    
    create index if not exists idx_ai_feedback_organization on app.ai_feedback(organization_id);
  end if;
end $$;

-- Rep Console Stats (if exists from 0005_rep_console.sql)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'app' and table_name = 'rep_stats') then
    alter table app.rep_stats
      add column if not exists organization_id uuid;
    
    alter table app.rep_stats
      add constraint fk_rep_stats_organization
      foreign key (organization_id)
      references app.organizations(id)
      on delete cascade;
    
    create index if not exists idx_rep_stats_organization on app.rep_stats(organization_id);
  end if;
end $$;

-- ============================================================================
-- 6. UPDATE VIEWS TO INCLUDE ORGANIZATION CONTEXT
-- ============================================================================

-- Note: Any existing views that join these tables should be updated to include organization_id

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================

comment on column app.tickets.organization_id is 'Foreign key to organizations - all tickets belong to an organization for data isolation';
comment on column app.messages.organization_id is 'Foreign key to organizations - denormalized for query performance';
comment on column app.documents.organization_id is 'Foreign key to organizations - knowledge base is organization-specific';
comment on column app.chunks.organization_id is 'Foreign key to organizations - denormalized for RAG query performance';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Status: All tables now have organization_id column (nullable)
-- Next step: Run 0009_migrate_existing_data.sql to populate organization_id values
-- After data migration: Make organization_id NOT NULL
