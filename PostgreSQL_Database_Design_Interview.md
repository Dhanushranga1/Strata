# PostgreSQL Database Design - TicketPilot Interview Guide

## 1) High-Level Database Architecture (6 Bullets)

- **Users (auth.users + app.user_roles)**: Supabase auth stores credentials → app.user_roles maps user_id to global role (customer/rep/admin)
- **Tenants (app.organizations + app.organization_members)**: Organizations table = tenants → junction table maps users to orgs with org-specific roles (owner/admin/rep/member)
- **Tickets (app.tickets + app.messages)**: Tickets scoped by organization_id → messages linked to tickets → both RLS-protected to prevent cross-tenant access
- **Documents/KB (app.documents + app.chunks)**: Knowledge base docs uploaded per org → chunked for RAG → each chunk tied to org_id → embedded for FAISS search
- **Conversations (app.ai_chats + app.ai_chat_messages)**: AI chat sessions per ticket → stores query, response, citations → enables conversation history and feedback loops
- **Audit/Logs (app.ai_feedback + app.rep_stats)**: Tracks AI response quality (thumbs up/down) → rep performance metrics (tickets resolved, avg time) → analytics per organization

---

## 2) Core Table Schema Design

### **app.user_roles**
```sql
CREATE TABLE app.user_roles (
  user_id uuid PRIMARY KEY,              -- FK to auth.users(id)
  role text NOT NULL CHECK (role IN ('customer','rep','admin')),
  created_at timestamptz DEFAULT now()
);
```
**Purpose**: Maps Supabase auth users to application-level global roles (customer/rep/admin) for coarse-grained access control.

---

### **app.organizations**
```sql
CREATE TABLE app.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  slug text NOT NULL UNIQUE CHECK (slug ~* '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  domain text,                           -- Optional custom domain
  settings jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_organizations_slug ON app.organizations(slug);
```
**Purpose**: Tenant table—each organization is a separate tenant with isolated data, identified by UUID and human-readable slug.

---

### **app.organization_members** (Junction Table)
```sql
CREATE TABLE app.organization_members (
  organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app.user_roles(user_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','rep','member')),
  joined_at timestamptz DEFAULT now(),
  invited_by uuid,
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX idx_org_members_user ON app.organization_members(user_id);
CREATE INDEX idx_org_members_org ON app.organization_members(organization_id);
```
**Purpose**: Many-to-many mapping of users to organizations with org-specific roles—enables users to belong to multiple tenants with different permissions.

---

### **app.tickets**
```sql
CREATE TABLE app.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES app.organizations(id),  -- TENANT KEY
  created_by uuid NOT NULL,              -- FK to auth.users(id)
  assignee_id uuid,                      -- FK to auth.users(id) for rep assignment
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description text NOT NULL CHECK (length(description) BETWEEN 10 AND 4000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed','escalated')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  needs_attention boolean DEFAULT false,
  message_count int NOT NULL DEFAULT 0,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_tickets_org_created ON app.tickets(organization_id, created_at DESC);
CREATE INDEX idx_tickets_status ON app.tickets(status);
CREATE INDEX idx_tickets_assignee ON app.tickets(assignee_id);
```
**Purpose**: Core ticketing entity scoped by organization_id—RLS filters ensure users only see tickets from their organizations.

---

### **app.messages**
```sql
CREATE TABLE app.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES app.tickets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES app.organizations(id),  -- DENORMALIZED for RLS performance
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('customer','rep','system')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_messages_ticket_time ON app.messages(ticket_id, created_at);
CREATE INDEX idx_messages_org ON app.messages(organization_id);
```
**Purpose**: Conversation thread per ticket—organization_id denormalized from ticket for efficient RLS filtering without joins.

---

### **app.documents**
```sql
CREATE TABLE app.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES app.organizations(id),  -- TENANT KEY
  title text NOT NULL,
  source text NOT NULL,                  -- e.g., 'upload:filename.pdf'
  mime_type text,
  size_bytes int,
  doc_hash text NOT NULL,                -- SHA-256 to detect duplicates
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX idx_documents_org_hash ON app.documents(organization_id, doc_hash);
CREATE INDEX idx_documents_org_created ON app.documents(organization_id, created_at DESC);
```
**Purpose**: Knowledge base documents per organization—doc_hash prevents duplicate uploads, scoped by organization_id for RLS.

