Here’s a detailed, copy-paste friendly spec for a stabilization pass:

# TicketPilot — Phase 5A (Roles, Admin Tools, and DB Visibility Hardening)

**Purpose:** Close the gaps discovered in Phase 5:

* Clear, admin-only **role management** (no self-elevation).
* Optional **“Request Rep Access”** flow.
* Fix **Supabase schema visibility** and **migrations drift**.
* Add **diagnostics**, **tests**, and **edge-case guards**.

**Scope:** No new product features for customers; this phase is operational hardening and admin ergonomics.

---

## 0) Outcomes & Acceptance Criteria

**Outcomes**

* ✅ Roles are set via an **admin-only** API/UI (not by end users).
* ✅ Optional **role request** workflow exists and is admin-approved.
* ✅ Supabase shows the `app` schema tables; migrations are **applied and idempotent**.
* ✅ Diagnostics endpoints/scripts help detect env drift and missing extensions.
* ✅ Backfill + seed path for first **admin** user.
* ✅ Server/UI guards are consistent for `/rep` and `/api/rep/*`.

**Acceptance Checklist**

1. Admin can view users and set role → `customer|rep|admin`; customers cannot.
2. A customer can **request** rep access; the request appears in an admin list; admin can **approve/deny**.
3. In Supabase **Table Editor**, the `app` schema is visible and contains all tables: `user_roles`, `tickets`, `messages`, `documents`, `chunks`, etc.
4. Running the migrations twice is **safe** (no errors, no duplicates).
5. `/api/rep/*` returns 403 for non-rep; `/rep` is visually gated in the UI.
6. Changing a user’s role takes effect on next API call (no app restart needed).

**Non-Goals**

* ❌ Notifications, emails, or workflow automation beyond approval/deny.
* ❌ Streaming/Sockets, analytics, complex RBAC.

---

## 1) Data Model Changes (Migration `0005a_admin_roles.sql`)

> If you already have `app.user_roles`, keep it; this migration is **idempotent** and adds what’s missing.

```sql
create schema if not exists app;
create extension if not exists pgcrypto;

-- 1) Roles table (server-side source of truth)
create table if not exists app.user_roles (
  user_id uuid primary key,
  role text not null check (role in ('customer','rep','admin')),
  updated_at timestamptz default now()
);

-- 2) Role requests (optional workflow)
create table if not exists app.role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','denied','cancelled')),
  created_at timestamptz default now(),
  decided_at timestamptz
);

create unique index if not exists ux_role_requests_user_pending
  on app.role_requests(user_id) where status = 'pending';

-- 3) Convenience view
create or replace view app.v_users_roles as
select
  u.id as user_id,
  u.email,
  coalesce(r.role, 'customer') as role,
  r.updated_at as role_updated_at
from auth.users u
left join app.user_roles r on r.user_id = u.id;

-- 4) Ensure tickets/messages exist (no-op if created in earlier phases)
-- (Only include if your env may be missing these; otherwise omit.)
```

**Backfill/Seed (manual, one-time):**

```sql
-- Make yourself admin (replace YOUR_UUID)
insert into app.user_roles (user_id, role)
values ('YOUR_UUID', 'admin')
on conflict (user_id) do update set role = excluded.role, updated_at = now();
```

---

## 2) Backend — Admin & Role APIs

**Files**

```
backend/app/
├─ admin.py        # NEW: admin-only routes
├─ roles.py        # NEW: helpers to read/write roles safely
├─ main.py         # include admin router
└─ schemas.py      # add DTOs
```

### 2.1 Schemas (add to `schemas.py`)

```python
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

Role = Literal["customer","rep","admin"]
RoleRequestStatus = Literal["pending","approved","denied","cancelled"]

class UserRoleItem(BaseModel):
    user_id: str
    email: str | None = None
    role: Role
    role_updated_at: Optional[datetime] = None

class SetRoleRequest(BaseModel):
    role: Role

class RoleRequestCreate(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=400)

class RoleRequestItem(BaseModel):
    id: str
    user_id: str
    email: str | None = None
    reason: Optional[str] = None
    status: RoleRequestStatus
    created_at: datetime
    decided_at: Optional[datetime] = None

class DecideRoleRequest(BaseModel):
    decision: Literal["approve","deny"]
```

### 2.2 Role helpers (`roles.py`)

```python
from .main import get_db
def get_user_role(user_id: str) -> str:
    # SELECT role FROM app.user_roles WHERE user_id=:uid
    # default 'customer' when none
    ...

def set_user_role(user_id: str, role: str):
    # UPSERT with parameterized SQL within a transaction
    ...
```

### 2.3 Admin routes (`admin.py`)

