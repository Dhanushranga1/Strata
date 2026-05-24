# Strata Platform Hub — Mission Control

## Purpose
The single entry point for the entire Strata platform. Every module appears as a card with live health stats, plan gate status, and a direct action link. Replaces the current per-module sidebar navigation as the primary landing page for admins.

---

## Route
`/platform` — protected, any authenticated org member

Admins and owners get the full management view. Members see a read-only status view.

---

## UI Layout

```
┌──────────────────────────────────────── Strata ──────────────────────────────────────────────┐
│  Mission Control                                        [COMMUNITY]   Acme Corp IT   [avatar] │
│  Every IT operation, one place.                                                               │
├───────────────────────────────────────────────────────────────────────────────────────────── │
│                                                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  TicketPilot    │  │   AssetLog      │  │  ContractVault  │  │  ProcureFlow    │         │
│  │  ● Active       │  │  🔒 Starter     │  │  🔒 Starter     │  │  🔒 Business    │         │
│  │                 │  │                 │  │                 │  │                 │         │
│  │  14 open        │  │  Unlock asset   │  │  Unlock vendor  │  │  Unlock PO      │         │
│  │  2 overdue      │  │  inventory      │  │  contracts      │  │  approvals      │         │
│  │  3 urgent       │  │                 │  │                 │  │                 │         │
│  │  [Open →]       │  │  [Upgrade →]    │  │  [Upgrade →]    │  │  [Upgrade →]    │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   PatchWatch    │  │    CostLens     │  │   ServiceHub    │  │  ChangeBoard    │         │
│  │  🔒 Business    │  │  🔒 Business    │  │  🔒 Starter     │  │  🔒 Business    │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                                               │
│  ... more rows ...                                                                            │
└───────────────────────────────────────────────────────────────────────────────────────────── ┘
```

### Module Card States
| State | Visual | Condition |
|-------|--------|-----------|
| Active | Green dot, live stats | `can(feature)` returns true |
| Locked | Lock icon, plan badge, upgrade CTA | `can(feature)` returns false |
| Coming Soon | Grey, no action | `comingSoon: true` in config |
| Alert | Yellow/red border | Active + unhealthy (overdue, expiring, critical patches) |

---

## Module Config (frontend)

```typescript
// frontend/src/lib/platform-modules.ts

export interface PlatformModule {
  id: string
  name: string
  description: string
  href: string
  icon: string                    // lucide icon name
  color: string                   // tailwind color class (bg-violet-500, etc.)
  feature: string                 // entitlement key from plans.ts
  requiredPlan: PlanId
  statsEndpoint?: string          // GET /api/{endpoint}/stats — returns ModuleStats
  comingSoon?: boolean
}

export interface ModuleStats {
  primary: string                 // "14 open tickets"
  secondary?: string              // "2 overdue"
  tertiary?: string               // "3 urgent"
  health: "healthy" | "warning" | "critical"
}

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: "ticketpilot",
    name: "TicketPilot",
    description: "AI-powered support tickets, SLA, canned responses, CSAT",
    href: "/tickets",
    icon: "Ticket",
    color: "bg-violet-500",
    feature: "ticketing",           // always true — core product
    requiredPlan: "community",
    statsEndpoint: "tickets/stats",
  },
  {
    id: "assetlog",
    name: "AssetLog",
    description: "Hardware, software licenses, lifecycle, QR codes",
    href: "/assets",
    icon: "Monitor",
    color: "bg-blue-500",
    feature: "assets",
    requiredPlan: "starter",
    statsEndpoint: "assets/stats",
  },
  {
    id: "contractvault",
    name: "ContractVault",
    description: "Vendors, agreements, renewal tracking",
    href: "/contracts",
    icon: "FileText",
    color: "bg-emerald-500",
    feature: "contracts",
    requiredPlan: "starter",
    statsEndpoint: "contracts/stats",
  },
  {
    id: "procureflow",
    name: "ProcureFlow",
    description: "Purchase requests, approvals, PO tracking",
    href: "/procurement",
    icon: "ShoppingCart",
    color: "bg-amber-500",
    feature: "procurement",
    requiredPlan: "starter",
    statsEndpoint: "procurement/stats",
  },
  {
    id: "patchwatch",
    name: "PatchWatch",
    description: "Patch status, severity dashboard, maintenance windows",
    href: "/patches",
    icon: "Shield",
    color: "bg-red-500",
    feature: "patches",
    requiredPlan: "business",
    statsEndpoint: "patches/stats",
  },
  {
    id: "costlens",
    name: "CostLens",
    description: "License waste, idle assets, spend visibility",
    href: "/costlens",
    icon: "TrendingDown",
    color: "bg-green-500",
    feature: "cost_lens",
    requiredPlan: "business",
    statsEndpoint: "costlens/stats",
  },
  {
    id: "servicehub",
    name: "ServiceHub",
    description: "Employee self-service request portal",
    href: "/servicehub",
    icon: "LayoutGrid",
    color: "bg-cyan-500",
    feature: "service_hub",
    requiredPlan: "starter",
    statsEndpoint: "servicehub/stats",
  },
  {
    id: "changeboard",
    name: "ChangeBoard",
    description: "RFC workflow, change calendar, blackout periods",
    href: "/changes",
    icon: "GitBranch",
    color: "bg-orange-500",
    feature: "change_board",
    requiredPlan: "business",
    statsEndpoint: "changes/stats",
  },
  {
    id: "incidentbridge",
    name: "IncidentBridge",
    description: "P1 war room, incident timeline, stakeholder comms",
    href: "/incidents",
    icon: "AlertTriangle",
    color: "bg-rose-500",
    feature: "incidents",
    requiredPlan: "business",
    statsEndpoint: "incidents/stats",
  },
  {
    id: "peoplesync",
    name: "PeopleSync",
    description: "Joiner/mover/leaver IT provisioning checklists",
    href: "/peoplesync",
    icon: "Users",
    color: "bg-pink-500",
    feature: "people_sync",
    requiredPlan: "enterprise",
    statsEndpoint: "hr/stats",
  },
  {
    id: "flowbot",
    name: "FlowBot",
    description: "IF/THEN automation rules, auto-routing, auto-close",
    href: "/automation",
    icon: "Zap",
    color: "bg-yellow-500",
    feature: "flowbot",
    requiredPlan: "business",
    statsEndpoint: "automation/stats",
  },
  {
    id: "statuscast",
    name: "StatusCast",
    description: "Public uptime and incident status page",
    href: "/statuscast",
    icon: "Globe",
    color: "bg-teal-500",
    feature: "status_cast",
    requiredPlan: "business",
    statsEndpoint: "statuscast/stats",
  },
  {
    id: "knowbase",
    name: "KnowBase",
    description: "SOPs, runbooks, how-to articles — searchable, linkable",
    href: "/kb",
    icon: "BookOpen",
    color: "bg-indigo-500",
    feature: "kb",
    requiredPlan: "starter",
    statsEndpoint: "kb/stats",
  },
]
```

