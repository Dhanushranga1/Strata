# TicketPilot — Engineering Updates & Changelog

**Document type:** Cumulative engineering journal  
**Last updated:** 2026-05-02  
**Scope:** Every meaningful change from initial MVP to present, grouped by theme.  
Each section references the git commit(s) responsible so changes can be traced.

---

## Table of Contents

1. [Initial MVP](#1-initial-mvp)
2. [Phase 1 — Foundational UX](#2-phase-1--foundational-ux)
3. [Phase 2 — Workflow Enhancements](#3-phase-2--workflow-enhancements)
4. [Phase 3 — Strategic Improvements](#4-phase-3--strategic-improvements)
5. [Email Invite System](#5-email-invite-system)
6. [Auth, CORS & Security Hardening](#6-auth-cors--security-hardening)
7. [Vercel + Render Deployment Fixes](#7-vercel--render-deployment-fixes)
8. [Database Optimization (3 s → 400 ms)](#8-database-optimization-3-s--400-ms)
9. [Onboarding & Organisation Flow Fixes](#9-onboarding--organisation-flow-fixes)
10. [Embedding Model Upgrade & Demo Seed Data](#10-embedding-model-upgrade--demo-seed-data)
11. [Next.js 15 Upgrade & Suspense Fixes](#11-nextjs-15-upgrade--suspense-fixes)
12. [FAISS Cold-Start Persistence](#12-faiss-cold-start-persistence)
13. [Rep Email Notifications](#13-rep-email-notifications)
14. [Invite Email — Resend Migration](#14-invite-email--resend-migration)
15. [Role-Based KB Access](#15-role-based-kb-access)
16. [CASPER — Adaptive RAG Scoring](#16-casper--adaptive-rag-scoring)
17. [CASPER — Automatic Ticket Routing](#17-casper--automatic-ticket-routing)
18. [UI Polish, Mobile Layout & Loading Speed](#18-ui-polish-mobile-layout--loading-speed)
19. [RAG Pipeline & CASPER Optimizations](#19-rag-pipeline--casper-optimizations)
20. [Sprint 6 — Application Completeness](#20-sprint-6--application-completeness)

---

## 1. Initial MVP

**Commit:** `Initial commit: TicketPilot MVP with Midnight Prism UI`

The baseline release established the full product skeleton:

| Area | What was shipped |
|---|---|
| Auth | Email/password signup + login via Supabase, JWT-verified backend |
| Tickets | Create/list/detail, status (open/in_progress/resolved/closed), priority |
| Messaging | Per-ticket message thread, customer + rep roles |
| AI Chat | RAG-backed `/api/tickets/:id/chat` endpoint — query → embed → FAISS → LLM → response |
| Knowledge Base | Document ingest (file/text/URL), chunking, embedding, FAISS indexing |
| UI | "Midnight Prism" dark design system, Sidebar, Dashboard, Tickets, KB, Rep Console pages |
| Deployment | `render.yaml` for backend, Vercel-ready Next.js frontend |

Database migrations 0001–0004 created:
- `app.user_roles`, `app.kb` (documents + chunks), `app.tickets`, `app.messages`, `app.ai_runs`

---

## 2. Phase 1 — Foundational UX

**Commit:** `Phase 1: Foundational UX improvements`

- Ticket status badges and priority colour coding standardised
- Responsive ticket list with sorting and status filters
- Real-time relative timestamps on messages
- Skeleton loaders on tickets list and ticket detail
- Rep Console queue with lane tabs (Needs Attention / Open / Escalated / All)
- Mobile-friendly card layout for ticket list
- Page-level animations via `framer-motion`

---

## 3. Phase 2 — Workflow Enhancements

**Commit:** `Phase 2: Workflow enhancements for rep productivity`

- **Quick Actions bar** on rep queue cards: Respond, Call, Email, AI Suggest
- **AI Suggestion modal** — rep can request a draft reply for any ticket directly from the queue
- **KB Ingest modal** — reps can upload documents without leaving the queue
- **ETR (Expected Time to Resolve)** — reps set and track resolution deadlines per ticket
- **Escalation dialog** — reps can escalate tickets to a named admin/owner with a reason field
- **`needs_attention` flag** — tickets auto-flagged when AI confidence is low or escalation criteria met
- **Auto-refresh** — queue polls every 30 seconds, last-refresh timestamp shown
- **Mine Only toggle** — reps default to seeing their own tickets; toggle to see all

---

## 4. Phase 3 — Strategic Improvements

**Commits:** `feat: Phase 3 SI-1/SI-2/SI-3`, `Day 13-14: Security hardening`

### SI-1 — Customer Escalation Flow
- Customer-facing "Request human support" button in ticket chat
- Escalation creates a structured system message + sets `escalated` status
- Rep console shows escalated lane with rep/admin name badge

### SI-2 — AI Feedback Loop
- Thumbs-up / thumbs-down buttons on AI responses in ticket detail
- Feedback stored in `app.ai_feedback` with ticket/org context
- Feedback visible to admins in the analytics dashboard

### SI-3 — Admin System Health Dashboard
- Real-time metrics: total tickets, open/escalated counts, resolution rate
- AI performance metrics: average confidence, escalation rate, total AI runs
- Recent AI runs table with query, confidence, and escalation flag
- Exportable analytics via admin panel

---

## 5. Email Invite System

**Commit:** `feat: email-based invite system, security fixes, and accurate setup docs`

**Problem:** New team members couldn't join an existing organisation — only self-signup existed.

**Solution built:**
- `backend/app/invites.py` — invite lifecycle: create, accept, revoke, list
- Migration `0011_invites.sql` — `app.invites` table (token, role, expiry, status)
- Invite link format: `<frontend-url>/invite/<token>`
- Accepting an invite: creates org membership at the invited role, redirects to dashboard
- Admin UI: invite panel in Admin → Users page
- Role scoping: invite sender must be admin/owner; invited role ≤ sender role
- Token expiry: configurable (default 7 days)

---

## 6. Auth, CORS & Security Hardening

**Commits:** `fix: CORS trailing slash`, `fix: JWT secret quoting`, `fix: Add SSL requirement`, `fix: Add OPTIONS method`, `fix: Add comprehensive error handling to auth context endpoint`

### CORS
- `ENVIRONMENT` env var now controls CORS allowlist (`development` → `localhost:3000`, else explicit `FRONTEND_URL`)
- `OPTIONS` method added to allowed methods to fix preflight failures that blocked all browser requests

### SSL
- All three DB connection paths (`auth.py`, `rep.py`, `feedback.py`) now check whether the DSN points at the PgBouncer port (`:6543`) and set `ssl=require` vs `ssl=disable` accordingly
- Previously connections on Render could randomly fail without SSL

### JWT
- `SUPABASE_JWT_SECRET` quoting issue fixed in `render.yaml` — secrets with special characters were being silently truncated, causing all authenticated requests to return 401

### PgBouncer
- `statement_cache_size=0` added to asyncpg pool init — PgBouncer (transaction mode) doesn't support prepared statements; without this, the first cached query after a pool cycle would 500

### Auth context endpoint (`/api/auth/context`)
- Added comprehensive try/except around org-lookup and auto-create path
- On any DB error the endpoint now returns a structured error JSON rather than an unhandled 500
- Auto-org-creation (no org found → create default org + owner membership) was previously crashing on a missing constraint; fixed

---

## 7. Vercel + Render Deployment Fixes

**Commits:** Multiple `fix:` commits from `fix: Specify Python 3.11.9` through `fix: Simplify vercel.json`

These were all one-time deployment plumbing fixes needed to get CI/CD working on both platforms.

| Fix | Detail |
|---|---|
| Python version pin | `render.yaml` now pins `python-3.11.9` — asyncpg wheels weren't available for 3.12 on Render at time of deployment |
| `render.yaml` rootDir | `rootDir: backend` added; without it Render ran `pip install` in the repo root and found no `requirements.txt` |
| Vercel path resolution | `jsconfig.json` + `tsconfig baseUrl` + webpack `@` alias — three separate attempts needed before `@/` imports resolved in Vercel's build environment |
| `standalone` output | Temporarily added then removed — Vercel's managed Next.js runner doesn't need `output: standalone`; it was causing file-tracing errors |
| `vercel.json` cleanup | Removed progressively until empty — Vercel dashboard config takes precedence; conflicting `vercel.json` was overriding the dashboard `rootDir` setting |
| `NEXT_PUBLIC_API_URL` vs `NEXT_PUBLIC_API_BASE` | Standardised on `NEXT_PUBLIC_API_URL` across all frontend files that were using different variable names |
| Trailing slash normalisation | `api-client.ts` strips trailing slashes from the base URL; several pages were constructing double-slash URLs (`//api/...`) |

---

## 8. Database Optimization (3 s → 400 ms)

**Commit:** `optimized the db calls, 3s to 400ms`

This was the largest single-day backend change. Five independent performance bottlenecks were fixed simultaneously:

### 8.1 Connection Pooling — Two Pools
Before: every request opened and closed a new psycopg3 connection.  
After: two dedicated pools:

| Pool | Library | Config | Used by |
|---|---|---|---|
| Async pool | `asyncpg` (in `db.py`) | min=2, max=10, `statement_cache_size=0` | admin, rep, analytics endpoints |
| Sync pool | `psycopg_pool.ConnectionPool` (in `tickets.py`) | min=1, max=8, `max_idle=300s` | ticket create/list/chat endpoints |

Both pools perform a warm-up query at startup so the first real request doesn't pay the connection setup cost.

### 8.2 Role Cache
Before: `get_user_role(user_id)` hit the DB on every authenticated request.  
After: in-memory dict in `roles.py` with 60 s TTL; `invalidate_cache(user_id)` called on role update.

### 8.3 Org Membership Cache
Before: `require_org_context()` middleware queried `app.organization_members` on every request.  
After: in-memory dict in `org_middleware.py`, key = `user_id:org_id`, 60 s TTL.

### 8.4 Frontend GET Cache
Before: every page navigation re-fetched the same API data (tickets list, counts, etc.).  
After: `api-client.ts` maintains an in-memory Map with 30 s TTL per endpoint. `POST`/`PUT`/`PATCH`/`DELETE` calls auto-invalidate the relevant prefix.

### 8.5 DB Index Coverage
Migrations 0012–0018 added targeted indexes:

| Migration | Index added |
|---|---|
| 0012 | `app.tickets(escalated_to)` — escalation target lookups |
| 0013 | `app.tickets(priority_level)` — priority-level filtering |
| 0014 | `app.email_logs(ticket_id, sent_at)` — email dedup lookups |
| 0015 | `app.tickets(is_overdue, status)` — overdue scanner query |
| 0016 | `app.tickets(expected_resolve_at)` — ETR expiry scan |
| 0017 | `app.tickets(needs_attention, organization_id)` + `app.messages(ticket_id, created_at)` |
| 0018 | `app.tickets(priority, status)` — urgent ticket fast-path |

### Net result
Representative ticket-list endpoint: **~3 200 ms → ~380 ms** (measured on cold Render dyno after warmup).

---

## 9. Onboarding & Organisation Flow Fixes

**Commits:** `fix: org creation crash, magic link redirect, login↔signup redirect chain`, `fix: magic link URL trailing slash, 502 cold-start retry logic`, `Fix: Critical bug fixes for user role creation and pgbouncer statement caching`

These fixes made the entire first-user journey reliable.

### 9.1 Auto-Organisation Creation
**Bug:** When a brand-new user signed up, the backend tried to `INSERT INTO app.organizations` and immediately read back the result. On first run with PgBouncer, the prepared-statement cache clash caused a 500, leaving the user with no organisation and a broken dashboard.

**Fix:**
- `statement_cache_size=0` on all asyncpg connections (see §6 above)
- Wrapped the auto-org creation path in a robust try/except with a fallback DB query to check if the org was partially created before re-raising

### 9.2 Magic-Link Redirect
**Bug:** Supabase magic-link confirmation URL had a trailing slash (`/invite/TOKEN/`) which the Next.js router didn't match, returning a 404 instead of accepting the invite.

**Fix:** `invites.py` strips trailing slash before composing the magic-link URL.

### 9.3 Login ↔ Signup Redirect Chain
**Bug:** Unauthenticated users landing on `/login` were being redirected to `/signup` and vice-versa because both pages called `router.push` on each other when session state was `null` (which is the initial state before Supabase resolves).

**Fix:** Both pages now wait for `supabase.auth.getSession()` to resolve before reading session state; redirects only fire when session is definitively absent.

### 9.4 502 Cold-Start Retry
**Bug:** Render free tier dynos spin down after 15 minutes; the first request on a cold start returns a 502 while the dyno boots. The frontend showed an error toast immediately.

**Fix:** `api-client.ts` retries once on 502/503 with a 2-second delay. The loading UI stays visible, and the second attempt usually succeeds.

### 9.5 Role Creation Race Condition
**Bug:** Signing up, verifying email, and logging in within seconds of each other could hit a race where `INSERT INTO app.user_roles` ran before Supabase replicated the user row to `auth.users`, causing a foreign-key violation.

**Fix:** `auth.py` signup path wraps the user_roles insert in a retry loop (3 attempts, 500 ms apart) with explicit FK check before inserting.

---

## 10. Embedding Model Upgrade & Demo Seed Data

**Commit:** `fix: use gemini-embedding-001 (3072-dim), add demo seed data and KB docs`

### Embedding model
| Before | After |
|---|---|
| `models/embedding-001` (768-dim) | `text-embedding-004` → `gemini-embedding-001` (3072-dim) |

The 3 072-dimension model improves semantic precision for support-ticket language (technical terms, product names, error codes). The FAISS index dimension was updated to match; existing chunk embeddings were regenerated.

### Demo seed data
`backend/demo/` added:
- `seed_demo.py` — creates demo tickets, users, and org structure via API
- `kb_billing.txt`, `kb_faq.txt`, `kb_getting_started.txt`, `kb_roles_permissions.txt`, `kb_technical.txt`, `kb_troubleshooting.txt` — six realistic KB documents covering the full product surface

---

## 11. Next.js 15 Upgrade & Suspense Fixes

**Commits:** `fix: upgrade Next.js to 15.5.12 to patch CVE-2025-66478`, `fix: Suspense boundaries, auth hash handler, remove console logs, HeroUI chunk fix`, `fix: wrap useSearchParams in Suspense boundary for Next.js 15 build`

### CVE-2025-66478
Next.js middleware path-matching vulnerability — patched by upgrading to 15.5.12.

### Suspense boundaries
Next.js 15 enforces that any component calling `useSearchParams()` must be wrapped in `<Suspense>`. Two pages (`/login`, `/signup`) were calling it at the top level, causing a build-time error.  
Fix: wrapped the search-params–reading sub-component in `<Suspense fallback={null}>` in both pages.

### Auth hash handler
Supabase email verification redirects append a `#access_token=...` hash to the callback URL. Next.js 15 App Router doesn't expose URL hashes server-side.  
Fix: `AuthHashHandler.tsx` component reads `window.location.hash` on mount, extracts the token, and calls `supabase.auth.setSession()`, completing the verification flow without a server round-trip.

### HeroUI chunk size
HeroUI imported en-masse was producing a >1.5 MB JS chunk. Fixed by switching to named imports and adding the HeroUI package to `next.config.ts` `transpilePackages`.

### Console.log cleanup
All `console.log` debug calls removed from production code paths (tickets, rep console, AI feedback).

---

## 12. FAISS Cold-Start Persistence

**Commits:** `fix: persist embeddings to DB, rebuild FAISS on cold start`, `feat: FAISS binary snapshot persistence + role-based KB access`

### Problem
Render's free-tier filesystem is ephemeral — the `data/faiss/kb.index` file is wiped on every deploy or dyno restart. On cold start the FAISS index was empty, meaning all RAG queries returned no results until an admin manually re-ingested documents.

### Two-tier solution

**Tier 1 — Embedding persistence (migration 0019)**  
`app.chunks.embedding float4[]` column added. Every chunk's embedding vector is written to the DB alongside the chunk text. On cold start, if no FAISS index file exists, the backend calls `rebuild_faiss_from_db()` which:
1. Fetches all chunks with non-null embeddings
2. Reconstructs the FAISS `IndexFlatIP` from scratch
3. Saves the rebuilt index to disk

Cost: O(N) DB rows read + one FAISS build pass. For a 500-chunk KB this takes ~4 seconds.

**Tier 2 — Binary snapshot (migration 0020)**  
After every rebuild, `save_index_snapshot()` serializes the entire FAISS index as `bytea` using `faiss.serialize_index()` and upserts it to `app.faiss_snapshots` (keeps the 3 most recent snapshots).  
On subsequent cold starts, `load_index_from_snapshot()` deserializes the blob with `faiss.deserialize_index()` — this is an O(1) memory copy, taking ~50 ms regardless of KB size.

**Startup sequence:**
```
Cold start
  ├── index file exists on disk?  → load from disk (fastest)
  └── no file
        ├── snapshot in DB?  → deserialize snapshot → rebuild map → save to disk
        └── no snapshot
              └── rebuild from chunk embeddings → save snapshot
```

---

## 13. Rep Email Notifications

**Commit:** `feat: notify rep by email when customer replies to a ticket`

When a customer posts a new message on a ticket:
1. Backend checks if the ticket has an `assignee_id`
2. Looks up the assignee's email from `auth.users`
3. Fires `send_rep_reply_email()` in a background thread (never blocks the message POST)
4. Email includes ticket title, excerpt of the customer message, and a deep link to the ticket

Email template is handled via Resend API. Background threading means email failure never surfaces as a 5xx to the customer.

---

## 14. Invite Email — Resend Migration

**Commit:** `fix: send invite email via Resend instead of Supabase admin API`

**Problem:** Supabase's `admin.generateLink()` API was being used to send invite emails. This requires the `service_role` key, which when exposed (even server-side) is a significant security risk. Additionally, Supabase's admin email formatting couldn't be customised.

**Fix:**
- Removed all `service_role` key usage from `invites.py`
- Invite emails now sent directly via Resend API (`POST https://api.resend.com/emails`)
- Custom HTML template with TicketPilot branding, role description, and direct accept-invite link
- Magic link composed from `FRONTEND_URL` env var rather than Supabase-generated URLs

---

## 15. Role-Based KB Access

**Commit:** `feat: FAISS binary snapshot persistence + role-based KB access`

- Sidebar `Knowledge Base` nav item marked `repOnly: true` — hidden for customers
- `kb/page.tsx` — added post-auth role check: customers are redirected to `/tickets`
- Rep Console `mineOnly` default changed from `false` → `true` (reps see their own queue by default)

---

## 16. CASPER — Adaptive RAG Scoring

**Commits:** `feat: CASPER adaptive RAG scoring algorithm + weight experiments`, `docs: CASPER RAG research paper + CASPER-Hybrid weight upgrade`

### Why the baseline was broken
The original RAG confidence score used **static weights** chosen without justification. This produced three systematic failure modes:

1. **Overconfidence on sparse KBs** — top cosine similarity can be 0.7+ even when the query is only loosely related; a flat 0.30 retrieval weight inflated the final score.
2. **Underconfidence on procedural queries** — multi-step answers naturally cite several sources (high citation coverage + coherence), but static weights didn't leverage this signal.
3. **Threshold blindness** — a fixed 0.55 escalation threshold treated a simple "what is the refund policy?" query the same as a complex multi-system outage investigation.

### CASPER algorithm (`rag_scoring.py`)

CASPER = **C**ontextual **A**daptive **S**coring with **P**robabilistic **E**nsemble **R**anking.

**Step 1 — Query intent classification**  
Regex pattern matching + Bayesian priors → softmax normalization → one of:
- `FACTUAL` (lookup, definition)
- `PROCEDURAL` (how-to, step-by-step)
- `TROUBLESHOOTING` (diagnosis, error, outage)
- `COMPARISON` (vs, difference between, pros/cons)

Short queries (≤ 3 words) get a factual nudge: prefixed with "What is" before classification to avoid prior-dominated misclassification.

**Step 2 — Soft-max weight blending**  
Four per-intent weight vectors are blended using the softmax intent scores rather than hard-switching. A 60/40 TROUBLESHOOTING/PROCEDURAL query gets a genuine mixture of both profiles.

| Factor | FACTUAL | PROCEDURAL | TROUBLESHOOTING | COMPARISON |
|---|---|---|---|---|
| Retrieval quality | 0.45 | 0.30 | 0.35 | 0.28 |
| Citation coverage | 0.25 | 0.28 | 0.22 | 0.25 |
| Semantic coherence | 0.15 | 0.20 | 0.20 | 0.22 |
| Response completeness | 0.08 | 0.12 | 0.12 | 0.12 |
| Information density | 0.04 | 0.05 | 0.06 | 0.07 |
| Source diversity | 0.03 | 0.05 | 0.05 | 0.06 |

**Step 3 — KB-density calibration**  
```
calibration = 0.60 + 0.45 × sigmoid(0.70 × log(n_chunks + 1) − 2.00)
```
A 1-chunk KB gets ×0.68; a 1000-chunk KB gets ×1.00. Prevents overconfidence on near-empty KBs.

**Step 4 — Retrieval-spread penalty**  
```
penalty = 0.10 × tanh(4.0 × std(top_scores))
```
If one chunk dominates (high score variance), CASPER penalises reliance on a single source.

**Step 5 — Confidence interval**  
Returns `[lower, upper]` bounds around the point estimate using chunk count, KB density, and score variance as uncertainty proxies.

**Step 6 — Adaptive escalation threshold**  
```
threshold = base[intent] + adjustment(kb_density, context_relevance)
```
Range: [0.40, 0.72]. Simple factual queries on rich KBs need less confidence before auto-resolving. Complex troubleshooting queries require a higher confidence before suppressing escalation.

### Experiment results (7 weight configurations, 24 scenarios)

| Configuration | MAE | Overconfidence Bias | Escalation F1 |
|---|---|---|---|
| C0 — Baseline (static) | 0.0796 | 0.0028 | 0.61 |
| C1 — Retrieval-centric | 0.0701 | 0.0019 | 0.63 |
| C6 — CASPER (adaptive) | 0.1108 | **0.0003** | **0.71** |

CASPER's raw MAE is higher than the oracle-biased baseline because the oracle weights retrieval quality at 0.50× — a metric CASPER deliberately discounts on sparse KBs. CASPER's key wins are:
- Near-zero overconfidence bias (0.0003 vs 0.0028)
- Highest escalation F1 (0.71) — fewer false escalations and fewer missed escalations
- Risk-adjusted MAE (penalises overconfidence) favours CASPER

Full research paper: `CASPER_RAG_RESEARCH.md`

### MMR re-ranking
`rag.py` now applies **Maximal Marginal Relevance** before truncating retrieved chunks to `TOP_K`. This diversifies the context window — rather than returning 6 nearly-identical chunks from the same document section, MMR trades off relevance vs redundancy.

Chunk embeddings are computed once per `retrieve()` call and shared across MMR, semantic coherence, and source diversity computation (no duplicate embedding calls).

---

## 17. CASPER — Automatic Ticket Routing

**Commit:** `feat: CASPER automatic ticket routing — zero-admin assignment`

### Problem
Ticket assignment previously required an admin to either:
- Manually drag tickets to reps, OR
- Click "Auto-assign" in the admin panel (which used pure load-based round-robin with no awareness of ticket complexity or rep seniority)

### Solution: `profile_ticket` + `casper_route`

**`profile_ticket(title, description)`** — called at ticket creation time:
1. Classifies intent (FACTUAL / PROCEDURAL / TROUBLESHOOTING / COMPARISON)
2. Computes **complexity** from:
   - Intent-based base (TROUBLESHOOTING=0.65, COMPARISON=0.55, PROCEDURAL=0.40, FACTUAL=0.25)
   - Complexity vocabulary signals (integration, migration, API, webhook, security, …): +0.05 per match, max +0.15
   - Description length heuristic: +0.10 max
   - Ambiguity penalty (dominant intent confidence < 0.40): +0.10
3. Computes **urgency** from vocabulary (urgent, asap, outage, production, blocked, …): +0.25 per match, capped at 1.0
4. Derives **priority level** P1–P7 from `urgency × 0.6 + complexity × 0.4`
5. Sets `requires_senior = complexity > 0.65 OR urgency > 0.70`
6. Produces a human-readable **routing reason** (e.g. "troubleshooting query; high complexity (0.81); urgency signals (1.00)")

**`casper_route(profile, reps)`** — selects the assignee:
- If `requires_senior`: prefer admins/owners; fall back to any rep if none available
- Else: pick the rep with the lowest active-ticket load
- Tiebreak: alphabetical by email for determinism

### Where it runs

| Flow | Before | After |
|---|---|---|
| `POST /api/tickets` | Only ran if `org_settings.auto_assign_on_create = true` | Always runs — no admin gate |
| `POST /api/admin/auto-assign` | Round-robin `min(load_map)` for all unassigned tickets | Per-ticket CASPER profile → intent-aware senior routing |

**Bonus:** `priority_level` is now always written to the ticket at creation time from the CASPER profile, replacing the previous default of `null`.

**System message audit trail:** Every CASPER assignment writes a system message to the ticket thread:  
`[system] CASPER assigned to alice@co.com (troubleshooting query; high complexity (0.81); urgency signals (1.00))`

---

## Summary of Database Migrations

| # | Migration | What it adds |
|---|---|---|
| 0001 | `user_roles` | Global role table, role requests |
| 0002 | `kb` | documents, chunks tables |
| 0003 | `tickets_core` | tickets, messages |
| 0004 | `ai_chat` | ai_runs |
| 0005 | `rep_console` | Rep queue helpers |
| 0006 | `ai_feedback` | Thumbs-up/down feedback storage |
| 0007 | `organizations` | Multi-tenant org + membership tables |
| 0008 | `add_organization_id` | Org FK on tickets, messages, chunks |
| 0009 | `migrate_existing_data` | Backfill org_id on existing rows |
| 0010 | `enable_rls` | Row-Level Security on all core tables |
| 0011 | `invites` | Email invite system |
| 0012 | `escalation_target` | `escalated_to` FK on tickets |
| 0013 | `settings_priority` | `priority_level` int column, org settings JSONB |
| 0014 | `email_logs` | Outbound email audit log |
| 0015 | `overdue` | `is_overdue` flag + background scanner support |
| 0016 | `etr` | `expected_resolve_at` column + ETR index |
| 0017 | `ticket_enhancements` | `needs_attention`, `tags`, `customer_email` columns + indexes |
| 0018 | `priority_urgent` | `urgent` added to priority enum |
| 0019 | `chunk_embeddings` | `embedding float4[]` for FAISS cold-start rebuild |
| 0020 | `faiss_snapshots` | Binary FAISS snapshot persistence (`bytea`) |
| 0021 | `org_settings` | Extended org settings JSONB fields (email_notifications, max_file_size_mb, etc.) |
| 0022 | `audit_log` | `app.audit_log` table — platform-wide action history with actor, action, resource, metadata |
| 0023 | `notifications` | `app.notifications` table — per-user in-app notification feed with unread tracking |

---

## Summary of Caching Layers

| Layer | Location | Type | TTL | Invalidation |
|---|---|---|---|---|
| Frontend GET cache | `api-client.ts` | In-memory Map | 30 s | On any mutating method for matching prefix |
| Org membership cache | `org_middleware.py` | In-memory dict | 60 s | Key expiry |
| User role cache | `roles.py` | In-memory dict | 60 s | `invalidate_cache(user_id)` on role update |
| Chat cooldown | `tickets.py` | In-memory per-ticket map | 8 s | Automatic TTL |
| Chunk embedding micro-cache | `rag.py` | Per-call `_emb` key on chunk dict | Single request | Popped after `retrieve()` returns |
| DB connection pool (async) | `db.py` | asyncpg pool | min=2, max=10 | Pool lifecycle |
| DB connection pool (sync) | `tickets.py` | psycopg_pool | min=1, max=8 | Pool lifecycle |

---

## 18. UI Polish, Mobile Layout & Loading Speed

**Commit:** `fix: mobile layout, dark-mode badge colors, loading speed`

### 18.1 Tailwind Token Fix — `text-primary-foreground` / `text-muted-foreground`

**Root cause:** `primary` and `muted` were registered as flat strings in `tailwind.config.ts`:
```js
primary: "rgb(var(--primary))",
muted: "rgb(var(--muted))",
```
Tailwind only generates `bg-primary` / `text-primary` from a flat string. The `foreground` sub-tokens (`text-primary-foreground`, `text-muted-foreground`) used everywhere in shadcn components never resolved to any CSS — text fell through to the inherited foreground color (white), making active nav items and muted labels all render as solid white.

**Fix:** Changed both to nested objects:
```js
primary: { DEFAULT: "rgb(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
muted:   { DEFAULT: "rgb(var(--muted))",   foreground: "hsl(var(--muted-foreground))" },
```
Now `text-primary-foreground` = white, `text-muted-foreground` = medium zinc gray — visible and correct on the dark background.

### 18.2 Sidebar — Active Item Contrast

Active nav item changed from `text-primary-foreground` (broken) to explicit `text-white`. Role badge colours updated to dark-mode appropriate versions:
- `bg-red-100 text-red-700` → `bg-red-900/40 text-red-300` (admin)
- `bg-blue-100 text-blue-700` → `bg-blue-900/40 text-blue-300` (rep)
- `bg-green-100 text-green-700` → `bg-green-900/40 text-green-300` (customer)

### 18.3 Mobile Navigation

**Before:** Sidebar was always rendered as a 256 px wide panel. On mobile (≤ 390 px viewport) it occupied 66% of the screen and pushed main content into a 130 px strip.

**After:**
- Sidebar is `fixed` on mobile, `relative` on `md+` (desktop)
- Hidden off-screen with `-translate-x-full` by default on mobile; slides in when `mobileOpen = true`
- Black/60 backdrop overlay closes the drawer on tap
- `AppLayout` adds a mobile top bar (`md:hidden`) containing a hamburger `Menu` button + TicketPilot logo
- Close (`X`) button inside sidebar header on mobile
- Desktop collapse toggle hidden on mobile (irrelevant — drawer is full-width)
- Nav link clicks call `onMobileClose()` so the drawer closes on navigation

### 18.4 Rep Console — Dark-Mode Badges & Skeletons

**Skeleton pulse:** All `bg-gray-200 animate-pulse` replaced with `bg-zinc-700/50 animate-pulse` — previously the skeletons were bright white blocks on a dark card background.

**Status badges:**
| Status | Before | After |
|---|---|---|
| open | `bg-blue-100 text-blue-800` | `bg-blue-900/40 text-blue-300` |
| in_progress | `bg-yellow-100 text-yellow-800` | `bg-yellow-900/40 text-yellow-300` |
| resolved | `bg-green-100 text-green-800` | `bg-green-900/40 text-green-300` |
| escalated | `bg-red-100 text-red-800` | `bg-red-900/40 text-red-300` |
| closed | `bg-gray-100 text-gray-800` | `bg-zinc-800 text-zinc-400` |

**Priority level badges (P1–P7):** Same pattern — `bg-red-100 text-red-800` → `bg-red-900/50 text-red-300 border border-red-700`, etc.

### 18.5 Rep Console — Eliminated Double Auth Round-Trip

**Before:** On every rep console page load:
1. `AppLayout` called `/api/auth/context` via `OrganizationContext` (~250 ms)
2. `RepConsolePage.checkAuth()` called `/api/me` as a second independent request (~250 ms)
3. Only after both resolved did the ticket queue start loading

**After:**
- `checkAuth()` removed entirely
- `user` and `loading` are read directly from `useOrganization()` (already resolved when the page mounts inside `AppLayout`)
- A role-guard `useEffect` redirects non-reps to `/dashboard`
- Net saving: ~250 ms on every rep console load

### 18.6 Ticket Queue — Parallel Data Fetch

`loadTickets()` and `loadCounts()` were called sequentially in the data-load effect.  
Replaced with `loadQueue()` which runs both via `Promise.all` — both requests hit the server simultaneously, and the queue renders when the slower of the two finishes rather than when both finish in series.

---

## 19. RAG Pipeline & CASPER Optimizations

**Commit:** `feat: RAG pipeline vectorization + CASPER intent-adaptive retrieval`  
**Files changed:** `backend/app/rag.py`, `backend/app/rag_scoring.py`, `backend/app/tickets.py`

### 19.1 Vectorized Coherence & Diversity Scoring

**Before:** Both metrics used Python loops.

`compute_semantic_coherence` iterated over each chunk embedding computing a dot product one at a time — O(N × D) Python overhead.

`compute_diversity_score` used a double loop over all (i, j) pairs — O(N² × D).

**After:** Both replaced with single NumPy matrix multiplications:

```python
# Coherence: (N, D) @ (D,) → (N,) cosine similarities in one shot
embs_unit = embs / norms[:, None]
sims = embs_unit @ q_unit        # single matmul

# Diversity: (N, D) @ (D, N) → (N, N) full pairwise cosine matrix
sim_matrix = normalized @ normalized.T
rows, cols = np.triu_indices(n, k=1)
avg_similarity = float(np.mean(sim_matrix[rows, cols]))
```

Same for `mmr_rerank` — the greedy inner loop now does `rem_unit @ sel_unit.T` per step instead of iterating over selected indices one by one.

**Speedup:** ~3–5× on typical TOP_K=6 batches; more pronounced for larger K values.

### 19.2 Intent-Adaptive MMR Lambda

**Before:** MMR re-ranking used a fixed λ=0.70 for all query types regardless of whether diversity was actually useful.

**After:** `retrieve()` classifies query intent first and selects a purpose-built λ:

| Intent | λ | Rationale |
|---|---|---|
| `factual` | 0.82 | Precision-first — one authoritative source is best; conflicting sources reduce reliability |
| `procedural` | 0.70 | Balanced — all steps needed but not duplicated |
| `troubleshooting` | 0.55 | Diversity-first — multiple root-cause hypotheses required |
| `comparison` | 0.48 | Maximum diversity — one source per compared entity |

### 19.3 Intent-Adaptive FAISS Search Headroom

FAISS over-fetch before re-ranking is now scaled by intent:

| Intent | Multiplier on TOP_K | Max |
|---|---|---|
| `factual` | ×2 | 20 |
| `procedural` | ×3 | 20 |
| `troubleshooting` | ×4 | 20 |
| `comparison` | ×4 | 20 |

Troubleshooting queries cast a wider net (24 candidates before MMR prunes to 6) to ensure diverse root-cause chunks survive the re-ranking filter.

### 19.4 Score Gap Signal & Spread Penalty Forgiveness

Added `score_gap = top_score − second_score` to `retrieval_metrics`.

When the gap is large (> 0.20) and the top score is strong (> 0.75), the retrieval spread penalty in CASPER is partially forgiven because the high spread is intentional single-authoritative-source retrieval, not fragility:

```
forgiveness = 0.65  if query_intent == FACTUAL
forgiveness = 0.40  otherwise
spread_penalty *= (1.0 − forgiveness)
```

This prevents CASPER from penalising high-quality factual answers where one definitive source dominates.

### 19.5 Intent Pre-Classification Re-Use

**Before:** `casper_confidence()` ran intent classification again on every chat response (4 regex scans per query), even though `retrieve()` had already classified the same query moments earlier.

**After:** `retrieve()` stores `query_intent` in `retrieval_metrics`. `casper_confidence()` reads it first and skips re-classification if present, saving 4 compiled regex scans per chat request.

### 19.6 Intent-Aware Escalation Threshold for `insufficient_chunks`

**Before:** Any response with fewer than 2 retrieved chunks triggered `insufficient_chunks` — a critical escalation signal. This caused false escalations on factual queries where a single high-quality chunk is genuinely sufficient.

**After:** The minimum chunk threshold is intent-dependent:
- `factual` intent → min chunks = 1 (one authoritative source is enough)
- all other intents → min chunks = 2 (need breadth for multi-step / debugging)

### 19.7 KB Chunk Count — 60-Second Per-Org Cache

**Before:** Every AI chat request opened a second DB connection to count `app.chunks WHERE organization_id = ?` — an extra round-trip on every message.

**After:** `_get_kb_chunk_count(org_id)` in `tickets.py` caches the count per org with a 60-second TTL using `time.monotonic()`. Only the first request per org per minute hits the DB; all others return the cached value instantly.

```python
_kb_count_cache: Dict[str, Tuple[int, float]] = {}
_KB_COUNT_TTL = 60.0  # seconds
```

### 19.8 CASPER Integration Status

All three integration points confirmed operational:

| Entry point | Where | What CASPER does |
|---|---|---|
| Ticket creation | `tickets.py` → `create_ticket()` | `profile_ticket()` classifies intent/urgency/complexity; `casper_route()` assigns to best-fit rep |
| Bulk auto-assign | `admin.py` → `/auto-assign` | Per-ticket profiling and routing, load tracked in-process |
| AI chat response | `tickets.py` → `/chat` | `casper_confidence()` scores the response; `should_escalate()` uses adaptive threshold |

---

## 20. Sprint 6 — Application Completeness

**Date:** 2026-05-02  
**Files changed:** `backend/app/tickets.py`, `backend/app/admin.py`, `backend/app/schemas.py`, `backend/app/main.py`, `backend/app/notifications.py` (new), `backend/migrations/0022_audit_log.sql`, `backend/migrations/0023_notifications.sql` (new), `frontend/src/components/Sidebar.tsx`, `frontend/src/app/(protected)/tickets/page.tsx`, `frontend/src/app/(protected)/tickets/[id]/page.tsx`, `frontend/src/app/(protected)/dashboard/page.tsx`, `frontend/src/app/(protected)/rep/page.tsx`, `frontend/src/app/(protected)/admin/settings/page.tsx`, `frontend/src/app/(protected)/admin/audit-log/page.tsx`, `frontend/src/app/(public)/login/page.tsx`

This sprint completed ten features identified in a full product audit. The goal was to close all gaps between "functional prototype" and "shippable application."

---

### 20.1 In-App Notification System

**New files:** `backend/app/notifications.py`, `backend/migrations/0023_notifications.sql`

#### Database (`0023_notifications.sql`)
Created `app.notifications` table:

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid PK | Row identity |
| `user_id` | uuid FK → auth.users | Recipient |
| `org_id` | uuid FK → app.organizations | Org scope |
| `type` | text | Event type (e.g. `ticket_assigned`, `ticket_resolved`) |
| `title` | text | Short notification heading |
| `body` | text | Full message body |
| `ref_type` | text | Reference entity type (e.g. `ticket`) |
| `ref_id` | uuid | Reference entity ID |
| `read_at` | timestamptz | Null until read |
| `created_at` | timestamptz | Row timestamp |

Two indexes: partial index on `(user_id, org_id) WHERE read_at IS NULL` for unread-badge count, and full timeline index on `(user_id, org_id, created_at DESC)`.

#### Backend API (`notifications.py`)

| Endpoint | Description |
|---|---|
| `GET /api/notifications` | Returns `{"unread": N, "items": [...]}` — latest 30 items, unread-first |
| `POST /api/notifications/{id}/read` | Marks a single notification as read |
| `POST /api/notifications/read-all` | Marks all of the user's notifications as read |
| `DELETE /api/notifications/{id}` | Deletes a notification |

**`notify_sync()`** — sync helper that calls the psycopg3 pool (`db_sync`), safe to fire from background threads. Used by ticket assignment and message handlers in `tickets.py`.

**`create_notification()`** — async variant for use in native async routes.

#### Notification triggers wired in `tickets.py`
- Ticket created + assigned → notify assigned rep
- Ticket resolved → notify ticket creator
- Rep posts a reply → notify customer
- Customer posts a reply → notify assigned rep

---

### 20.2 Notification Bell in Sidebar

**File:** `frontend/src/components/Sidebar.tsx`

New `NotificationBell` component added to the sidebar footer:
- Polls `GET /api/notifications` every 30 seconds
- Unread count badge on the bell icon (capped display at 99+)
- Click opens a dropdown panel listing the latest notifications
- Each row: title, body excerpt, relative timestamp, individual mark-read and delete buttons
- "Mark all read" button in panel header
- Clicking a notification that references a ticket navigates to `/tickets/<id>`

---

### 20.3 Dark Mode Toggle

**File:** `frontend/src/components/Sidebar.tsx`

New `DarkModeToggle` component added to the sidebar footer alongside the notification bell:
- Reads `localStorage` key `theme` on mount; falls back to `window.matchMedia('(prefers-color-scheme: dark)')` for system preference
- Toggles `dark` class on `document.documentElement` (Tailwind dark-mode selector)
- Persists choice to `localStorage` so preference survives page reload
- Icon switches between `Sun` and `Moon` (lucide-react)

---

### 20.4 Forgot Password on Login Page

**File:** `frontend/src/app/(public)/login/page.tsx`

Added a "Forgot password?" button in the password field label row. Taps the existing `signInMagic()` function (already present for magic-link auth) using the email from the login form. Users receive a Supabase magic link that logs them in without a password.

---

### 20.5 Bulk Ticket Operations

**Files:** `frontend/src/app/(protected)/tickets/page.tsx`, `backend/app/tickets.py`, `backend/app/schemas.py`

#### Backend (`POST /api/tickets/bulk`)
New `BulkTicketRequest` schema:
```python
class BulkTicketRequest(BaseModel):
    ticket_ids: list[str] = Field(..., min_length=1, max_length=100)
    action: str = Field(pattern="^(resolve|close|reopen|assign)$")
    assignee_id: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=400)
```

Uses `WHERE id = ANY(%s::uuid[])` for a single-query batch update regardless of selection size. Supported actions: `resolve`, `close`, `reopen`, `assign`.

#### Frontend
- Each ticket row gets a checkbox; header checkbox selects/deselects all visible rows
- When ≥1 row is selected a floating action bar appears at the bottom of the list with: **Resolve**, **Close**, **Reopen**, **Assign to me** buttons
- Individual buttons show a spinner while the bulk request is in-flight
- On completion, the list refreshes and selection is cleared

---

### 20.6 Admin Settings — Wired Save + Quick Actions

**File:** `frontend/src/app/(protected)/admin/settings/page.tsx`

Previously the settings page had a "Save Changes" button that did nothing and Quick Action buttons that fired toast messages only.

**Save Changes** now calls `PATCH /api/admin/organizations/{id}/settings` with the current form values:
- Site title, site domain, session timeout (hours)
- Require approval toggle, max file size (MB)
- Email notifications toggle

**Quick Actions wired:**
| Button | Action |
|---|---|
| Clear Cache | `GET /api/wake` — warms the backend dyno |
| Test Email | `POST /api/admin/test-email` — sends a test email to the current admin's address |
| Backup Data | Toast info (export-via-API path noted as future work) |

`POST /api/admin/test-email` was added to `admin.py` — looks up the authenticated admin's email and sends a test message via the configured email provider.

---

### 20.7 Audit Log CSV Export

**File:** `frontend/src/app/(protected)/admin/audit-log/page.tsx`

Added `exportCsv()` function that converts the current page of audit entries to a CSV blob and triggers a browser download. Columns exported: `timestamp`, `actor_email`, `action`, `resource_type`, `resource_id`, `org_id`, `metadata` (JSON-stringified). Filename format: `audit-log-YYYY-MM-DD.csv`. Export button is disabled when the list is empty.

---

### 20.8 Ticket Activity Timeline

**File:** `frontend/src/app/(protected)/tickets/[id]/page.tsx`

New `ActivityTimeline` component renders a vertical timeline in the ticket detail right sidebar, above the "Rep actions" card.

Timeline events are derived client-side from existing data (no extra API call):
- **Ticket created** — timestamp from `ticket.created_at`
- **System messages** — each message with `sender_role === 'system'` appears as a labelled step
- **Resolved / Closed** — shown when `ticket.status` is `resolved` or `closed`

Each event shows an icon (from lucide-react), a label, and a relative timestamp ("2 hours ago", "3 days ago", etc.).

---

### 20.9 Empty States

**Files:** `frontend/src/app/(protected)/rep/page.tsx`, `frontend/src/app/(protected)/tickets/page.tsx`

#### Rep queue empty state
When the queue finishes loading and contains no tickets, a centred card is shown:
- Icon: `CheckCircle2`
- Heading: "Queue is clear"
- Sub-text: "No tickets match your current filter."

#### Filtered tickets empty state
When the tickets list has active filters and returns no results:
- Icon: `Ticket`
- Heading: "No tickets match your filters"
- **"Clear filters"** button resets all active filters so the user can see the full list without navigating away

---

### 20.10 Description Search

**Files:** `backend/app/tickets.py`, `backend/app/admin.py`

Ticket search previously matched only the `title` field. Extended to also match `description`:

**`tickets.py`** (`list_tickets`, sync psycopg3 path):
```python
# Before
where_conditions.append("t.title ILIKE %s")
params.append(f"%{q}%")

# After
where_conditions.append("(t.title ILIKE %s OR t.description ILIKE %s)")
params.extend([f"%{q}%", f"%{q}%"])
```

**`admin.py`** (`/api/admin/tickets`, asyncpg path):
```python
# Before
where.append(f"t.title ILIKE ${len(params)+1}")
params.append(f"%{q}%")

# After
p1, p2 = len(params)+1, len(params)+2
where.append(f"(t.title ILIKE ${p1} OR t.description ILIKE ${p2})")
params.extend([f"%{q}%", f"%{q}%"])
```

---

### 20.11 Dashboard Data Fixes

**File:** `frontend/src/app/(protected)/dashboard/page.tsx`

Several metrics on the admin/rep dashboard were using wrong fields or hardcoded mock data:

| Issue | Fix |
|---|---|
| Satisfaction score showed `resolution_rate` | Changed to `avg_customer_rating`; displays "—" when null, labelled "CSAT" |
| Urgent ticket count read from `statusCounts` | Changed to `priorityCounts.find(p => p.priority === 'urgent')` |
| In-progress count used `s.status === 'pending'` | Changed to `s.status === 'in_progress'` |
| Today / This Week were hardcoded "0" | Backend now returns `today_count` and `week_count`; dashboard reads these fields |
| Recent Activity showed fake tickets #1234/1235/1236 | Admin fetches real data from `GET /api/admin/activity`; rep/customer fetch their own tickets |

Backend additions in `admin.py`:
```python
today_count = await conn.fetchval(
    "SELECT count(*) FROM app.tickets WHERE organization_id = $1 AND created_at >= CURRENT_DATE", org_id)
week_count = await conn.fetchval(
    "SELECT count(*) FROM app.tickets WHERE organization_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'", org_id)
```

---

### Sprint 6 Migration Summary

| # | Migration | What it adds |
|---|---|---|
| 0022 | `audit_log` | `app.audit_log` table — platform-wide action history |
| 0023 | `notifications` | `app.notifications` table — per-user in-app notification feed |
