# TicketPilot Project Report - Chapter 6

This chapter describes the system architecture of TicketPilot, covering the frontend, backend, database, AI pipeline, and API design decisions.

---

## 6.1 Overall Architecture

TicketPilot is built on a multi-tier architecture that separates concerns across four distinct layers: presentation, application logic, data storage, and AI services. This separation ensures each layer can be reasoned about, tested, and scaled independently.

### Architectural Layers

- **Presentation Layer**: A Next.js 15 (App Router) frontend served via Vercel, providing role-specific dashboards for customers, support representatives, and administrators.
- **Application Layer**: A FastAPI backend hosted on Render, responsible for authentication, business logic, AI workflows, and notification delivery.
- **Data Layer**: PostgreSQL via Supabase, using an `app` schema with Row-Level Security (RLS) policies to enforce strict tenant isolation at the database level.
- **AI Layer**: A custom RAG pipeline using FAISS for vector retrieval, Google Gemini for embeddings and response generation, and the CASPER algorithm for confidence scoring and adaptive routing.

### Key Architectural Principles

- **Multi-tenant isolation**: Every table includes `organization_id`. RLS policies ensure cross-tenant data leakage is impossible even if an application bug exists.
- **Role-based access control**: Admin, rep, and customer permissions are enforced at both the API middleware layer and the frontend routing layer.
- **Human-in-the-loop AI**: AI-generated drafts assist representatives but all responses require human review and submission.
- **Performance by design**: Dual connection pooling, multi-layer in-memory caching, and targeted DB indexes reduced the representative p95 response time from ~3,200 ms to ~380 ms.
- **Non-blocking side effects**: Email and in-app notifications are dispatched in background threads so they never add latency to the user-facing request.

---

## 6.2 Backend Architecture (FastAPI)

The backend is built with FastAPI, providing asynchronous request handling, automatic OpenAPI documentation, and Pydantic-based schema validation across all endpoints.

### Core Components

- **Auth Layer**: Every protected request is validated against a Supabase-issued JWT. The token is decoded using the configured `SUPABASE_JWT_SECRET`, and the resolved user identity is injected into the request context.
- **Org Context Middleware**: Before any business logic executes, the middleware reads the `X-Organization-ID` header and verifies that the authenticated user is an active member of the requested organisation. Membership lookups are cached in memory with a 60-second TTL to avoid repeated DB queries.
- **Role Cache**: User roles are cached per `user_id` with a 60-second TTL and invalidated explicitly on role updates, eliminating per-request role lookups.

### Routers and Modules

| Route Prefix | Responsibility |
|---|---|
| `/api/auth` | Session management, user context, org resolution |
| `/api/organizations` | Org creation, settings, invite management |
| `/api/tickets` | Ticket lifecycle, messaging, AI chat, bulk operations |
| `/api/rep` | Queue management, rep actions, cross-org my-tickets view |
| `/api/kb` | Knowledge base ingestion, chunking, semantic search |
| `/api/admin` | Analytics, user management, audit log, auto-assignment |
| `/api/notifications` | In-app notification feed, read/delete actions |

### Connection Pool Strategy

Two pools run in parallel to stay within Supabase's free-tier connection limit of 5 concurrent connections:

- **asyncpg pool** (`db.py`): min=2, max=10 — used by all native async routes (admin, rep, notifications).
- **psycopg3 sync pool** (`db_sync.py`): min=1, max=8 — used by ticket routes and background threads. This is the only pool safe to call from non-async contexts such as notification fire-and-forget threads.

Both pools warm up at startup with a test query to avoid cold-start latency on the first real request.

### Supporting Services

- **Rate limiting**: Endpoint-specific throttling on expensive operations (AI chat, KB ingest).
- **Structured logging**: Request IDs and error context for full traceability.
- **Background threads**: Email and in-app notifications are dispatched using `threading.Thread(daemon=True)`, keeping response times independent of email provider latency.

