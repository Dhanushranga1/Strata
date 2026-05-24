# TicketPilot MVP Build Plan

## 1. MVP Scope & Success Criteria

• **Core Function**: Customers submit support tickets, AI answers from ingested docs/KB/past tickets with citations
• **Ingestion**: Manual file upload or text paste by reps only - no crawlers or scheduled jobs
• **Escalation**: Auto-recommend or manual escalate when AI confidence is low or no relevant context found  
• **Success**: Working Supabase login, ticket creation, AI responses with source citations, manual KB ingestion
• **Rep Access**: Simple queue view of open/escalated tickets with ability to respond and close
• **Non-Goals**: No multi-tenant, analytics, queues, SSE/WebSockets, role admin, notifications, Docker, CI/CD

## 2. Minimal Page Map (Next.js)

### /login
• **Fields**: Email, password  
• **Actions**: Sign in via Supabase Auth UI, redirect to /tickets or /rep based on role
• **States**: Loading spinner during auth, error message for failed login

### /tickets  
• **Fields**: Ticket list showing (title, status chip, updated_at)
• **Actions**: "New Ticket" modal with title/product/description/optional file, click to view ticket
• **States**: "No tickets yet" when empty, loading skeleton during fetch

### /tickets/[id]
• **Fields**: Header (title, status), chat messages with role labels, citations under AI messages
• **Actions**: Send message, "Escalate" button (disabled if escalated/closed), view citation sources
• **States**: Message sending indicator, "Generating response..." for AI replies

### /rep
• **Fields**: Two columns (Open tickets, Needs attention/escalated), "Add Source" button top-right
• **Actions**: Click ticket to open chat view, ingest modal (file/text upload), close ticket toggle
• **States**: "No tickets" in each column when empty, upload progress for ingestion

## 3. API Surface (FastAPI)

### GET /api/health
• **Auth**: None  
• **Response**: `{"status": "ok"}`
• **Errors**: 500 if backend unhealthy

### POST /api/kb/ingest
• **Auth**: Supabase JWT (rep only)
• **Request**: `{"text": "optional string", "file": "multipart/form-data", "product": "optional string"}`
• **Response**: `{"source_id": "uuid", "chunks_count": 12}`
• **Errors**: 401 unauthorized, 400 file too large, 409 duplicate content

### POST /api/tickets  
• **Auth**: Supabase JWT
• **Request**: `{"title": "string", "product": "optional string", "description": "string", "file": "optional multipart"}`
• **Response**: `{"ticket_id": "uuid"}`
• **Errors**: 401 unauthorized, 400 missing required fields, 413 file too large

### GET /api/tickets
• **Auth**: Supabase JWT
• **Request**: Query param `?role=rep` for rep queue view
• **Response**: `{"tickets": [{"id": "uuid", "title": "string", "status": "open|escalated|closed", "updated_at": "iso-date"}]}`
• **Errors**: 401 unauthorized, 400 invalid role

### GET /api/tickets/{id}
• **Auth**: Supabase JWT  
• **Response**: `{"ticket": {"id": "uuid", "title": "string", "status": "string"}, "messages": [{"id": "uuid", "role": "user|assistant|rep|system", "text": "string", "citations": [...], "created_at": "iso-date"}]}`
• **Errors**: 401 unauthorized, 403 forbidden (not your ticket), 404 not found

### POST /api/chat
• **Auth**: Supabase JWT
• **Request**: `{"ticket_id": "uuid", "user_message": "string"}`  
• **Response**: `{"ai_message": "string", "citations": [{"source_id": "uuid", "chunk_id": "uuid", "source_title": "string"}], "confidence": 0.85, "escalate_recommended": false}`
• **Errors**: 401 unauthorized, 404 ticket not found, 500 LLM/FAISS error

### POST /api/tickets/{id}/escalate
• **Auth**: Supabase JWT
• **Request**: Empty body
• **Response**: `{"status": "escalated", "message": "Ticket escalated to support team"}`
• **Errors**: 401 unauthorized, 404 not found, 409 already escalated/closed

## 4. Data Model (Postgres)

### Tables
```
tickets(id UUID, user_id UUID, title TEXT, product VARCHAR, status ENUM['open','escalated','closed'], created_at TIMESTAMP)
messages(id UUID, ticket_id UUID, role ENUM['user','assistant','rep','system'], text TEXT, citations JSONB, created_at TIMESTAMP)
kb_sources(id UUID, title TEXT, product VARCHAR, type ENUM['file','text'], location TEXT, created_at TIMESTAMP)
kb_chunks(id UUID, source_id UUID, chunk_index INT, text TEXT)
user_roles(user_id UUID PRIMARY KEY, role VARCHAR DEFAULT 'customer')
```

### Indexes
• `tickets(user_id, status)` - filter user's tickets by status  
• `messages(ticket_id, created_at)` - ordered message retrieval
• `kb_chunks(source_id, chunk_index)` - chunk ordering within source

