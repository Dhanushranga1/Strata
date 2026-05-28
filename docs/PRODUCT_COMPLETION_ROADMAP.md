# Strata — Product Completion Roadmap

**Last updated:** 2026-05-28  
**Purpose:** Definitive tracker of what's built, what's next, and why the ordering matters.

---

## Platform Completion Map

```
Legend:  ✅ Built  🔧 Partial  ⬜ Not built
```

### Core AI Engine (CASPER)
| Component | Status | Notes |
|-----------|--------|-------|
| RAG pipeline (FAISS + BM25 + RRF + MMR) | ✅ | P1+P2 done |
| HNSW vector index (O(log N) search) | ✅ | P1 done; 1024-dim live |
| Matryoshka 512-dim truncation | 🔧 | Mechanism in place; needs JINA_API_KEY + re-embed to activate |
| Semantic response cache | ✅ | P3 done; per-org, 1h TTL, cosine similarity >0.95 |
| AI streaming (SSE) | ✅ | P4 done; ~300ms first token |
| Dual-mode system prompt (TicketPilot/Strata) | ✅ | Phase 0 done |
| Entity namespaces (asset/contract/article/ticket) | ✅ | Phase 0 done |
| CASPER module tools (5 tools) | ✅ | Phase 0 done |
| Related Entities panel (ticket detail) | ✅ | Phase 0 done |
| CASPER NL query bar (/platform ⌘K) | ⬜ | Phase 2 — next AI sprint |
| Proactive intelligence agents | ⬜ | Phase 3 — cross-module CASPER |

### Frontend Performance
| Component | Status | Notes |
|-----------|--------|-------|
| SWR data layer | ✅ | P5 done; ticket list, rep page |
| Virtual scrolling | ✅ | P6 done; admin ticket list |
| Composite DB indexes | ✅ | P7 done; migration 0029 |
| Materialized view dashboard | ✅ | P8 done; pg_cron auto-refresh |

### Modules
| Module | Status | Gate | Migration | Backend | Frontend |
|--------|--------|------|-----------|---------|----------|
| TicketPilot (ticketing) | ✅ | Community | — | tickets.py | /tickets |
| KnowBase (articles) | ✅ | Starter | 0031 | knowbase.py | /knowbase |
| BillingVault (invoices) | ✅ | Starter | 0032 | billing.py | /billing |
| AssetLog (assets/licenses) | ✅ | Starter | 0034 | assets.py | /assets |
| ContractVault (vendors/contracts) | ✅ | Starter | 0036 | contractvault.py | /contracts |
| ProcureFlow (procurement) | ✅ | Starter | 0037 | procureflow.py | /procurement |
| PatchWatch (patches) | ✅ | Business | 0038 | patchwatch.py | /patches |
| CostLens (cost intelligence) | ✅ | Business | — | costlens.py | /costlens |
| ChangeBoard (change mgmt) | ✅ | Business | 0039 | changeboard.py | /changes |
| ServiceHub (self-service portal) | ⬜ | Starter | — | — | — |
| FlowBot (automation rules) | ⬜ | Business | — | — | — |
| IncidentBridge (incident mgmt) | ⬜ | Business | — | — | — |
| StatusCast (public status page) | ⬜ | Business | — | — | — |
| PeopleSync (HR joiner/mover/leaver) | ⬜ | Enterprise | — | — | — |

### Platform Infrastructure
| Component | Status | Notes |
|-----------|--------|-------|
| /platform Mission Control hub | ✅ | All 13 module cards, live stats, plan gates |
| Sidebar navigation | ✅ | All built modules linked |
| Feature gate system | ✅ | entitlements/plans.py |
| Multi-tenant FAISS isolation | ✅ | Per-org index files + LRU cache |
| Supabase Auth + RLS | ✅ | |
| Rate limiting (slowapi) | ✅ | |
| SSO/SAML | ⬜ | Enterprise — later |
| Full audit log | ⬜ | Enterprise — later |
| Webhooks API | ⬜ | Business — later |

---

## What to Build Next (Priority Order)

### Tier 1 — Highest Impact, Closest to Done

#### 1. CASPER Phase 2 — Natural Language Query Bar
**What:** Add a `⌘K` command bar to `/platform` that lets any admin ask CASPER questions in plain English across all modules. "Show me all assets whose warranties expire this quarter." "Which vendors have contracts expiring in 30 days?"

**Why now:** Phase 0 already embedded all entities. The namespace search functions are live. The only thing missing is:
- `POST /api/casper/query` endpoint that embeds the query, routes to the right namespace(s), and returns structured results
- Frontend command palette component (headless UI combobox + ⌘K shortcut)
- Intent classifier to route asset_query | contract_query | ticket_query | cross_module

**Effort:** ~2 days  
**Files:** `backend/app/casper/query.py` (new) · `frontend/src/components/CommandBar.tsx` (new) · `frontend/src/app/(protected)/platform/page.tsx`

---

#### 2. ServiceHub — Employee Self-Service Portal
**What:** A `/portal` page (no login required) where employees can see a catalog of IT services (request a laptop, request software, VPN access, etc.) and submit requests that create tickets.

**Why now:** This directly closes the loop on the TicketPilot wedge. With ServiceHub, IT teams can share a portal link with the whole company. The Starter plan gets a real collaborative use case, not just an internal tool.

**Effort:** ~3 days  
**Spec:** [docs/modules/06_servicehub.md](modules/06_servicehub.md)  
**Migration needed:** `app.service_catalog` (form schema per service item)

---

#### 3. FlowBot — Automation Rules Engine
**What:** IF/THEN rule engine. "If ticket priority = urgent AND assignee is null → assign to on-call rep." "If ticket status = closed AND no CSAT → send CSAT request after 1 hour." Pure Python evaluator — no external lib.

