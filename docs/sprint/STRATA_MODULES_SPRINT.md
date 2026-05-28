# Strata Module Sprint — CostLens · ProcureFlow · PatchWatch · ChangeBoard

**Status:** ✅ All four modules built, migrated, and deployed  
**Sprint:** Month 3 — SME Module Suite (Priority Batch 1)  
**Migrations run:** 0035 · 0036 · 0037 · 0038 · 0039

---

## Why These Four First

The SME IT operations market has a clear pain hierarchy. These four modules together tell a complete story a buyer can instantly understand:

| Module | Core Pain It Solves | Why It's Urgent |
|--------|--------------------|--------------------|
| **ProcureFlow** | Purchase approvals live in email — no audit trail | Every org with >10 employees has this problem today |
| **PatchWatch** | Unpatched devices = ransomware target | SMEs are #1 ransomware target; most breaches exploit known unpatched CVEs |
| **CostLens** | License waste is invisible until renewal | Average SME wastes 30–40% of SaaS spend on unused seats |
| **ChangeBoard** | "I pushed a config change on Friday and broke email" | One bad change can take down an entire SME for hours |

---

## What Was Built

### Module 1 — CostLens (Cost Intelligence)

**Feature gate:** `cost_lens` — Business plan  
**No new schema** — all computed from existing `app.assets`, `app.software_licenses`, `app.contracts`, `app.purchase_requests`

**Backend:** `backend/app/costlens.py`

| Endpoint | What it returns |
|----------|----------------|
| `GET /api/costlens/platform-stats` | Annual SW spend, unused license count, expiring contracts count |
| `GET /api/costlens/summary` | Full dashboard: 5 insight categories (see below) |

**Five insight categories in `/summary`:**

1. **Unused licenses** — `seats_used / seat_count < 0.6` for ≥30 days, sorted by annual cost DESC. Shows potential saving per product.
2. **Idle assets** — Assets with no linked tickets in 90+ days, still assigned to active users. Flags potential surplus hardware.
3. **Upcoming renewals** — Contracts and licenses expiring in next 90 days, grouped with total renewal cost.
4. **Department spend** — Total asset purchase price grouped by `department`.
5. **Vendor spend** — Annual software license cost grouped by vendor.

**Frontend:** `frontend/src/app/(protected)/costlens/page.tsx`

- 4 stat cards at top (annual spend, unused licenses, idle assets, expiring soon)
- Each insight category is a collapsible section with a table
- Empty state when no data in a category (not an error — normal for new orgs)
- Redirects to `/platform` if not entitled

---

### Module 2 — ProcureFlow (Procurement & Approvals)

**Feature gate:** `procurement` — Starter plan  
**Migration:** `backend/migrations/0037_procureflow.sql` → `app.purchase_requests`

**Key schema decisions:**
- `total_price` is a GENERATED ALWAYS AS (`quantity * unit_price`) STORED column — never out of sync
- `vendor_id` links to ContractVault's `app.vendors` — auto-fill from existing vendor directory
- `linked_asset_id` — set automatically when a request is delivered and `create_asset=true`

**Backend:** `backend/app/procureflow.py`

| Endpoint | Auth | Action |
|----------|------|--------|
| `GET /api/procurement` | All | List (non-reps see only their own requests) |
| `POST /api/procurement` | Any | Submit new request |
| `POST /api/procurement/{id}/approve` | Admin/Owner | `pending → approved` |
| `POST /api/procurement/{id}/reject` | Admin/Owner | `pending → rejected` |
| `POST /api/procurement/{id}/order` | Rep+ | `approved → ordered`, sets `ordered_at` |
| `POST /api/procurement/{id}/deliver` | Rep+ | `ordered → delivered`, optionally auto-creates AssetLog entry |
| `POST /api/procurement/{id}/cancel` | Requester or Admin | `pending/approved → cancelled` |
| `GET /api/procurement/platform-stats` | Any | Stat chip data for /platform hub |

