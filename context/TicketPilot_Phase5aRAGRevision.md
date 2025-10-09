Awesome — here’s exactly what you asked for: a **single, authoritative document** your agent should follow, and a **tight agent prompt** that makes the agent read this doc, audit your codebase, and build/fix only what’s necessary.

---

# TicketPilot — Phase 5A+ Integration & IAM Hardening

**Authoritative Build & Audit Document (Frontend + Backend)**

## 0) Purpose (Read Me First)

You must **audit and complete wiring** between existing backend endpoints and frontend pages for:

* **Admin/IAM** (`/admin/*` endpoints & pages),
* **KB ingestion** (must work for **rep** and **admin**),
* **RAG/AI** features (ensure endpoints and UI are correctly connected),
* **Rep Console** integration (auto-flag and acknowledgement flows).

**Do not add new endpoints or features** unless absolutely required to make the above work. If you must add, document the justification and keep it minimal.

---

## 1) Access Model (Ground Truth)

* Roles: `customer`, `rep`, `admin`.
* **KB ingestion**: allowed for **rep** **and** **admin** (highest rights).
* **Rep Console**: visible & callable only for `rep|admin`.
* **Admin Panel**: visible & callable only for `admin`.
* Ticket visibility: customers see **their own**; reps/admins see tickets according to console filters; all access must be server-enforced.

### 1.1 Backend Enforcement Helpers

* `require_admin(user)` → 403 if not `admin`.
* `require_rep_or_admin(user)` → 403 if not `rep|admin`.
* `get_current_user()` → reads role from DB (`app.user_roles`) each request (or cached with proper invalidation).

**Action:**
Ensure all routes use the correct guard (esp. `/api/kb/ingest` → `require_rep_or_admin`).

---

## 2) Endpoint Matrix (Backend ↔ Frontend Wiring)

Use this checklist to verify **each** endpoint is correctly invoked by the right UI and that request/response shapes match.

| Backend Endpoint                            | Guard           | Purpose                    | Expected Frontend Caller                                 | UI File(s) to Verify/Connect                                                                              |
| ------------------------------------------- | --------------- | -------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `POST /api/kb/ingest`                       | rep/admin       | Ingest doc or text into KB | **Rep Console** (KB modal) **and** Admin Panel (allowed) | `src/components/KBIngestModal.tsx`, `/rep/page.tsx`, `/admin/roles/page.tsx` (if you surface ingest here) |
| `GET /api/kb/search?q=&k=`                  | auth            | Quick KB search (debug)    | Optional admin/rep-only debug spot                       | If a debug panel exists; don’t add a new page                                                             |
| `GET /api/kb/stats`                         | auth            | Totals                     | Dashboard widgets                                        | `/dashboard/page.tsx` cards                                                                               |
| `POST /api/tickets`                         | auth            | Create ticket              | Tickets pages                                            | `/tickets/page.tsx` modal                                                                                 |
| `GET /api/tickets`                          | auth            | List tickets (filters)     | Tickets list & Rep lanes                                 | `/tickets/page.tsx`, `/rep/page.tsx`                                                                      |
| `GET /api/tickets/{id}`                     | auth            | Ticket + thread            | Ticket detail                                            | `/tickets/[id]/page.tsx`                                                                                  |
| `POST /api/tickets/{id}/messages`           | auth            | Add message                | Ticket detail composer                                   | `/tickets/[id]/page.tsx`                                                                                  |
| `POST /api/tickets/{id}/chat`               | auth + cooldown | **RAG/AI reply**           | **Ask AI** button                                        | `/tickets/[id]/page.tsx` (AIMessage render, cooldown state)                                               |
| `GET /api/rep/queue`                        | rep/admin       | Rep lanes                  | Rep console list                                         | `/rep/page.tsx`                                                                                           |
| `GET /api/rep/counts`                       | rep/admin       | Lane counts                | Rep console header                                       | `/rep/page.tsx`                                                                                           |
| `POST /api/rep/tickets/{id}/escalate`       | rep/admin       | Escalate                   | Rep inline action                                        | `/rep/page.tsx`                                                                                           |
| `POST /api/rep/tickets/{id}/status`         | rep/admin       | Status change              | Rep inline action                                        | `/rep/page.tsx`, `/tickets/[id]/page.tsx`                                                                 |
| `POST /api/rep/tickets/{id}/assign`         | rep/admin       | Assign                     | Rep inline action                                        | `/rep/page.tsx`, `/tickets/[id]/page.tsx`                                                                 |
| `POST /api/rep/tickets/{id}/acknowledge`    | rep/admin       | Clear attention            | Rep inline action                                        | `/rep/page.tsx`                                                                                           |
| `POST /api/rep/tickets/{id}/priority`       | rep/admin       | Set priority               | Rep inline action                                        | `/rep/page.tsx`, `/tickets/[id]/page.tsx`                                                                 |
| `GET /api/admin/users?q=`                   | admin           | List users + roles         | Admin IAM table                                          | `/admin/roles/page.tsx`                                                                                   |
| `POST /api/admin/users/{user_id}/role`      | admin           | Set role                   | RoleSelect                                               | `/admin/roles/page.tsx`                                                                                   |
| `POST /api/admin/role-requests`             | auth            | Customer request rep       | Request form                                             | `/account/request-rep/page.tsx`                                                                           |
| `GET /api/admin/role-requests?status=`      | admin           | Review requests            | Admin view                                               | `/admin/roles/page.tsx` (section/tab if present)                                                          |
| `POST /api/admin/role-requests/{id}/decide` | admin           | Approve/Deny               | Admin action                                             | `/admin/roles/page.tsx`                                                                                   |

