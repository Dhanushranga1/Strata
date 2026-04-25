# FastAPI Backend Architecture - TicketPilot Interview Guide

## 1) High-Level Backend Architecture (6 Bullets)

- **Client (Next.js)**: Sends HTTP requests with JWT auth header → connects to FastAPI endpoints
- **API Layer (FastAPI)**: Receives requests → validates with Pydantic schemas → routes to service logic via routers
- **Auth (Supabase + Middleware)**: JWT verification → extract user_id & org_id → set session variables for RLS
- **DB (PostgreSQL + Supabase)**: RLS-enforced queries filter by org_id → ensure multi-tenant isolation automatically
- **Vector Store (FAISS)**: In-memory index of document embeddings → semantic similarity search (sub-millisecond retrieval)
- **LLM (Google Gemini)**: Receives query + context from FAISS → generates structured JSON response with citations and confidence scores
- **CI/CD (GitHub Actions)**: Automated tests on PR → lint/type-check → deploy to Render on merge → zero-downtime rollout

---

## 2) FastAPI Request Lifecycle (7 Steps)

1. **HTTP Request**: Client sends `POST /api/tickets/123/ask` with JWT in Authorization header and JSON body containing user query
2. **Middleware Chain**: Request logging → JWT verification → extract user_id, org_id, role → set `app.org_id` session variable for RLS
3. **Router & Validation**: FastAPI routes to `/tickets` endpoint → Pydantic validates request body (query length, type) → raises 422 if invalid
4. **Service Logic**: Endpoint calls service function → verifies user has access to ticket (RLS auto-filters) → proceeds if authorized
5. **FAISS Retrieval**: Query embedded via Google API → FAISS searches top-5 similar chunks → filters by org_id → returns source context
6. **LLM Generation**: Context + query sent to Gemini → structured JSON response with answer, citations, confidence → parsed and validated
7. **Response**: FastAPI returns JSON to client with answer, citations (doc_id, chunk_id, scores), confidence, escalation flag, latency metadata

---

## 3) FastAPI Project Structure

**main.py**: Application entry point → initializes FastAPI app → registers middleware (logging, auth, CORS, rate limiting) → mounts routers → starts server

**routers** (auth.py, kb.py, tickets.py, rep.py, admin.py): Define HTTP endpoints by domain → use `@router.get/post/put/delete` decorators → inject dependencies (`Depends(get_current_user)`) → call service functions

**services** (ai.py, embeddings.py, store.py): Business logic layer → FAISS vector operations, LLM calls, document chunking → reusable across multiple endpoints

**schemas** (schemas.py): Pydantic models for request/response validation → ensures type safety (e.g., `TicketCreate`, `ChatRequest`, `ChatResponse`) → auto-generates OpenAPI docs

**db/session layer** (auth.py, org_middleware.py): Database connection pooling → session variable management (`SET LOCAL app.org_id`) → RLS context propagation per request

**background tasks**: FastAPI's `BackgroundTasks` for async operations like document embedding after upload → returns response immediately while processing continues

---

## 4) Authentication with Supabase + FastAPI (5 Bullets)

- **JWT Flow**: Client authenticates with Supabase → receives JWT with `sub` (user_id), `role`, `exp` claims → sends as `Authorization: Bearer <token>` on every request
- **Middleware Verification**: `get_current_user` dependency extracts JWT → verifies signature & expiry with Supabase secret → decodes to get user_id
- **User → Tenant Mapping**: Query `app.users` table with `WHERE id = user_id` → retrieves `organization_id` (tenant_id) for multi-tenancy association
- **RLS Context**: Execute `SET LOCAL app.org_id = '{org_id}'` at connection start → PostgreSQL RLS policies automatically filter all queries by this value
- **Role-Based Access**: User role (customer/rep/admin) stored in DB → checked in endpoints (e.g., `require_rep(user)`) → 403 if insufficient permissions

---

## 5) RAG Triggering Inside FastAPI (5 Bullets)

- **Entry Point**: `/api/tickets/{id}/ask` endpoint receives query → validates user access to ticket via RLS → proceeds to RAG pipeline
- **FAISS Call (Service Layer)**: `ai.py` service calls `embeddings.embed_texts([query])` → generates query embedding → calls `store.search_vectors(embedding, org_id, top_k=5)`
- **Context Assembly**: FAISS returns top-5 chunks with scores → fetch full chunk text + metadata from PostgreSQL → format as numbered context string with sources
- **LLM Invocation**: Construct prompt: system instructions + numbered context + user query → call Gemini API with structured JSON schema → request citations, confidence, escalation flags
- **Post-Processing**: Parse Gemini JSON response → validate with Pydantic (`GeminiResponse` schema) → extract citations → map FAISS IDs to doc/chunk metadata → return to client with <200ms latency

---

## 6) Concurrency & Performance (4 Lines)

**async/await**: All I/O operations (DB queries, FAISS search, LLM calls) use `async def` → non-blocking concurrency → server handles 100+ concurrent requests without thread overhead

**threadpools**: FAISS operations (CPU-bound) run in executor thread pool → prevents blocking event loop → maintains responsive API under load

**connection pooling**: PostgreSQL connections pooled (PgBouncer-style) → reuse connections across requests → SET LOCAL session vars per transaction → reduces connection overhead

**caching**: Semantic cache for embeddings (hash query → check Redis/dict → return cached result if exists) → 70% hit rate → cuts LLM costs and latency by 3x

