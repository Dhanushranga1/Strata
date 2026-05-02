# Sprint 4 — Admin Power Features

## Features

### S4-1 · Admin ticket view: all orgs + org filter
- Admin tickets page shows tickets from all organizations
- Columns: Org Name, Ticket Title, Status, Priority, Assignee, Created
- Filter bar: dropdown to select one org or "All Organizations"
- Default: show all, sorted by created_at desc

### S4-2 · Platform-wide audit log
- DB: new `app.audit_log` table
  - `id, actor_id, actor_email, action, resource_type, resource_id, org_id, metadata JSONB, created_at`
- Hook into: ticket CRUD, message send, member invite/remove, settings change, login events
- Admin UI: `/admin/audit-log` — filterable by org, actor, action, date range
- Note: log is read-only, never delete entries

### S4-3 · Rep contact card shown to client
- When ticket has an assignee, show on client ticket page:
  - Rep name, email, phone (from rep's profile)
- DB: need `phone` field on rep profiles (check `app.user_profiles` or add it)
- Rep fills phone in their own Settings → Profile page

### S4-4 · Editable admin settings + remove mobile from signup
- Remove phone/mobile field from signup flow (Supabase email+password and magic link)
- Admin Settings page: make these fields editable:
  - Organization name, logo, support email
  - Overdue thresholds, SLA settings
  - Rep profile: name, phone, bio
  - Notification preferences
- "Save" button per section with optimistic UI

## Implementation log

### S4-1 · Admin cross-org ticket view

**Backend** (`backend/app/admin.py`)
- Added `GET /api/admin/tickets` endpoint — no org membership required, uses `require_admin(user)`
- Joins `app.organizations` for `org_name`, `auth.users` for `assignee_email`
- Supports query params: `org_id`, `status`, `q` (search title), `offset`, `limit`
- Returns `items[]` + `total` for pagination

**Frontend** (`frontend/src/app/(protected)/admin/tickets/page.tsx`) — NEW ~200 lines
- Org dropdown populated from `/api/admin/organizations`; defaults to "All Organizations"
- Status filter (all / open / in_progress / resolved / closed / escalated)
- Free-text search (debounced via `useEffect`)
- Table: Org badge, title (link → `/tickets/{id}`), StatusBadge, priority pill, assignee email, created date
- Pagination with offset/limit

### S4-2 · Audit log

**Migration** (`backend/migrations/0022_audit_log.sql`) — NEW
```sql
CREATE TABLE IF NOT EXISTS app.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    actor_email TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT '',
    resource_id TEXT NOT NULL DEFAULT '',
    org_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Indexes: created_at DESC, org_id+created_at, actor_id+created_at, action
```

**Backend** (`backend/app/admin.py`)
- Added `log_audit(action, actor, resource_type, resource_id, org_id, metadata)` async helper
  - Fire-and-forget: opens its own DB connection, wrapped in try/except so it's always non-fatal
  - Called with `asyncio.create_task(log_audit(...))` in handler bodies
- Hooked into: org rename, org toggle-active, member add/patch/remove
- `GET /api/admin/audit-log` — paginated, filters: org_id, actor_email, action, date_from, date_to
  - Returns `{"items": [...], "total": N, "note": "..."}` — gracefully returns empty if table doesn't exist yet

**Backend** (`backend/app/rep.py`)
- Imported `log_audit` from admin (inside function body to avoid circular import)
- Used `asyncio.create_task(log_audit(...))` in: `accept_ticket`, `escalate_ticket`, `set_status`

**Frontend** (`frontend/src/app/(protected)/admin/audit-log/page.tsx`) — NEW ~200 lines
- Filters: org dropdown, action text search, actor email search
- Color-coded action badge map (ticket.* → blue, member.* → indigo, org.* → emerald, etc.)
- Amber notice card shown when migration hasn't been run yet (detects empty `note` field)
- Pagination

### S4-3 · Rep contact card on ticket

**Backend** (`backend/app/main.py`)
- `GET /api/me/profile` — reads `raw_user_meta_data` from Supabase admin client, returns `{display_name, phone, bio}`
- `PATCH /api/me/profile` — merges patch fields into existing metadata, updates via `supabase.auth.admin.update_user_by_id`
- No new DB table — stored in `auth.users.raw_user_meta_data` JSONB

**Backend** (`backend/app/tickets.py`)
- Ticket detail SQL updated to join `auth.users` on `assignee_id`:
  ```sql
  au.raw_user_meta_data->>'display_name' AS assignee_display_name,
  au.raw_user_meta_data->>'phone' AS assignee_phone,
  ```
- `TicketDetail` constructor passes `assignee_display_name` and `assignee_phone`

**Backend** (`backend/app/schemas.py`)
- Added `assignee_display_name: Optional[str] = None` and `assignee_phone: Optional[str] = None` to `TicketDetail`

**Frontend** (`frontend/src/app/(protected)/tickets/[id]/page.tsx`)
- Added `assignee_display_name?: string` and `assignee_phone?: string` to `TicketDetail` interface
- Added rep contact card: shown when `!isRep && ticket.assignee_id` — displays avatar, "Your Support Rep" label, name/email, phone as `tel:` link

**Frontend** (`frontend/src/app/(protected)/account/page.tsx`)
- Added `api`, `toast`, `Input`, `Label`, `Phone` imports
- `loadProfile()` calls `GET /api/me/profile` on mount
- `saveProfile()` calls `PATCH /api/me/profile` with `{display_name, phone}`
- "Contact Profile" card rendered for rep/admin roles only

### S4-4 · Settings + accept timer + role panels

**Backend** (`backend/app/rep.py`)
- Added `accepted_at` column to queue item SELECT and `QueueItem` constructor
- Added `POST /api/rep/tickets/{ticket_id}/accept` — sets `status='in_progress'`, `accepted_at=NOW()`, `assignee_id=user.id`, `needs_attention=false`; inserts system message; fires audit log

**Backend** (`backend/app/schemas.py`)
- Added `accepted_at: Optional[datetime] = None` to `QueueItem`

**Frontend** (`frontend/src/app/(protected)/rep/page.tsx`)
- Added live 1-second tick timer (`setInterval` + `Date.now()`)
- `formatElapsed()` renders elapsed time since `accepted_at` (Xh Ym format)
- "Accept" primary action button on open/escalated tickets; `handleAccept()` calls API + optimistic state update
- Elapsed timer shown in metadata row for in_progress tickets

**Frontend** (`frontend/src/app/(protected)/dashboard/page.tsx`)
- Role-aware Quick Actions: Client sees My Tickets + New Ticket; Rep adds Rep Console; Admin adds Analytics + Admin Panel
- Fixed role badge label (customer → Client)

**Frontend** (`frontend/src/app/(protected)/admin/settings/page.tsx`)
- Fully wired: overdue threshold, overdue reminder, attention thresholds (P1–P7), default ETR, auto-assign toggle
- `patchOrgSettings()` merge-safe helper: reads current settings before patching
- Rep workload table with color-coded open ticket counts
- Bulk auto-assign button (`POST /api/admin/auto-assign`)

**Admin Panel** (`frontend/src/app/(protected)/admin/page.tsx`)
- Added "All Tickets" card (→ `/admin/tickets`, orange)
- Added "Audit Log" card (→ `/admin/audit-log`, slate)
- Added `Building2` (Organisations, already present), `Ticket`, `ScrollText` to lucide imports

**Org access control** (`backend/app/auth.py`)
- Added `AND o.is_active = true` to `get_user_organizations` SQL — deactivated orgs vanish from switcher

**API client fix** (`frontend/src/lib/api-client.ts`)
- Fixed 204/empty-body crash: `response.text()` then `JSON.parse` if non-empty

### Run the audit log migration

```bash
psql "$DATABASE_URL" -f backend/migrations/0022_audit_log.sql
```
Or paste into the Supabase SQL editor.