**Action:**
For each row: confirm there is a real caller in the indicated UI file, and that the fetch body/headers match backend expectations (JWT header, JSON shapes). Fix mismatches—**no new endpoints**.

---

## 3) Admin/IAM Panel — “Keep as is” but Make It Correct

The Admin panel must **list users** and **set roles**. If you already have role-requests, keep it; if not, **do not add** unless there’s an obvious half-implemented frontend route calling a missing backend (then add the smallest viable endpoint or rewire the UI to existing endpoints).

### 3.1 Required Admin Features (Minimal IAM)

* **Users table** (email, current role, last updated).
* **Role change** control (`customer|rep|admin`) with optimistic UI and toast.
* **Search** by email substring.
* **Access guard**: 403 screen if not admin (client-side) and enforced server-side.

### 3.2 IAM Edge Cases (Must Handle)

* **Last-admin lockout**: Prevent demoting/deleting the **last remaining admin** (server-side validation in `POST /api/admin/users/{id}/role`). Return `409` with clear message.
* **Self-demotion**: Allow an admin to demote self **only if** another admin exists; otherwise `409`.
* **Immediate effect**: Role changes should take effect on the next request (role read from DB). If you cache roles on the server, invalidate cache on change.
* **Pagination**: If user list is large, either server-side pagination or a sane cap (≤200) with a note. **Do not add pagination** unless the list already paginates.
* **Auditing (optional)**: If system messages exist for admin actions, ensure **role changes** add a small system log row (optional; do not add if not present).

### 3.3 Admin & KB

* Admin must be able to use the **same KB ingestion dialog** that reps use (or access it from Rep Console if your product decision keeps ingest only there). Backend must allow admin on `/api/kb/ingest`.

---

## 4) KB Ingestion — Admin Allowed

**Backend guard change (if needed):**
`/api/kb/ingest` should call `require_rep_or_admin(user)` — not just `require_rep`.

**Frontend visibility:**

* Rep Console already surfaces KB ingest (modal).
* **Admin**: either access the same Rep Console (they have role ≥ rep) or show the KB ingest entry point wherever your admin UX places it.
  **Do not add a new page**; reuse existing modal/component if possible.

