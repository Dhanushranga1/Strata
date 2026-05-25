# TicketPilot — Production Readiness & Sellability Plan

> **Live document** — updated as phases are completed.  
> Each phase lists concrete items with file paths.

---

## ✅ Completed

| Area | Items |
|------|-------|
| **Security & Crash Bugs** | JWT bypass in org middleware, SSL for Supabase pooler, cross-org data leak, admin demotion race, stale JWT role checks, FAISS concurrent read/write race, error boundaries, 401 retry, unmounted state leak |
| **Data Correctness** | Citation coverage cap, savepoint rollback, missing psycopg import, zero-vector FAISS handling, embedding fallback shape, org membership for assign, custom fields validation, admin org list pagination, re-render loop, dark mode toggle |
| **Production Hardening** | Rate limit via X-Forwarded-For, circuit breaker 1→3, fetch timeout, GET cache LRU, cache invalidation paths, cross-tab sync closure, invite rate limit, async httpx, forgot password fix, Python 3.10 compat, NODE_ENV→ENVIRONMENT, loading.tsx, switchOrganization delay, useAuthHeaders rename |
| **Observability** | Structured error codes, JWT error leaking, validation input logging, credit card Luhn check, latency=None on failure, FAISS snapshot lock, health endpoint improvements |
| **Dev/Prod Separation** | Env templates (dev/prod), Docker Compose, Makefile, migration_runner.py, setup-dev.sh, Render-only deploy |
| **BYOK AI System** | DB-backed AI settings (`app.ai_settings`), API endpoints (`GET/PUT /api/admin/ai-settings`), frontend settings page (`/admin/settings/ai`), provider-agnostic ai.py/embeddings.py (auto-detect gemini/gpt/claude/groq from model name), key masking in UI, masked-key protection in PUT |
| **AI Integration** | ES256 JWT support (Supabase JWKS endpoint), Groq provider support, Google Gemini embedding + generation, 429 retry backoff |
| **RAG Pipeline Fixes** | MMR auto-disabled when KB < 50 chunks, FAISS rebuild syncs faiss_id to DB, MOC.md removed from KB (TOC doc polluted rankings), score clustering skip for MMR |
| **DB Migrations** | 0028_ai_runs_org_id, 0029_ai_settings, 0030_fix_sender_role_check |

---

## Phase 4 — Test Coverage & CI (blocks PR merge)

**Goal**: Tests pass in CI pipeline so dev→main PR can merge.

### 4.1 Backend auth tests
- **New**: `backend/tests/test_auth.py`
- JWT verification (valid, expired, invalid signature, wrong alg, missing header)
- ES256 via JWKS, HS256 fallback
- Org middleware with valid/invalid token
- Role caching (60s TTL)
- Rate limit key extraction

### 4.2 Backend org tests
- **New**: `backend/tests/test_organizations.py`
- CRUD, slug validation, member management
- Role checks, invite accept flow
- Cross-org data isolation

### 4.3 Backend ticket tests
- **New**: `backend/tests/test_tickets.py`
- CRUD, assign (with cross-org rejection)
- Status transitions, message flow, priority/SLA
- AI chat endpoint (RAG integration)

### 4.4 Backend RAG tests
- **New**: `backend/tests/test_rag.py`
- MMR re-ranking, context building
- Citation parsing, embedding fallback
- Zero-vector handling, concurrent search/ingest
- CASPER confidence scoring

### 4.5 Frontend API client tests
- **New**: `frontend/src/__tests__/lib/api-client.test.ts`
- Auth header injection, GET caching
- Cache invalidation, 401 retry with refresh
- 502/503 retry, timeout via AbortController

### 4.6 Frontend auth context tests
- **New**: `frontend/src/__tests__/contexts/OrganizationContext.test.tsx`
- Load state, auth context, org switching
- Error states, cross-tab sync, unmount cleanup

### 4.7 CI workflow fixes
- **File**: `.github/workflows/ci-development.yml`
- Ensure all lint/format commands match current setup
- Add npm audit check (soft-fail)
- Add security headers test
- Verify `rag_validation_suite.py` works against test DB

### 4.8 Backend test fixtures
- **New**: `backend/tests/conftest.py`
- Pytest fixtures: test DB connection, test org, test user, test JWT token