### Backend Data Flow

1. Request arrives at a REST endpoint.
2. JWT is validated; user identity is extracted.
3. Org Context Middleware confirms membership for the requested `organization_id`.
4. Business logic executes with pooled DB connections.
5. Side effects (notifications, emails, audit log entries) are dispatched in background threads.
6. Serialized JSON response is returned to the frontend.

---

## 6.3 Frontend Architecture (Next.js)

The frontend is implemented with Next.js 15 (App Router) and TypeScript, using Tailwind CSS and shadcn/ui for the component layer. All pages within the `(protected)` route group require authentication and inject the active organisation ID into every API request via `OrganizationContext`.

### Key Features

- **Role-based routing**: Customers see ticket creation and tracking. Reps see the queue console and AI tools. Admins see analytics, user management, audit logs, and org settings.
- **Organisation context**: A React context provider resolves the user's org on mount and injects `X-Organization-ID` into all API calls.
- **Frontend GET cache**: `api-client.ts` maintains an in-memory Map with a 30-second TTL per endpoint. Mutating requests (POST/PATCH/DELETE) auto-invalidate the relevant prefix, reducing redundant requests across page navigations.
- **Dark mode**: Persisted to `localStorage` with a system `prefers-color-scheme` fallback. Toggled via the Tailwind `dark` class on `document.documentElement`.

### Frontend Modules

| Module | Description |
|---|---|
| **Auth UI** | Login, signup, magic-link, invite acceptance |
| **Customer UI** | Ticket creation, message thread, status tracking |
| **Rep Console** | Queue lanes, AI assist, escalation, my-tickets cross-org view |
| **Admin UI** | Analytics, user management, org settings, audit log, ticket management |
| **Sidebar** | Navigation, notification bell (polling every 30 s), dark mode toggle |

---

## 6.4 Database Architecture (PostgreSQL with RLS)

TicketPilot uses PostgreSQL (Supabase) as its single system of record. All application tables reside in the `app` schema and are protected by Row-Level Security policies.

### Isolation Model

Every table that stores tenant data includes an `organization_id` column. RLS policies require that the authenticated user's org membership matches the row's `organization_id`. This means data isolation is enforced at the database level as a second boundary, independent of the API layer.

### Core Tables

| Table | Purpose |
|---|---|
| `organizations` | Tenant root; holds name, slug, settings JSONB |
| `organization_members` | Maps users to orgs with a role |
| `tickets` | Full ticket lifecycle with status, priority, ETR, escalation |
| `messages` | Per-ticket thread; supports rep, customer, system, and AI sender roles |
| `documents` / `chunks` | Knowledge base; chunks store 3072-dim embeddings |
| `ai_runs` / `ai_feedback` | AI response history and rep thumbs-up/down feedback |
| `invites` | Email-based invite tokens with expiry and status |
| `notifications` | Per-user in-app notification feed with unread tracking |
| `audit_log` | Platform-wide action history with actor, resource, and metadata |
| `faiss_snapshots` | Binary FAISS index snapshots for cold-start recovery |
| `email_logs` | Outbound email audit trail |

### Indexing Strategy

Targeted indexes are applied on the most-queried column combinations:

- `(organization_id, status)` and `(organization_id, priority)` on tickets
- `(user_id, org_id) WHERE read_at IS NULL` on notifications (partial index for unread badge counts)
- `(ticket_id, sent_at)` on email_logs for deduplication
- `(needs_attention, organization_id)` for queue filtering

---

## 6.5 RAG and AI Architecture

The RAG (Retrieval-Augmented Generation) pipeline provides grounded AI responses using each organisation's own knowledge base. It is invoked when a representative uses the AI chat feature on a ticket.

### Pipeline Stages