---

### **app.chunks**
```sql
CREATE TABLE app.chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES app.documents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES app.organizations(id),  -- DENORMALIZED for RLS
  chunk_index int NOT NULL,              -- Position in document (0-based)
  content text NOT NULL,                 -- Actual chunk text (512-2400 chars)
  faiss_index int,                       -- Index in FAISS vector store
  created_at timestamptz DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);
CREATE INDEX idx_chunks_document ON app.chunks(document_id);
CREATE INDEX idx_chunks_org_faiss ON app.chunks(organization_id, faiss_index);
```
**Purpose**: Document chunks for RAG pipeline—each chunk indexed in FAISS, faiss_index maps vector store position to DB metadata.

---

### **app.ai_chats**
```sql
CREATE TABLE app.ai_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES app.tickets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES app.organizations(id),
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_ai_chats_ticket ON app.ai_chats(ticket_id);
CREATE INDEX idx_ai_chats_org ON app.ai_chats(organization_id);
```
**Purpose**: AI chat sessions tied to tickets—groups related queries/responses, enables conversation context and history tracking.

---

### **app.ai_chat_messages**
```sql
CREATE TABLE app.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES app.ai_chats(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES app.organizations(id),
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  citations jsonb DEFAULT '[]'::jsonb,   -- Array of {label, doc_id, chunk_id, faiss_id, score}
  confidence float,
  suggest_escalation boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_ai_messages_chat ON app.ai_chat_messages(chat_id, created_at);
```
**Purpose**: Individual AI query/response pairs—stores user question + AI answer with citations, confidence, escalation flags for analytics.

---

## 3) Multi-Tenancy Model

### **How organization_id Flows Through All Tables**

**Entry Point (User Authentication):**
1. User authenticates with Supabase → JWT contains `auth.uid()` (user UUID)
2. FastAPI middleware queries `app.organization_members WHERE user_id = auth.uid()` → retrieves user's `organization_id`
3. Middleware executes `SET LOCAL app.org_id = '{organization_id}'` at connection start

**RLS Policy Enforcement:**
```sql
-- Example RLS policy on tickets table
CREATE POLICY tickets_select_policy ON app.tickets
  FOR SELECT
  USING (organization_id = current_setting('app.org_id')::uuid);
```

**Data Isolation Cascade:**
- **tickets**: Scoped by `organization_id` → RLS filters all queries automatically
- **messages**: Inherits `organization_id` from parent ticket (denormalized for performance)
- **documents**: Uploaded per organization → tagged with `organization_id`
- **chunks**: Inherit `organization_id` from parent document
- **ai_chats/ai_chat_messages**: Tied to ticket → inherit `organization_id` from ticket's org

**Why Denormalization?**
Without denormalization, RLS policies would need joins:
```sql
-- SLOW: Join required for every message query
CREATE POLICY messages_policy ON app.messages
  USING (ticket_id IN (SELECT id FROM app.tickets WHERE organization_id = current_setting('app.org_id')::uuid));
```

With denormalized `organization_id`:
```sql
-- FAST: Direct filter, uses index
CREATE POLICY messages_policy ON app.messages
  USING (organization_id = current_setting('app.org_id')::uuid);
```

**Performance Impact**: Denormalization adds 16 bytes (UUID) per row but eliminates subquery overhead—critical for high-frequency tables like messages.

---

## 4) RLS Policy Structure

### **Three Policy Types**

**SELECT Policies** (Read Access):
```sql
CREATE POLICY table_select_policy ON app.table_name
  FOR SELECT
  USING (organization_id = current_setting('app.org_id')::uuid);
```
Users see only rows matching their org_id.

**INSERT Policies** (Write Access):
```sql
CREATE POLICY table_insert_policy ON app.table_name
  FOR INSERT
  WITH CHECK (organization_id = current_setting('app.org_id')::uuid);
```
Users can only insert rows for their organization.

