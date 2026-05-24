# AssetLog — IT Asset & License Management

## Problem It Solves
SME IT teams track assets in spreadsheets. Nobody knows:
- How many laptops they actually have and where they are
- Which devices are under warranty
- Which software licenses are unused (paying for 50 Zoom seats, using 22)
- Who had a device before it was reassigned

AssetLog is the single source of truth for all IT hardware, software licenses, and their lifecycle.

---

## Feature Gate
`"assets"` — Starter plan and above

---

## Database Schema
**Migration:** `backend/migrations/0031_assetlog.sql`

```sql
-- Hardware and physical assets
CREATE TABLE app.assets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  asset_tag        text NOT NULL,                        -- e.g. "ASSET-0042", must be unique per org
  name             text NOT NULL,                        -- "MacBook Pro 14" M3"
  category         text NOT NULL CHECK (category IN (
                     'laptop','desktop','server','phone','tablet',
                     'network','printer','other'
                   )),
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','in_repair','retired','lost','disposed')),
  assigned_to      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  location         text,                                 -- "NYC Office - Floor 2"
  department       text,                                 -- "Engineering", "HR"
  specs            jsonb DEFAULT '{}',                   -- {serial, model, cpu, ram, storage, os}
  purchase_date    date,
  purchase_price   numeric(12,2),
  warranty_expiry  date,
  depreciation_years int DEFAULT 3,
  notes            text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (organization_id, asset_tag)
);

-- Software licenses (SaaS, perpetual, OEM)
CREATE TABLE app.software_licenses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  product_name     text NOT NULL,                        -- "Adobe Creative Cloud"
  vendor           text,
  license_type     text CHECK (license_type IN ('perpetual','subscription','oem','free')),
  seat_count       int,                                  -- NULL = unlimited
  seats_used       int NOT NULL DEFAULT 0,
  expiry_date      date,
  cost_per_year    numeric(12,2),
  contract_id      uuid REFERENCES app.contracts(id) ON DELETE SET NULL,  -- link to ContractVault
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Links assets to support tickets (many-to-many)
CREATE TABLE app.asset_tickets (
  asset_id   uuid NOT NULL REFERENCES app.assets(id) ON DELETE CASCADE,
  ticket_id  uuid NOT NULL REFERENCES app.tickets(id) ON DELETE CASCADE,
  linked_at  timestamptz DEFAULT now(),
  PRIMARY KEY (asset_id, ticket_id)
);

-- Full change history per asset (who changed what, when)
CREATE TABLE app.asset_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      uuid NOT NULL REFERENCES app.assets(id) ON DELETE CASCADE,
  changed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  field_changed text NOT NULL,
  old_value     text,
  new_value     text,
  created_at    timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_assets_org_status    ON app.assets(organization_id, status);
CREATE INDEX idx_assets_org_assignee  ON app.assets(organization_id, assigned_to);
CREATE INDEX idx_assets_warranty      ON app.assets(organization_id, warranty_expiry)
  WHERE warranty_expiry IS NOT NULL;
CREATE INDEX idx_licenses_org_expiry  ON app.software_licenses(organization_id, expiry_date)
  WHERE expiry_date IS NOT NULL;
```

**Note:** `app.contracts` is from ContractVault (migration 0032). AssetLog migration must run after ContractVault migration, or add the FK after the fact. For now, the FK can be left as nullable and added in a later migration.

---

## API Endpoints
**Router prefix:** `/api/assets`
**File:** `backend/app/modules/assetlog/router.py`

### Assets CRUD
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/assets` | List assets (filter: status, category, assignee, department) |
| POST | `/api/assets` | Create asset |
| GET | `/api/assets/{id}` | Asset detail (includes history + linked tickets) |
| PATCH | `/api/assets/{id}` | Update asset (auto-writes to asset_history) |
| DELETE | `/api/assets/{id}` | Soft-delete → status = 'disposed' (never hard-delete) |
| GET | `/api/assets/{id}/qr.png` | QR code PNG — scans to ticket creation pre-filled with asset |
| GET | `/api/assets/stats` | Module stats for Strata hub |

### Software Licenses
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/assets/licenses` | List all licenses |
| POST | `/api/assets/licenses` | Add license |
| PATCH | `/api/assets/licenses/{id}` | Update (recalculate seats_used warning) |
| DELETE | `/api/assets/licenses/{id}` | Remove license |

