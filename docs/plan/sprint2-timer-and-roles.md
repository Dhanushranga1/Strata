# Sprint 2 — Timer & Role-Based UI

## Features

### S2-1 · Time to Resolve field
- DB: add `accepted_at TIMESTAMPTZ`, `resolved_duration_minutes INTEGER` to `app.tickets`
- Ticket list: new column showing live timer for open/in_progress, final duration for resolved/closed
- Format: `2h 34m` (under 24h), `3d 2h` (over 24h)

### S2-2 · Accept → in_progress + timer start
- New `POST /api/tickets/{id}/accept` endpoint
- Sets `status = 'in_progress'`, `accepted_at = NOW()`, `assignee_id = current_user.id`
- Frontend: "Accept" button in rep queue card → calls endpoint → card updates live

### S2-3 · Role-based conditional panels
- Dashboard: admin sees org stats + system health; rep sees queue + AI metrics; client sees their ticket list + status summary
- Sidebar: hide/show nav items per role (already partial — complete the gaps)
- Settings: admin-only sections hidden from rep view

## Implementation log

### S2-1 — Time to Resolve  ✅ SHIPPED
**DB:** `accepted_at TIMESTAMPTZ` added to `app.tickets` (migration run prior to this session).
**Files changed:**
- `backend/app/schemas.py` — added `accepted_at: Optional[datetime] = None` to `QueueItem`
- `backend/app/rep.py` — queue SQL now selects `t.accepted_at`; `QueueItem` constructor passes `accepted_at`
- `frontend/src/app/(protected)/rep/page.tsx` — added `accepted_at?: string` to `QueueItem` interface; added `formatElapsed()` helper (formats ms into `2h 34m` / `3d 2h`); added `now` state ticking every second; in-progress tickets show "In progress: Xh Ym" live timer in metadata row

### S2-2 — Accept → in_progress + timer start  ✅ SHIPPED
**Files changed:**
- `backend/app/rep.py` — new `POST /api/rep/tickets/{ticket_id}/accept` endpoint; validates ticket is `open` or `escalated`; sets `status='in_progress'`, `accepted_at=NOW()`, `assignee_id=user.id`, clears `needs_attention`; inserts system message
- `frontend/src/app/(protected)/rep/page.tsx` — `handleAccept()` function calls accept endpoint, optimistically updates local state; "Accept" button added as first primary action on `open`/`escalated` cards (variant=default so it stands out); live timer starts immediately via optimistic `accepted_at`

### S2-3 — Role-based dashboard panels  ✅ SHIPPED
**Files changed:**
- `frontend/src/app/(protected)/dashboard/page.tsx`
  - Role badge: `customer` now displays as "Client" instead of raw "customer"
  - Quick Actions panel is now role-aware:
    - **Client**: "My Tickets" + "New Ticket"
    - **Rep**: "All Tickets" + "Rep Console" + "My Tickets"
    - **Admin**: everything above + "Analytics" + "Admin Panel"
