# StatusCast — Public Status Page

## Problem It Solves
When IT systems go down, users flood the helpdesk with "Is X down?" tickets. IT spends 40% of incident time answering the same question instead of fixing the problem. There's no authoritative source of truth for system status that users can check themselves.

StatusCast is a public-facing status page (like status.github.com or status.atlassian.com) that IT maintains. When updated, it automatically reduces support ticket volume during incidents.

---

## Feature Gate
`"status_cast"` — Business plan and above

---

## Database Schema
**Migration:** `backend/migrations/0041_statuscast.sql`

```sql
-- Services to track on the status page
CREATE TABLE app.status_services (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,                      -- "Email", "VPN", "File Server"
  description      text,
  sort_order       int NOT NULL DEFAULT 0,
  is_active        bool NOT NULL DEFAULT true,
  current_status   text NOT NULL DEFAULT 'operational'
                   CHECK (current_status IN (
                     'operational','degraded','partial_outage','major_outage','maintenance'
                   )),
  created_at       timestamptz DEFAULT now()
);

-- Status history (timeline of status changes)
CREATE TABLE app.status_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  service_id       uuid REFERENCES app.status_services(id) ON DELETE SET NULL,
  title            text NOT NULL,
  body             text,
  status_impact    text NOT NULL DEFAULT 'none'
                   CHECK (status_impact IN (
                     'none','degraded','partial_outage','major_outage','resolved','maintenance'
                   )),
  incident_id      uuid REFERENCES app.incidents(id) ON DELETE SET NULL,
  posted_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_status_services_org   ON app.status_services(organization_id, is_active, sort_order);
CREATE INDEX idx_status_history_org    ON app.status_history(organization_id, created_at DESC);
CREATE INDEX idx_status_history_svc    ON app.status_history(service_id, created_at DESC);
```

### Service status values
| Status | Display | Color |
|--------|---------|-------|
| `operational` | Operational | Green |
| `degraded` | Degraded Performance | Yellow |
| `partial_outage` | Partial Outage | Orange |
| `major_outage` | Major Outage | Red |
| `maintenance` | Under Maintenance | Blue |

---

## API Endpoints
**Router prefix:** `/api/statuscast`
**File:** `backend/app/modules/statuscast/router.py`

### Public endpoints (no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/statuscast/public/{org_slug}` | Full public status page data |
| GET | `/api/statuscast/public/{org_slug}/history` | Last 90 days of incidents |

### Admin endpoints (authenticated)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/statuscast/services` | List services |
| POST | `/api/statuscast/services` | Add service |
| PATCH | `/api/statuscast/services/{id}` | Update service |
| DELETE | `/api/statuscast/services/{id}` | Remove service |
| POST | `/api/statuscast/post` | Post status update |
| GET | `/api/statuscast/stats` | Module stats for Strata hub |

---

## Public Endpoint Response
`GET /api/statuscast/public/{org_slug}` — no auth required:

```json
{
  "org_name": "Acme Corp IT",
  "overall_status": "partial_outage",
  "last_updated": "2026-05-24T14:47:00Z",
  "services": [
    { "name": "Email", "status": "major_outage" },
    { "name": "VPN", "status": "operational" },
    { "name": "File Server", "status": "operational" },
    { "name": "Internal Wiki", "status": "degraded" }
  ],
  "recent_incidents": [
    {
      "title": "Email service degradation",
      "status_impact": "major_outage",
      "created_at": "2026-05-24T14:32:00Z",
      "updates": [
        { "body": "Root cause identified: DNS misconfiguration. Rollback in progress.", "at": "2026-05-24T14:47:00Z" },
        { "body": "Investigating reports of email delivery failures.", "at": "2026-05-24T14:35:00Z" }
      ]
    }
  ]
}
```

`overall_status` = worst status across all active services.

---

## IncidentBridge Integration
When a P1/P2 incident is declared in IncidentBridge and linked to services:
1. Auto-set linked service statuses to `major_outage` or `partial_outage`
2. Auto-post a status update: "Investigating {incident.title}"

When incident status changes (via `POST /api/incidents/{id}/update`):
1. Auto-post status history entry with the update text

When incident is resolved:
1. Reset linked service statuses to `operational`
2. Post "Resolved: {incident.title}"

---

## Post Status Update
`POST /api/statuscast/post` — admin manually posts an update:

```python
@router.post("/post")
async def post_status_update(body: StatusUpdate, ...):
    # Update service statuses
    for service_id, new_status in body.service_statuses.items():
        await db.execute("""
            UPDATE app.status_services
            SET current_status = $1
            WHERE id = $2 AND organization_id = $3
        """, new_status, service_id, org_id)

    # Log to history
    await db.execute("""
        INSERT INTO app.status_history
          (organization_id, service_id, title, body, status_impact, incident_id, posted_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    """, org_id, body.service_id, body.title, body.body,
        body.status_impact, body.incident_id, user["id"])
```

---

## Stats Response (Strata Hub)
```json
{
  "primary": "All systems operational",
  "secondary": "Last incident: 3 days ago",
  "health": "healthy"
}
```

Health `"critical"` if any service is `major_outage`.
Health `"warning"` if any service is `degraded` or `partial_outage`.

---

## Public Status Page (Frontend)
**Route:** `/status` — public, no login required

```
┌─────────────────── Acme Corp IT Status ─────────────────────────────────────┐
│                          ● All Systems Operational                           │
│                     Last updated: 3 minutes ago                              │
├──────────────────────────────────────────────────────────────────────────────│
│  Email          ● Operational                                                │
│  VPN            ● Operational                                                │
│  File Server    ● Operational                                                │
│  Internal Wiki  ● Operational                                                │
├──────────────────────────────────────────────────────────────────────────────│
│  Incident History — Last 90 days                                             │
│                                                                              │
│  May 24 — Email service degradation [Resolved]                              │
│    14:47  Root cause: DNS TTL. Fix deployed. Monitoring.                    │
│    14:32  Investigating email delivery failures.                             │
│           Duration: 43 minutes                                               │
│                                                                              │
│  May 15 — Scheduled maintenance: File Server [Resolved]                     │
│    02:00  Maintenance complete. All systems normal.                         │
│    00:00  Scheduled maintenance begins.                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Admin page (`/statuscast` — authenticated)
Manage services + post updates. Shows current status of all services with dropdowns to change them.

---

## Custom Domain (v2)
`status.acmecorp.com` → CNAME to the `/status` page with org context from subdomain.
v1: just use the org slug URL: `app.strata.io/status?org=acmecorp`

---

## 90-Day Uptime Calculation (v2)
Track daily uptime percentage per service. Display calendar heatmap (green/yellow/red squares per day, last 90 days).

```sql
-- v2 table
CREATE TABLE app.status_daily_uptime (
  service_id   uuid NOT NULL REFERENCES app.status_services(id) ON DELETE CASCADE,
  date         date NOT NULL,
  uptime_pct   numeric(5,2) NOT NULL DEFAULT 100.00,  -- 0-100
  PRIMARY KEY (service_id, date)
);
```

---

## Cross-Module Links
- **IncidentBridge:** P1/P2 incidents auto-push to StatusCast. Incident updates sync to status history.
- **Strata Hub:** "All systems operational" or active outage shown as StatusCast card stat

---

## Notes
- The public page has no login requirement — this is intentional (users need to check status without logging into anything)
- The page should be fast and cacheable — static-friendly, no per-user data
- Status history is append-only — never edit or delete historical entries
- For org with no incidents: StatusCast shows a clean green "All systems operational" page from day one
