# 03 - Database Schema & Data Model

**Document Version:** 1.0  
**Last Updated:** March 6, 2026  
**Database**: PostgreSQL 15+ (via Supabase)

---

## Overview

TicketPilot uses a well-normalized PostgreSQL schema with 11 core tables organized under the `app` schema. The database implements:
- **Multi-tenancy**: All tables have `organization_id` for data isolation
- **Row-Level Security (RLS)**: Enforces organization boundaries
- **Referential Integrity**: Foreign keys with cascade/restrict rules
- **Audit Trails**: Timestamps on all tables
- **Performance Optimization**: Strategic indexes on query patterns

---

## Schema Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION & USERS                         │
├─────────────────────────────────────────────────────────────────┤
│  auth.users (Supabase managed)                                  │
│    └─► app.user_roles (role mapping)                            │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ORGANIZATIONS (Multi-Tenancy)                 │
├─────────────────────────────────────────────────────────────────┤
│  app.organizations                                               │
│    ├─► app.organization_members (users ↔ orgs with roles)       │
│    │                                                             │
│    ├─► app.tickets (scoped by organization_id)                  │
│    ├─► app.kb_documents (scoped by organization_id)             │
│    └─► app.rag_requests (scoped by organization_id)             │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                      TICKETING SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│  app.tickets                                                     │
│    └─► app.messages (1:many relationship)                       │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                      KNOWLEDGE BASE                              │
├─────────────────────────────────────────────────────────────────┤
│  app.kb_documents                                                │
│    └─► app.kb_chunks (1:many relationship)                      │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                      AI/RAG SYSTEM                               │
├─────────────────────────────────────────────────────────────────┤
│  app.rag_requests (query logs)                                  │
│    └─► app.ai_feedback (1:1 optional feedback)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Tables

### 1. auth.users (Supabase Managed)

**Purpose**: User authentication managed by Supabase Auth

**Columns:**
- `id` (uuid, PK): User unique identifier
- `email` (text): User email (unique)
- `encrypted_password` (text): Hashed password
- `email_confirmed_at` (timestamptz): Email verification timestamp
- `created_at` (timestamptz): Account creation time
- `updated_at` (timestamptz): Last update time
- *...additional Supabase columns*

**Notes:**
- Managed by Supabase Auth API
- Not directly modified by application
- Used as foreign key reference in app.user_roles

---

### 2. app.user_roles

**Purpose**: Map users to their global role (admin, rep, customer)

**Schema:**
```sql
CREATE TABLE app.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'rep', 'customer')),
  created_at timestamptz DEFAULT now()
);
```

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | uuid | PK, FK → auth.users(id) | User reference |
| role | text | CHECK ('admin','rep','customer') | Global role |
| created_at | timestamptz | NOT NULL | Record creation time |

**Indexes:**
- Primary key: `user_id`

**Business Rules:**
- Every authenticated user must have a role
- Created automatically on signup (default: 'customer')
- Role is global (not organization-specific)
- Organization-specific roles managed in `organization_members`

**Query Patterns:**
```sql
-- Get user's global role
SELECT role FROM app.user_roles WHERE user_id = $1;

-- Get all admins
SELECT u.email, ur.role
FROM auth.users u
JOIN app.user_roles ur ON ur.user_id = u.id
WHERE ur.role = 'admin';
```

---

### 3. app.organizations

**Purpose**: Organization/tenant definitions for multi-tenancy