**UPDATE/DELETE Policies** (Modify Access):
```sql
CREATE POLICY table_update_policy ON app.table_name
  FOR UPDATE
  USING (organization_id = current_setting('app.org_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.org_id')::uuid);
```
USING checks existing rows, WITH CHECK validates new values.

---

## 5) Indexes for Performance

### **Critical Composite Indexes**

**Tenant-Scoped Queries:**
```sql
CREATE INDEX idx_tickets_org_created ON app.tickets(organization_id, created_at DESC);
CREATE INDEX idx_documents_org_created ON app.documents(organization_id, created_at DESC);
```
**Why**: Every RLS-filtered query includes `WHERE organization_id = X`—composite index enables index-only scans.

**FAISS Mapping:**
```sql
CREATE INDEX idx_chunks_org_faiss ON app.chunks(organization_id, faiss_index);
```
**Why**: After FAISS returns vector IDs, need fast lookup: `WHERE organization_id = X AND faiss_index IN (1,5,9,12,33)`.

**Foreign Key Cascades:**
```sql
CREATE INDEX idx_messages_ticket_time ON app.messages(ticket_id, created_at);
```
**Why**: Enables efficient `SELECT * FROM messages WHERE ticket_id = X ORDER BY created_at` for conversation history.

---

## 6) Data Integrity & Constraints

### **Referential Integrity**

**CASCADE Deletes:**
- `documents.organization_id` FK → `ON DELETE CASCADE` ensures orphaned docs are removed if org deleted
- `chunks.document_id` FK → `ON DELETE CASCADE` ensures chunks deleted with parent document
- `messages.ticket_id` FK → `ON DELETE CASCADE` ensures conversation history deleted with ticket

**RESTRICT Deletes:**
- `tickets.organization_id` FK → `ON DELETE CASCADE` (debatable—may want RESTRICT to prevent accidental org deletion with active tickets)

### **Check Constraints**

**Enum-Like Values:**
```sql
status text CHECK (status IN ('open','in_progress','resolved','closed','escalated'))
role text CHECK (role IN ('customer','rep','admin'))
```
Database enforces valid values—prevents invalid states even if application bugs exist.

**Length Validation:**
```sql
title text CHECK (length(title) BETWEEN 3 AND 120)
body text CHECK (length(body) BETWEEN 1 AND 8000)
```
Prevents empty fields and oversized inputs at DB level.

---

## 7) FAISS Integration with Database

### **Two-Tier Storage Model**

**PostgreSQL (Metadata):**
- Stores `app.chunks` table with `content`, `document_id`, `organization_id`
- `faiss_index` column maps chunk to vector store position

**FAISS (Vectors):**
- In-memory numpy array of embeddings (e.g., 768-dimensional vectors)
- Index position corresponds to `chunks.faiss_index`

### **Workflow**

**Ingestion:**
1. Upload document → parse text → chunk into 512-2400 char segments
2. Insert chunks into `app.chunks` → get UUIDs
3. Generate embeddings via Google API → store in FAISS
4. Update `chunks.faiss_index` with FAISS position

**Retrieval:**
1. User query → generate query embedding
2. FAISS search returns top-k faiss_index values (e.g., [5, 12, 33, 45, 67])
3. Query DB: `SELECT * FROM app.chunks WHERE organization_id = X AND faiss_index IN (5,12,33,45,67)`
4. Return chunk content + metadata (doc title, chunk position) for LLM context

**Synchronization:**
- FAISS index rebuilt on server restart from `app.chunks` table
- `faiss_index` nullable until embedding completes (async background task)

---

## 8) Advanced Features

### **Soft Deletes**
```sql
is_active boolean DEFAULT true
```
Organizations never hard-deleted—set `is_active = false` to preserve audit trail while hiding data.

### **Audit Timestamps**
```sql
created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```
Every table tracks creation + last modification—enables temporal queries and analytics.

### **JSONB for Flexibility**
```sql
settings jsonb DEFAULT '{}'::jsonb
citations jsonb DEFAULT '[]'::jsonb
```
Schema-less columns for org settings, AI citations—avoids migrations for new fields, indexed with GIN for fast lookups.

### **Helper Views**
```sql
CREATE VIEW app.v_organization_members AS
SELECT om.*, o.name as org_name, u.email
FROM app.organization_members om
JOIN app.organizations o ON o.id = om.organization_id
LEFT JOIN auth.users u ON u.id = om.user_id;
```
Simplifies common joins—not RLS-protected (relies on base table policies).

