# ProcureFlow — Procurement & Purchase Approvals

> **Implementation Status: ✅ Built & Deployed**  
> Backend: `backend/app/procureflow.py` · Migration: `0037_procureflow.sql` (live)  
> Frontend: `frontend/src/app/(protected)/procurement/page.tsx`  
> See [STRATA_MODULES_SPRINT.md](../sprint/STRATA_MODULES_SPRINT.md) for full build notes.

## Problem It Solves
At SMEs, purchase requests travel through email chains. The approval trail exists only in someone's inbox. Budget tracking is impossible. IT has no idea what's been ordered, what's in transit, or what's been delivered. An engineer needs a laptop — it takes 2 weeks of email ping-pong before anything is ordered.

ProcureFlow creates a structured workflow: Request → Manager Approval → Order → Delivery → Asset. Every step is tracked. Budget owners see all spend in one place.

---

## Feature Gate
`"procurement"` — Starter plan and above

---

## Workflow States
```
pending → approved → ordered → delivered → cancelled
      ↘ rejected
```

| Status | Meaning |
|--------|---------|
| `pending` | Submitted, waiting for manager approval |
| `approved` | Approved, ready to be ordered |
| `rejected` | Rejected with reason |
| `ordered` | PO issued, item on its way |
| `delivered` | Item received — asset auto-created in AssetLog |
| `cancelled` | Cancelled at any stage |

---

## Database Schema
**Migration:** `backend/migrations/0033_procureflow.sql`

```sql
CREATE TABLE app.purchase_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  requested_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  vendor_id        uuid REFERENCES app.vendors(id) ON DELETE SET NULL,
  title            text NOT NULL,
  description      text,
  category         text CHECK (category IN (
                     'hardware','software','subscription','services','other'
                   )),
  quantity         int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price       numeric(12,2),
  total_price      numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  currency         text NOT NULL DEFAULT 'USD',
  department       text,
  justification    text,
  urgency          text NOT NULL DEFAULT 'normal'
                   CHECK (urgency IN ('low','normal','high','urgent')),
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected','ordered','delivered','cancelled')),
  rejection_reason text,
  po_number        text,                               -- purchase order number
  ordered_at       timestamptz,
  delivered_at     timestamptz,
  linked_asset_id  uuid REFERENCES app.assets(id) ON DELETE SET NULL,  -- created on delivery
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pr_org_status      ON app.purchase_requests(organization_id, status);
CREATE INDEX idx_pr_org_requester   ON app.purchase_requests(organization_id, requested_by);
CREATE INDEX idx_pr_org_approver    ON app.purchase_requests(organization_id, approved_by);
```

---

## API Endpoints
**Router prefix:** `/api/procurement`
**File:** `backend/app/modules/procureflow/router.py`

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| GET | `/api/procurement` | All | List PRs (filter: status, department, requester, date range) |
| POST | `/api/procurement` | All | Submit new request |
| GET | `/api/procurement/{id}` | All | PR detail |
| POST | `/api/procurement/{id}/approve` | Admin/Owner | Approve request |
| POST | `/api/procurement/{id}/reject` | Admin/Owner | Reject with reason |
| POST | `/api/procurement/{id}/order` | Admin/Owner | Mark as ordered (set PO number) |
| POST | `/api/procurement/{id}/deliver` | Admin/Owner | Mark delivered → auto-create asset |
| POST | `/api/procurement/{id}/cancel` | Requester/Admin | Cancel |
| GET | `/api/procurement/stats` | All | Module stats for Strata hub |
| GET | `/api/procurement/budget` | Admin/Owner | Budget summary by department/category |

### Stats response
```json
{
  "primary": "5 pending approvals",
  "secondary": "2 items in transit",
  "tertiary": "$4,200 ordered this month",
  "health": "warning"
}
```

Health `"warning"` if any request has been `pending` > 3 business days.

---

