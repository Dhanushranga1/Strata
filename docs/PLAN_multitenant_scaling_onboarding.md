# Plan: Multi-Tenant Scaling + Onboarding Wizard

**Status:** Complete  
**Date:** 2026-04-27

---

## Goal

Scale TicketPilot from a single-vendor system to a true multi-tenant SaaS platform where:
1. Each org's FAISS index is fully isolated — no cross-org RAG bleed regardless of how many orgs are active
2. New orgs get a guided onboarding experience (workspace name → KB upload → invite team → launch) instead of landing on an empty dashboard

---

## Backend: Per-Org FAISS Isolation

### Problem (before this work)
`store.py` maintained a single global `kb.index` + `kb_map.json`. `search_vectors()` searched ALL chunks across all orgs, then post-filtered by `organization_id` at the DB layer. As org count grows, top-K slots are wasted on other orgs' chunks, degrading RAG quality for every org.

### Solution
Separate FAISS index per org, stored at:
- `{INDEX_DIR}/orgs/{org_id}.index`
- `{MAP_DIR}/orgs/{org_id}.json`

LRU in-memory cache (default 50 slots) keeps hot orgs warm. Per-org `threading.Lock` prevents concurrent writes.

### Files Changed

| File | Change | Status |
|------|--------|--------|
| `backend/app/store.py` | Full rewrite: `add_org_vectors`, `search_org_vectors`, `save_org_snapshot`, `rebuild_org_from_db`, LRU cache, per-org locks | ✅ Done |
| `backend/app/kb.py` | Switch `add_vectors_for_chunks` → `add_org_vectors(org_id, ...)`, `search_vectors` → `search_org_vectors(org_id, ...)`, background snapshot uses `save_org_snapshot` | ✅ Done |
| `backend/app/rag.py` | Add `org_id: str = ""` param to `retrieve()`, swap `search_vectors` → `search_org_vectors(org_id, ...)` | ✅ Done |
| `backend/app/tickets.py` | Pass `org_id=org_id` to `retrieve()` at line 724 | ✅ Done |
| `backend/migrations/0021_faiss_snapshots_org.sql` | Add `organization_id TEXT` col to `app.faiss_snapshots`; back-fill `'__global__'` for existing rows | ✅ Done |

---

## Frontend: Onboarding Wizard

### Problem
New orgs land directly on an empty dashboard with no guidance. There's no workspace setup, no KB doc, no teammates — the product looks broken on first login.

### Solution
4-step wizard route `/onboarding` in a separate `(wizard)` route group (no sidebar):

| Step | Title | Content |
|------|-------|---------|
| 1 | Name Your Workspace | Text field to set `org.name` (or confirm it) |
| 2 | Add Your First KB Doc | File upload (PDF/DOCX/MD/TXT) via `POST /api/kb/ingest`; can skip |
| 3 | Invite Your Team | Add emails for reps/admins; send invites via `POST /api/invites`; can skip |
| 4 | You're Ready | Summary card, CTA to open dashboard |

**Redirect logic:** In `OrganizationContext`, after org loads, if `org.settings.onboarding_completed !== true` AND user role is `owner`/`admin`, redirect to `/onboarding`.

**Completion:** Step 4 "Launch" button calls `PATCH /api/organizations/{org_id}` with `{ settings: { onboarding_completed: true } }`, then navigates to `/dashboard`.

### Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/app/(wizard)/layout.tsx` | Minimal layout — auth check, no AppLayout sidebar | ✅ Done |
| `frontend/src/app/(wizard)/onboarding/page.tsx` | 4-step wizard component | ✅ Done |

### Files Updated

| File | Change | Status |
|------|--------|--------|
| `frontend/src/contexts/OrganizationContext.tsx` | Added `settings` to `Organization` type; redirects admin/owner to `/onboarding` when `onboarding_completed !== true` | ✅ Done |

---

## Gap Fixes (found during audit)

Three issues discovered and resolved after initial implementation:

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Onboarding redirect never fired | `UserOrganization` in `auth.py` had no `settings` field; `settings.onboarding_completed` was always `undefined` on the frontend | Added `settings: dict` to Pydantic model + `o.settings` to DB SELECT |
| `PATCH /api/organizations/{id}` wiped existing settings | `settings = %s` did a full JSON overwrite | Changed to `settings = settings \|\| %s::jsonb` (JSONB merge) |
| Cold-start rebuilt global index only | `lifespan` in `main.py` checked for old `kb.index` path and called legacy `rebuild_faiss_from_db()` | Replaced with per-org discovery query + concurrent `_rebuild_one_org` calls per org |

---

## Sequencing

```
1. store.py           ✅
2. kb.py              ✅
3. rag.py             ✅
4. tickets.py         ✅
5. migration 0021     ✅
6. wizard layout      ✅
7. wizard page        ✅
8. org context        ✅
9. auth.py settings   ✅  (gap fix)
10. org PATCH merge   ✅  (gap fix)
11. main.py lifespan  ✅  (gap fix)
```
