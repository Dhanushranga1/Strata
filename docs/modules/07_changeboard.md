# ChangeBoard — Change Management (Lightweight)

> **Implementation Status: ✅ Built & Deployed**  
> Backend: `backend/app/changeboard.py` · Migration: `0039_changeboard.sql` (live)  
> Frontend: `frontend/src/app/(protected)/changes/page.tsx`  
> See [STRATA_MODULES_SPRINT.md](../sprint/STRATA_MODULES_SPRINT.md) for full build notes.

## Problem It Solves
An SME IT admin once pushed a DNS config change at 3pm on a Friday. Email stopped working company-wide for 4 hours. There was no review. No rollback plan. No one knew it was happening.

ChangeBoard is a simple gate: before you touch production infrastructure, write down what you're doing, get it approved, and have a rollback plan. It's not ITIL bureaucracy — it's a 2-minute safety check for changes that could hurt everyone.

---

## Feature Gate
`"change_board"` — Business plan and above

---

## Risk Levels
| Level | Description | Approval Required |
|-------|-------------|------------------|
| `low` | Minor config change, easily reversible | No (auto-approved) |
| `standard` | Normal change with known impact | Yes — any admin |
| `high` | Significant impact, extended downtime | Yes — owner only |
| `emergency` | P1 incident mitigation, skip normal process | Yes (retroactive) |

---

## Workflow
```
draft → pending_approval → approved → scheduled → in_progress → completed
                       ↘ rejected
                                                              ↘ failed
```

Emergency changes: `emergency` risk level goes straight to `in_progress`, requires retroactive approval within 24h.

---

## Database Schema
**Migration:** `backend/migrations/0036_changeboard.sql`

```sql
CREATE TABLE app.changes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  risk_level       text NOT NULL DEFAULT 'standard'
                   CHECK (risk_level IN ('low','standard','high','emergency')),
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','pending_approval','approved',
                                     'scheduled','in_progress','completed','failed','cancelled')),
  requested_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_at     timestamptz,
  completed_at     timestamptz,
  rollback_plan    text NOT NULL DEFAULT '',
  impact_description text,
  affected_systems text[],
  linked_ticket_id uuid REFERENCES app.tickets(id) ON DELETE SET NULL,
  blackout_blocked bool NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Blackout periods — no high/standard changes allowed during these windows
CREATE TABLE app.change_blackouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,                      -- "Month-end close", "Product launch"
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  blocks_risk_levels text[] NOT NULL DEFAULT ARRAY['high','standard'],
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_changes_org_status    ON app.changes(organization_id, status);
CREATE INDEX idx_changes_org_scheduled ON app.changes(organization_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_blackouts_org_time    ON app.change_blackouts(organization_id, starts_at, ends_at);
```

---

## API Endpoints
**Router prefix:** `/api/changes`
**File:** `backend/app/modules/changeboard/router.py`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/changes` | List changes (filter: status, risk_level, date range) |
| POST | `/api/changes` | Create change request (starts as draft) |
| GET | `/api/changes/{id}` | Change detail |
| PATCH | `/api/changes/{id}` | Update (only in draft state) |
| POST | `/api/changes/{id}/submit` | Submit for approval (draft → pending_approval) |
| POST | `/api/changes/{id}/approve` | Approve (admin/owner) → approved |
| POST | `/api/changes/{id}/reject` | Reject with reason |
| POST | `/api/changes/{id}/schedule` | Set scheduled_at → scheduled |
| POST | `/api/changes/{id}/start` | Mark in_progress |
| POST | `/api/changes/{id}/complete` | Mark completed |
| POST | `/api/changes/{id}/fail` | Mark failed (triggers rollback prompt) |
| GET | `/api/changes/calendar` | Scheduled changes as calendar events |
| GET | `/api/changes/stats` | Module stats for Strata hub |
| GET | `/api/changes/blackouts` | List blackout periods |
| POST | `/api/changes/blackouts` | Create blackout period |
| DELETE | `/api/changes/blackouts/{id}` | Remove blackout |

---

## Blackout Check
When submitting or scheduling a change, check against active blackout periods:

```python
async def check_blackout(org_id, risk_level, scheduled_at, db):
    if risk_level == 'emergency':
        return None  # emergency changes bypass blackouts
    blackout = await db.fetchrow("""
        SELECT name FROM app.change_blackouts
        WHERE organization_id = $1
          AND $2 = ANY(blocks_risk_levels)
          AND starts_at <= $3
          AND ends_at >= $3
        LIMIT 1
    """, org_id, risk_level, scheduled_at or datetime.utcnow())
    return blackout["name"] if blackout else None
```

If blocked: return HTTP 409 with `{ "blocked_by_blackout": "Month-end close", "ends_at": "..." }`.
Frontend shows: "This change is blocked during the 'Month-end close' blackout window (ends June 3)."

---

## Approval Logic
- `low` risk: auto-approved on submit
- `standard` risk: any admin or owner can approve
- `high` risk: only org owner can approve
- `emergency` risk: bypass approval, but notify all admins for retroactive review within 24h

---

## Change Calendar
`GET /api/changes/calendar` returns scheduled changes formatted for a calendar view:
```json
[
  {
    "id": "...",
    "title": "DNS Migration — office.acmecorp.com",
    "start": "2026-06-11T22:00:00Z",
    "end": "2026-06-12T02:00:00Z",
    "risk": "high",
    "status": "approved"
  }
]
```

---

## Stats Response (Strata Hub)
```json
{
  "primary": "3 changes pending approval",
  "secondary": "1 in progress",
  "tertiary": "Next scheduled: Jun 11",
  "health": "warning"
}
```

Health `"critical"` if any `high` emergency change has been in `in_progress` > 4 hours.

---

## Frontend Pages
**Base route:** `/changes`

| Page | Path | Description |
|------|------|-------------|
| Change list | `/changes` | Pipeline view by status |
| Calendar | `/changes/calendar` | Month view of scheduled changes |
| Change detail | `/changes/{id}` | Full detail + approval actions |
| New change | `/changes/new` | Create form |
| Blackouts | `/changes/blackouts` | Manage blackout periods |

### Change list columns
`Title | Risk | Status | Requested By | Scheduled | Approved By | Actions`

### Change form required fields
- Title
- Description (what are you changing and why)
- Risk level
- Rollback plan (required for standard/high — cannot submit empty)
- Affected systems
- Scheduled date/time (optional for draft)

---

## Cross-Module Links
- **TicketPilot:** `linked_ticket_id` — a P1 incident can trigger an emergency change; change detail shows the linked ticket
- **PatchWatch:** Maintenance windows can auto-create a linked change request
- **Strata Hub:** Pending approvals count shown as module stat

---

## Notes
- `rollback_plan` is required for `standard` and `high` changes — cannot submit without it
- The change calendar is the most visible artifact — print it for weekly IT team standups
- Future v2: automated pre/post checks (ping a URL before and after a DNS change)
- Future v2: CAB (Change Advisory Board) meeting mode — bulk approve multiple changes