## 5. RAG Flow

### Ingestion Pipeline
• **Normalize**: Clean text, handle encodings, extract from PDF/DOCX
• **Chunk**: Fixed 600 chars with 100 char overlap, preserve chunk order
• **Embed**: Call Gemini embeddings API for each chunk
• **Store**: Insert vectors into FAISS, save mapping `{faiss_id: kb_chunk_id}` to JSON
• **Persist**: Write FAISS index to `./data/faiss.index`, mapping to `./data/faiss_map.json`

### Retrieval Pipeline  
• **Query Embed**: Convert user message to vector via Gemini
• **Search**: FAISS similarity search for top-K (default 8) chunks
• **Fetch**: Load chunk texts from Postgres using mapped IDs
• **Context**: Build prompt with retrieved chunks (max 4000 tokens)
• **Generate**: Call Gemini with context + query, extract citations from response
• **Confidence**: If top-1 similarity < 0.3 OR no citations found → `escalate_recommended=true`

## 6. Assumptions to Lock

• **Chunking**: 600 char chunks, 100 char overlap
• **Retrieval**: K=8 results, min similarity threshold=0.3
• **File limits**: Supports pdf/txt/md/docx, max 10MB per file
• **Context window**: Max 4000 tokens for RAG context
• **FAISS storage**: Index at `./data/faiss.index`, mappings at `./data/faiss_map.json`
• **Timestamps**: All times in ISO 8601 UTC format
• **Session timeout**: 24 hours for JWT tokens
• **Rate limits**: 10 tickets per user per hour, 100 messages per ticket

## 7. Auth & Security

• **JWT Validation**: FastAPI validates Supabase JWT on all protected endpoints using SUPABASE_JWT_SECRET
• **Role Detection**: Check `user_roles` table first, default to 'customer' if not found
• **Rep List**: Fallback to environment variable REP_USER_EMAILS (comma-separated) if no DB entry
• **PII Scrubbing**: Regex remove emails, phone numbers, SSNs before sending to Gemini
• **Ticket Access**: Customers see only their tickets, reps see all open/escalated
• **CORS**: Allow only frontend origin specified in FRONTEND_URL env var

## 8. Env Vars & Config

• `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL for frontend auth
• `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key for Supabase client
• `SUPABASE_JWT_SECRET` - Secret for JWT verification in backend
• `DATABASE_URL` - PostgreSQL connection string  
• `GEMINI_API_KEY` - Google AI API key for embeddings and generation
• `FAISS_INDEX_PATH` - Location of persisted FAISS index (default: ./data/faiss.index)
• `RAG_TOP_K` - Number of chunks to retrieve (default: 8)
• `RAG_MIN_SIM` - Minimum similarity threshold for escalation (default: 0.3)
• `FRONTEND_URL` - Allowed CORS origin for API calls

## 9. Manual Test Plan

### Happy Path
Sign in → Create ticket with "How do I reset password?" → AI answers with 2+ citations → Add follow-up "What if I forgot email?" → AI responds → Close ticket

### Edge Cases
• **No KB match**: Query "alien spaceship manual" → escalate_recommended=true → escalate button works
• **Large file rejected**: Upload 15MB PDF → client and server both reject with size error
• **Duplicate ingest**: Upload same doc twice → second attempt returns "already ingested" 
• **Rep queue view**: Rep login shows only open/escalated tickets, not closed ones
• **Auth failure**: Invalid JWT returns 401, can't access other user's tickets (403)
• **FAISS reload**: Stop backend, restart → existing queries still return same results

## 10. Step-by-Step Build Order

1) Setup Next.js with Supabase Auth, create /login, /tickets, /tickets/[id], /rep pages with static content
2) Create FastAPI app with health endpoint and JWT middleware using python-jose
3) Setup Postgres, create all tables with indexes, add test user with rep role  
4) Implement /kb/ingest: file parsing → chunking → Gemini embed → FAISS index → persist to disk
5) Build ticket CRUD endpoints: POST /tickets, GET /tickets, GET /tickets/{id}
6) Implement /chat endpoint: FAISS search → fetch chunks → Gemini completion → save message with citations
7) Connect frontend to API: auth flow, ticket creation, chat interface with citation display
8) Add escalation: frontend button, POST /tickets/{id}/escalate, update rep queue view
9) Test all flows end-to-end, fix only critical blockers

## 11. Acceptance Checklist

- [ ] Supabase login works, unauthorized API calls return 401
- [ ] File and text ingestion creates searchable FAISS index that persists across restarts  
- [ ] New ticket receives AI answer with clickable citations showing source and chunk
- [ ] Low-confidence responses show escalation prompt, escalate button updates status
- [ ] Rep page displays open/escalated tickets, clicking opens same chat interface
- [ ] No features beyond this spec are implemented (no SSE, no analytics, no Docker)
