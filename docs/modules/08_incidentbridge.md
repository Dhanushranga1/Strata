# IncidentBridge — Incident & Major Incident Management

## Problem It Solves
When something goes down company-wide, chaos erupts in Slack. Five people are investigating the same thing. Nobody knows the current status. Stakeholders are pinging IT every 5 minutes. The timeline of what happened and when gets reconstructed from memory 3 days later.

IncidentBridge provides a structured war room: one place where the incident is declared, a commander is assigned, every update is timestamped, and stakeholders get a clear status feed. When the dust settles, the post-incident review is already half-written.

---

## Feature Gate
`"incidents"` — Business plan and above

---

## Severity Levels
| Level | Definition | Example |
|-------|------------|---------|
| P1 | Company-wide impact, business halted | Email down, payment gateway down |
| P2 | Major feature down, significant user impact | VPN broken for 50% of users |
| P3 | Partial degradation, workaround exists | Slow file server, one printer broken |
| P4 | Minor issue, single user or low impact | Password reset failing for 1 user |

---

## Incident Lifecycle
```
active → investigating → identified → monitoring → resolved
```

| Status | Meaning |
|--------|---------|
| `active` | Just declared, teams mobilizing |
| `investigating` | Root cause being investigated |
| `identified` | Root cause known, fix in progress |
| `monitoring` | Fix deployed, watching for recurrence |
| `resolved` | Incident closed |

---

## Database Schema
**Migration:** `backend/migrations/0037_incidentbridge.sql`

```sql
CREATE TABLE app.incidents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text,
  severity            text NOT NULL CHECK (severity IN ('p1','p2','p3','p4')),
  status              text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','investigating','identified','monitoring','resolved')),
  commander_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  root_cause          text,
  resolution          text,
  timeline            jsonb NOT NULL DEFAULT '[]',
                      -- [{ts: ISO, actor_name: str, action: str, status_change?: str}]
  affected_services   text[] NOT NULL DEFAULT ARRAY[]::text[],
  linked_ticket_ids   uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  linked_change_id    uuid REFERENCES app.changes(id) ON DELETE SET NULL,
  declared_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  postmortem_done     bool NOT NULL DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Post-incident review (written after resolution)
CREATE TABLE app.incident_postmortems (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id         uuid NOT NULL REFERENCES app.incidents(id) ON DELETE CASCADE UNIQUE,
  timeline_summary    text,
  root_cause          text NOT NULL,
  contributing_factors text,
  what_went_well      text,
  what_went_poorly    text,
  action_items        jsonb DEFAULT '[]',
              -- [{item: str, owner_name: str, due_date: date, status: open|done}]
  written_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_incidents_org_status   ON app.incidents(organization_id, status);
CREATE INDEX idx_incidents_org_severity ON app.incidents(organization_id, severity, status);
```

---

## API Endpoints
**Router prefix:** `/api/incidents`
**File:** `backend/app/modules/incidentbridge/router.py`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/incidents` | List incidents (filter: severity, status) |
| POST | `/api/incidents` | Declare new incident |
| GET | `/api/incidents/{id}` | Full incident detail with timeline |
| PATCH | `/api/incidents/{id}` | Update incident fields |
| POST | `/api/incidents/{id}/update` | Add timeline update + optional status change |
| POST | `/api/incidents/{id}/resolve` | Resolve incident |
| POST | `/api/incidents/{id}/postmortem` | Create/update post-incident review |
| GET | `/api/incidents/{id}/postmortem` | Get post-incident review |
| POST | `/api/incidents/{id}/notify` | Send stakeholder update email |
| GET | `/api/incidents/active` | Active P1/P2 incidents (for status banner) |
| GET | `/api/incidents/stats` | Module stats for Strata hub |

---

## Timeline Updates
Each `POST /api/incidents/{id}/update` call appends to the `timeline` jsonb array and optionally changes the incident status:

```python
@router.post("/{incident_id}/update")
async def add_update(incident_id: uuid.UUID, body: IncidentUpdate, ...):
    entry = {
        "ts": datetime.utcnow().isoformat(),
        "actor_name": f"{user['first_name']} {user['last_name']}",
        "action": body.message,
    }
    if body.new_status:
        entry["status_change"] = body.new_status

    await db.execute("""
        UPDATE app.incidents
        SET timeline = timeline || $1::jsonb,
            status = COALESCE($2, status),
            updated_at = now()
        WHERE id = $3 AND organization_id = $4
    """, json.dumps([entry]), body.new_status, incident_id, org_id)
