# Strata Module Specs

Complete specifications for all Strata platform modules. Each doc covers: problem statement, DB schema, API endpoints, frontend pages, feature gate, and cross-module links.

---

## Architecture Decision

**Single repo, modular monolith.** All modules live in this repository.

```
backend/app/modules/{module}/    ← router, service logic per module
backend/migrations/XXXX_{m}.sql  ← isolated schema per module
frontend/src/app/(protected)/{slug}/  ← frontend pages per module
docs/modules/                    ← this folder
infra/                           ← Docker Compose, Nginx (to be added)
```

TicketPilot is the first and core module. Others are added incrementally.
No microservices — one FastAPI process, one PostgreSQL database, one Next.js frontend.

---

## Module Index

| # | Module | Feature Key | Plan | Doc | Status |
|---|--------|-------------|------|-----|--------|
| 0 | **Strata Platform Hub** | *(all)* | Any | [00_strata_platform_hub.md](00_strata_platform_hub.md) | 📋 Spec ready |
| 1 | **AssetLog** | `assets` | Starter | [01_assetlog.md](01_assetlog.md) | 📋 Spec ready |
| 2 | **ContractVault** | `contracts` | Starter | [02_contractvault.md](02_contractvault.md) | 📋 Spec ready |
| 3 | **ProcureFlow** | `procurement` | Starter | [03_procureflow.md](03_procureflow.md) | 📋 Spec ready |
| 4 | **PatchWatch** | `patches` | Business | [04_patchwatch.md](04_patchwatch.md) | 📋 Spec ready |
| 5 | **CostLens** | `cost_lens` | Business | [05_costlens.md](05_costlens.md) | 📋 Spec ready |
| 6 | **ServiceHub** | `service_hub` | Starter | [06_servicehub.md](06_servicehub.md) | 📋 Spec ready |
| 7 | **ChangeBoard** | `change_board` | Business | [07_changeboard.md](07_changeboard.md) | 📋 Spec ready |
| 8 | **IncidentBridge** | `incidents` | Business | [08_incidentbridge.md](08_incidentbridge.md) | 📋 Spec ready |
| 9 | **PeopleSync** | `people_sync` | Enterprise | [09_peoplesync.md](09_peoplesync.md) | 📋 Spec ready |
| 10 | **FlowBot** | `flowbot` | Business | [10_flowbot.md](10_flowbot.md) | 📋 Spec ready |
| 11 | **StatusCast** | `status_cast` | Business | [11_statuscast.md](11_statuscast.md) | 📋 Spec ready |
| 12 | **KnowBase** | `kb` | Starter | [12_knowbase.md](12_knowbase.md) | 📋 Spec ready |

**TicketPilot** (ticketing, SLA, AI, canned responses, CSAT) is the existing product — not documented here as its spec lives in the main docs/ folder.

---

## Migration Order (dependency chain)

Some modules have FK dependencies. Run migrations in this order:

```
0031_assetlog.sql         ← standalone
0032_contractvault.sql    ← standalone (vendors + contracts)
                            → then add FK: ALTER TABLE software_licenses
                              ADD FOREIGN KEY (contract_id) REFERENCES app.contracts(id)
0033_procureflow.sql      ← depends on: app.vendors (ContractVault), app.assets (AssetLog)
0034_patchwatch.sql       ← depends on: app.assets (AssetLog)
0035_servicehub.sql       ← standalone
0036_changeboard.sql      ← standalone
0037_incidentbridge.sql   ← depends on: app.changes (ChangeBoard) — optional FK
0038_peoplesync.sql       ← standalone
0039_knowbase.sql         ← standalone (extends existing KB)
0040_flowbot.sql          ← standalone
0041_statuscast.sql       ← depends on: app.incidents (IncidentBridge) — optional FK
```

---

## Cross-Module Dependency Map

```
TicketPilot ←──── AssetLog (asset_tickets join)
                    ↑
ProcureFlow ────→ AssetLog (delivery → auto-create asset)
                    ↑
ContractVault ──→ AssetLog (license.contract_id)

ProcureFlow ────→ ContractVault (vendor_id)
CostLens ───────→ AssetLog + ContractVault + ProcureFlow (read-only)

PeopleSync ─────→ ProcureFlow (joiner laptop request)
PeopleSync ─────→ AssetLog (leaver asset recovery)
PeopleSync ─────→ TicketPilot (leaver ticket transfer)

ServiceHub ─────→ TicketPilot (portal submission → ticket)
ServiceHub ─────→ ProcureFlow (laptop request)
ServiceHub ─────→ PeopleSync (new employee form)
ServiceHub ─────→ KnowBase (public articles on portal)

PatchWatch ─────→ AssetLog (patch.asset_id)
PatchWatch ─────→ TicketPilot (maintenance window → ticket)

ChangeBoard ────→ TicketPilot (linked_ticket_id)
IncidentBridge ─→ TicketPilot (P1 upgrade prompt)
IncidentBridge ─→ ChangeBoard (linked_change_id: failed change)
IncidentBridge ─→ StatusCast (P1/P2 auto-update)

FlowBot ────────→ TicketPilot (rule engine embedded in ticket events)
KnowBase ───────→ TicketPilot (CASPER AI surfaces articles)
KnowBase ───────→ ServiceHub (public articles on portal)
```

---

## Implementation Roadmap

### Month 2 (current) — Speed Sprint
- P7 composite DB indexes ✅ (0029_perf_indexes.sql)
- P8 materialized views (0030_mv_dashboard.sql — pending pg_cron)
- P4 AI streaming (SSE)
- P1 HNSW vector index
- P9 Matryoshka 512-dim embeddings

### Month 3 — Platform Hub + AI
- Strata `/platform` hub page
- KnowBase article layer (extends existing KB)
- BM25 + RRF hybrid search
- Semantic response cache

### Month 4 — Core Asset Suite
- AssetLog (0031 + router + frontend + QR)
- ContractVault (0032 + router + frontend)
- ProcureFlow (0033 + router + frontend)

### Month 5 — Business Operations
- PatchWatch (0034 + router + frontend)
- CostLens (no new schema + router + frontend)
- ServiceHub portal (0035 + router + /portal page)
- FlowBot rule engine (0040 + engine + frontend)

### Month 6 — Incident & Change
- ChangeBoard (0036 + router + frontend + calendar)
- IncidentBridge (0037 + router + war room UI)
- StatusCast (0041 + public /status page)

### Month 7 — Enterprise
- PeopleSync (0038 + router + checklist UI + webhook)
- SSO/SAML (`python-saml`)
- Full audit log
- Infrastructure: Docker Compose + Nginx config for self-hosting

---

## Entitlements Update Required
The following feature keys need to be added to `backend/app/entitlements/plans.py` and `frontend/src/lib/plans.ts` before any module is built:

```python
# Add to TIER_DEFINITIONS features dict per plan:
"assets": True,           # Starter+
"contracts": True,        # Starter+
"procurement": True,      # Starter+
"service_hub": True,      # Starter+
"patches": False,         # Business+
"cost_lens": False,       # Business+
"change_board": False,    # Business+
"incidents": False,       # Business+
"flowbot": False,         # Business+
"status_cast": False,     # Business+
"people_sync": False,     # Enterprise only
```
