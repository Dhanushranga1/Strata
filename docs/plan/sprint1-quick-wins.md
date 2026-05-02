# Sprint 1 — Quick Wins

> Goal: ship label changes, ticket visibility fix, and auto-assign with zero breaking changes.

## Features in this sprint

### S1-1 · Rename "Member" → "Client"
**Scope:** UI labels only. DB role value stays `member` — changing it would break existing data.
**Touch points:** role badges, invite dropdowns, invite emails, rep/admin views.
**Done when:** No visible "Member" label anywhere in the app.

### S1-2 · Remove Team Members page from rep view
**Scope:** Hide nav item + guard the `/admin/users` route for reps.
**Done when:** Rep logs in and has no way to reach the Team Members page.

### S1-3 · "Total Queue" → "Total In Progress"
**Scope:** Rep dashboard stat card — change label and query to count `in_progress` only.
**Done when:** Card shows correct in_progress count.

### S1-4 · Auto-assign fires on ticket creation (not manual)
**Scope:** Backend `POST /api/tickets` — trigger the casper_route assignment immediately.
**Done when:** New ticket is auto-assigned to a rep without any admin action.

### S1-5 · Fix ticket visibility — reps see only their org's tickets
**What's broken:** Rep can see tickets from orgs they don't belong to if they switch via header.
**Fix:** Every ticket query checks `organization_id` against the rep's verified org membership, not just the header value.
**Done when:** Rep can only see tickets from orgs they are an active member of.

### S1-6 · Unified "My Tickets" view for reps
**Why:** Reps belong to multiple orgs and currently must switch orgs to see each one's queue — slow and annoying.
**Scope:** New page `/rep/my-tickets` — shows all tickets assigned to the logged-in rep across all their orgs. Read-only cross-org view; actions still happen within each org context.
**Done when:** Page loads tickets from all rep's orgs in a single list, sortable by org/priority/date.

---

## Implementation log

### S1-1 — Member → Client  ✅ SHIPPED
**Files changed:**
- `frontend/src/components/Sidebar.tsx` — role badge: `customer → 'Client'`
- `frontend/src/app/(protected)/account/page.tsx` — added `getRoleLabel()`, badge now uses it
- `frontend/src/app/invite/[token]/page.tsx` — added `ROLE_LABELS` map, badge + success message use it; description updated
- `frontend/src/app/(protected)/admin/users/page.tsx` — added `ROLE_LABELS` map, role selector + badge display use it; invite dropdown shows "Client"
- `backend/app/invites.py` — `role_label` map: `"member" → "Client"`; role description updated
**How:** DB role value `member` unchanged. All display-facing strings mapped through `ROLE_LABELS` / `getRoleLabel()`. Logic checks (`role === 'member'`) untouched.

### S1-2 — Hide Team Members from rep  ✅ ALREADY DONE
`Team Members` nav item was already `adminOnly: true` in Sidebar — no change needed.

### S1-3 — Total In Progress  ✅ SHIPPED
**Files changed:**
- `backend/app/schemas.py` — added `in_progress: int = 0` to `QueueCounts`
- `backend/app/rep.py` — new `in_progress_count` query; returned in `QueueCounts`
- `frontend/src/app/(protected)/rep/page.tsx` — card label → "Total In Progress"; value → `counts.in_progress`

### S1-4 — Auto-assign on creation  ✅ ALREADY DONE
Auto-assign (CASPER routing) was already running inside `create_ticket()` at lines 194–245 of `tickets.py`. No change needed.

### S1-5 — Ticket visibility fix  ✅ ALREADY DONE
`org_middleware.py` already verifies membership before any endpoint runs and returns 403 if the user is not in the org. `require_org_context()` uses the verified `request.state.org_id`. No change needed.

### S1-6 — Unified My Tickets  ✅ SHIPPED
**Files changed:**
- `backend/app/rep.py` — new `GET /api/rep/my-tickets` endpoint; no org header required; queries across all rep's orgs using `organization_members`
- `frontend/src/app/(protected)/rep/my-tickets/page.tsx` — new page; groups tickets by org; status tabs + search; links to `/tickets/{id}`
- `frontend/src/components/Sidebar.tsx` — added "My Tickets" nav item (`repOnly: true`) with `Inbox` icon
