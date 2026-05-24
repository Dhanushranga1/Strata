# ServiceHub — Self-Service Portal & Service Catalog

## Problem It Solves
Employees don't know what to ask IT for or how. They send informal Slack messages, emails, or walk up to an IT person. IT gets interrupted constantly with repetitive requests. There's no standard form, so every request is incomplete. And self-help articles live in Google Docs that nobody can find.

ServiceHub gives employees a clean self-service portal where they can browse available IT services, submit structured requests, and search the knowledge base — all without needing a Strata account.

---

## Feature Gate
`"service_hub"` — Starter plan and above

---

## Two Entry Points
1. `/portal` — Public-facing page, accessible without login via org invite link
2. `/servicehub` — Internal admin view to manage catalog entries

---

## Database Schema
**Migration:** `backend/migrations/0035_servicehub.sql`

```sql
-- Service catalog items
CREATE TABLE app.service_catalog (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  category         text,                               -- "Hardware", "Access", "Software", "Onboarding"
  icon             text,                               -- lucide icon name
  form_schema      jsonb NOT NULL DEFAULT '[]',        -- array of field definitions (see below)
  auto_assign_role text,                               -- assign to first available rep with this role
  sla_priority     int NOT NULL DEFAULT 3,             -- 1-5, maps to ticket priority
  estimated_time   text,                               -- "1-2 business days" (shown to requester)
  sort_order       int NOT NULL DEFAULT 0,
  is_active        bool NOT NULL DEFAULT true,
  is_public        bool NOT NULL DEFAULT false,        -- visible on /portal without login
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Index
CREATE INDEX idx_catalog_org_active ON app.service_catalog(organization_id, is_active, sort_order);
```

### form_schema structure (jsonb array)
Each element defines one field on the request form:
```json
[
  { "id": "requester_name", "type": "text", "label": "Your name", "required": true },
  { "id": "department",     "type": "select", "label": "Department",
    "options": ["Engineering","HR","Finance","Sales","Other"], "required": true },
  { "id": "laptop_type",    "type": "select", "label": "Laptop preference",
    "options": ["MacBook Pro 14\"","Dell XPS 15","Windows (any)"], "required": false },
  { "id": "notes",          "type": "textarea", "label": "Additional notes", "required": false }
]
```

Supported field types: `text`, `textarea`, `select`, `multi_select`, `date`, `email`, `phone`, `checkbox`

---

## API Endpoints
**Router prefix:** `/api/servicehub`
**File:** `backend/app/modules/servicehub/router.py`

### Public endpoints (no auth required, just org slug)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/portal/{org_slug}/catalog` | List public catalog items for portal |
| POST | `/api/portal/{org_slug}/request/{catalog_id}` | Submit a request (creates ticket) |
| GET | `/api/portal/{org_slug}/kb` | Public KB articles |

### Admin endpoints (authenticated)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/servicehub/catalog` | List all catalog items (including inactive) |
| POST | `/api/servicehub/catalog` | Create catalog item |
| GET | `/api/servicehub/catalog/{id}` | Get item |
| PATCH | `/api/servicehub/catalog/{id}` | Update item |
| DELETE | `/api/servicehub/catalog/{id}` | Delete (or deactivate) |
| GET | `/api/servicehub/stats` | Module stats for Strata hub |

---

## Portal Request Submission Logic
When `POST /api/portal/{org_slug}/request/{catalog_id}` is called:

1. Validate the submitted form data against `form_schema` (required fields, types)
2. Build ticket title: `"{catalog_item.name} — {requester_name}"`
3. Build ticket description from form data as structured markdown:
   ```
   **Service:** New Laptop Request
   **Requester:** Jane Smith
   **Department:** Engineering
   **Preference:** MacBook Pro 14"
   **Notes:** Starting March 15
   ```
4. Create ticket in `app.tickets`:
   - `organization_id` from org slug lookup
   - `priority` from `sla_priority` mapping
   - `assignee_id` = first available rep with `auto_assign_role` (if set)
   - `title` and `description` as above
5. Return `{ ticket_id, ticket_number, estimated_time }` so portal can show a confirmation

No Strata account required from the submitter. The `created_by` field on the ticket is `NULL` for portal submissions (or a system user).

---

## Built-in Catalog Templates
Pre-seeded on org creation (hidden by default, admin can activate):

| Template | Form fields |
|----------|-------------|
| New Laptop Request | Name, Department, Laptop preference, Start date |
| Software Installation | Name, Software name, Business justification |
| VPN / Remote Access | Name, Device type, Reason |
| New Employee Setup | Employee name, Email, Department, Start date, Manager |
| Password Reset | Account email, System/app name |
| Printer Access | Name, Location, Printer |
| File Share Access | Name, Share path, Access level |

---

## Public Portal Page
**Route:** `/portal` (or `/portal?org={slug}` when org is not in subdomain)

```
┌────────────────────── Acme Corp IT Portal ─────────────────────────┐
│  How can we help you today?                  [🔍 Search articles]  │
├────────────────────────────────────────────────────────────────────┤
│  Hardware                Software            Access                │
│                                                                    │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ 💻 New Laptop   │  │ 📦 Install App   │  │ 🔐 VPN Access    │  │
│  │ 1-2 business    │  │ Same day         │  │ 4 hours          │  │
│  │ days            │  │                  │  │                  │  │
│  │ [Request →]     │  │ [Request →]      │  │ [Request →]      │  │
│  └─────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                    │
│  Popular Articles                                                  │
│  • How to connect to VPN                                           │
│  • Setting up your MacBook on day one                              │
│  • Requesting software: step by step                               │
└────────────────────────────────────────────────────────────────────┘
```

After submitting a request:
```
✅ Request Submitted
Your request has been received. Reference: #1042
Estimated time: 1-2 business days.
The IT team has been notified.
```

---

## Frontend Pages

| Page | Path | Description |
|------|------|-------------|
| Public portal | `/portal` | Employee-facing service catalog |
| Request form | `/portal/request/{id}` | Dynamic form for a catalog item |
| Admin catalog | `/servicehub` | Manage catalog items |
| Edit item | `/servicehub/catalog/{id}` | Edit form + form builder |
| New item | `/servicehub/catalog/new` | Create catalog item |

### Form Builder (admin)
The catalog item editor includes a drag-and-drop field builder:
- Add field → choose type → set label, options, required
- Preview the form as it will appear to employees
- Save schema to `form_schema` jsonb

This is a v1 simplified version: no drag-and-drop, just an add/remove list of fields.

---

## KnowBase Integration
- Public portal shows articles where `is_public = true` from KnowBase
- Search on the portal queries `app.knowledge_articles` with pg_trgm
- "Popular Articles" = top 5 by `view_count` among public articles

---

## Cross-Module Links
- **TicketPilot:** Portal submissions create tickets. The ticket shows "Source: Portal" in its metadata
- **ProcureFlow:** "New Laptop" catalog item can optionally trigger a ProcureFlow purchase request instead of (or in addition to) a ticket
- **PeopleSync:** "New Employee Setup" catalog item triggers a PeopleSync joiner event
- **KnowBase:** Public KB articles surface on the portal

---

## Notes
- The portal URL can be custom per org: `it.acmecorp.com` (CNAME to `/portal?org=acmecorp`) — v2
- No authentication required on the portal — this is intentional for SMEs (employees don't have accounts)
- Rate limiting on portal submissions: 10 requests per IP per hour to prevent spam
- `is_public = false` items are only visible to logged-in Strata users (for internal requests like ProcureFlow triggers)
