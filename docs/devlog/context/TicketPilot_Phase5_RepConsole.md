Here’s the full, copy-paste friendly **Phase 5 (Rep Console & Escalation)** spec inline — super detailed and ready to hand to your agent.

# TicketPilot — Phase 5 (Rep Console & Escalation)

**Goal:** Deliver a focused **Rep Console** with actionable queues (“Needs Attention”, “Open/Active”, “Escalated”, “All”) and a **lightweight escalation workflow** tied to the confidence hints from Phase 4. Reps can triage, reply, escalate, change status, assign, acknowledge, and ingest KB content — no streaming/notifications yet.

---

## 0) Outcomes & Acceptance Criteria

**Outcomes**

* ✅ A secured **Rep Console** at `/rep` (rep/admin only) showing queues:

  * **Needs Attention** — tickets flagged by AI (Phase 4) or manually marked.
  * **Open/Active** — `open`, `in_progress`, `resolved` (but not closed/escalated), not flagged.
  * **Escalated** — `escalated` only.
  * **All** — everything visible to reps.
* ✅ Rep actions (server-side enforced):

  * **Reply** (existing Phase 3 endpoint).
  * **Escalate** (status→`escalated`, sets `needs_attention=true`, optional reason).
  * **Change status**: `open` ⇄ `in_progress` ⇄ `resolved` → `closed` (and `closed` → `open` for reopen).
  * **Assign** (to self or a specific rep).
  * **Acknowledge** (clear `needs_attention`).
  * **Set priority** (`low|normal|high`).
  * **KB Ingest** modal (reuse Phase 2 API).
* ✅ Phase 4 integration: when AI replies with `suggest_escalation=true`, ticket is **auto-flagged** (`needs_attention=true`) and visible in “Needs Attention”.
* ✅ Every state change writes a **system message** (`sender_role='system'`).

**Acceptance Checklist**

1. `/rep` accessible to **rep/admin** only (customers get 403 or redirect).
2. Queues show cards with title, status, priority, assignee, message\_count, last activity time; lane counts render.
3. **Escalate** moves a ticket to `escalated`, sets `needs_attention=true`, and logs a system message.
4. **Acknowledge** clears `needs_attention` and removes from Needs Attention lane.
5. **Assign to me** sets `assignee_id=current_user.id` and logs a system message.
6. **Close** moves status to `closed` and prevents further escalate attempts; **Reopen** sets status to `open`.
7. Phase 4 AI replies with `suggest_escalation=true` cause **auto-flag** (ticket appears under Needs Attention).
8. APIs enforce role/transition constraints; 401/403/404/409 returned appropriately.

**Non-Goals**

* ❌ No notifications (email/push), no SSE/WebSockets.
* ❌ No teams/skills routing, tags, or SLAs (beyond simple fields below).
* ❌ No analytics dashboard (counts only).

---

## 1) Repository Changes

```
ticketpilot/
├─ backend/
│  ├─ app/
│  │  ├─ rep.py                 # NEW: rep-only queues & actions
│  │  ├─ tickets.py             # (existing) — import/use shared helpers if desired
│  │  ├─ schemas.py             # ADD: queue & action models
│  │  └─ ... (Phase 1–4 files)
│  └─ migrations/
│     └─ 0005_rep_console.sql   # NEW: status enum add, needs_attention, priority
└─ frontend/
   └─ app/(protected)/rep/page.tsx  # NEW: Rep Console (lanes + actions + KB ingest modal)
```

---

## 2) Data Model & Migration

**File:** `backend/migrations/0005_rep_console.sql`

```sql
create schema if not exists app;

-- Extend status to include 'escalated'
alter table app.tickets
  drop constraint if exists app_tickets_status_check;
alter table app.tickets
  add constraint app_tickets_status_check
  check (status in ('open','in_progress','resolved','closed','escalated'));

-- Triage fields
alter table app.tickets
  add column if not exists needs_attention boolean not null default false,
  add column if not exists priority text not null default 'normal' check (priority in ('low','normal','high'));

-- Indexes
create index if not exists idx_tickets_needs_attention on app.tickets(needs_attention);
create index if not exists idx_tickets_assignee on app.tickets(assignee_id);

-- (Optional) quick glance view
create or replace view app.v_ticket_glance as
select
  t.id,
  t.title,
  t.status,
  t.needs_attention,
  t.priority,
  t.assignee_id,
  t.message_count,
  t.last_message_at,
  t.created_by,
  t.created_at
from app.tickets t;
```

