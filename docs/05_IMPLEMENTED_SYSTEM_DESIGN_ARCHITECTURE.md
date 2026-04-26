# TicketPilot Implemented System Design Architecture

Last verified: 2026-04-26  
Scope: This document describes only behavior and components currently implemented in this repository.

## 1. System Scope and Boundaries

TicketPilot is a multi-tenant support platform with:
- Next.js frontend (authenticated app + public auth/invite pages)
- FastAPI backend (REST API)
- PostgreSQL (Supabase-hosted) as system of record
- Google Generative AI for embeddings and response generation
- FAISS for vector similarity search

Implemented primary domains:
- Authentication and user context
- Organization and membership management
- Ticket lifecycle and messaging
- Knowledge base ingestion/search
- RAG chat with confidence + escalation
- CASPER-based ticket profiling/auto-assignment
- Admin analytics and role management

## 2. High-Level Architecture

```text
Browser (Next.js 15, React 19, TS)
  -> Supabase Auth (JWT issuance)
  -> FastAPI API (/api/*) with Bearer JWT + X-Organization-ID
      -> PostgreSQL (app schema, RLS enabled)
      -> FAISS index + map files on local filesystem
      -> Google AI APIs (embeddings + generation)
```

Core implementation files:
- Backend app bootstrapping: `backend/app/main.py`
- Ticketing + AI chat pipeline: `backend/app/tickets.py`
- RAG retrieval: `backend/app/rag.py`
- CASPER scoring/routing: `backend/app/rag_scoring.py`
- KB ingest and vectorization: `backend/app/kb.py`
- Vector storage/snapshots/rebuild: `backend/app/store.py`
- Frontend API client + org context: `frontend/src/lib/api-client.ts`, `frontend/src/contexts/OrganizationContext.tsx`

## 3. Component Design

### 3.1 Frontend

Implemented stack:
- Next.js `15.5.12`, React `19.1.0`, TypeScript
- Supabase JS client for auth session/token
- API client wrapper that injects `Authorization` and `X-Organization-ID`

Implemented UI areas (route groups):
- Public: login/signup/auth callback/invite acceptance
- Protected: dashboard, tickets, ticket detail, rep queue, KB, analytics, organizations, admin