## Approve / Reject Endpoint
```python
@router.post("/{pr_id}/approve")
async def approve_request(pr_id: uuid.UUID, request: Request, user = Depends(get_current_user)):
    # Only admins/owners can approve
    await require_role(request, user, ["admin","owner"])
    org_id = require_org_context(request)
    pr = await db.fetchrow("SELECT * FROM app.purchase_requests WHERE id=$1 AND organization_id=$2", pr_id, org_id)
    if not pr or pr["status"] != "pending":
        raise HTTPException(400, "Request not in pending state")
    await db.execute("""
        UPDATE app.purchase_requests
        SET status='approved', approved_by=$1, updated_at=now()
        WHERE id=$2
    """, user["id"], pr_id)
    # Notify requester
    await create_notification(org_id, pr["requested_by"], "Purchase request approved",
                               f"Your request for '{pr['title']}' has been approved.")
    return {"status": "approved"}
```

---

## Auto-Create Asset on Delivery
When `POST /api/procurement/{id}/deliver` is called:
1. Set `status = 'delivered'`, `delivered_at = now()`
2. If `category IN ('hardware')` → auto-create a draft asset in AssetLog:
   ```python
   asset = await db.fetchrow("""
       INSERT INTO app.assets
         (organization_id, asset_tag, name, category, status, purchase_date,
          purchase_price, assigned_to, created_by)
       VALUES ($1, $2, $3, $4, 'active', CURRENT_DATE, $5, $6, $7)
       RETURNING id
   """, org_id, generate_asset_tag(org_id), pr["title"],
       map_category(pr["category"]), pr["unit_price"],
       pr["requested_by"], user["id"])
   ```
3. Link: `UPDATE app.purchase_requests SET linked_asset_id=$1 WHERE id=$2`
4. Notify requester: "Your {item} has been delivered. Asset #{tag} has been created."

`map_category`: `'hardware' → 'laptop'/'desktop'` (ask user in delivery form) or default to `'other'`.

---

## Budget View
`GET /api/procurement/budget` returns spend grouped by department and category for the current month and year-to-date:

```sql
SELECT
  department,
  category,
  COUNT(*) as request_count,
  SUM(total_price) FILTER (WHERE status IN ('approved','ordered','delivered')) as committed_spend,
  SUM(total_price) FILTER (WHERE status = 'delivered') as actual_spend,
  date_trunc('month', created_at) as month
FROM app.purchase_requests
WHERE organization_id = $1
  AND created_at >= date_trunc('year', CURRENT_DATE)
GROUP BY department, category, date_trunc('month', created_at)
ORDER BY month DESC, committed_spend DESC;
```

---

## Notifications
| Event | Who Gets Notified |
|-------|------------------|
| New request submitted | All admins/owners |
| Request approved | Requester |
| Request rejected | Requester (with reason) |
| Request ordered | Requester |
| Item delivered / asset created | Requester |
| Request pending > 3 business days | All admins/owners |

All notifications go to `app.notifications` (existing table).

---

## Frontend Pages
**Base route:** `/procurement`

| Page | Path | Description |
|------|------|-------------|
| Request list | `/procurement` | All PRs with status pipeline view |
| My requests | `/procurement?mine=true` | Filtered to current user |
| Pending approvals | `/procurement?status=pending` | Admin view |
| New request | `/procurement/new` | Submit form |
| PR detail | `/procurement/{id}` | Full detail with action buttons |
| Budget | `/procurement/budget` | Spend dashboard |

### PR list columns
`Title | Category | Requester | Vendor | Quantity | Total | Status | Urgency | Date | Actions`

### Status pipeline (kanban-style header on list page)
`Pending (5) → Approved (2) → Ordered (3) → Delivered (12)`

---

## Cross-Module Links
- **ContractVault:** `vendor_id` links to vendor record — auto-fill vendor from existing vendors
- **AssetLog:** `linked_asset_id` — delivery auto-creates asset; PR detail shows the created asset
- **CostLens:** Purchase totals feed into department spend analysis
- **PeopleSync:** Joiner flow triggers purchase request for laptop/equipment

---

## Notes
- Budget limits per department can be added in a later iteration (v2 feature)
- PO number is free-text — whatever the vendor issues. Not validated.
- For SMEs without a formal approval process: `auto_approve_under = 500` org setting (v2)
- The requester can be any org member; only admins/owners can approve
- `urgency = 'urgent'` surfaces at the top of the pending approval queue
