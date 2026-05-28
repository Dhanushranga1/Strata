# CostLens — Cost Intelligence & Optimization

> **Implementation Status: ✅ Built & Deployed**  
> Backend: `backend/app/costlens.py` · No new migration (computed from existing tables)  
> Frontend: `frontend/src/app/(protected)/costlens/page.tsx`  
> See [STRATA_MODULES_SPRINT.md](../sprint/STRATA_MODULES_SPRINT.md) for full build notes.

## Problem It Solves
SME IT spend is notoriously wasteful. Licenses nobody uses stay on autopay. SaaS subscriptions accumulate because nobody owns the renewal decision. Assets gather dust but stay on the books as active. IT doesn't have a single view of what they're spending — so they can't cut anything.

CostLens surfaces this automatically from data already in AssetLog, ContractVault, and ProcureFlow. No new data entry required. It answers: "Where is our IT budget going, and where is it being wasted?"

---

## Feature Gate
`"cost_lens"` — Business plan and above

---

## No New Database Tables
CostLens is entirely computed from existing module data:
- `app.assets` (purchase price, depreciation)
- `app.software_licenses` (cost_per_year, seat_count, seats_used)
- `app.contracts` (value, end_date)
- `app.purchase_requests` (total_price, status, department)

This is intentional — no maintenance burden, always up-to-date, zero migration risk.

---

## API Endpoints
**Router prefix:** `/api/costlens`
**File:** `backend/app/modules/costlens/router.py`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/costlens/summary` | Full cost intelligence summary |
| GET | `/api/costlens/unused-licenses` | Licenses with low utilization |
| GET | `/api/costlens/idle-assets` | Assets inactive for 90+ days |
| GET | `/api/costlens/upcoming-renewals` | Contracts + licenses expiring in 90 days |
| GET | `/api/costlens/spend-by-department` | Total spend grouped by department |
| GET | `/api/costlens/spend-by-vendor` | Total spend grouped by vendor |
| GET | `/api/costlens/trend` | Month-by-month spend trend (YTD) |
| GET | `/api/costlens/stats` | Module stats for Strata hub |

---

## Insights Engine

### 1. Unused Licenses
Licenses where `seats_used / seat_count < 0.6` for more than 30 days:

```sql
SELECT
  sl.id,
  sl.product_name,
  sl.vendor,
  sl.seat_count,
  sl.seats_used,
  sl.cost_per_year,
  ROUND((sl.seat_count - sl.seats_used) * (sl.cost_per_year / NULLIF(sl.seat_count, 0)), 2)
    AS wasted_cost_per_year
FROM app.software_licenses sl
WHERE sl.organization_id = $1
  AND sl.seat_count > 0
  AND sl.seats_used::float / sl.seat_count < 0.6
ORDER BY wasted_cost_per_year DESC NULLS LAST;
```

Output message template:
`"You're paying for {seat_count} {product_name} seats but only using {seats_used}. Potential saving: ${wasted}/yr"`

### 2. Idle Assets
Assets with status `active`, assigned to an active user, but with no linked tickets in 90+ days:

```sql
SELECT
  a.id,
  a.asset_tag,
  a.name,
  a.category,
  a.purchase_price,
  a.assigned_to,
  MAX(at2.linked_at) AS last_ticket_date
FROM app.assets a
LEFT JOIN app.asset_tickets at2 ON a.id = at2.asset_id
WHERE a.organization_id = $1
  AND a.status = 'active'
  AND a.assigned_to IS NOT NULL
GROUP BY a.id
HAVING MAX(at2.linked_at) < NOW() - INTERVAL '90 days'
   OR MAX(at2.linked_at) IS NULL
ORDER BY last_ticket_date NULLS FIRST;
```

### 3. Upcoming Renewals (90-day window)
Combines contracts and licenses expiring in the next 90 days with their costs:

```sql
SELECT 'contract' AS type, c.title AS name, c.end_date, c.value AS annual_cost, v.name AS vendor
FROM app.contracts c
LEFT JOIN app.vendors v ON c.vendor_id = v.id
WHERE c.organization_id = $1
  AND c.status = 'active'
  AND c.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'