**Schema:**
```sql
CREATE TABLE app.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  slug text NOT NULL UNIQUE CHECK (slug ~* '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  domain text,
  settings jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Organization unique ID |
| name | text | NOT NULL, 2-100 chars | Display name |
| slug | text | UNIQUE, lowercase-hyphen format | URL-friendly identifier |
| domain | text | NULL | Custom domain (future) |
| settings | jsonb | DEFAULT '{}' | Organization settings |
| is_active | boolean | DEFAULT true | Soft delete flag |
| created_at | timestamptz | DEFAULT now() | Creation time |
| updated_at | timestamptz | DEFAULT now() | Last update (auto-trigger) |

**Indexes:**
- `idx_organizations_slug` on `slug`
- `idx_organizations_is_active` on `is_active`
- `idx_organizations_created_at` on `created_at DESC`

**Triggers:**
- `update_organizations_updated_at`: Auto-updates `updated_at` on UPDATE

**Business Rules:**
- Slug must be unique across all organizations
- Reserved slugs (admin, api, auth, etc.) enforced in `app.reserved_slugs`
- Every organization must have at least one owner (enforced by trigger)
- Settings JSONB can store organization-specific config

**Example Settings:**
```json
{
  "allow_public_signup": false,
  "require_ticket_approval": true,
  "ai_confidence_threshold": 0.60,
  "business_hours": {
    "timezone": "America/New_York",
    "weekdays": "9:00-17:00"
  }
}
```

**Query Patterns:**
```sql
-- Get user's organizations
SELECT o.* FROM app.organizations o
JOIN app.organization_members om ON om.organization_id = o.id
WHERE om.user_id = $1 AND o.is_active = true;

-- Get organization by slug
SELECT * FROM app.organizations WHERE slug = $1;
```

---

### 4. app.organization_members

**Purpose**: Junction table linking users to organizations with roles

**Schema:**
```sql
CREATE TABLE app.organization_members (
  organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app.user_roles(user_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'rep', 'member')),
  joined_at timestamptz DEFAULT now(),
  invited_by uuid,
  PRIMARY KEY (organization_id, user_id)
);
```

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| organization_id | uuid | PK, FK → organizations(id) | Organization reference |
| user_id | uuid | PK, FK → user_roles(user_id) | User reference |
| role | text | CHECK ('owner','admin','rep','member') | Role in organization |
| joined_at | timestamptz | DEFAULT now() | Membership start time |
| invited_by | uuid | NULL | User who invited (future) |

**Indexes:**
- Composite primary key: `(organization_id, user_id)`
- `idx_org_members_user` on `user_id`
- `idx_org_members_org` on `organization_id`
- `idx_org_members_role` on `role`

**Role Hierarchy:**
1. **owner**: Full control, can delete org, manage all members
2. **admin**: Manage KB, view analytics, manage users (except owners)
3. **rep**: Handle tickets, use AI assistant, view rep dashboard
4. **member** (mapped to 'customer'): Create tickets, view own tickets only

**Business Rules:**
- Every organization must have at least one owner
- Cannot remove last owner (enforced by `check_organization_has_owner()` trigger)
- User can belong to multiple organizations
- User can have different roles in different organizations

**Query Patterns:**
```sql
-- Get user's role in organization
SELECT role FROM app.organization_members
WHERE user_id = $1 AND organization_id = $2;

-- Get all members of organization
SELECT u.email, om.role, om.joined_at
FROM app.organization_members om
JOIN auth.users u ON u.id = om.user_id
WHERE om.organization_id = $1
ORDER BY om.joined_at;
```

---

### 5. app.tickets

**Purpose**: Support tickets (main entity for ticketing system)

**Schema:**
```sql
CREATE TABLE app.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  assignee_id uuid,
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  description text NOT NULL CHECK (length(description) BETWEEN 10 AND 4000),
  status text NOT NULL DEFAULT 'open' 
    CHECK (status IN ('open','in_progress','resolved','closed','escalated')),
  needs_attention boolean NOT NULL DEFAULT false,
  priority text NOT NULL DEFAULT 'normal' 
    CHECK (priority IN ('low','normal','high')),
  message_count int NOT NULL DEFAULT 0,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Ticket unique ID |
| organization_id | uuid | NOT NULL, FK → organizations(id) | Organization scoping |
| created_by | uuid | NOT NULL | User who created ticket |
| assignee_id | uuid | NULL | Rep assigned to ticket |
| title | text | NOT NULL, 3-200 chars | Ticket subject |
| description | text | NOT NULL, 10-4000 chars | Ticket body |
| status | text | CHECK (5 values) | Current status |
| needs_attention | boolean | DEFAULT false | Escalation flag |
| priority | text | CHECK ('low','normal','high') | Priority level |
| message_count | int | DEFAULT 0 | Cached message count |
| last_message_at | timestamptz | DEFAULT now() | Last activity timestamp |
| created_at | timestamptz | DEFAULT now() | Creation time |
| updated_at | timestamptz | DEFAULT now() | Last update time |