**Auto-asset creation on delivery:** When `POST /deliver` is called with `create_asset=true`, the backend automatically:
1. Reads the asset_tag_sequences table to generate the next available tag
2. Creates a new `app.assets` record with category inferred from the PR title
3. Sets `linked_asset_id` on the purchase request
4. Calls `embed_entity("asset", ...)` so CASPER can find it

**Frontend:** `frontend/src/app/(protected)/procurement/page.tsx`

- Filter tabs: All / Pending / Approved / Ordered / Delivered
- `RequestRow` shows contextual action buttons — only the valid actions for the current status are shown (approve+reject when pending, order when approved, deliver when ordered, cancel when pending/approved)
- Vendor dropdown fetched from ContractVault vendors
- `NewRequestModal` with title, quantity, unit price, vendor, department, justification

---

### Module 3 — PatchWatch (Patch Management)

**Feature gate:** `patches` — Business plan  
**Migration:** `backend/migrations/0038_patchwatch.sql` → `app.patch_records`

**Key schema decisions:**
- `cve_id` stored as free text (e.g. `CVE-2024-1234`) — no validation against NVD; SMEs just need to log it
- `applied_at` and `applied_by` set automatically by the backend when `status → applied`
- `asset_id` is nullable — some patches apply org-wide, not to a specific device

**Backend:** `backend/app/patchwatch.py`

| Endpoint | What it does |
|----------|-------------|
| `GET /api/patches/dashboard` | Severity × status matrix + overdue_critical count + scheduled_week count |
| `GET /api/patches` | List with severity/status/asset_id filters, ordered by severity priority |
| `POST /api/patches` | Log a new patch record |
| `PUT /api/patches/{id}/status` | Update status; auto-sets `applied_at = NOW()` and `applied_by` when `status = applied` |
| `DELETE /api/patches/{id}` | Remove a record |
| `GET /api/patches/platform-stats` | Stat chip for /platform hub |

**Dashboard logic:**
```python
# severity_summary: one row per severity level
needed = counts.get("needed", 0) + counts.get("scheduled", 0)   # both need action
applied = counts.get("applied", 0)
pct_patched = round(applied / total * 100) if total else 0

# overdue_critical: needed/scheduled critical patches with no schedule or schedule in past
SELECT COUNT(*) WHERE patch_severity = 'critical'
AND status IN ('needed', 'scheduled')
AND (scheduled_at IS NULL OR scheduled_at < NOW())
```

**Frontend:** `frontend/src/app/(protected)/patches/page.tsx`

- Severity summary cards (clickable to filter by severity) — progress bar shows % patched, color-coded red/amber/green
- Red alert banner when `overdue_critical > 0`
- Status filter row: needed / scheduled / applied / deferred / All
- `PatchRow` with inline "mark applied" button (only shown when `status = needed`)
- `NewPatchModal` — patch name, CVE ID, severity, asset ID (optional)

---

### Module 4 — ChangeBoard (Change Management)

**Feature gate:** `change_board` — Business plan  
**Migration:** `backend/migrations/0039_changeboard.sql` → `app.changes` + `app.change_blackouts`

**Key design decisions:**
- **Not ITIL** — no CAB, no change windows, no complex approval chains. It's: write it down, get one approval, have a rollback plan.
- **Blackout windows** — org admins define periods (e.g. "Month-end close", "Product launch") during which high/emergency changes cannot be approved. This is the single most impactful safety feature.
- `blackout_check` column — set to `true` when a change is created during an active blackout window. Persists as an audit trail even after the window closes.

**Backend:** `backend/app/changeboard.py`