```python
from fastapi import APIRouter, Depends, HTTPException, status, Query
from .schemas import (UserRoleItem, SetRoleRequest, RoleRequestCreate, RoleRequestItem, DecideRoleRequest)
from .main import get_current_user, User

router = APIRouter(prefix="/api/admin", tags=["admin"])

def require_admin(u: User):
    if (u.role or "customer") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

@router.get("/users", response_model=list[UserRoleItem])
def list_users(q: str | None = Query(None), user: User = Depends(get_current_user)):
    require_admin(user)
    # SELECT from view app.v_users_roles, filter by q in email (ILIKE)
    # LIMIT 200 for safety
    ...

@router.post("/users/{user_id}/role")
def set_role(user_id: str, body: SetRoleRequest, user: User = Depends(get_current_user)):
    require_admin(user)
    # roles.set_user_role(...)
    # Insert a system message? (optional audit)
    return {"ok": True}

# Role request workflow (optional)

@router.post("/role-requests", response_model=RoleRequestItem)
def create_role_request(body: RoleRequestCreate, user: User = Depends(get_current_user)):
    # customers call this to request rep; enforce max 1 pending per user
    ...

@router.get("/role-requests", response_model=list[RoleRequestItem])
def list_role_requests(status: str | None = Query(None), user: User = Depends(get_current_user)):
    require_admin(user)
    ...

@router.post("/role-requests/{req_id}/decide")
def decide_role_request(req_id: str, body: DecideRoleRequest, user: User = Depends(get_current_user)):
    require_admin(user)
    # update status + decided_at
    # if approve => set role='rep' on user_roles
    return {"ok": True}
```

**Error Contracts:** 401 unauthenticated, 403 non-admin, 404 not found, 409 duplicate pending request, 422 invalid role/decision.

---

## 3) Frontend — Admin & Request UI

**Files**

```
frontend/src/app/(protected)/admin/roles/page.tsx    # admin-only table + role selector
frontend/src/app/(protected)/account/request-rep/page.tsx  # customer page to submit a request
```

### 3.1 `/admin/roles` (admin only)

* **Table:** email, current role, last updated.
* **Action:** dropdown (`customer|rep|admin`) → `POST /api/admin/users/{id}/role`.
* **Search:** text filter on email.
* **Guards:** fetch `/api/me`; if role !== admin → 403 screen.

### 3.2 `/account/request-rep` (customer)

* Simple form: “Why do you need rep access?” (optional).
* POST `/api/admin/role-requests` (no decision here).
* Confirmation state; show **status** if a pending request exists.

---

## 4) Supabase “Tables not showing” — Visibility & Drift Playbook

### 4.1 Make `app` schema visible

In Supabase **Table Editor**, open the **schema selector** and enable “Show all schemas”, pick `app`.

### 4.2 Verify tables exist

Run in SQL editor:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema in ('app','public')
order by table_schema, table_name;
```

### 4.3 Apply/Repair migrations (idempotent)

* Ensure `pgcrypto` exists.
* Reapply **Phase 1→5** migrations and `0005a_admin_roles.sql` **against the Supabase connection**, not local Postgres.

**CLI example**

```
psql "postgresql://postgres:<PW>@db.<project-id>.supabase.co:5432/postgres?sslmode=require" -f backend/migrations/0001_roles.sql
psql "...supabase..." -f backend/migrations/0003_tickets_core.sql
psql "...supabase..." -f backend/migrations/0004_ai_chat.sql
psql "...supabase..." -f backend/migrations/0005_rep_console.sql
psql "...supabase..." -f backend/migrations/0005a_admin_roles.sql
```

### 4.4 Diagnostics endpoint (admin only)

Add a tiny route to dump basic info (no secrets):

```python
@router.get("/api/admin/_diag/db")
def db_diag(user: User = Depends(get_current_user)):
    require_admin(user)
    # SELECT now(), current_user, version(), installed extensions (pgcrypto),
    # count(*) from key tables, list of non-empty schemas, etc.
    return {...}
