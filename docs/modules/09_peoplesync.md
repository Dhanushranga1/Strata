# PeopleSync — HR IT Automation (Joiner/Mover/Leaver)

## Problem It Solves
IT onboarding and offboarding is a manual, error-prone process at every SME:
- New hires wait 3 days before their laptop arrives and accounts are set up
- Ex-employees' accounts stay active for weeks — a serious security risk
- "Mover" scenarios (department change, promotion) are handled ad-hoc with no audit trail
- Nobody has a checklist — things get forgotten, discovered months later

PeopleSync turns Joiner/Mover/Leaver events into structured, trackable checklists. Every task is assigned, timestamped, and marked done. Nothing falls through the cracks.

---

## Feature Gate
`"people_sync"` — Enterprise plan

---

## Three Event Types
| Type | Trigger | What IT Does |
|------|---------|-------------|
| **Joiner** | New hire starting | Order laptop, create accounts, grant access, set up email, send welcome |
| **Mover** | Role/department change | Update directory, review asset assignment, update access permissions |
| **Leaver** | Employee departing | Revoke all accounts, recover hardware, free license seats, archive email, transfer tickets |

---

## Database Schema
**Migration:** `backend/migrations/0038_peoplesync.sql`

```sql
CREATE TABLE app.hr_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  event_type       text NOT NULL CHECK (event_type IN ('joiner','mover','leaver')),
  employee_name    text NOT NULL,
  employee_email   text,
  department       text,
  start_date       date,                               -- start date for joiners, effective date for movers/leavers
  manager_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  triggered_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  checklist        jsonb NOT NULL DEFAULT '[]',
  -- [{id, task, status: open|done|skipped, assigned_to_name, completed_at, notes}]
  status           text NOT NULL DEFAULT 'in_progress'
                   CHECK (status IN ('in_progress','completed','cancelled')),
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Index
CREATE INDEX idx_hr_events_org_status ON app.hr_events(organization_id, status, event_type);
CREATE INDEX idx_hr_events_start_date ON app.hr_events(organization_id, start_date)
  WHERE start_date IS NOT NULL;
```

### Checklist item structure (jsonb)
```json
[
  {
    "id": "task_1",
    "task": "Order laptop",
    "status": "done",
    "assigned_to_name": "Alex Chen",
    "completed_at": "2026-05-20T10:30:00Z",
    "notes": "MacBook Pro 14 M3 ordered, delivery Jun 2"
  },
  {
    "id": "task_2",
    "task": "Create Google Workspace account",
    "status": "open",
    "assigned_to_name": null,
    "completed_at": null,
    "notes": null
  }
]
```

---

## API Endpoints
**Router prefix:** `/api/hr`
**File:** `backend/app/modules/peoplesync/router.py`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/hr` | List HR events (filter: type, status, date range) |
| POST | `/api/hr` | Create HR event (auto-generates checklist) |
| GET | `/api/hr/{id}` | Event detail with full checklist |
| PATCH | `/api/hr/{id}` | Update event fields |
| POST | `/api/hr/{id}/tasks/{task_id}/complete` | Mark checklist task done |
| POST | `/api/hr/{id}/tasks/{task_id}/skip` | Skip task with reason |
| POST | `/api/hr/{id}/complete` | Mark event fully completed |
| POST | `/api/hr/webhook` | External HR system webhook (BambooHR, Workday, etc.) |
| GET | `/api/hr/stats` | Module stats for Strata hub |

---

## Auto-Generated Checklists

### Joiner Checklist
```python
JOINER_CHECKLIST = [
    "Submit laptop purchase request (ProcureFlow)",
    "Create user account in identity provider (Google/Azure AD)",
    "Set up email account",
    "Grant role-based system access (list systems for department)",
    "Add to relevant Slack channels / Teams",
    "Add to mailing lists",
    "Register asset in AssetLog",
    "Schedule IT orientation session",
    "Send welcome email with account details",
    "Confirm hardware delivery",
]
```

### Mover Checklist
```python
MOVER_CHECKLIST = [
    "Update department in identity provider",
    "Review and update system access permissions",
    "Transfer asset assignment if department change",
    "Update mailing list memberships",
    "Notify relevant team leads",
    "Update org chart / directory",
]
```

### Leaver Checklist
```python
LEAVER_CHECKLIST = [
    "Disable all accounts (Google, Azure AD, Slack, etc.)",
    "Revoke VPN access",
    "Recover laptop / hardware (update AssetLog)",
    "Free software license seats (update AssetLog)",
    "Archive and forward email",
    "Transfer open tickets to another rep (TicketPilot)",
    "Remove from mailing lists and Slack",
    "Disable MFA devices",
    "Final access audit",
    "Close any active ProcureFlow requests for this user",
]
```

These are customizable per org in settings (v2).

---

## ProcureFlow Integration
When a Joiner event is created:
- Automatically create a ProcureFlow purchase request: "Laptop for {employee_name}"
- Priority: urgent (if start_date within 5 days)
- Linked to the HR event

```python
async def create_joiner_laptop_request(event, db, org_id, triggered_by):
    await db.execute("""
        INSERT INTO app.purchase_requests
          (organization_id, requested_by, title, description, category, urgency, status)
        VALUES ($1, $2, $3, $4, 'hardware', $5, 'pending')
    """, org_id, triggered_by,
        f"Laptop for {event.employee_name}",
        f"New hire {event.employee_name} starting {event.start_date}. Department: {event.department}",
        'urgent' if days_until(event.start_date) <= 5 else 'high'
    )
