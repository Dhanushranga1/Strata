Here’s the full, copy-paste friendly **Phase 3 — Ticketing Core** spec inline.

# TicketPilot — Phase 3 (Ticketing Core)

**Goal:** Implement the core ticketing system: schema, secured REST endpoints, and minimal UI to create, list, view tickets, and post messages. **No AI yet.**

---

## 0) Outcomes & Acceptance Criteria

**Outcomes**

* ✅ Postgres tables for **tickets** and **messages** (schema `app`).
* ✅ Authenticated users can **create a ticket** (title + description).
* ✅ Creating a ticket also creates the **initial message** from the creator.
* ✅ Users can **list** tickets with pagination and filters:

  * Customers: only their tickets
  * Reps/Admins: all tickets (or just theirs with `mine=true`)
* ✅ Users can **open a ticket** and see ordered messages (oldest → newest).
* ✅ Users can **post a message** on tickets they’re allowed to access.
* ✅ Backend enforces access & returns clean error codes.
* ✅ Frontend pages `/tickets` and `/tickets/[id]` are wired and usable.

**Acceptance Checklist**

1. `POST /api/tickets` → `201` with ticket JSON; appears in `/tickets`.
2. `GET /api/tickets` → respects `status_filter`, `q`, `mine`, `offset`, `limit`.
3. `GET /api/tickets/{id}` → ticket + messages ordered by time (ASC).
4. `POST /api/tickets/{id}/messages` → appends message; updates `last_message_at`.
5. Customers see only their tickets; reps see all.
6. Proper error codes: 401/403/404/400.

**Non-Goals (Phase 3)**

* ❌ No AI/RAG/citations.
* ❌ No escalation/assignment/close workflow (Phase 5).
* ❌ No notifications/SSE/WebSockets.
* ❌ No analytics or admin console.

---

## 1) Data Model & Migration

**Migration file:** `backend/migrations/0003_tickets_core.sql`

```sql
create schema if not exists app;

-- 1) Tickets
create table if not exists app.tickets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,                              -- auth.users.id (ticket owner)
  assignee_id uuid,                                      -- future use (rep assignment)
  title text not null check (length(title) between 3 and 120),
  description text not null check (length(description) between 10 and 4000),
  status text not null default 'open' check (status in ('open','closed')),
  message_count int not null default 0,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tickets_created_at on app.tickets(created_at desc);
create index if not exists idx_tickets_status on app.tickets(status);
create index if not exists idx_tickets_owner on app.tickets(created_by);
create index if not exists idx_tickets_last_message on app.tickets(last_message_at desc);

-- 2) Messages
create table if not exists app.messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references app.tickets(id) on delete cascade,
  sender_id uuid not null,
  sender_role text not null check (sender_role in ('customer','rep','system')),
  body text not null check (length(body) between 1 and 8000),
  created_at timestamptz default now()
);

create index if not exists idx_messages_ticket_time on app.messages(ticket_id, created_at);
create index if not exists idx_messages_sender on app.messages(sender_id);

-- (Optional) triggers to auto-update updated_at/message_count can be added later.
```

> Keep enums as constrained `text` for simplicity.
> `message_count` and `last_message_at` can be maintained in application code for this phase.

---

## 2) Backend (FastAPI)

> Reuse Phase 1 auth: `User` model + `get_current_user` (Supabase JWT).
> Reuse your DB access layer (Supabase SQL, psycopg/asyncpg, or ORM).

### 2.1 Suggested file layout

```
backend/app/
├─ main.py             # existing
├─ tickets.py          # NEW: routes
├─ schemas.py          # NEW: pydantic models
└─ ... (Phase 1/2 files)
```

Mount router in `main.py`:

```python
from .tickets import router as tickets_router
app.include_router(tickets_router)
```

### 2.2 Pydantic Schemas (`backend/app/schemas.py`)

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class TicketCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=4000)

class TicketSummary(BaseModel):
    id: str
    title: str
    status: str
    message_count: int
    last_message_at: datetime
    created_at: datetime

class TicketDetail(TicketSummary):
    created_by: str
    assignee_id: Optional[str] = None
    description: str

class TicketListResponse(BaseModel):
    items: List[TicketSummary]
    total: int
    offset: int
    limit: int

class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=8000)

class MessageOut(BaseModel):
    id: str
    ticket_id: str
    sender_id: str
    sender_role: str
    body: str
    created_at: datetime

class TicketWithMessages(BaseModel):
    ticket: TicketDetail
    messages: List[MessageOut]
```

### 2.3 Routes (`backend/app/tickets.py`)

```python
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional
from datetime import datetime
from .schemas import (
    TicketCreate, TicketSummary, TicketDetail, TicketListResponse,
    MessageCreate, MessageOut, TicketWithMessages
)
from .main import User, get_current_user

router = APIRouter(prefix="/api", tags=["tickets"])

def is_rep(user: User) -> bool:
    return (user.role or "customer") in ("rep", "admin")

@router.post("/tickets", response_model=TicketDetail, status_code=status.HTTP_201_CREATED)
def create_ticket(payload: TicketCreate, user: User = Depends(get_current_user)):
    # 1) Insert into app.tickets with created_by=user.id, status='open', message_count=0
    # 2) Insert initial message into app.messages (sender_id=user.id, sender_role=user.role or 'customer')
    # 3) Update ticket.message_count=1 and last_message_at=now()
    # 4) Return the new ticket as TicketDetail
    raise NotImplementedError