Implemented frontend caching:
- In-memory GET response cache in `api-client.ts`
- TTL: 30 seconds
- Invalidation: on mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`) by endpoint prefix

### 3.2 Backend API Layer

FastAPI routers mounted in `main.py`:
- `/api/auth`
- `/api/organizations`
- `/api/kb`
- `/api` (tickets + chat)
- `/api/rep`
- `/api/admin`
- `/api/ai` (feedback)
- invite endpoints under `/api/organizations/{org_id}/invites` and `/api/invites/{token}`

Cross-cutting middleware and controls:
- Request logging middleware
- Organization context middleware
- Security headers middleware
- CORS environment-aware allowlist
- SlowAPI limiter configured, custom 429 handler

### 3.3 Data and Vector Layer

Primary storage:
- PostgreSQL tables in `app` schema

Vector retrieval storage:
- FAISS `IndexFlatIP` persisted to disk
- Mapping JSON persisted to disk
- Embeddings also persisted in DB (`app.chunks.embedding`) for rebuild
- Serialized FAISS snapshots persisted in DB (`app.faiss_snapshots`) for faster cold-start recovery

Important implemented reality:
- Retrieval uses one FAISS index file path (`data/faiss/kb.index` by default).
- Organization isolation in retrieval is enforced by DB lookup/filtering of `faiss_id` to `organization_id` when materializing chunks, not by per-org FAISS files in the current `store.py` path design.

## 4. Multi-Tenancy and Security Model

### 4.1 Tenant Context

Tenant key:
- `organization_id` stored on core entities (`tickets`, `messages`, `documents`, `chunks`, etc.)

Request scoping:
- Frontend sends `X-Organization-ID`
- Backend middleware validates membership and stores role/context in request state

Implemented org-membership cache:
- In-memory cache in `org_middleware.py`
- Key: `user_id:org_id`
- TTL: 60 seconds

### 4.2 AuthN/AuthZ

Authentication:
- Supabase-issued JWT
- Backend verifies JWT signature with `SUPABASE_JWT_SECRET` (HS256)

Authorization:
- Global role checks (`app.user_roles`)
- Organization role checks (`app.organization_members`)
- Route-level role guards for rep/admin/owner flows

### 4.3 Database Isolation

RLS:
- Enabled via migration `0010_enable_rls.sql` on organizations, memberships, tickets, messages, documents, chunks (and conditional AI tables)
- Policies gate select/insert/update/delete by org membership and role

Security headers:
- CSP, frame protection, content-type sniffing control, referrer policy, permissions policy, optional HSTS in production mode

Rate limiting:
- Endpoint-class-based limit definitions in `security.py`
- Chat-specific cooldown also enforced in-memory in tickets module

## 5. Database Design (Implemented)

## 5.1 Core Tables

Identity and access:
- `auth.users` (Supabase-managed)
- `app.user_roles`
- `app.role_requests`

Tenant model:
- `app.organizations`
- `app.organization_members`
- `app.reserved_slugs`

Ticketing:
- `app.tickets`
- `app.messages` (includes `meta` JSONB)

AI and observability:
- `app.ai_runs`
- `app.ai_feedback`

Knowledge base:
- `app.documents`
- `app.chunks` (includes `faiss_id` and `embedding float4[]`)
- `app.faiss_snapshots`

Operations:
- `app.invites`
- `app.email_logs`

### 5.2 Notable Implemented DB Patterns

- Extensive indexing on status/date/owner/organization/FAISS keys
- Triggers for organization owner safety and `updated_at` maintenance
- JSONB for settings and message metadata
- Soft operational flags for ticket attention/overdue/escalation states

## 6. Caching and Performance Strategy

Implemented caching/perf layers:

1. Frontend GET cache
- Location: `frontend/src/lib/api-client.ts`
- Type: in-memory map
- TTL: 30s

2. Organization membership cache
- Location: `backend/app/org_middleware.py`
- Type: in-memory dict
- TTL: 60s

3. User role cache
- Location: `backend/app/roles.py`
- Type: in-memory dict
- TTL: 60s
- Invalidation on role update

4. Chat request throttling
- Location: `backend/app/tickets.py`
- Type: in-memory per-ticket cooldown map
- Window: 8 seconds by default (`CHAT_COOLDOWN_SECONDS`)

5. DB connection pooling
- Async pool: `asyncpg` pool in `db.py`
- Sync pool: `psycopg_pool` in `tickets.py`

6. RAG compute micro-cache (single request)
- Location: `rag.py`
- Chunk embedding memoization on each chunk dict (`_emb`) reused by MMR/coherence/diversity within one retrieve call

7. FAISS cold-start optimization
- Binary index snapshots in `app.faiss_snapshots`
- Fallback rebuild from persisted chunk embeddings

Not implemented in current code:
- Redis or distributed cache
- Cross-instance cache invalidation

## 7. RAG and CASPER Design

### 7.1 KB Ingestion Pipeline

Implemented flow (`/api/kb/ingest`):
1. Upload file or raw text
2. Normalize and hash document
3. Create document row (`app.documents`)
4. Chunk content (`make_chunks`)
5. Insert chunk rows (`app.chunks`)
6. Generate embeddings via Google API
7. Add vectors to FAISS + map
8. Persist `faiss_id` and raw embeddings back into DB
9. Trigger background snapshot save

### 7.2 Retrieval Pipeline

Implemented flow in `rag.retrieve(...)`:
1. Embed query
2. FAISS search (headroom `TOP_K*2`, capped at 20)
3. Score threshold filter (`RAG_MIN_SCORE`)
4. Fetch chunk metadata from DB constrained by `organization_id`
5. MMR re-rank
6. Build scrubbed context and source list
7. Compute retrieval metrics:
- `context_relevance`
- `source_diversity`
- `information_density`
- `top_score`
- `score_variance`

### 7.3 CASPER Confidence Algorithm

Implemented in `rag_scoring.py` and called from chat flow via `rag.compute_confidence(...)`.

CASPER = Contextual Adaptive Scoring with Probabilistic Ensemble Ranking.

Implemented elements:
1. Query intent classification into:
- factual
- procedural
- troubleshooting
- comparison

2. Intent-adaptive weight blending:
- softmax over intent confidence
- blended factor weights across six factors

3. Factor set used in score:
- retrieval quality
- citation coverage
- semantic coherence
- response completeness
- information density
- source diversity

4. Penalties:
- citation penalty when no citations used
- uncertainty phrase penalty
- retrieval spread penalty based on score variance

5. KB-density calibration:
- confidence calibration function based on KB chunk count

6. Confidence interval:
- lower/upper bounds around point estimate

7. Adaptive escalation threshold:
- threshold adjusted by query intent + KB density + context relevance

Chat endpoint persists:
- confidence
- confidence breakdown
- retrieval metrics
- escalation reasoning

### 7.4 CASPER Ticket Routing

Implemented in ticket creation and admin bulk auto-assign:
- `profile_ticket(title, description)` computes:
  - intent + intent scores
  - complexity
  - urgency
  - suggested `priority_level` (P1-P7)
  - `requires_senior`
  - routing reason
- `casper_route(profile, reps)` selects assignee using seniority and load

Where applied:
- Real-time ticket creation path (`/api/tickets`)
- Admin batch endpoint (`/api/admin/auto-assign`)

## 8. Key Runtime Flows

### 8.1 Login + Context Bootstrap

1. User authenticates via Supabase
2. Frontend obtains access token
3. Frontend calls `/api/auth/context`
4. Backend returns user + org memberships
5. If no org exists, backend auto-creates default org and owner membership
6. Frontend stores current org and includes `X-Organization-ID` for subsequent calls

### 8.2 Ticket Creation

1. Create ticket + first message in transaction
2. Apply org default ETR if configured
3. CASPER profile + route assignment
4. Update priority_level and assignee (if route candidate exists)
5. Write system routing note message
6. Async email notifications

### 8.3 AI Chat on Ticket

1. Validate ticket access by role/owner and org
2. Enforce per-ticket cooldown
3. Scrub query
4. Retrieve RAG chunks and metrics
5. Generate AI response (structured path then fallback)
6. Compute CASPER confidence + adaptive escalation decision
7. Persist AI message metadata and optional system escalation message
8. Flag ticket `needs_attention` when escalation criteria hit
9. Log AI run metrics and optional rep notification email

### 8.4 Startup Recovery

At app startup:
- Initialize async DB pool
- Check vector index path
- If index file missing:
  - try loading latest binary snapshot from DB
  - otherwise rebuild FAISS from stored chunk embeddings
- Start periodic overdue scanner task

## 9. Operational and Deployment Architecture

Implemented deployment posture in repo:
- Backend deploy target definition in `render.yaml`
- Frontend configured as standard Next.js app (commonly Vercel in project docs)
- Environment variable-driven runtime wiring for DB, Supabase, Google AI, email

Background operations implemented in backend:
- Overdue scan loop every 15 minutes:
  - auto-attention flags by threshold
  - overdue marking
  - reminder/ETR notification handling

## 10. Implemented Limitations (Important)

This section intentionally lists current implementation limits, not roadmap items.

- In-memory caches/cooldowns are process-local and non-distributed
- FAISS is file-based in app runtime; persistence durability depends on host filesystem + DB snapshots
- Mixed sync (`psycopg`) and async (`asyncpg`) DB access patterns coexist across modules
- Some modules perform best-effort exception swallowing around non-critical CASPER/email actions to avoid blocking primary ticket flows

## 11. Appendix: Critical Files for Architecture Ownership

- App lifecycle + middleware + router composition: `backend/app/main.py`
- Org context and membership cache: `backend/app/org_middleware.py`
- Role cache and role mutation: `backend/app/roles.py`
- Ticket lifecycle + chat endpoint: `backend/app/tickets.py`
- RAG retrieval + scoring bridge: `backend/app/rag.py`
- CASPER algorithm + routing: `backend/app/rag_scoring.py`
- KB ingestion/search: `backend/app/kb.py`
- Vector storage/snapshot/rebuild: `backend/app/store.py`
- DB pool management: `backend/app/db.py`
- Frontend API client and GET cache: `frontend/src/lib/api-client.ts`
- Frontend organization state/context: `frontend/src/contexts/OrganizationContext.tsx`
- Foundational schema migrations: `backend/migrations/0002_kb.sql`, `backend/migrations/0003_tickets_core.sql`, `backend/migrations/0004_ai_chat.sql`, `backend/migrations/0007_organizations.sql`, `backend/migrations/0010_enable_rls.sql`, `backend/migrations/0019_chunk_embeddings.sql`, `backend/migrations/0020_faiss_snapshots.sql`