```

---

## AssetLog Integration
When a Leaver event's "Recover hardware" task is completed:
- Prompt: "Update asset assignment for {employee_name}?"
- If yes: set `assigned_to = null` on their assets in AssetLog

When a Leaver event's "Free license seats" task is completed:
- Find all `software_licenses` where this user occupies a seat (by name/email match — v1 is manual, v2 is automated)

---

## Webhook (External HR Systems)
`POST /api/hr/webhook` accepts events from BambooHR, Workday, or any HR system:

```json
{
  "event_type": "joiner",
  "employee_name": "Jane Smith",
  "employee_email": "jane.smith@acmecorp.com",
  "department": "Engineering",
  "start_date": "2026-06-01",
  "manager_email": "alex.chen@acmecorp.com"
}
```

The webhook creates the HR event and sends a notification to all admins.
Webhook URL format: `https://app.strata.io/api/hr/webhook?org={slug}&key={api_key}`

---

## Stats Response (Strata Hub)
```json
{
  "primary": "2 active events",
  "secondary": "1 joiner: Jane (Jun 1)",
  "tertiary": "3 tasks overdue",
  "health": "warning"
}
```

Health `"warning"` if any checklist task is overdue (start_date passed and task still open).
Health `"critical"` if a Leaver event has accounts not yet disabled 24h after `start_date`.

---

## Frontend Pages
**Base route:** `/peoplesync`

| Page | Path | Description |
|------|------|-------------|
| Event list | `/peoplesync` | All events grouped by type (Joiners / Movers / Leavers) |
| Event detail | `/peoplesync/{id}` | Checklist view with task completion |
| New event | `/peoplesync/new` | Create form (choose type, fill employee details) |

### Event detail layout (checklist view)
```
┌── JOINER: Jane Smith — Engineering ────────────── Start: Jun 1, 2026 ─────┐
│  Triggered by: Alex Chen | Status: In Progress (4/10 tasks done)          │
├──────────────────────────────────────────────────────────────────────────── │
│  ✅ Submit laptop purchase request           Alex Chen    May 25           │
│  ✅ Create Google Workspace account          Alex Chen    May 26           │
│  ✅ Set up email account                     Alex Chen    May 26           │
│  ✅ Grant system access                      Sam Patel    May 27           │
│  ○  Add to Slack channels                   Unassigned   —                │
│  ○  Register asset in AssetLog              Unassigned   —                │
│  ○  Schedule IT orientation                 Unassigned   —                │
│  ○  Send welcome email                      Unassigned   —                │
│  ○  Confirm hardware delivery               Unassigned   —                │
│                                                                            │
│  [Mark Complete]  [Add Note]                                               │
└────────────────────────────────────────────────────────────────────────── ┘
```

---

## Cross-Module Links
- **ProcureFlow:** Joiner auto-creates purchase request for laptop
- **AssetLog:** Leaver flow recovers and reassigns assets; Joiner auto-creates asset on delivery
- **TicketPilot:** Leaver transfers open tickets to another assignee
- **ServiceHub:** "New Employee Setup" portal item triggers a PeopleSync Joiner event

---

## Notes
- `start_date` on a Leaver event = the last working day (not the termination date)
- Security: Leaver events should always be treated with urgency — account revocation cannot wait
- The checklist is the core deliverable — it's the audit trail that proves offboarding was done
- Org admins can customize the default checklists per event type in settings (v2)
- `employee_email` is not a foreign key — this person may not have a Strata account