```

---

## P1 Auto-escalation from TicketPilot
When a ticket is marked `priority = 'urgent'` in TicketPilot, prompt the assignee:
```
⚠️  This ticket is marked urgent.
Is this a P1/P2 incident requiring a war room?
[Declare Incident →]  [Keep as Ticket]
```

Clicking "Declare Incident" pre-fills IncidentBridge with the ticket title, creates the incident, and links `linked_ticket_ids`.

---

## Stakeholder Notification Email
`POST /api/incidents/{id}/notify` sends an email to all `org_members` (or a custom recipient list):

```
Subject: [P1 INCIDENT] Email service degradation — Status: Investigating

Incident: Email service degradation
Severity: P1 | Status: Investigating
Declared: 14:32 UTC | Commander: Alex Chen

Latest update (14:47 UTC):
"Root cause identified as DNS misconfiguration. Rollback in progress. ETA 15 mins."

Full incident timeline: https://app.strata.io/incidents/{id}
```

Uses the existing email infrastructure (SMTP from TicketPilot).

---

## StatusCast Integration
Active P1/P2 incidents automatically push updates to the public StatusCast page:
- Incident declared → "Investigating: {title}" on status page
- Status update → status page updated in real-time
- Incident resolved → "Resolved" entry with duration

---

## Stats Response (Strata Hub)
```json
{
  "primary": "0 active incidents",
  "secondary": "2 postmortems pending",
  "tertiary": "Last resolved: 3 days ago",
  "health": "healthy"
}
```

Health `"critical"` if any P1/P2 incident is `active` or `investigating`.

---

## Frontend Pages
**Base route:** `/incidents`

| Page | Path | Description |
|------|------|-------------|
| Active war room | `/incidents/active` | Live view of active P1/P2 incidents |
| Incident list | `/incidents` | All incidents with severity/status filters |
| Incident detail | `/incidents/{id}` | War room: timeline, actions, notify button |
| Post-mortem | `/incidents/{id}/postmortem` | PIR form (write after resolution) |
| Declare incident | `/incidents/new` | Quick declare form |

### Incident detail (war room) layout
```
┌── INCIDENT: Email service degradation ───────────────── P1 | INVESTIGATING ──┐
│  Commander: Alex Chen   Declared: 14:32 UTC   Duration: 23 minutes           │
│  Affected: Email (Google Workspace), Calendar                                 │
├────────────────────────────────────────────────────────────────────────────── │
│  ┌── Update Status ──────────────────────────────────────────────────────┐   │
│  │  [Update text...                                   ] [Post Update]    │   │
│  │  Status: [Investigating ▼]                                            │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  [📧 Notify Stakeholders]  [🔗 Link Ticket]  [✅ Resolve Incident]           │
├────────────────────────────────────────────────────────────────────────────── │
│  Timeline                                                                     │
│  14:55 ▸ Alex Chen — Root cause: DNS TTL. Rollback initiated. (→ Identified)│
│  14:47 ▸ Sam Patel — Confirmed affecting 80% of users. MX records wrong.    │
│  14:32 ▸ Alex Chen — Incident declared. Investigating email bounce errors.   │
└───────────────────────────────────────────────────────────────────────────── ┘
```

---

## Cross-Module Links
- **TicketPilot:** P1 upgrade prompt from urgent tickets; linked tickets shown on incident
- **ChangeBoard:** `linked_change_id` — a failed change that caused the incident
- **StatusCast:** P1/P2 incidents auto-push to public status page
- **Strata Hub:** Active P1 shows as critical health indicator on the IncidentBridge card

---

## Notes
- `commander_id` is the single point of accountability during a P1 — clearly shown in the UI
- The timeline is append-only (jsonb array) — never edit past entries
- Post-incident review is required before marking `postmortem_done = true` — surface this in the UI
- v2: Pager/on-call integration (PagerDuty webhook inbound)
- v2: SLA-based escalation — auto-escalate to P1 if P2 unresolved after 2 hours