**Indexes:**
- `idx_tickets_created_at` on `created_at DESC`
- `idx_tickets_status` on `status`
- `idx_tickets_owner` on `created_by`
- `idx_tickets_last_message` on `last_message_at DESC`
- `idx_tickets_needs_attention` on `needs_attention`
- `idx_tickets_assignee` on `assignee_id`
- `idx_tickets_status_priority` on `(status, priority)`
- `idx_tickets_organization` on `organization_id`

**Status Flow:**
```
open → in_progress → resolved → closed
  ↓
escalated (can transition to in_progress)
```

**Business Rules:**
- Every ticket belongs to exactly one organization
- Tickets are soft-deleted (status = 'closed')
- message_count is denormalized for performance
- needs_attention flag for rep console prioritization

**Row-Level Security:**
```sql
-- Policy: Users can only see tickets in their organization
CREATE POLICY tickets_org_isolation ON app.tickets
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**Query Patterns:**
```sql
-- Rep queue (all organization tickets, prioritized)
SELECT * FROM app.tickets
WHERE organization_id = $1
  AND status != 'closed'
ORDER BY needs_attention DESC, priority DESC, last_message_at DESC;

-- Customer tickets (own tickets only)
SELECT * FROM app.tickets
WHERE organization_id = $1 AND created_by = $2
ORDER BY last_message_at DESC;

-- Search tickets
SELECT * FROM app.tickets
WHERE organization_id = $1
  AND (title ILIKE '%' || $2 || '%' OR description ILIKE '%' || $2 || '%')
ORDER BY last_message_at DESC;
```

---

### 6. app.messages

**Purpose**: Conversation messages within tickets

**Schema:**
```sql
CREATE TABLE app.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES app.tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('customer','rep','ai','system')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  meta jsonb,
  created_at timestamptz DEFAULT now()
);
```

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Message unique ID |
| ticket_id | uuid | NOT NULL, FK → tickets(id) CASCADE | Parent ticket |
| sender_id | uuid | NOT NULL | User who sent message |
| sender_role | text | CHECK (4 values) | Role of sender |
| body | text | NOT NULL, 1-8000 chars | Message content |
| meta | jsonb | NULL | Additional data (AI citations, confidence) |
| created_at | timestamptz | DEFAULT now() | Send time |

**Indexes:**
- `idx_messages_ticket_time` on `(ticket_id, created_at)`
- `idx_messages_sender` on `sender_id`

**Sender Roles:**
- **customer**: Message from ticket creator
- **rep**: Message from support rep
- **ai**: Message from AI assistant
- **system**: Automated system messages (status changes, assignments)

**Meta JSONB Structure (for AI messages):**
```json
{
  "citations": [
    {
      "label": "Company Policy Doc",
      "doc_id": "uuid",
      "chunk_id": "uuid",
      "faiss_id": 123,
      "score": 0.87
    }
  ],
  "confidence": 0.75,
  "suggest_escalation": false,
  "model": "gemini-1.5-flash",
  "tokens_used": 450
}
```

**Triggers:**
- On INSERT: Increments `tickets.message_count`
- On INSERT: Updates `tickets.last_message_at`

**Row-Level Security:**
```sql
-- Policy: Users can only see messages in their organization's tickets
CREATE POLICY messages_org_isolation ON app.messages
  USING (EXISTS (
    SELECT 1 FROM app.tickets t
    WHERE t.id = messages.ticket_id
      AND t.organization_id = current_setting('app.current_organization_id')::uuid
  ));
```

**Query Patterns:**
```sql
-- Get all messages for ticket (chronological)
SELECT * FROM app.messages
WHERE ticket_id = $1
ORDER BY created_at ASC;

-- Get recent AI messages
SELECT m.*, t.title FROM app.messages m
JOIN app.tickets t ON t.id = m.ticket_id
WHERE t.organization_id = $1
  AND m.sender_role = 'ai'
  AND m.created_at > now() - interval '7 days'
ORDER BY m.created_at DESC;
```

---

### 7. app.kb_documents

**Purpose**: Knowledge base document metadata

**Schema:**
```sql
CREATE TABLE app.kb_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  title text,
  source text NOT NULL,
  mime_type text,
  size_bytes bigint,
  doc_hash text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Document unique ID |
