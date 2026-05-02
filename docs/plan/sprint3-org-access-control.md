# Sprint 3 — Org Access Control & Admin Org Management

## Features

### S3-1 · Rep ↔ Org assignments (admin controls)
- DB: `organization_members` already exists — enforce it strictly (Sprint 1 fixes the query side)
- Admin UI: Settings → Team → per-org rep list with Add/Remove buttons
- When admin removes rep from org: org disappears from rep's switcher immediately

### S3-2 · Unified "My Tickets" page for reps
*(moved to Sprint 1 — built early because it unblocks rep UX)*

### S3-3 · Admin creates and manages organizations
- Admin panel → Organizations section (new page `/admin/organizations`)
- Create org: name, slug, settings
- Edit org: rename, change settings
- Deactivate org: hides from all views but preserves data

### S3-4 · Rep sees only assigned-org tickets (enforced end-to-end)
- API-level enforcement in all ticket list/detail endpoints
- Org switcher only shows orgs the rep is an active member of

## Implementation log

### S3-1 · Rep ↔ Org assignments  ✅ SHIPPED
**Files changed:**
- `backend/app/admin.py` — new platform-admin bypass endpoints (no org-membership check needed):
  - `GET /api/admin/organizations` — list ALL orgs on the platform with `member_count` + `ticket_count`
  - `PATCH /api/admin/organizations/{org_id}` — rename or toggle `is_active`
  - `GET /api/admin/organizations/{org_id}/members` — list members of any org
  - `POST /api/admin/organizations/{org_id}/members` — add user by email + role (auto-resolves email → user_id)
  - `PATCH /api/admin/organizations/{org_id}/members/{user_id}` — change org-level role
  - `DELETE /api/admin/organizations/{org_id}/members/{user_id}` — remove member (returns `{"ok": true}` for api-client compatibility)
- `frontend/src/lib/api-client.ts` — fixed 204 / empty-body responses: `response.json()` replaced with `text ? JSON.parse(text) : {}`
- `frontend/src/app/(protected)/admin/organizations/page.tsx` — new admin organisations page:
  - Expandable org cards showing members inline
  - Create org dialog → `POST /api/organizations`
  - Rename org dialog → `PATCH /api/admin/organizations/{id}`
  - Toggle active/inactive button → `PATCH /api/admin/organizations/{id}`
  - Add member dialog → email + role → `POST /api/admin/organizations/{id}/members`
  - Inline role selector per member → `PATCH /api/admin/organizations/{id}/members/{userId}`
  - Remove member with confirmation → `DELETE /api/admin/organizations/{id}/members/{userId}`
- `frontend/src/app/(protected)/admin/page.tsx` — added "Organisations" card (emerald, first card) linking to `/admin/organizations`

### S3-2 · Unified My Tickets  ✅ DONE IN SPRINT 1
*(built early — see sprint1 doc)*

### S3-3 · Admin creates and manages organizations  ✅ SHIPPED
Same page as S3-1. Create org → admin becomes owner. Rename + deactivate from the org list.

### S3-4 · Rep sees only assigned-org tickets  ✅ VERIFIED + HARDENED
**Files changed:**
- `backend/app/auth.py` — `get_user_organizations` query now adds `AND o.is_active = true`; deactivated orgs disappear from the org switcher immediately. API-level enforcement was already in place via `org_middleware.py`.