---

## 7) Error Handling (3 Lines)

**Validation Errors**: Pydantic raises `ValidationError` for invalid request bodies → FastAPI auto-converts to 422 with field-specific error messages → client sees which fields failed

**DB Errors**: PostgreSQL exceptions (connection timeout, constraint violation) caught in endpoints → logged with context → return 500 with safe generic message (hide internal details)

**LLM Failures**: Gemini API errors (rate limit, timeout, invalid response) trigger retry logic (3 attempts, exponential backoff) → if all fail, return 503 with "AI temporarily unavailable" → escalation flag set to true

---

## 8) 60-Second Backend Explanation (120 Words)

"TicketPilot's FastAPI backend implements a production-grade multi-tenant RAG system. When a request arrives, middleware extracts the JWT, verifies it with Supabase, and sets the organization ID as a PostgreSQL session variable. This enables Row-Level Security to automatically filter all queries by tenant, preventing data leakage at the database layer.

For AI queries, the system embeds the question using Google's API, searches FAISS for the top-5 semantically similar chunks from the organization's knowledge base, and passes that context to Gemini. The LLM returns structured JSON with citations, confidence scores, and escalation signals, which we validate with Pydantic before responding.

The entire stack uses async/await for concurrency, connection pooling for performance, and comprehensive error handling with retries. CI/CD via GitHub Actions ensures tested, automated deployments to Render with 99% uptime."

---

## 9) Top 8 FastAPI Interview Questions

**Q1: What is FastAPI and why use it over Flask/Django?**
FastAPI is an async-first framework with automatic OpenAPI docs, Pydantic validation, and 3x faster performance than Flask. Native async/await support makes it ideal for I/O-heavy workloads like LLM APIs and database operations.

**Q2: How does dependency injection work in FastAPI?**
`Depends()` allows reusable dependencies (e.g., `get_current_user`) injected into endpoints. FastAPI resolves dependencies automatically, caches results per request, and enables clean separation of concerns (auth, DB connections, etc.).

**Q3: Explain async/await in FastAPI. When do you use it?**
`async def` endpoints yield control during I/O waits (DB queries, HTTP calls), allowing other requests to run concurrently. Use for I/O-bound ops; use sync `def` for CPU-bound tasks (runs in thread pool automatically).

**Q4: How do you handle authentication in FastAPI?**
Use dependency injection with `Depends(get_current_user)` that extracts JWT from headers, verifies signature, and returns user object. FastAPI automatically enforces this on protected endpoints, returning 401 if token is missing/invalid.

**Q5: What are Pydantic models and why are they important?**
Pydantic validates request/response data at runtime using Python type hints. Ensures type safety, automatic error messages for invalid data, and generates OpenAPI/JSON schemas for frontend integration—eliminates manual validation code.

**Q6: How does FastAPI middleware work?**
Middleware wraps every request/response. Executes before routing (logging, CORS, auth) and after response (headers, cleanup). Use `app.add_middleware()` or `@app.middleware("http")` decorator to inject cross-cutting concerns.

**Q7: How do you handle errors and exceptions in FastAPI?**
Register global exception handlers with `app.add_exception_handler()` for custom error responses. FastAPI auto-converts Pydantic `ValidationError` to 422, `HTTPException` to specified status, and unhandled exceptions to 500 with logging.

**Q8: How do you test FastAPI applications?**
Use `TestClient` from `fastapi.testclient` for integration tests (no server needed). Mock dependencies with `app.dependency_overrides`, test endpoints directly, and use pytest fixtures for DB setup/teardown—achieves 90%+ coverage easily.

---

## Bonus: Production Concerns in TicketPilot

**Rate Limiting**: `slowapi` library limits requests per IP/user (e.g., 100/minute) → prevents abuse, DDoS → returns 429 on exceed

**CORS Configuration**: Environment-specific origins (localhost in dev, production domain in prod) → `allow_credentials=True` for JWT cookies → prevents CSRF

**Structured Logging**: JSON logs with request_id, user_id, org_id, latency → centralized via stdout → ingested by log aggregators (Datadog, CloudWatch)

**Health Checks**: `/health` endpoint returns DB status, FAISS index size, LLM availability → Render uses for zero-downtime deployments

**Background Tasks**: Document upload returns 200 immediately → embedding/chunking happens async in background → user doesn't wait for slow operations

**Security Headers**: `SecurityHeadersMiddleware` adds CSP, X-Frame-Options, HSTS → mitigates XSS, clickjacking, man-in-the-middle attacks

---

## Key Takeaways for Interview

✅ FastAPI = async-first, Pydantic validation, auto OpenAPI docs  
✅ Request flow: Middleware → Router → Validation → Service → DB/FAISS → LLM → Response  
✅ Auth: JWT → `get_current_user` dependency → extract org_id → set RLS session var  
✅ RAG: Embed query → FAISS search → assemble context → Gemini structured JSON → validate  
✅ Async for I/O (DB, LLM), thread pool for CPU (FAISS), connection pooling for performance  
✅ Errors: Pydantic (422), DB exceptions (500), LLM retries (503) with escalation  
✅ Production: Rate limiting, CORS, structured logging, health checks, background tasks  

**Trade-Off Discussion**: FastAPI's async model is powerful but requires discipline—mixing sync/async incorrectly causes blocking. We carefully separate I/O (async) from CPU-bound (executors) to maximize concurrency without deadlocks.