---

## 9) 60-Second Database Explanation

"TicketPilot uses a multi-tenant PostgreSQL architecture where every table is scoped by `organization_id`. The core design has three layers: authentication via Supabase auth, tenant mapping through `organization_members` junction table, and data isolation via Row-Level Security policies.

When a user authenticates, we query their organization membership, set `app.org_id` as a session variable, and RLS policies automatically filter every query to show only that org's data. Critical tables like tickets, messages, documents, and chunks all have composite indexes on `(organization_id, created_at)` for fast RLS-filtered queries.

For RAG, documents are chunked and stored in `app.chunks` with a `faiss_index` column mapping to the in-memory FAISS vector store. When users query, FAISS returns vector IDs, we look up chunks in PostgreSQL filtered by org_id, and pass that context to the LLM. The entire system enforces tenant isolation at the database layer, so even application bugs can't leak cross-tenant data."

---

## 10) Top 8 Database Interview Questions

**Q1: Why denormalize organization_id instead of joining through parent tables?**
Performance. Without denormalization, RLS policies require subqueries (e.g., messages → tickets → check org_id), executing per row. Denormalizing adds 16 bytes but enables direct index lookups, reducing query time from 50ms to <5ms.

**Q2: How do you handle users in multiple organizations?**
`organization_members` junction table allows many-to-many relationships. Middleware sets `app.org_id` based on user's currently selected org (via header or session). User can switch orgs, triggering new session variable and re-filtering data.

**Q3: What happens if you forget to add organization_id to a new table?**
RLS can't filter—users see all data (data leak) or no data (if policy denies by default). Mitigation: Code review checklist, automated tests checking RLS coverage, and migration templates enforcing org_id column.

**Q4: How do you sync FAISS with PostgreSQL after server restart?**
On startup, query `SELECT id, faiss_index, <embedding> FROM app.chunks WHERE faiss_index IS NOT NULL ORDER BY faiss_index`. Rebuild FAISS index from embeddings, using `faiss_index` as position. Ensures consistency even after crashes.

**Q5: What's the trade-off between RLS and application-level filtering?**
RLS: Defense-in-depth (DB enforces), centralized policies, but slight performance cost (<5ms with proper indexes). App-level: Faster (no session vars), but requires manual WHERE clauses everywhere, error-prone, bypassable via SQL injection.

**Q6: How do you test RLS policies in development?**
Write integration tests setting different `app.org_id` values, attempt cross-tenant queries, assert zero results. Use `SET ROLE` to simulate different users, and `EXPLAIN ANALYZE` to verify RLS clauses are applied.

**Q7: Why use UUIDs instead of serial integers for primary keys?**
UUIDs prevent enumeration attacks (can't guess IDs), enable distributed ID generation (no central sequence), and avoid exposing row counts (serial IDs leak "we have 1000 tickets"). Trade-off: 16 bytes vs 4 bytes, slightly slower joins.

**Q8: How would you partition tables for scale (e.g., 1M+ tickets)?**
Use declarative partitioning by `organization_id`: `PARTITION BY LIST (organization_id)`. Each org gets a partition, queries hit only relevant partition. Combine with composite indexes for sub-second queries even at 100M+ rows.

---

## Key Takeaways for Interview

✅ Multi-tenant = `organization_id` on every table + RLS policies  
✅ Denormalize org_id to avoid joins in RLS policies (performance)  
✅ `organization_members` junction table = many-to-many user-org mapping  
✅ FAISS integration via `faiss_index` column mapping vectors to DB metadata  
✅ Composite indexes `(organization_id, created_at)` critical for RLS queries  
✅ Cascade deletes maintain referential integrity, check constraints prevent invalid states  
✅ Session variable (`app.org_id`) set per request, propagates to RLS evaluation  
✅ Trade-off: Slight denormalization overhead vs. massive RLS performance gain  

**Scaling Strategy**: Start with single DB + proper indexing → add read replicas for analytics → partition by org_id at 10M+ rows → migrate to distributed DB (Citus, CockroachDB) at 100M+ rows.