| organization_id | uuid | NOT NULL, FK → organizations(id) | Organization scoping |
| title | text | NULL | Document display name |
| source | text | NOT NULL | Origin ('upload:<filename>' or 'raw') |
| mime_type | text | NULL | File MIME type |
| size_bytes | bigint | NULL | Original file size |
| doc_hash | text | NOT NULL | SHA256 of text (deduplication) |
| created_by | uuid | NOT NULL | User who uploaded |
| created_at | timestamptz | DEFAULT now() | Upload time |

**Indexes:**
- `idx_documents_created_at` on `created_at DESC`
- `idx_documents_organization` on `organization_id`
- `idx_documents_doc_hash` on `doc_hash` (for duplicate detection)

**Supported MIME Types:**
- `application/pdf`
- `text/plain`
- `text/markdown`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)

**Business Rules:**
- doc_hash ensures no duplicate documents per organization
- Documents are not physically deleted (soft delete recommended)
- On deletion, associated chunks are cascade-deleted

**Row-Level Security:**
```sql
CREATE POLICY kb_documents_org_isolation ON app.kb_documents
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**Query Patterns:**
```sql
-- List all documents for organization
SELECT id, title, source, size_bytes, created_at
FROM app.kb_documents
WHERE organization_id = $1
ORDER BY created_at DESC;

-- Check if document already exists (by hash)
SELECT id FROM app.kb_documents
WHERE organization_id = $1 AND doc_hash = $2;
```

---

### 8. app.kb_chunks

**Purpose**: Chunked document segments with embeddings

**Schema:**
```sql
CREATE TABLE app.kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES app.kb_documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  text text NOT NULL,
  chunk_hash text NOT NULL,
  token_count int,
  faiss_id bigint,
  created_at timestamptz DEFAULT now(),
  UNIQUE (doc_id, chunk_index)
);
```

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Chunk unique ID |
| doc_id | uuid | NOT NULL, FK → kb_documents(id) CASCADE | Parent document |
| chunk_index | int | NOT NULL, UNIQUE per doc | Sequence number in document |
| text | text | NOT NULL | Chunk text content |
| chunk_hash | text | NOT NULL | MD5 of text (deduplication) |
| token_count | int | NULL | Approximate token count |
| faiss_id | bigint | NULL | Index in FAISS vector store |
| created_at | timestamptz | DEFAULT now() | Creation time |

**Indexes:**
- `idx_chunks_doc` on `doc_id`
- `idx_chunks_faiss` on `faiss_id`
- Unique constraint on `(doc_id, chunk_index)`

**Chunking Strategy:**
- Target size: 512-1024 tokens
- Overlap: 20% between adjacent chunks
- Preserve markdown formatting
- Respect sentence boundaries

**FAISS Mapping:**
- Each chunk has corresponding vector in FAISS index
- FAISS indices stored per-organization at `data/faiss/{org_id}/kb.index`
- Chunk mapping stored at `data/maps/{org_id}/kb_map.json`
- faiss_id links database chunk to FAISS vector

**Example Mapping File:**
```json
{
  "0": {"chunk_id": "uuid-1", "doc_id": "uuid-doc-1", "chunk_index": 0},
  "1": {"chunk_id": "uuid-2", "doc_id": "uuid-doc-1", "chunk_index": 1},
  "2": {"chunk_id": "uuid-3", "doc_id": "uuid-doc-2", "chunk_index": 0}
}
```

**Row-Level Security:**
```sql
CREATE POLICY kb_chunks_org_isolation ON app.kb_chunks
  USING (EXISTS (
    SELECT 1 FROM app.kb_documents d
    WHERE d.id = kb_chunks.doc_id
      AND d.organization_id = current_setting('app.current_organization_id')::uuid
  ));
```

**Query Patterns:**
```sql
-- Get all chunks for document
SELECT * FROM app.kb_chunks
WHERE doc_id = $1
ORDER BY chunk_index;

-- Fetch chunks by FAISS IDs (after vector search)
SELECT c.*, d.title, d.source
FROM app.kb_chunks c
JOIN app.kb_documents d ON d.id = c.doc_id
WHERE c.faiss_id = ANY($1::bigint[])
  AND d.organization_id = $2;