**Validation & Errors:**

* Enforce allowed file types (`pdf, txt, md, docx`) and a sane size limit; return `415/413`.
* Duplicate documents: return 200 with `{chunks_ingested:0, vectors_added:0}` and a friendly message.
* Embedding failures: return 503 with retry advice.

---

## 5) RAG/AI — Wiring Verification (No New Features)

Make sure the **existing** Phase-4 AI chat is correctly wired:

**Backend**

* `POST /api/tickets/{id}/chat`:

  * AuthN/AuthZ: user can access ticket.
  * Rate limit: 8s per ticket/user; exceeded → `429`.
  * Query len ≤ 1000; otherwise `422`.
  * RAG pipeline: embeddings → FAISS top-K (threshold \~0.75) → context budget (\~2000 chars).
  * LLM: Gemini 1.5 (`pro` for big prompts, `flash` for small).
  * Confidence: hybrid (heuristic + LLM self-rating).
  * `suggest_escalation` when confidence < 0.3 (env).
  * Persist AI message with `sender_role='ai'` and `meta.citations`, `meta.confidence`, etc.
  * If suggest-escalation and ticket not closed → set `needs_attention=true` + system message.

**Frontend**

* `/tickets/[id]` “Ask AI” button calls chat endpoint; UI shows:

  * AI message bubble text,
  * **Sources** (expand/collapse),
  * **Confidence** badge (0.00–1.00),
  * **Escalation hint** if true,
  * **Cooldown** indicator disables the button briefly.

**Rep Console**

* “Needs Attention” lane includes AI-flagged tickets.
* “Acknowledge” clears the flag.

---

## 6) Cross-Cutting Edge Cases (Must Verify)

* **Admin ingest path** works end-to-end (UI shows modal, backend accepts).
* **Role change race**: Two admins change the same user → one wins; the other gets `409`/`412`.
* **Closed ticket escalation**: Attempt to escalate a closed ticket → `409` or force reopen. Follow your current rule (do not change business logic).
* **Message counters & timestamps** update on system/AI messages (trigger validated).
* **Empty KB**: AI answers with low confidence and “No relevant sources”, no hallucinations.
* **Auth leakage**: No admin endpoints callable by non-admins (double enforce).
* **Client optimism**: If optimistic UI is used (RoleSelect, Status change), ensure **revert** logic on server error.
* **Token/role freshness**: Role changes should reflect without requiring logout (server reads DB).

---

## 7) Implementation Order (Minimal Change Policy)

1. **Audit pass**: build a table of ✅/❌ for every endpoint↔UI link listed in §2.
2. **Guard corrections**: change `/api/kb/ingest` to `require_rep_or_admin` if necessary.
3. **Frontend wiring fixes**: ensure buttons/forms call the right endpoints with the right shapes; remove dead calls; unify headers (`Authorization: Bearer <jwt>`).
4. **Admin IAM edge cases**: implement server-side checks for last-admin and self-demotion if missing.
5. **RAG/AI UI polish**: show citations, confidence, cooldown, escalation hint.
6. **Tests (minimal)**: a) admin role change; b) admin KB ingest; c) AI chat happy path and low-confidence path; d) acknowledge clears attention.
7. **QA**: manual verification of all lanes/pages with one admin, one rep, two customers.

---

## 8) Acceptance Criteria (Sign-off)

* **KB ingestion works** for rep and admin (end-to-end).
* **Admin IAM**: users listed; roles changed; last-admin/self-demotion safe-guard enforced; non-admins see 403 page and server 403.
* **RAG/AI**: `/api/tickets/{id}/chat` returns citations & confidence; UI displays them; cooldown enforced; escalations flag tickets; Rep Console shows & clears flags.
* **No new endpoints** beyond what already exists; any added code is justified as necessary glue/validation.
* **All endpoints used by UI** have matching request/response shapes and error handling.
* **Security**: all admin/rep routes protected server-side; client gating consistent.