```

Use this when something looks off between environments.

---

## 5) Server Guards & Caching

* `get_current_user` **reads role from DB**: `coalesce(user_roles.role,'customer')`.
* **Do not** trust a client-provided “role” field.
* Add an **in-process cache** (TTL 60s) for `user_id → role` to reduce DB calls; **invalidate** cache on `set_role`.
* `/rep` page fetch should re-verify role on each load (client → `/api/me`).

---

## 6) Edge Cases & Expected Behavior

1. **Self-elevation attempt**: customer calls `/api/admin/...` → 403.
2. **Duplicate role request**: user submits again while `pending` exists → 409.
3. **Approve/deny race**: two admins decide same request → one succeeds, other gets 409/412.
4. **Assign to non-existent user**: `assignee_id` not found—either forbid (422) or allow raw UUID but show “Unknown (id)”. Recommended: verify against known reps and return 422.
5. **Escalate a closed ticket**: 409 (must reopen first).
6. **Acknowledge when not flagged**: idempotent 200 with no changes (or 409; pick one and document).
7. **Role changed while user is logged in**: effect is immediate if backend reads DB; no token refresh required.
8. **Case sensitivity in roles**: normalize to lowercase; enforce via check constraint/validation.
9. **Message counters**: ensure system messages for admin actions increment `message_count` and bump `last_message_at` in one transaction.
10. **Schema drift**: local dev points to local DB but prod uses Supabase—ensure `DATABASE_URL` is correct before running migrations.
11. **Missing pgcrypto**: migration fails on `gen_random_uuid()` → instruct to `create extension if not exists pgcrypto;`.
12. **Auth user deleted**: `tickets.created_by` is orphaned—do **not** cascade delete tickets; consider keeping assignee nullable.
13. **RLS (optional)**: If you enable Supabase RLS later, add policies to `app.*` or keep app schema private and use service key only from backend.

---

## 7) Test Plan (add to `pytest`)

* **Admin list users**: 403 for non-admin; returns list for admin.
* **Set role**: admin can set → verify `/api/me` shows new role.
* **Create role request**: customer can create; 409 on duplicate pending; admin approve → role becomes `rep`.
* **/rep gating**: customer gets 403; rep/admin gets 200.
* **Diag**: `/api/admin/_diag/db` returns extensions and counts for admin only.

Sample fixture ideas:

* `user_customer`, `user_admin`, `user_rep`.
* Seed `auth.users` (or mock) + `app.user_roles`.

---

## 8) Frontend UX Notes

* Add a small **Admin** menu only when role=`admin`.
* On `/admin/roles`: optimistic update with toast; revert on failure.
* On `/account/request-rep`: if `pending` exists, disable resubmit; show status.
* Don’t expose role selection anywhere outside the admin page.

---

## 9) Security Notes

* All admin endpoints require `role='admin'` and must be **server-side enforced**.
* Parameterize all SQL (no string interpolation).
* Log role changes as **system messages** (optional) for audit.
* Keep PII masking from Phase 6 (if already added), especially in admin logs.

---

## 10) Where to edit (map to your repo)

* **Backend**

  * `backend/app/admin.py` (new)
  * `backend/app/roles.py` (new)
  * `backend/app/schemas.py` (add DTOs)
  * `backend/app/main.py` → `app.include_router(admin_router)`
  * `backend/migrations/0005a_admin_roles.sql` (new)
* **Frontend**

  * `frontend/src/app/(protected)/admin/roles/page.tsx` (new)
  * `frontend/src/app/(protected)/account/request-rep/page.tsx` (new)
  * Existing guards in `/rep` and `AuthGate` (verify)

---

## 11) Quick Commands

**Seed yourself as admin**

```sql
insert into app.user_roles (user_id, role)
values ('YOUR_UUID','admin')
on conflict (user_id) do update set role = excluded.role, updated_at = now();
```

**List users + roles**

```sql
select * from app.v_users_roles order by role desc, email asc limit 200;
```

**Approve a pending request (SQL)**

```sql
update app.role_requests
set status='approved', decided_at=now()
where id = 'REQ_UUID' and status='pending';

insert into app.user_roles (user_id, role)
select user_id, 'rep' from app.role_requests where id='REQ_UUID';
```

---

## 12) Deliverables

* `0005a_admin_roles.sql` migration file applied to Supabase.
* `admin.py`, `roles.py`, schema DTOs, and wired router.
* `/admin/roles` & `/account/request-rep` pages.
* Tests covering admin/rep gating and requests.
* Short README section: “How to set roles” + “Troubleshooting: tables not visible”.

---

## 13) Agent Prompt (for your code agent)

```
Implement **TicketPilot – Phase 5A (Roles, Admin Tools, DB Visibility Hardening)**.

### Objectives
1) Admin-only role management API/UI; optional “request rep access” workflow.
2) Supabase schema visibility + idempotent migrations; diagnostics endpoint.
3) Server/UI gating consistency for rep/admin.

### Tasks
- Add migration `0005a_admin_roles.sql` (user_roles table, role_requests table, view v_users_roles, pgcrypto ensure).
- Backend:
  - `roles.py` helpers (get/set role).
  - `admin.py` routes:
    - GET /api/admin/users?q=
    - POST /api/admin/users/{user_id}/role
    - POST /api/admin/role-requests        # customer create
    - GET  /api/admin/role-requests?status=
    - POST /api/admin/role-requests/{id}/decide  # approve/deny → set role=rep on approve
  - Optional: GET /api/admin/_diag/db (admin only) with basic env info and counts.
  - Wire router in main.py; ensure get_current_user reads role from DB (default 'customer').
- Frontend:
  - `/admin/roles` page (admin only): table of users, role selector, search.
  - `/account/request-rep` page (customer): form to submit request; handle pending state.
  - Keep `/rep` gated by role.
- Tests (pytest):
  - Admin vs non-admin access.
  - Role set/reflect; role request lifecycle.
  - Rep console gating.
- Docs:
  - README updates for role management and Supabase visibility.

### Constraints
- No public self-elevation. All mutations behind admin routes.
- Parameterized SQL only; idempotent migrations.
- Keep code small, readable, and production-sane.

### Done When
- Admin can set roles; customers can request rep; Supabase shows `app` schema; migrations re-run safely; `/rep` gated correctly; tests pass.
```

---

If you want, I can also sketch the minimal `/admin/roles` React page and the FastAPI SQL snippets inline next.