---

## Stats Endpoints

Each active module exposes `GET /api/{module}/stats` returning `ModuleStats`. The platform hub fetches all stats in parallel.

### TicketPilot stats (already exists, may need `/stats` route)
```json
{ "primary": "14 open tickets", "secondary": "2 overdue", "tertiary": "3 urgent", "health": "warning" }
```

### AssetLog stats
```json
{ "primary": "47 assets", "secondary": "3 warranties expiring", "health": "warning" }
```

### ContractVault stats
```json
{ "primary": "12 active contracts", "secondary": "2 expiring in 30 days", "health": "warning" }
```

Health rules:
- `"healthy"` — no alerts
- `"warning"` — ≥1 expiring/overdue item within 30 days
- `"critical"` — P1 incident active, or critical patches overdue

---

## Backend Endpoint (for ticket stats using materialized view)

```python
# backend/app/tickets.py
@router.get("/stats")
async def ticket_stats(request: Request, user = Depends(get_current_user)):
    org_id = require_org_context(request)
    rows = await db.fetch("""
        SELECT status, ticket_count, urgent_count, overdue_count
        FROM app.mv_ticket_counts
        WHERE organization_id = $1
    """, org_id)
    open_count = sum(r["ticket_count"] for r in rows if r["status"] not in ("resolved","closed"))
    overdue = sum(r["overdue_count"] for r in rows)
    urgent = sum(r["urgent_count"] for r in rows if r["status"] not in ("resolved","closed"))
    health = "critical" if overdue > 0 else ("warning" if urgent > 0 else "healthy")
    return {
        "primary": f"{open_count} open ticket{'s' if open_count != 1 else ''}",
        "secondary": f"{overdue} overdue" if overdue else None,
        "tertiary": f"{urgent} urgent" if urgent else None,
        "health": health,
    }
```

---

## Frontend Page

**File:** `frontend/src/app/(protected)/platform/page.tsx`

Key implementation notes:
- Use `Promise.all` or SWR's parallel fetch to get all stats simultaneously
- Cards that are locked still show (with upgrade CTA) — don't hide them
- Plan badge in header uses `useEntitlements().planId`
- "Go to Mission Control" link on the main dashboard for admins
- Sidebar: "Platform" item at the very top, above "Dashboard"

---

## No New DB Schema Required
The platform hub is purely a frontend composition of existing module data. It needs no new tables — only the `GET /api/{module}/stats` endpoints per module.

---

## Sidebar Update
```
[ Platform ]      ← new top-level link (href="/platform")
[ Dashboard ]
[ Tickets ]
[ Knowledge Base ]
[ Rep Console ]
[ Settings ]
```

Admin/owner sees Platform at top. Members see it too (read-only module status view).