### State & Rules

* **Escalate** is **not allowed** if `status='closed'` (must reopen first).
* **Setting** `status in ('resolved','closed')` automatically implies `needs_attention=false`.
* **`escalated`** implies `needs_attention=true` until acknowledged (or resolved/closed).
* Priority is independent; defaults `normal`.

---

## 3) Backend API (FastAPI)

### 3.1 Schema additions (`backend/app/schemas.py`)

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class QueueItem(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    needs_attention: bool
    assignee_id: Optional[str] = None
    message_count: int
    last_message_at: datetime
    created_at: datetime

class QueueResponse(BaseModel):
    items: List[QueueItem]
    total: int
    offset: int
    limit: int

class QueueCounts(BaseModel):
    needs_attention: int
    open_active: int
    escalated: int
    all: int

class EscalateRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=400)

class StatusChangeRequest(BaseModel):
    status: str = Field(pattern="^(open|in_progress|resolved|closed|escalated)$")

class AssignRequest(BaseModel):
    assignee_id: Optional[str] = None  # None => assign to caller

class AckAttentionRequest(BaseModel):
    note: Optional[str] = Field(default=None, max_length=200)

class PriorityRequest(BaseModel):
    priority: str = Field(pattern="^(low|normal|high)$")
```

### 3.2 Role helper (reuse Phase 1 `User`)

```python
def require_rep(user: "User"):
    if (user.role or "customer") not in ("rep","admin"):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Rep access required")
```

### 3.3 Routes (`backend/app/rep.py`)

```python
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional, List
from .schemas import (
    QueueResponse, QueueCounts, QueueItem,
    EscalateRequest, StatusChangeRequest, AssignRequest, AckAttentionRequest, PriorityRequest
)
from .main import get_current_user, User
from datetime import datetime

router = APIRouter(prefix="/api/rep", tags=["rep"])