@router.get("/tickets", response_model=TicketListResponse)
def list_tickets(
    status_filter: str = Query("open", pattern="^(open|closed|all)$"),
    q: Optional[str] = Query(None, description="search in title (case-insensitive)"),
    mine: Optional[bool] = Query(None, description="for reps: show only my tickets when true"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
):
    # WHERE rules:
    # - if not is_rep(user): created_by = user.id
    # - if is_rep(user) and mine == True: created_by = user.id
    # - status_filter: if open/closed apply, if 'all' ignore
    # - q: title ILIKE %q%
    # ORDER BY last_message_at DESC
    # Return items + total count
    raise NotImplementedError

@router.get("/tickets/{ticket_id}", response_model=TicketWithMessages)
def get_ticket(ticket_id: str, user: User = Depends(get_current_user)):
    # Check access: owner OR rep/admin
    # Fetch ticket + messages ordered by created_at ASC
    raise NotImplementedError

@router.post("/tickets/{ticket_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def post_message(ticket_id: str, payload: MessageCreate, user: User = Depends(get_current_user)):
    # Access: owner OR rep/admin
    # Insert message with sender_id=user.id, sender_role=user.role or 'customer'
    # Update ticket.message_count += 1, last_message_at = now()
    # Return new message
    raise NotImplementedError
```

### 2.4 Error Contracts

* `401` — missing/invalid token
* `403` — not owner & not rep/admin
* `404` — ticket not found or not visible
* `400` — validation error (lengths)

### 2.5 Search, Filters, Pagination

* **Filters:** `status_filter=open|closed|all`, `q` (case-insensitive in title)
* **Reps:** pass `mine=true` to see only tickets created by themselves
* **Order:** `last_message_at DESC`
* **Pagination:** `offset` + `limit` (default 0/20; max 100)

---

## 3) Frontend (Next.js)

> Reuse Phase 1: `AuthGate`, `supabaseClient`, and `lib/api.ts` (add `apiPost()` below).

### 3.1 API helper (`frontend/lib/api.ts`)

```ts
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

### 3.2 Routes & Pages

```
/tickets
/tickets/[id]
```

**`/tickets` page (list + New Ticket modal)**

* Top bar: **New Ticket** button (modal).
* List: title, status badge, last activity time, `message_count`.
* Filters: `status_filter (open|closed|all)`, search `q`, pagination (Next/Prev).
* Modal fields: `title`, `description`.
* Submit → `apiPost('/api/tickets', { title, description })` → navigate to `/tickets/{id}`.

**`/tickets/[id]` page (detail)**

* Header: title, status, created\_at, ticket id.
* Messages: oldest → newest.
* Composer: textarea + **Send** → `apiPost('/api/tickets/{id}/messages', { body })` → refresh list.
* Manual refresh is fine (no SSE/WebSockets in this phase).

**Suggested components**

* `TicketList.tsx` — list + empty/loading + pagination
* `NewTicketModal.tsx` — modal with basic validation
* `MessageItem.tsx` — bubble UI (left/right by role)
* `Composer.tsx` — textarea + send button

---

## 4) Security & Access Rules

* **Customers:** can create tickets; can list/view/post only on **their** tickets.
* **Reps/Admins:** can list/view/post on **all** tickets (or `mine=true` for their own).
* **Server-side enforcement** only (don’t trust client).

**Access checks**

* `get_ticket`, `post_message`: allow if `ticket.created_by == user.id` **OR** `is_rep(user)`; else `403`.

---

## 5) Testing (cURL)

Assume `TOKEN` is a valid Supabase access token.

**Create ticket**

```bash
curl -X POST http://127.0.0.1:8000/api/tickets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Payment failed at checkout","description":"Payment declined with code 2003 on ICICI card."}'
```

**List tickets (open)**

```bash
curl "http://127.0.0.1:8000/api/tickets?status_filter=open&limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Search by title**

```bash
curl "http://127.0.0.1:8000/api/tickets?q=payment&status_filter=all" \
  -H "Authorization: Bearer $TOKEN"
```

**Get ticket + messages**

```bash
curl "http://127.0.0.1:8000/api/tickets/<ticket_id>" \
  -H "Authorization: Bearer $TOKEN"
```

**Post message**

```bash
curl -X POST "http://127.0.0.1:8000/api/tickets/<ticket_id>/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Sharing additional screenshots, please check."}'
```

---

## 6) Troubleshooting

* **403 on get/post:** You’re not the owner and not a rep. Assign rep role in `app.user_roles` for testing.
* **400 validation error:** Check min/max lengths on `title`, `description`, `body`.
* **Empty list (customer):** Customers only see their own tickets; use a rep for full list.
* **Ordering wrong:** Ensure you update `last_message_at` whenever a new message is added.

---

## 7) What’s Next (Phase 4 Preview)

* RAG-powered AI chat per ticket: retrieve top-k chunks from FAISS, synthesize an answer, store AI message + citations.
* Confidence scoring and escalation suggestion (ties into Phase 5 Rep Console).

---

If you want, I can also drop the **agent prompt** tailored for Phase 3 again, or we can jump straight to a Phase 4 spec.