| Endpoint | Auth | Transition |
|----------|------|-----------|
| `POST /api/changes` | Rep+ | Creates in `draft` |
| `POST /api/changes/{id}/submit` | Rep+ | `draft → pending_approval` |
| `POST /api/changes/{id}/approve` | Admin | `pending_approval → approved` (blocked if blackout active and risk = high/emergency) |
| `POST /api/changes/{id}/reject` | Admin | `pending_approval → cancelled` |
| `POST /api/changes/{id}/schedule` | Rep+ | `approved → scheduled` (sets `scheduled_at`) |
| `POST /api/changes/{id}/start` | Rep+ | `approved/scheduled → in_progress` |
| `POST /api/changes/{id}/complete` | Rep+ | `in_progress → completed` or `failed` |
| `GET /api/changes/blackouts` | Any | List blackout windows |
| `POST /api/changes/blackouts` | Admin | Create blackout window |
| `DELETE /api/changes/blackouts/{id}` | Admin | Delete blackout window |
| `GET /api/changes/platform-stats` | Any | Stat chip data |

**Blackout enforcement:**
```python
# In approve_change():
if body.risk_level in ("high", "emergency"):
    active_blackouts = SELECT COUNT(*) FROM app.change_blackouts
        WHERE organization_id = %s AND NOW() BETWEEN start_at AND end_at
    if active_blackouts > 0:
        raise HTTPException(409, "Cannot approve high/emergency change during an active blackout window")
```

**Frontend:** `frontend/src/app/(protected)/changes/page.tsx`

- Risk level legend (Low/Standard/High/Emergency with color chips)
- Blackout banner — shows when any blackout window is currently active
- Filter tabs: All / Draft / Pending / Approved / In Progress / Completed
- `ChangeRow` — contextual action buttons per status:
  - Draft: submit (flag icon)
  - Pending: approve (✓) + reject (✗) — admin only
  - Approved: start (play icon)
  - In Progress: complete (✓) or fail (✗)
- Orange "Blackout" badge on any change that was created during a blackout window

---

## Database — What Was Migrated

| Migration | Tables Created | Run |
|-----------|---------------|-----|
| 0035_casper_insights.sql | `app.casper_insights`, `app.casper_agent_runs` | ✅ |
| 0036_contractvault.sql | `app.vendors`, `app.contracts`, `app.contract_assets`, `app.contract_history` | ✅ |
| 0037_procureflow.sql | `app.purchase_requests` | ✅ |
| 0038_patchwatch.sql | `app.patch_records` | ✅ |
| 0039_changeboard.sql | `app.changes`, `app.change_blackouts` | ✅ |

All verified live against Supabase (`nvgmgvplfpukckfkjuso`).

---

## Platform Hub Integration

All four modules are now live cards on `/platform`. `comingSoon` removed, `statsEndpoint` wired:

| Module | Endpoint | Stat Chips |
|--------|----------|-----------|
| ProcureFlow | `/api/procurement/platform-stats` | "N pending approvals", "N total" |
| PatchWatch | `/api/patches/platform-stats` | "N patches needed", "N critical" |
| CostLens | `/api/costlens/platform-stats` | "$X annual SW spend", "N unused licenses" |
| ChangeBoard | `/api/changes/platform-stats` | "N awaiting approval", "blackout active" |

---

## Sidebar Navigation

All four modules added to the Modules group in `frontend/src/components/Sidebar.tsx`:
- ProcureFlow → `/procurement` (ShoppingCart icon)
- PatchWatch → `/patches` (ShieldCheck icon)
- CostLens → `/costlens` (BarChart3 icon)
- ChangeBoard → `/changes` (GitPullRequest icon)

All `repOnly: true` — not shown to customers.

---

## What's Not Built Yet (Planned v2)

| Feature | Module | Why Deferred |
|---------|--------|-------------|
| Budget limits per department | ProcureFlow | Requires org settings schema — v2 |
| Maintenance window scheduler | PatchWatch | Nice-to-have; the dashboard + mark-applied is the core loop |
| `auto_approve_under = $500` | ProcureFlow | Org-level setting needed — v2 |
| ChangeBoard calendar view | ChangeBoard | Need a date picker component; list view covers the core case |
| ChangeBoard → StatusCast | ChangeBoard | StatusCast not yet built |
| CostLens trend charts | CostLens | Needs time-series data; current schema supports it, UI deferred |