@router.get("/queue", response_model=QueueResponse)
def queue(
    lane: str = Query("needs_attention", pattern="^(needs_attention|open|escalated|all)$"),
    q: Optional[str] = Query(None, description="search in title (ILIKE)"),
    mine: Optional[bool] = Query(None, description="restrict to assignee=current user"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
):
    require_rep(user)
    # WHERE building:
    # lane=needs_attention -> needs_attention=true AND status!='closed'
    # lane=open           -> status IN ('open','in_progress','resolved') AND needs_attention=false
    # lane=escalated      -> status='escalated'
    # lane=all            -> no lane predicate
    # mine=true           -> assignee_id=user.id
    # q provided          -> title ILIKE %q%
    # ORDER BY last_message_at DESC
    # Return rows as QueueItem + total count
    raise NotImplementedError

@router.get("/counts", response_model=QueueCounts)
def counts(user: User = Depends(get_current_user)):
    require_rep(user)
    # Return counts for lanes (needs_attention, open_active, escalated, all)
    raise NotImplementedError

@router.post("/tickets/{ticket_id}/escalate", status_code=status.HTTP_200_OK)
def escalate(ticket_id: str, body: EscalateRequest, user: User = Depends(get_current_user)):
    require_rep(user)
    # Preconditions: ticket exists; status!='closed'
    # Update: status='escalated', needs_attention=true
    # Insert system message: "Escalated" (+reason)
    # Update last_message_at, message_count += 1
    return {"ok": True}

@router.post("/tickets/{ticket_id}/status", status_code=status.HTTP_200_OK)
def set_status(ticket_id: str, body: StatusChangeRequest, user: User = Depends(get_current_user)):
    require_rep(user)
    # Enforce transitions (closed -> must reopen via status=open)
    # If setting resolved/closed => needs_attention=false
    # Insert system message e.g., "Status changed to resolved"
    return {"ok": True}

@router.post("/tickets/{ticket_id}/assign", status_code=status.HTTP_200_OK)
def assign(ticket_id: str, body: AssignRequest, user: User = Depends(get_current_user)):
    require_rep(user)
    # assignee = body.assignee_id or user.id
    # Update tickets.assignee_id
    # Insert system message e.g., "Assigned to <user/email>"
    return {"ok": True}

@router.post("/tickets/{ticket_id}/acknowledge", status_code=status.HTTP_200_OK)
def acknowledge_attention(ticket_id: str, body: AckAttentionRequest, user: User = Depends(get_current_user)):
    require_rep(user)
    # If needs_attention=true -> set false
    # Insert system message e.g., "Attention acknowledged" (+note)
    return {"ok": True}

@router.post("/tickets/{ticket_id}/priority", status_code=status.HTTP_200_OK)
def set_priority(ticket_id: str, body: PriorityRequest, user: User = Depends(get_current_user)):
    require_rep(user)
    # Update tickets.priority
    # Insert system message e.g., "Priority set to high"
    return {"ok": True}
```

### 3.4 Status Transition Matrix (server-side guard)

| From → To        | open | in\_progress | resolved | closed | escalated |
| ---------------- | ---- | ------------ | -------- | ------ | --------- |
| **open**         | ✓    | ✓            | ✓        | ✓      | ✓         |
| **in\_progress** | ✓    | ✓            | ✓        | ✓      | ✓         |
| **resolved**     | ✓    | ✓            | ✓        | ✓      | ✓         |
| **closed**       | ✓    | ✗            | ✗        | ✓      | ✗         |
| **escalated**    | ✓    | ✓            | ✓        | ✓      | ✓         |

* Escalate is a convenience action mapping to `status='escalated'` + `needs_attention=true`.
* When setting to **resolved/closed**, also set `needs_attention=false`.

### 3.5 System Message Templates

* Escalate: `"[system] Ticket escalated"` (+ `Reason: <text>` if provided)
* Status change: `"[system] Status changed to <status>"`
* Assign: `"[system] Assigned to <user or assignee_id>"`
* Acknowledge: `"[system] Attention acknowledged"` (+ optional note)
* Priority: `"[system] Priority set to <low|normal|high>"`
* AI auto-flag (from Phase 4 patch): `"[system] AI suggested escalation (confidence <0.xx>)"`

### 3.6 Phase 4 Patch (auto-flag from `/chat`)

In `POST /api/tickets/{id}/chat`, after computing `suggest_escalation`:

* If `suggest_escalation==true` and ticket not `closed`:

  * `UPDATE app.tickets SET needs_attention=true WHERE id=:id`
  * Insert system message as above.

### 3.7 Error Contracts

* `401` — not authenticated
* `403` — caller not rep/admin or forbidden transition
* `404` — ticket not found
* `409` — invalid operation (e.g., escalate a closed ticket)
* `422` — validation errors

---

## 4) Frontend — Rep Console (`/rep`)

### 4.1 Route Protection

* `/rep` gated by role:

  * On mount, call `/api/me`; if `role ∉ {rep,admin}` → show 403 screen or redirect to `/login`.
* Use existing AuthGate pattern from Phase 1.

### 4.2 Page Layout (Next.js App Router + Tailwind)

* **Header**: “Rep Console”

  * Lane counts (fetched from `/api/rep/counts`): Needs Attention | Open | Escalated | All.
* **Controls** (sticky bar):

  * Search input (`q`), “Mine only” toggle, lane tabs (`needs_attention | open | escalated | all`), pagination.
* **Tickets list** (cards):

  * Title (link to `/tickets/[id]`)
  * Badges: `status`, `priority`, `needs_attention` (if true)
  * `assignee` (email or “Unassigned”)
  * `message_count`
  * `last_message_at` (relative time)

**Card actions** (inline buttons):

* **Open** (navigate)
* **Assign to me**
* **Escalate** (confirm + optional reason)
* **Resolve / Close** (dropdown)
* **Acknowledge** (if flagged)
* **Set Priority** (dropdown: low/normal/high)
* **KB Ingest** (opens modal; see §4.5)

### 4.3 API Calls (client snippets)

```ts
// counts
await apiGet('/api/rep/counts')

// queue
await apiGet(`/api/rep/queue?lane=${lane}&q=${encodeURIComponent(q||'')}&mine=${mine||''}&offset=${offset}&limit=${limit}`)

// actions
await apiPost(`/api/rep/tickets/${id}/assign`, {})
await apiPost(`/api/rep/tickets/${id}/escalate`, { reason })
await apiPost(`/api/rep/tickets/${id}/status`, { status }) // 'open' | 'in_progress' | 'resolved' | 'closed' | 'escalated'
await apiPost(`/api/rep/tickets/${id}/acknowledge`, { note })
await apiPost(`/api/rep/tickets/${id}/priority`, { priority }) // 'low' | 'normal' | 'high'
```

### 4.4 Ticket Detail Enhancements (`/tickets/[id]`)

* **Rep Action Bar** at top: Assign to me | Escalate | Resolve | Close | Reopen (if closed) | Acknowledge (if flagged) | Priority selector.
* **Banner** if `needs_attention=true`: “Flagged for attention (AI or manual).”
* System messages styled subtly (muted/italic).

### 4.5 KB Ingest Modal (rep-only)

* Reuse Phase 2 `POST /api/kb/ingest`.
* Tabs:

  * **Upload File** (PDF/TXT/MD/DOCX)
  * **Paste Text**
* On success: toast “Ingested N chunks • added M vectors”.

---

## 5) Security & Access

* Endpoints under `/api/rep/*` require `role ∈ {rep, admin}`.
* Customers receive `403` on rep routes.
* All state changes must be server-side checked (don’t rely on UI).
* Every state change logs a **system** message (immutable audit trail via messages table).

---

## 6) Integration Notes

* **With Phase 4**: `/chat` auto-flags `needs_attention` when `suggest_escalation=true` and ticket not `closed`.
* **With Phase 3**: Replying continues via `POST /api/tickets/{id}/messages`.
* **With Phase 2**: KB ingest modal uses `POST /api/kb/ingest` (rep-only) to enrich the knowledge base.

---

## 7) Testing (cURL)

```bash
TOKEN_REP="..."

# Counts
curl "http://127.0.0.1:8000/api/rep/counts" \
  -H "Authorization: Bearer $TOKEN_REP"

# Needs Attention lane
curl "http://127.0.0.1:8000/api/rep/queue?lane=needs_attention&limit=10" \
  -H "Authorization: Bearer $TOKEN_REP"

# Escalate
curl -X POST "http://127.0.0.1:8000/api/rep/tickets/<id>/escalate" \
  -H "Authorization: Bearer $TOKEN_REP" -H "Content-Type: application/json" \
  -d '{"reason":"Policy exception; needs senior review"}'

# Acknowledge
curl -X POST "http://127.0.0.1:8000/api/rep/tickets/<id>/acknowledge" \
  -H "Authorization: Bearer $TOKEN_REP"

# Assign to me
curl -X POST "http://127.0.0.1:8000/api/rep/tickets/<id>/assign" \
  -H "Authorization: Bearer $TOKEN_REP"

# Status change
curl -X POST "http://127.0.0.1:8000/api/rep/tickets/<id>/status" \
  -H "Authorization: Bearer $TOKEN_REP" -H "Content-Type: application/json" \
  -d '{"status":"resolved"}'

# Priority
curl -X POST "http://127.0.0.1:8000/api/rep/tickets/<id>/priority" \
  -H "Authorization: Bearer $TOKEN_REP" -H "Content-Type: application/json" \
  -d '{"priority":"high"}'
```

**Expected**

* `200` with `{ ok: true }` for actions; queue returns paginated items; counts return per-lane totals.
* `403` if caller not rep/admin; `409` when escalate attempted on `closed`; `404` when ticket not found.

---

## 8) Troubleshooting

* **Queue empty** → Ensure tickets with `needs_attention=true` (trigger via Phase 4) or open statuses exist.
* **403 on /api/rep/** → Add your user to `app.user_roles` with `role='rep'` or `'admin'`:

  ```sql
  insert into app.user_roles (user_id, role) values ('<uuid>', 'rep')
  on conflict (user_id) do update set role=excluded.role;
  ```
* **409 on escalate** → Ticket is `closed`; call `/status { "status": "open" }` first.
* **Buttons disabled** → Respect current status (e.g., cannot escalate `closed`).
* **KB ingest failing** → Check Phase 2 env (`GOOGLE_API_KEY`) and FAISS paths; verify file/mime.

---

## 9) Implementation Hints (Server)

* **Transactions:** For any action that updates `tickets` and inserts a system message, wrap in a single DB transaction.
* **Updated timestamps:** Update `tickets.updated_at` and `tickets.last_message_at` when writing system messages; increment `message_count`.
* **Names in system messages:** If you can resolve `assignee_id → email`, include it in the message body for clarity.
* **Search (`q`)**: Use `ILIKE '%' || q || '%'` on `title`; add `description` later if needed.
* **Counts:** Precompute with simple `COUNT(*) FILTER (...)` query or separate queries per lane.

---

## 10) README Addendum (what to document)

* How to grant rep role (SQL above).
* How AI auto-flags tickets (Phase 4) and where they appear in `/rep`.
* Rep endpoints and sample payloads.
* Screenshots/GIFs of `/rep` lanes and actions (optional).

---

## 11) What’s Next (Phase 6 Preview — Polish & Test Pass)

* Uniform error formatter (JSON with `code`, `message`).
* UI polish: disabled states, empty states, skeleton loaders.
* Validation tightening and length caps.
* PII log scrub audit.
* Manual acceptance pass across Phases 1–5; fix only blockers.

---

### (Optional) Example SQL/Logic Snippets

**Escalate (pseudo-SQL within transaction):**

```sql
-- Preconditions: select status from app.tickets where id=:id for update; if status='closed' -> 409
update app.tickets
set status='escalated', needs_attention=true, updated_at=now(), last_message_at=now()
where id=:id;

insert into app.messages (ticket_id, sender_id, sender_role, body, created_at)
values (:id, :user_id, 'system', coalesce('Escalated' || case when :reason<>'' then ' • Reason: '||:reason else '' end, 'Escalated'), now());
update app.tickets set message_count = message_count + 1 where id=:id;
```

**Acknowledge:**

```sql
update app.tickets
set needs_attention=false, updated_at=now(), last_message_at=now()
where id=:id and needs_attention=true;

insert into app.messages (ticket_id, sender_id, sender_role, body, created_at)
values (:id, :user_id, 'system', coalesce('Attention acknowledged' || case when :note<>'' then ' • Note: '||:note else '' end, 'Attention acknowledged'), now());
update app.tickets set message_count = message_count + 1 where id=:id;
```

**Assign:**

```sql
update app.tickets
set assignee_id = coalesce(:assignee_id, :user_id), updated_at=now(), last_message_at=now()
where id=:id;

insert into app.messages (ticket_id, sender_id, sender_role, body, created_at)
values (:id, :user_id, 'system', 'Assigned to '||coalesce(:assignee_email, :assignee_id), now());
update app.tickets set message_count = message_count + 1 where id=:id;
```

**Status change:**

```sql
-- guard closed->anything_else except open; if invalid -> 403/409
update app.tickets
set status=:status,
    needs_attention = case when :status in ('resolved','closed') then false else needs_attention end,
    updated_at=now(),
    last_message_at=now()
where id=:id;

insert into app.messages (ticket_id, sender_id, sender_role, body, created_at)
values (:id, :user_id, 'system', 'Status changed to '||:status, now());
update app.tickets set message_count = message_count + 1 where id=:id;
```

---

That’s everything you need for Phase 5. If you want, I can also produce the **agent prompt** version (short, copy-paste) to give directly to your code agent.