```

---

### 9. app.rag_requests

**Purpose**: Log all RAG queries for analytics and debugging

**Schema:**
```sql
CREATE TABLE app.rag_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ticket_id uuid REFERENCES app.tickets(id) ON DELETE SET NULL,
  query text NOT NULL,
  response text NOT NULL,
  confidence real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  chunks_used int NOT NULL,
  latency_ms int,
  model_name text,
  tokens_used int,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);
```

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Request unique ID |
| organization_id | uuid | NOT NULL, FK → organizations(id) | Organization scoping |
| user_id | uuid | NOT NULL | User who made query |
| ticket_id | uuid | NULL, FK → tickets(id) | Associated ticket (if any) |
| query | text | NOT NULL | User's question |
| response | text | NOT NULL | AI-generated response |
| confidence | real | 0-1 | Confidence score (7-factor) |
| chunks_used | int | NOT NULL | Number of KB chunks retrieved |
| latency_ms | int | NULL | Total response time (ms) |
| model_name | text | NULL | AI model used (e.g., 'gemini-1.5-flash') |
| tokens_used | int | NULL | Total tokens consumed |
| meta | jsonb | NULL | Additional metadata (citations, etc.) |
| created_at | timestamptz | DEFAULT now() | Query time |

**Indexes:**
- `idx_rag_requests_org` on `organization_id`
- `idx_rag_requests_user` on `user_id`
- `idx_rag_requests_ticket` on `ticket_id`
- `idx_rag_requests_confidence` on `confidence`
- `idx_rag_requests_created_at` on `created_at DESC`

**Meta JSONB Structure:**
```json
{
  "citations": [
    {"doc_id": "uuid", "chunk_id": "uuid", "score": 0.87},
    {"doc_id": "uuid", "chunk_id": "uuid", "score": 0.82}
  ],
  "retrieval_scores": [0.87, 0.82, 0.79, 0.75, 0.71],
  "confidence_breakdown": {
    "retrieval_quality": 0.81,
    "citation_coverage": 0.75,
    "semantic_coherence": 0.80,
    "response_completeness": 0.90,
    "information_density": 0.85,
    "source_diversity": 0.60,
    "variance_penalty": -0.05
  },
  "suggest_escalation": false
}
```

**Business Rules:**
- Every RAG request is logged for analytics
- Confidence score is 7-factor computed score
- latency_ms includes embedding + search + generation time
- ticket_id is NULL for rep console queries without ticket context

**Row-Level Security:**
```sql
CREATE POLICY rag_requests_org_isolation ON app.rag_requests
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**Query Patterns:**
```sql
-- Admin analytics: Average confidence over time
SELECT date_trunc('day', created_at) as day,
       AVG(confidence) as avg_confidence,
       COUNT(*) as request_count
FROM app.rag_requests
WHERE organization_id = $1
  AND created_at > now() - interval '30 days'
GROUP BY day
ORDER BY day;

-- Find low-confidence queries (knowledge gaps)
SELECT query, confidence, response, created_at
FROM app.rag_requests
WHERE organization_id = $1
  AND confidence < 0.60
ORDER BY created_at DESC
LIMIT 20;

-- Most used documents
SELECT d.title, COUNT(*) as usage_count
FROM app.rag_requests r, jsonb_array_elements(r.meta->'citations') as cit
JOIN app.kb_documents d ON d.id = (cit->>'doc_id')::uuid
WHERE r.organization_id = $1
GROUP BY d.id, d.title
ORDER BY usage_count DESC;
```

---

### 10. app.ai_feedback

**Purpose**: Collect user feedback on AI responses

**Schema:**
```sql
CREATE TABLE app.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_request_id uuid NOT NULL REFERENCES app.rag_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  helpful boolean NOT NULL,
  comment text,
  created_at timestamptz DEFAULT now()
);
```

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Feedback unique ID |
| rag_request_id | uuid | NOT NULL, FK → rag_requests(id) CASCADE | Associated RAG request |
| user_id | uuid | NOT NULL | User who gave feedback |
| helpful | boolean | NOT NULL | Thumbs up (true) or down (false) |
| comment | text | NULL | Optional text feedback |
| created_at | timestamptz | DEFAULT now() | Feedback time |