**Why now:** Automation is the #1 feature request for any helpdesk product. It turns TicketPilot from a manual tool into an intelligent one.

**Effort:** ~2 days  
**Spec:** [docs/modules/10_flowbot.md](modules/10_flowbot.md)  
**Migration needed:** `app.automation_rules`

---

### Tier 2 — Business Plan Completeness

#### 4. IncidentBridge — Incident Management
**What:** P1 war room. When a ticket is marked critical, prompt to declare an incident. Incident has a live timeline, commander assignment, stakeholder comms, root cause form.

**Spec:** [docs/modules/08_incidentbridge.md](modules/08_incidentbridge.md)  
**Migration needed:** `app.incidents`

---

#### 5. StatusCast — Public Status Page
**What:** `/status` (or CNAME) — public uptime page auto-updated by IncidentBridge. Shows service status, 90-day uptime history.

**Depends on:** IncidentBridge (for incident data feed)  
**Spec:** [docs/modules/11_statuscast.md](modules/11_statuscast.md)

---

### Tier 3 — CASPER Phase 3 (Proactive Intelligence)

**What:** Background agents that run on a schedule, scan across module data, and write insights to `app.casper_insights`. The `/platform` hub surfaces these as alerts.

**Examples:**
- Warranty + Contract gap: "MacBook Pro M3 warranty expires July 1, Apple support contract expires June 15 — 16-day gap"
- License reclamation: "3 Adobe CC seats assigned to departed employees — $4,200/yr recoverable"
- Patch + ticket correlation: "Asset has 2 critical CVEs + 3 recent tickets about same symptom"
- Procurement → asset gap: "PO #2024-089 delivered 30 days ago — not logged in AssetLog"

**Infrastructure already in place:** `app.casper_insights`, `app.casper_agent_runs` (migration 0035 live)  
**Effort:** ~3 days  
**Files:** `backend/app/casper/agents.py` (new) · APScheduler (already in requirements?)

---

### Tier 4 — Enterprise Tier

#### PeopleSync (HR joiner/mover/leaver)
**Spec:** [docs/modules/09_peoplesync.md](modules/09_peoplesync.md)  
**Blocked by:** Needs FlowBot for checklist automation

#### SSO/SAML
**Library:** `python-saml` (MIT)  
**Depends on:** Nothing technically blocked, but low priority until Enterprise customers arrive

---

## Migration Log

| Migration | Description | Status |
|-----------|-------------|--------|
| 0001–0028 | Core platform (auth, tickets, KB, embeddings, notifications, SLA, entitlements) | ✅ Live |
| 0029 | Composite DB indexes | ✅ Live |
| 0030 | Materialized view — ticket counts | ✅ Live |
| 0031 | KnowBase articles | ✅ Live |
| 0032 | BillingVault | ✅ Live |
| 0033 | CASPER Foundation (entity_embeddings, casper_correlations, casper_tool_calls) | ✅ Live |
| 0034 | AssetLog (assets, software_licenses, asset_history, etc.) | ✅ Live |
| 0035 | CASPER Insights (casper_insights, casper_agent_runs) | ✅ Live |
| 0036 | ContractVault (vendors, contracts, contract_assets, contract_history) | ✅ Live |
| 0037 | ProcureFlow (purchase_requests) | ✅ Live |
| 0038 | PatchWatch (patch_records) | ✅ Live |
| 0039 | ChangeBoard (changes, change_blackouts) | ✅ Live |
| 0040 | ServiceHub (service_catalog) | ⬜ Not written |
| 0041 | FlowBot (automation_rules) | ⬜ Not written |
| 0042 | IncidentBridge (incidents) | ⬜ Not written |
| 0043 | PeopleSync (hr_events) | ⬜ Not written |

---

## How CASPER Connects Everything

```
User submits ticket
        ↓
TicketPilot creates ticket
        ↓
CASPER embeds ticket text → entity_embeddings
        ↓
CASPER retrieves:
  - KB chunks (for resolution steps)
  - Similar resolved tickets (for proven fixes)
  - Related assets (is this device under warranty?)
  - Related contracts (is there a support SLA?)
  - Related articles (is there a runbook for this?)
        ↓
RelatedEntitiesPanel shows connections in sidebar
        ↓
Rep resolves with full context, no tab-switching
```

**Future (Phase 2):**
```
Admin types "show me idle assets over $2000 in Engineering"
        ↓
⌘K CommandBar → POST /api/casper/query
        ↓
Intent: asset_query → search_asset_namespace()
        ↓
Returns structured asset cards with links
```

**Future (Phase 3):**
```
APScheduler runs every hour
        ↓
CASPER agents scan: warranty gaps, idle assets, unpatched CVEs, license waste
        ↓
Write to app.casper_insights
        ↓
/platform hub surfaces as alert cards
```

---

## Docs Index

| Doc | Purpose |
|-----|---------|
| [docs/sprint/README.md](sprint/README.md) | All sprint items with status |
| [docs/sprint/CASPER_PHASE0_FOUNDATION.md](sprint/CASPER_PHASE0_FOUNDATION.md) | CASPER wiring deep-dive |
| [docs/sprint/STRATA_MODULES_SPRINT.md](sprint/STRATA_MODULES_SPRINT.md) | CostLens/ProcureFlow/PatchWatch/ChangeBoard build notes |
| [docs/modules/](modules/) | Design specs for every module (13 docs) |
| [docs/01_SYSTEM_ARCHITECTURE_AND_TECH_STACK.md](01_SYSTEM_ARCHITECTURE_AND_TECH_STACK.md) | Full stack description |
| [docs/03_DATABASE_SCHEMA_AND_DATA_MODEL.md](03_DATABASE_SCHEMA_AND_DATA_MODEL.md) | Schema for all tables |