---

## 9) Deliverables (What you must output)

1. **Audit table** for §2 with ✅/❌, file paths, and a one-line fix per ❌.
2. **Diff summaries** per file changed (path + concise description).
3. **Short test log** (curl or fetch snippets) proving: admin KB ingest, role change safety, AI chat citations/confidence, rep acknowledge.
4. **Remaining risks** list (if any) with suggested next steps.

---

# Agent Prompt (Copy-Paste)

Use this prompt **with the repository mounted** so the agent can open files, search code, and run local tests. The agent must **follow the document above** verbatim.

```
You are a senior full-stack engineer. Your task: AUDIT and FIX the TicketPilot repo to meet the “TicketPilot — Phase 5A+ Integration & IAM Hardening (Authoritative Build & Audit Document)” requirements.

## Hard Rules
- NO new product features or endpoints unless absolutely required to make existing flows work.
- Keep all routes and DB schemas intact; only adjust guards and wiring.
- Admin has highest rights: admin must be able to ingest KB.
- All admin endpoints and pages must work as integrated IAM; enforce security server-side and gate client-side.
- Keep RAG/AI endpoints and UI as already specified; just ensure they are wired and complete.

## Step 0 — Read the Document
Load the “Phase 5A+ Integration & IAM Hardening” document provided. Use it as the single source of truth for acceptance.

## Step 1 — Repository Audit (produce a checklist)
Build the Endpoint Matrix from the document by scanning the code:
- For each backend route listed in §2, find its implementation path and confirm its guard (`require_admin`, `require_rep_or_admin`, etc.).
- For each frontend page/component listed in §2, confirm it calls the correct endpoint with the correct body/headers and renders the expected UI states.
- Mark ✅/❌ and collect exact file paths and line ranges.

## Step 2 — Minimal Fixes (Backend)
- Ensure `/api/kb/ingest` uses `require_rep_or_admin`.
- Ensure ALL `/api/admin/*` endpoints enforce `require_admin`.
- Add server protections for **last-admin** and **self-demotion** in `POST /api/admin/users/{user_id}/role` if missing. Return 409 with clear error.
- Confirm `/api/tickets/{id}/chat` implements cooldown, length guard, RAG retrieval, citations/confidence, and escalation flag. If one part is missing, add it in the existing module with minimal code.

## Step 3 — Minimal Fixes (Frontend)
- `/rep/page.tsx`: ensure lane tabs, counts, actions call the correct `/api/rep/*` endpoints; KB ingest modal is accessible for rep/admin.
- `/tickets/[id]/page.tsx`: wire “Ask AI” to `/api/tickets/{id}/chat`; show citations, confidence, escalation hint; enforce cooldown UI.
- `/admin/roles/page.tsx`: list users from `/api/admin/users?q=`; role changes via `POST /api/admin/users/{id}/role` with optimistic UI and error revert; gate page by admin role.
- `/account/request-rep/page.tsx`: if implemented, keep; if not present, do not add unless a dangling endpoint is already being called by a dead link.

## Step 4 — Edge-Case Coverage
- Test admin KB ingest end-to-end.
- Validate last-admin/self-demotion errors.
- Validate closed-ticket escalation rule matches server behavior.
- Confirm message counters and timestamps update for AI/system messages.
- Confirm AI returns “No relevant sources” on empty KB and does not hallucinate.

## Step 5 — Output
Return:
1) The full **audit table** with ✅/❌ and file paths for each endpoint↔UI link.
2) **Diff summaries** for every file changed (path + what changed).
3) **Test snippets** (curl or fetch) showing:
   - Successful admin KB ingest,
   - 409 on last-admin/self-demotion,
   - AI chat response showing citations/confidence,
   - Rep acknowledge clearing needs_attention.
4) Any **remaining risks** and recommendations.

Follow the document. Be concise in code edits, verbose in reporting. Do not provide backend run instructions. Do not add new product surfaces.
```

---