**Indexes:**
- `idx_ai_feedback_request` on `rag_request_id`
- `idx_ai_feedback_user` on `user_id`
- `idx_ai_feedback_helpful` on `helpful`

**Business Rules:**
- One feedback per RAG request per user (unique constraint recommended)
- Feedback is anonymous in analytics (user_id for tracking only)
- Used to improve AI quality over time

**Query Patterns:**
```sql
-- Feedback summary for organization
SELECT helpful, COUNT(*) as count
FROM app.ai_feedback f
JOIN app.rag_requests r ON r.id = f.rag_request_id
WHERE r.organization_id = $1
GROUP BY helpful;

-- Find poorly-rated high-confidence responses (false positives)
SELECT r.query, r.response, r.confidence, f.comment
FROM app.ai_feedback f
JOIN app.rag_requests r ON r.id = f.rag_request_id
WHERE r.organization_id = $1
  AND r.confidence > 0.75
  AND f.helpful = false
ORDER BY r.created_at DESC;
```

---

### 11. app.reserved_slugs

**Purpose**: Prevent use of system-reserved organization slugs

**Schema:**
```sql
CREATE TABLE app.reserved_slugs (
  slug text PRIMARY KEY,
  reason text
);
```

**Columns:**
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| slug | text | PK | Reserved slug string |
| reason | text | NULL | Why it's reserved |

**Reserved Slugs:**
```
api, admin, app, auth, billing, default, docs, help,
login, logout, pricing, register, settings, support, system, www
```

**Business Rules:**
- Checked during organization creation
- Prevents URL conflicts
- Case-insensitive check recommended

---

## Migration History

TicketPilot uses sequential SQL migration files for schema evolution:

| Migration | Purpose | Tables Modified |
|-----------|---------|-----------------|
| **0001_user_roles.sql** | User role system | app.user_roles |
| **0002_kb.sql** | Knowledge base tables | app.documents (renamed to kb_documents), app.chunks (renamed to kb_chunks) |
| **0003_tickets_core.sql** | Core ticketing | app.tickets, app.messages |
| **0004_ai_chat.sql** | AI chat history | app.rag_requests |
| **0005_rep_console.sql** | Rep console features | app.tickets (added assignee_id, priority, needs_attention) |
| **0005a_admin_roles.sql** | Admin role management | app.user_roles (added 'admin' role) |
| **0006_ai_feedback.sql** | Feedback collection | app.ai_feedback |
| **0007_organizations.sql** | Multi-tenancy foundation | app.organizations, app.organization_members |
| **0008_add_organization_id.sql** | Add org column to all tables | All major tables |
| **0009_migrate_existing_data.sql** | Migrate to default org | Data migration |
| **0010_enable_rls.sql** | Row-Level Security | Enable RLS policies on all tables |

**Running Migrations:**
```bash
# Run all migrations in order
psql $DATABASE_URL < backend/migrations/0001_user_roles.sql
psql $DATABASE_URL < backend/migrations/0002_kb.sql
# ... continue through 0010
```

---

## Row-Level Security (RLS) Policies

All tables with `organization_id` have RLS enabled:

### Policy Pattern:
```sql
-- Step 1: Enable RLS on table
ALTER TABLE app.{table_name} ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policy for organization isolation
CREATE POLICY {table_name}_org_isolation ON app.{table_name}
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Step 3: Backend sets session variable before queries
SET app.current_organization_id = 'org-uuid-here';
```

### How It Works:
1. Backend extracts org ID from `X-Organization-ID` header
2. Sets PostgreSQL session variable: `SET app.current_organization_id = $1`
3. All queries automatically filtered by RLS policies
4. No data leakage possible (enforced at database level)

### Tables with RLS:
- ✅ app.tickets
- ✅ app.messages (indirect via ticket FK)
- ✅ app.kb_documents
- ✅ app.kb_chunks (indirect via document FK)
- ✅ app.rag_requests
- ✅ app.ai_feedback (indirect via rag_request FK)

---

## Performance Considerations

### Index Strategy

**Principle**: Index columns used in WHERE, JOIN, ORDER BY clauses