### Query params for list:
```
GET /api/assets?status=active&category=laptop&assignee={user_id}&department=Engineering&search=macbook
```

### Stats response
```json
{
  "primary": "47 assets",
  "secondary": "3 warranties expiring this month",
  "tertiary": "5 unused license seats",
  "health": "warning"
}
```

Health is `"warning"` if any warranty expires within 30 days or `seats_used / seat_count < 0.6` for any license.

---

## QR Code Logic
1. `GET /api/assets/{id}/qr.png` generates a QR code linking to:
   `/tickets/new?asset_id={id}&asset_name={name}&asset_tag={tag}`
2. The ticket creation page pre-fills title and description with asset context
3. The new ticket is automatically linked in `app.asset_tickets`
4. Library: `qrcode` (MIT, pure Python, zero deps)

```python
import qrcode
import io

def generate_qr(asset_id: str, base_url: str) -> bytes:
    url = f"{base_url}/tickets/new?asset_id={asset_id}"
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
```

---

## Asset History (Audit Trail)
Every PATCH to an asset writes a row to `app.asset_history`. This is done at the router level, not triggers, to keep logic visible.

```python
async def record_change(db, asset_id, user_id, field, old_val, new_val):
    await db.execute("""
        INSERT INTO app.asset_history (asset_id, changed_by, field_changed, old_value, new_value)
        VALUES ($1, $2, $3, $4, $5)
    """, asset_id, user_id, field, str(old_val), str(new_val))
```

---

## Automated Alerts
A background task (or Supabase cron) checks daily:
- Warranty expiring in 30, 60, 90 days → creates notification for org admins
- License seats: `seats_used / seat_count > 0.9` → "Running low on {product} licenses" notification
- License expiring in 30 days → notification + ProcureFlow prompt

These are written to `app.notifications` (existing table).

---

## Frontend Pages
**Base route:** `/assets`

| Page | Path | Description |
|------|------|-------------|
| Asset list | `/assets` | Filterable table: status, category, department, search |
| Asset detail | `/assets/{id}` | Full detail + history timeline + linked tickets |
| New asset | `/assets/new` | Create form |
| Edit asset | `/assets/{id}/edit` | Edit form |
| Licenses | `/assets/licenses` | License list with seat utilization bars |

### Asset list columns
`Asset Tag | Name | Category | Status | Assigned To | Warranty | Department | Actions`

### Asset detail sections
1. Overview card (specs, purchase info, warranty status)
2. Assigned to (user card, change assignment)
3. Linked tickets (from `asset_tickets` join)
4. Change history timeline (from `asset_history`)
5. QR code download button

---

## Cross-Module Links
- **ContractVault:** `software_licenses.contract_id` → links a license to its contract
- **ProcureFlow:** On delivery of a purchase request, auto-create an asset record
- **TicketPilot:** `asset_tickets` table links assets to tickets; scanning QR opens pre-filled ticket
- **CostLens:** Uses `assets` + `software_licenses` for spend and waste calculations
- **PeopleSync:** Leaver flow recovers asset (changes `assigned_to` → null, status → TBD)

---

## Notes
- `asset_tag` is unique per org — auto-generate as `ASSET-{padded_sequence}` or let admin set it
- `specs` jsonb stores everything model-specific without schema changes: `{serial: "C02X...", model: "MacBook Pro 14", cpu: "M3 Pro", ram: "18GB"}`
- Never hard-delete assets — set `status = 'disposed'` to preserve history
- The QR code flow is the primary "wow" feature — make it prominent in onboarding