1. **Ingestion**: Documents are chunked (2400-char chunks, 400-char overlap) and embedded using Google Gemini (`text-embedding-004`, 3072 dimensions). Embeddings are stored in both the FAISS index and the `chunks.embedding` column for persistence.
2. **Cold-start recovery**: On startup, if no FAISS index file exists on disk, the system loads a binary snapshot from `app.faiss_snapshots` (~50 ms). If no snapshot exists, it rebuilds from chunk embeddings in the DB (~4 s for a 500-chunk KB).
3. **Retrieval**: The query is embedded and used to search the FAISS index. Candidates are over-fetched (2–4× TOP_K depending on query intent) before re-ranking.
4. **MMR re-ranking**: Maximal Marginal Relevance re-ranks chunks with an intent-adaptive lambda — 0.82 for factual queries (precision-first) down to 0.48 for comparison queries (diversity-first).
5. **CASPER scoring**: The CASPER algorithm classifies query intent, blends per-intent weight vectors via softmax, applies KB-density calibration, and computes a confidence score with an interval. The escalation threshold is adaptive rather than fixed, ranging from 0.40 to 0.72 depending on intent and KB richness.
6. **Generation**: Gemini generates a response grounded in the retrieved chunks. The response is returned with source citations and the CASPER confidence score.
7. **Escalation flag**: If confidence falls below the adaptive threshold, the UI surfaces a "Consider escalating" banner. The rep retains full control over whether to send, edit, or escalate.

### CASPER Routing (Ticket Assignment)

At ticket creation, `profile_ticket()` computes an urgency and complexity score from the title and description using intent classification and vocabulary signals. `casper_route()` then selects the best-fit rep: high-complexity or high-urgency tickets are routed to admins or senior reps; others go to the rep with the lowest current load. Every assignment is recorded as a system message in the ticket thread.

---

## 6.6 Security Model

Security is enforced at multiple independent layers so that no single failure exposes tenant data.

| Layer | Mechanism |
|---|---|
| **Transport** | HTTPS enforced on both Vercel and Render |
| **Authentication** | Supabase JWT on every protected request |
| **Org membership** | Middleware check before any business logic runs |
| **Database** | Row-Level Security as a hard enforcement boundary |
| **Invites** | Tokens expire after 7 days; `service_role` key never exposed to clients |
| **Audit trail** | Every action recorded in `app.audit_log` with actor and metadata |

---

## 6.7 API Design and Data Flow

All APIs follow REST conventions with uniform JSON response structures, mandatory JWT authentication, and org-scoped access on every protected route.

### Design Principles

- **Consistency**: Uniform error shapes and response envelopes across all endpoints.
- **Security**: JWT + org context validated before any DB query executes.
- **Pagination**: All list endpoints accept `offset` and `limit` to support large datasets.
- **Bulk operations**: `/api/tickets/bulk` accepts up to 100 ticket IDs in a single request, using `WHERE id = ANY(%s::uuid[])` for a single-query batch update.
- **Traceability**: Timestamps, actor IDs, and audit log entries included on all mutating operations.

### Example Flow: AI Chat Request

1. Rep types a query and triggers the AI assistant.
2. UI sends `POST /api/tickets/{id}/chat` with `X-Organization-ID` header.
3. Backend validates JWT and org membership.
4. RAG pipeline embeds the query, retrieves and re-ranks chunks, scores with CASPER, and calls Gemini.
5. Response is returned with draft, citations, confidence score, and escalation flag.

### Example Flow: Ticket Creation with Auto-Routing

1. Customer submits ticket form.
2. UI sends `POST /api/tickets`.
3. Backend saves the ticket, then calls `profile_ticket()` and `casper_route()` in a background thread.
4. Assigned rep receives an in-app notification and an email.
5. Ticket appears in the rep queue and admin analytics immediately.

---

This architecture enables TicketPilot to operate as a secure, scalable, and AI-assisted support platform — maintaining strict data isolation across tenants while delivering sub-400 ms responses under typical load.