**High-Traffic Queries:**
1. Ticket list (status, org, last_message_at)
2. Message thread (ticket_id, created_at)
3. RAG analytics (org, confidence, created_at)
4. User lookup (user_id, email)

**Index Coverage:**
- 38 indexes across 11 tables
- Composite indexes for common query patterns
- Partial indexes for filtered queries (e.g., `WHERE status != 'closed'`)

### Query Optimization

**Best Practices:**
- Use prepared statements (parameterized queries)
- Limit result sets with `LIMIT` clause
- Use `EXPLAIN ANALYZE` to verify index usage
- Denormalize counters (e.g., `tickets.message_count`)
- Cache frequently-accessed data (e.g., user roles)

**Known Slow Queries:**
- Admin analytics (aggregations across large datasets)
  - **Solution**: Consider materialized views for daily stats
- RAG analytics (JSONB queries on citations)
  - **Solution**: Add GIN index on `meta` column

---

## Data Integrity

### Foreign Key Cascade Rules

**ON DELETE CASCADE:**
- `tickets.id` → `messages.ticket_id`: Deleting ticket deletes all messages
- `kb_documents.id` → `kb_chunks.doc_id`: Deleting document deletes all chunks
- `organizations.id` → All org-scoped tables: Deleting org deletes all data (use with caution!)

**ON DELETE SET NULL:**
- `tickets.id` → `rag_requests.ticket_id`: Deleting ticket keeps RAG logs (for analytics)

**ON DELETE RESTRICT:**
- None currently (all use CASCADE or SET NULL)

### Triggers

**Auto-Update Triggers:**
- `tickets.last_message_at`: Updated on message INSERT
- `tickets.message_count`: Incremented on message INSERT
- `organizations.updated_at`: Updated on any UPDATE

**Business Rule Triggers:**
- `check_organization_has_owner()`: Prevents removing last owner

---

## Backup & Recovery

**Recommended Strategy:**
- **Daily**: Full database backup (Supabase handles this automatically)
- **Continuous**: Write-Ahead Log (WAL) replication
- **Pre-Deployment**: Manual backup before major migrations

**Restore Procedure:**
1. Restore database from backup
2. Re-run migrations from last applied version
3. Rebuild FAISS indices from `kb_chunks` table

---

## Schema Evolution Guidelines

**When Adding a New Table:**
1. Create new migration file: `00XX_feature_name.sql`
2. Add `organization_id` column (if multi-tenant)
3. Create appropriate indexes
4. Add RLS policy if needed
5. Update this documentation

**When Modifying Existing Table:**
1. Create migration with `ALTER TABLE` statements
2. Use `IF NOT EXISTS` for idempotency
3. Test on local database first
4. Run migration on staging before production

---

## Known Schema Issues

### ✅ Resolved Issues
- ~~Tickets missing 'escalated' status~~ → Fixed in `fix-escalated-status.sql`
- ~~Missing organization_id on core tables~~ → Fixed in migration 0008
- ~~No RLS policies~~ → Fixed in migration 0010

### 🔲 Open Issues / Future Improvements

1. **No Soft Delete Support**
   - Currently, deleted records are hard-deleted
   - **Recommendation**: Add `deleted_at` column to all tables

2. **Limited Audit Trail**
   - Only system messages for ticket actions
   - **Recommendation**: Add `app.audit_log` table for all admin actions

3. **No Database-Level Full-Text Search**
   - Currently using `ILIKE` for ticket search
   - **Recommendation**: Add `tsvector` column for PostgreSQL full-text search

4. **FAISS Mapping Duplication**
   - Chunk-to-FAISS mapping stored in both DB and JSON file
   - **Recommendation**: Use only database, remove JSON file

5. **No Materialized Views**
   - Analytics queries can be slow on large datasets
   - **Recommendation**: Create materialized views for daily/weekly stats

---

## Conclusion

The TicketPilot database schema is:
- ✅ Well-normalized (3NF)
- ✅ Fully indexed for performance
- ✅ Multi-tenant with RLS
- ✅ Referentially consistent
- ✅ Production-ready

**Total Tables**: 11 (+ auth.users managed by Supabase)  
**Total Indexes**: 38  
**Total Migrations**: 10  
**RLS Policies**: 6 tables protected

The schema supports all current features and has clear paths for future enhancements.