UNION ALL

SELECT 'license' AS type, sl.product_name AS name, sl.expiry_date AS end_date,
  sl.cost_per_year AS annual_cost, sl.vendor
FROM app.software_licenses sl
WHERE sl.organization_id = $1
  AND sl.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'

ORDER BY end_date;
```

### 4. Spend by Department
From purchase requests (delivered/ordered status):

```sql
SELECT
  COALESCE(department, 'Unassigned') AS department,
  SUM(total_price) AS total_spend,
  COUNT(*) AS purchase_count,
  date_trunc('month', created_at) AS month
FROM app.purchase_requests
WHERE organization_id = $1
  AND status IN ('ordered','delivered')
  AND created_at >= date_trunc('year', CURRENT_DATE)
GROUP BY department, date_trunc('month', created_at)
ORDER BY total_spend DESC;
```

### 5. Spend by Vendor
Combines contracts + licenses + purchases:

```sql
WITH vendor_spend AS (
  SELECT v.name AS vendor, SUM(c.value) AS contract_spend
  FROM app.contracts c JOIN app.vendors v ON c.vendor_id = v.id
  WHERE c.organization_id = $1 AND c.status = 'active'
  GROUP BY v.name

  UNION ALL

  SELECT sl.vendor, SUM(sl.cost_per_year) AS license_spend
  FROM app.software_licenses sl
  WHERE sl.organization_id = $1
  GROUP BY sl.vendor
)
SELECT vendor, SUM(contract_spend + license_spend) AS total_spend
FROM vendor_spend
WHERE vendor IS NOT NULL
GROUP BY vendor
ORDER BY total_spend DESC;
```

---

## Summary Endpoint Response
```json
{
  "total_annual_spend_estimate": 84200,
  "wasted_license_cost": 12400,
  "upcoming_renewals_30d": { "count": 3, "total_value": 28000 },
  "idle_assets_count": 7,
  "top_spend_department": "Engineering",
  "top_spend_vendor": "Microsoft"
}
```

---

## Stats Response (Strata Hub)
```json
{
  "primary": "$12,400 potential savings",
  "secondary": "7 idle assets",
  "tertiary": "3 renewals in 30 days",
  "health": "warning"
}
```

---

## Frontend Pages
**Base route:** `/costlens`

| Page | Path | Description |
|------|------|-------------|
| Overview | `/costlens` | Insight cards + KPIs |
| Licenses | `/costlens/licenses` | Unused license detail table |
| Assets | `/costlens/assets` | Idle asset list |
| Renewals | `/costlens/renewals` | Timeline of upcoming renewals |
| Spend | `/costlens/spend` | Department + vendor charts |

### Overview page layout (insight cards)
```
┌── Wasted Licenses ──────────────┐  ┌── Idle Assets ───────────────────┐
│  💸 $12,400/yr potential        │  │  📦 7 assets unused 90+ days     │
│  saving across 4 products       │  │  Est. value: $23,000             │
│  [See details →]                │  │  [See details →]                 │
└─────────────────────────────────┘  └──────────────────────────────────┘

┌── Upcoming Renewals ────────────┐  ┌── Total IT Spend (YTD) ──────────┐
│  📅 3 in next 30 days           │  │  $84,200 this year               │
│  Total: $28,000                 │  │  ▲ 12% vs last year              │
│  [See all renewals →]           │  │  [View breakdown →]              │
└─────────────────────────────────┘  └──────────────────────────────────┘
```

---

## Cross-Module Links
- **AssetLog:** Reads assets, licenses, asset_tickets for all calculations
- **ContractVault:** Reads contracts + vendors for spend and renewal data
- **ProcureFlow:** Reads purchase_requests for actual spend by department
- **Strata Hub:** Shows top savings opportunity as the module stat

---

## Notes
- All numbers are estimates — CostLens clearly labels them as such in the UI
- License "wasted cost" assumes even seat distribution; actual may vary
- The goal is directional insight, not accounting precision — that belongs in the CFO's tools
- v2: export to CSV for budget presentations; email weekly spend digest to org owner