### 4.9 Frontend test infrastructure
- **Files**: `frontend/jest.config.js`, `frontend/jest.setup.js`
- Fix `@/` path aliases in jest config
- Add `@testing-library/jest-dom` imports

---

## Phase 5 — Sellability Features

**Goal**: Features enterprise customers require to buy.

### 5.1 Audit trail frontend
- **Table**: `app.audit_log` already exists (migration 0022)
- **API**: `GET /api/admin/audit-log` already exists
- **Build**: Admin audit log view page with filters, pagination
- **Events**: ticket create/update/assign/close, org member changes, role changes, KB upload/delete, invites

### 5.2 API tokens
- **New table**: `app.api_tokens` (migration 0031)
- **Features**: 32-byte hex token, last_used_at, expiry, permission scopes, per-org binding
- **Auth**: Custom `X-API-Key` header → lookup token → impersonate owner user
- **Frontend**: Token management page in org settings

### 5.3 Rate limit headers
- **File**: `backend/app/security.py`
- Add `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` to all responses via middleware

### 5.4 Data export
- **New endpoint**: `GET /api/organizations/{id}/export`
- Scope: tickets (with messages), KB documents, settings, audit log
- Format: JSON archive (tar.gz), async with email notification

### 5.5 Usage tracking / billing
- **New table**: `app.usage_events` (migration 0032)
- Events: ticket created, AI query, KB upload, API call
- Plans: tier limits (tickets/month, AI queries/month, storage GB)
- Frontend: usage dashboard in org settings

### 5.6 Status page
- **New route**: `GET /api/status` — public, no auth
- Checks: DB, FAISS, LLM reachability, last background task run time
- Frontend: optional public status page at `/status`

### 5.7 Webhook system
- **New table**: `app.webhooks` (migration 0033)
- Events: ticket.created/updated/assigned/resolved, message.created
- Config: URL, secret (HMAC), event filters, retry policy
- Delivery: background task with exponential backoff, dead-letter after 24h

---

## Phase 6 — Enterprise Scale Hardening

**Goal**: Handle 1000+ orgs and 100+ concurrent users.

### 6.1 FAISS per-org lock cleanup
- **File**: `backend/app/store.py`
- Clean up `_per_org_locks` dict when org is deleted or cache evicted
- Prevent unbounded growth with thousands of orgs

### 6.2 Embedding API circuit breaker
- **File**: `backend/app/embeddings.py`
- After 3 consecutive failures, wait 60s before retrying
- Covers Jina/Gemini/Groq/OpenAI API calls

### 6.3 Database connection pool tuning
- **File**: `backend/app/db.py`
- Make pool size, timeouts, retries configurable via env vars

### 6.4 Background task monitoring
- **File**: `backend/app/main.py`
- Health endpoint reports last run time, duration, success/failure for: overdue scan, pool keepalive, FAISS rebuild

### 6.5 Frontend offline detection
- **New**: `frontend/src/lib/network.ts`
- `navigator.onLine` detection, offline banner, queue mutations for retry

---

## Phase 7 — Polish

**Goal**: Developer experience and maintainability.

### 7.1 Operations documentation
- **New**: `docs/operations.md`
- Deployment checklist, monitoring setup, backup procedures, incident response runbook, scaling guide

### 7.2 Known issues cleanup
- Remove stale root docs (`DEPLOYMENT.md`, `CI_CD_DOCUMENTATION.md`, etc.) that were copied during Obsidian sync
- Consolidate into `docs/` folder

---

## Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| 0–3 — Core Fixes | ✅ | Security, correctness, hardening, observability |
| Dev/Prod Separation | ✅ | Env templates, Docker, Makefile, migration runner |
| BYOK AI System | ✅ | DB config, UI settings, provider-agnostic |
| RAG Pipeline Fixes | ✅ | MMR auto-disable, faiss_id sync, MOC removal |
| 4 — Tests & CI | ⬜ | Blocks PR merge — start here |
| 5 — Sellability | ⬜ | Audit UI, API tokens, billing, webhooks |
| 6 — Enterprise Scale | ⬜ | FAISS cleanup, circuit breaker, pool tuning |
| 7 — Polish | ⬜ | Operations docs, stale file cleanup |
