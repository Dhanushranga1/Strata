# ContractVault — Vendor & Contract Management

## Problem It Solves
At most SMEs, contracts live in someone's email inbox or a shared Google Drive folder with no naming convention. Renewals are missed. When a vendor system goes down at 2am, nobody knows who the account manager is or what the SLA commitment was. IT gets blamed for both.

ContractVault gives IT a centralized, searchable record of every vendor and every agreement, with automatic renewal alerts so nothing gets silently auto-renewed or silently expired.

---

## Feature Gate
`"contracts"` — Starter plan and above

---

## Database Schema
**Migration:** `backend/migrations/0032_contractvault.sql`

```sql
-- Vendor directory
CREATE TABLE app.vendors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  category         text CHECK (category IN (
                     'hardware','software','saas','services','telecom','cloud','other'
                   )),
  website          text,
  support_email    text,
  support_phone    text,
  account_manager  text,                               -- name + contact of vendor's account rep
  performance_score int CHECK (performance_score BETWEEN 1 AND 5),
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Contracts
CREATE TABLE app.contracts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  vendor_id        uuid REFERENCES app.vendors(id) ON DELETE SET NULL,
  title            text NOT NULL,
  contract_type    text CHECK (contract_type IN (
                     'service','license','support','lease','nda','maintenance','other'
                   )),
  start_date       date,
  end_date         date,
  value            numeric(12,2),                      -- total contract value
  auto_renews      bool NOT NULL DEFAULT false,
  notice_period_days int NOT NULL DEFAULT 30,          -- days before end_date to notify
  document_url     text,                               -- Supabase Storage or external URL
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','expired','cancelled','draft')),
  notes            text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_vendors_org         ON app.vendors(organization_id);
CREATE INDEX idx_contracts_org       ON app.contracts(organization_id, status);
CREATE INDEX idx_contracts_end_date  ON app.contracts(organization_id, end_date)
  WHERE end_date IS NOT NULL AND status = 'active';
```

---

## API Endpoints
**Router prefix:** `/api/contracts`
**File:** `backend/app/modules/contractvault/router.py`

### Vendors
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/contracts/vendors` | List vendors (filter: category, search) |
| POST | `/api/contracts/vendors` | Create vendor |
| GET | `/api/contracts/vendors/{id}` | Vendor detail (includes contracts + linked tickets) |
| PATCH | `/api/contracts/vendors/{id}` | Update vendor |
| DELETE | `/api/contracts/vendors/{id}` | Delete vendor (only if no active contracts) |

### Contracts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/contracts` | List contracts (filter: vendor, status, type, expiry window) |
| POST | `/api/contracts` | Create contract |
| GET | `/api/contracts/{id}` | Contract detail |
| PATCH | `/api/contracts/{id}` | Update contract |
| DELETE | `/api/contracts/{id}` | Cancel contract (status = 'cancelled') |
| GET | `/api/contracts/stats` | Module stats for Strata hub |
| GET | `/api/contracts/expiring` | Contracts expiring within N days (default 90) |

### Stats response
```json
{
  "primary": "24 active contracts",
  "secondary": "3 expiring in 30 days",
  "tertiary": "2 auto-renewing",
  "health": "warning"
}
```

Health `"warning"` if any contract expires within `notice_period_days` days. Health `"critical"` if any contract has already expired with status still = 'active'.

---

## Renewal Alert Logic
A daily background task (or Supabase cron) scans `app.contracts` WHERE `status = 'active'` AND `end_date IS NOT NULL`:

```python
ALERT_THRESHOLDS_DAYS = [90, 60, 30]   # alert at each threshold

for threshold in ALERT_THRESHOLDS_DAYS:
    # find contracts expiring in exactly `threshold` days
    expiring = await db.fetch("""
        SELECT c.*, v.name as vendor_name
        FROM app.contracts c
        LEFT JOIN app.vendors v ON c.vendor_id = v.id
        WHERE c.organization_id = $1
          AND c.status = 'active'
          AND c.end_date = CURRENT_DATE + $2::interval
    """, org_id, f"{threshold} days")
    
    for contract in expiring:
        create_notification(
            org_id=org_id,
            title=f"Contract expiring in {threshold} days",
            body=f"{contract['vendor_name']}: {contract['title']} expires on {contract['end_date']}"
        )
```

Also alert when `end_date - notice_period_days = TODAY` (the custom notice period).

---

## Vendor Performance Score
Manual 1-5 rating set by admins, OR auto-computed from TicketPilot data:

```sql
-- Auto-compute vendor score based on linked ticket resolution time
-- Vendors linked via: tickets where title/description mentions vendor name
-- Or via future explicit ticket-vendor linkage
SELECT
  v.id,
  v.name,
  AVG(
    EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600
  ) AS avg_resolution_hours,
  COUNT(t.id) AS linked_tickets
FROM app.vendors v
LEFT JOIN app.tickets t ON t.organization_id = v.organization_id
  AND t.title ILIKE '%' || v.name || '%'
WHERE v.organization_id = $1
GROUP BY v.id, v.name;
```

Frontend shows this as a star rating on the vendor card (read-only if auto-computed, editable if manual).

---

## Document Storage
- Documents stored as URLs (not binary in DB)
- Option A: Upload to Supabase Storage → store the public URL
- Option B: Paste an external URL (SharePoint, Google Drive, Dropbox)
- Frontend shows a download/open link on the contract detail page
- No PDF viewer needed in v1 — just link out

```python
@router.post("/{contract_id}/document")
async def upload_document(contract_id: uuid.UUID, file: UploadFile, ...):
    # upload to Supabase Storage bucket "contracts"
    path = f"{org_id}/{contract_id}/{file.filename}"
    url = supabase.storage.from_("contracts").upload(path, await file.read())
    await db.execute("UPDATE app.contracts SET document_url=$1 WHERE id=$2", url, contract_id)
    return {"document_url": url}
```

---

## Frontend Pages
**Base route:** `/contracts`

| Page | Path | Description |
|------|------|-------------|
| Vendor list | `/contracts/vendors` | Card grid of vendors with category tags |
| Vendor detail | `/contracts/vendors/{id}` | Vendor info + linked contracts + performance |
| Contract list | `/contracts` | Table with expiry status color coding |
| Contract detail | `/contracts/{id}` | Full detail + document link |
| New vendor | `/contracts/vendors/new` | Form |
| New contract | `/contracts/new` | Form (pre-fills vendor if coming from vendor page) |

### Contract list columns
`Title | Vendor | Type | Status | Start | End | Value | Notice | Auto-renew | Actions`

### Expiry color coding
- Green: > 90 days
- Yellow: 30-90 days
- Orange: notice_period reached
- Red: < 30 days or already expired

---

## Spend Dashboard (on Vendor detail page)
Total IT spend visible per vendor:
- Sum of `contracts.value` for active/historical contracts
- Sum of `software_licenses.cost_per_year` for licenses linked to this vendor
- Displayed as: "Total spend: $47,200/yr across 3 contracts"

---

## Cross-Module Links
- **AssetLog:** `software_licenses.contract_id` — license linked to its supporting contract
- **CostLens:** Uses contracts + license costs for total spend analysis
- **ProcureFlow:** New purchase can create a contract upon delivery
- **TicketPilot:** Future: link a ticket to a vendor for escalation context

---

## Notes
- `auto_renews = true` contracts should have an extra-prominent alert — they silently cost money if missed
- `notice_period_days` defaults to 30 but can be set per contract (some need 90 days for SaaS, 6 months for hardware leases)
- Contract status transitions: draft → active → (expired | cancelled)
- Never hard-delete contracts — too important for audit
