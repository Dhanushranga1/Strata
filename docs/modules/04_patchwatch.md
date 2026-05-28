# PatchWatch — Patch Management

> **Implementation Status: ✅ Built & Deployed**  
> Backend: `backend/app/patchwatch.py` · Migration: `0038_patchwatch.sql` (live)  
> Frontend: `frontend/src/app/(protected)/patches/page.tsx`  
> See [STRATA_MODULES_SPRINT.md](../sprint/STRATA_MODULES_SPRINT.md) for full build notes.

## Problem It Solves
SMEs are prime ransomware targets. Most breaches exploit unpatched systems. The problem: SME IT teams have no systematic way to track what needs patching across their device fleet. They rely on Windows Update notifications being clicked, which is not a security strategy.

PatchWatch gives IT a dashboard of patch status across all AssetLog devices, severity prioritization, and maintenance window scheduling — without requiring an endpoint agent. Data is manually entered or imported; automated agent-based collection is a v2 feature.

---

## Feature Gate
`"patches"` — Business plan and above

---

## Database Schema
**Migration:** `backend/migrations/0034_patchwatch.sql`

```sql
CREATE TABLE app.patch_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  asset_id         uuid REFERENCES app.assets(id) ON DELETE SET NULL,
  patch_name       text NOT NULL,                      -- "KB5034441", "CVE-2024-1234", "macOS 14.3.1"
  patch_severity   text NOT NULL
                   CHECK (patch_severity IN ('critical','high','medium','low','informational')),
  status           text NOT NULL DEFAULT 'needed'
                   CHECK (status IN ('needed','scheduled','applied','deferred','not_applicable')),
  cve_id           text,                               -- optional CVE reference
  affected_systems text,                               -- "Windows 10/11" — description field
  scheduled_at     timestamptz,
  applied_at       timestamptz,
  applied_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  maintenance_window_id uuid REFERENCES app.maintenance_windows(id) ON DELETE SET NULL,
  notes            text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Maintenance windows — planned downtime slots for patching
CREATE TABLE app.maintenance_windows (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,                      -- "Monthly Patch Tuesday"
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  recurrence       text CHECK (recurrence IN ('once','weekly','monthly','quarterly')),
  notes            text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_patches_org_status    ON app.patch_records(organization_id, status);
CREATE INDEX idx_patches_org_severity  ON app.patch_records(organization_id, patch_severity, status);
CREATE INDEX idx_patches_asset         ON app.patch_records(asset_id);
```

---

## API Endpoints
**Router prefix:** `/api/patches`
**File:** `backend/app/modules/patchwatch/router.py`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/patches` | List patches (filter: severity, status, asset_id) |
| POST | `/api/patches` | Add patch record |
| GET | `/api/patches/{id}` | Patch detail |
| PATCH | `/api/patches/{id}` | Update status (e.g., mark applied) |
| POST | `/api/patches/{id}/apply` | Mark as applied (sets applied_at, applied_by) |
| POST | `/api/patches/{id}/defer` | Defer with reason |
| DELETE | `/api/patches/{id}` | Remove (admin only) |
| GET | `/api/patches/stats` | Module stats for Strata hub |
| GET | `/api/patches/summary` | Severity breakdown counts |
| GET | `/api/patches/windows` | List maintenance windows |
| POST | `/api/patches/windows` | Create maintenance window |
| PATCH | `/api/patches/windows/{id}` | Update window |

### Stats response
```json
{
  "primary": "23 patches pending",
  "secondary": "4 critical overdue",
  "tertiary": "Next window: Jun 11",
  "health": "critical"
}
```

Health `"critical"` if any `critical` patches are `needed` (not scheduled). `"warning"` if `high` patches unscheduled.

---

## Summary Endpoint
`GET /api/patches/summary` — used by the dashboard severity donut chart:

```sql
SELECT
  patch_severity,
  status,
  COUNT(*) as count
FROM app.patch_records
WHERE organization_id = $1
GROUP BY patch_severity, status
ORDER BY
  CASE patch_severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
    ELSE 5
  END;
```

---

## Critical Patch Alerts
Daily check: if `critical` or `high` patches remain `needed` for > 7 days without being scheduled:
```python
overdue_critical = await db.fetch("""
    SELECT * FROM app.patch_records
    WHERE organization_id = $1
      AND patch_severity IN ('critical','high')
      AND status = 'needed'
      AND created_at < NOW() - INTERVAL '7 days'
""", org_id)
```
Creates a notification for all org admins: "4 critical patches have been pending for over 7 days."

---

## Maintenance Window → Auto-create Ticket
When a maintenance window is created or upcoming:
- Auto-create a TicketPilot ticket: "Maintenance Window: {name} on {date}"
- Priority: `high`, assigned to the creating rep
- This ensures the window appears in the ticket queue and SLA tracking

---

## Frontend Pages
**Base route:** `/patches`

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/patches` | Severity donut + status bar + overdue list |
| Patch list | `/patches/list` | Full filterable table |
| Patch detail | `/patches/{id}` | Detail + linked asset + history |
| Maintenance windows | `/patches/windows` | Calendar view of planned windows |
| Add patch | `/patches/new` | Manual entry form |

### Dashboard layout
```
┌── Severity Summary ──┐  ┌── Status Summary ──────┐  ┌── Overdue Critical ──┐
│  ● Critical:  4      │  │  Needed:     12        │  │  KB5034441  7d ago   │
│  ● High:      8      │  │  Scheduled:   5        │  │  CVE-2024-1234 12d  │
│  ● Medium:   11      │  │  Applied:    45        │  │  macOS 14.2  15d    │
│  ● Low:       6      │  │  Deferred:    3        │  └──────────────────────┘
└──────────────────────┘  └────────────────────────┘
```

### Patch list columns
`Patch Name | CVE | Severity | Asset | Status | Scheduled | Applied By | Actions`

---

## Cross-Module Links
- **AssetLog:** `asset_id` — every patch is associated with a specific device
- **TicketPilot:** Maintenance windows auto-create linked tickets
- **Strata Hub:** "N critical patches pending" warning on the PatchWatch card

---

## Notes
- v1 is manual entry — IT admin logs patches they've identified
- v2: CSV import from Windows Update, Intune export, or WSUS
- v3: endpoint agent that reports installed patches automatically
- `cve_id` is optional but important for compliance reporting
- `not_applicable` status is for patches that don't apply to the org's environment
