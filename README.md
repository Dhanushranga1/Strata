# Strata — SME IT Operations Platform

**The complete IT operations platform for small and medium enterprises.**

Strata brings ticketing, asset management, contracts, procurement, patch tracking, cost intelligence, change management, incident response, and HR IT automation into one place — AI-first, open-core, built for teams of 1–10 IT people managing 50–500 employees.

---

## Modules

| Module | What it does | Plan |
|--------|-------------|------|
| **TicketPilot** | AI-powered support tickets, SLA, canned responses, CSAT | Community |
| **KnowBase** | Searchable knowledge articles, FAISS-backed AI retrieval | Starter |
| **AssetLog** | Hardware/software inventory, QR codes, warranty alerts | Starter |
| **ContractVault** | Vendor directory, contract renewals, document links | Starter |
| **ProcureFlow** | Purchase requests → approvals → delivery → AssetLog | Starter |
| **ServiceHub** | Employee self-service portal, dynamic request forms | Starter |
| **PatchWatch** | Patch status by asset and severity, maintenance windows | Business |
| **CostLens** | Unused licenses, idle assets, renewal forecasts | Business |
| **ChangeBoard** | Lightweight RFC workflow, blackout periods, change calendar | Business |
| **IncidentBridge** | P1 war room, live timeline, stakeholder comms | Business |
| **FlowBot** | IF/THEN automation rules engine for ticket workflows | Business |
| **StatusCast** | Public status page, auto-updated by IncidentBridge | Business |
| **PeopleSync** | Joiner/Mover/Leaver IT checklists, HR webhook integration | Enterprise |

---

## Stack

- **Backend:** FastAPI · psycopg3 · Supabase/PostgreSQL · FAISS · Groq (llama-3.3-70b) · Jina embeddings
- **Frontend:** Next.js 15 · React 19 · Tailwind CSS · Framer Motion
- **Auth:** Supabase Auth (JWT)
- **AI:** RAG pipeline with HNSW vector search, BM25 hybrid retrieval, semantic cache

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- A Supabase project (free tier works)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your Supabase credentials
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

### Run migrations
```bash
cd backend
bash ../scripts/run-migrations.sh
```

---

## Self-Hosting (Docker)

```bash
cd infra
docker compose up --build
```

Runs backend on :8000, frontend on :3000, Nginx on :80. Set your env files in `backend/.env` and `frontend/.env.local` before building.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for AWS/VPS setup guide.

---

## Repository Layout

```
strata/
├── backend/
│   ├── app/
│   │   ├── modules/        ← new Strata modules (assetlog, contractvault, etc.)
│   │   ├── entitlements/   ← plan gating (community/starter/business/enterprise)
│   │   └── *.py            ← TicketPilot core (tickets, kb, sla, auth, orgs...)
│   ├── migrations/         ← numbered SQL migrations (0001–0030+)
│   │   └── fixes/          ← one-off SQL patches
│   └── demo/               ← demo seed data
├── frontend/
│   └── src/
│       ├── app/(protected)/  ← all authenticated pages
│       ├── components/       ← shared UI components
│       ├── hooks/            ← React hooks (useEntitlements, etc.)
│       └── lib/              ← API client, plan definitions
├── infra/
│   ├── docker-compose.yml  ← full stack for self-hosting
│   └── nginx.conf
├── docs/
│   ├── modules/            ← full spec for each Strata module
│   └── ...                 ← deployment, security, architecture guides
└── scripts/                ← migration runners, local dev utilities
```

---

## Module Specs

Detailed specs for every module (schema, API, frontend, feature gates, cross-module links) live in [docs/modules/](docs/modules/).

---

## Plans

| Feature | Community | Starter | Business | Enterprise |
|---------|-----------|---------|----------|------------|
| TicketPilot (core) | ✔ | ✔ | ✔ | ✔ |
| AI Assistant (CASPER) | ✘ | ✔ | ✔ | ✔ |
| KnowBase | ✘ | ✔ | ✔ | ✔ |
| AssetLog + ContractVault | ✘ | ✔ | ✔ | ✔ |
| ProcureFlow + ServiceHub | ✘ | ✔ | ✔ | ✔ |
| PatchWatch + CostLens | ✘ | ✘ | ✔ | ✔ |
| ChangeBoard + IncidentBridge | ✘ | ✘ | ✔ | ✔ |
| FlowBot + StatusCast | ✘ | ✘ | ✔ | ✔ |
| PeopleSync (HR) | ✘ | ✘ | ✘ | ✔ |
