# DB Optimisation — Supabase Free Tier

## The problem
Supabase free tier allows **2 direct connections + ~20 pooler connections** via the transaction pooler (port 6543).
Our backend has two DB clients:
- `asyncpg` pool (async, used in main.py background tasks) — min=2, max=10
- `psycopg3` direct connects (sync, used in tickets.py, kb.py, organizations.py, etc.)

Under load both clients open connections simultaneously, easily exceeding the free tier limit and causing `too many connections` errors or timeouts.

## Target state
- Total concurrent connections to Supabase: **≤ 5**
- asyncpg pool: min=0, max=3
- psycopg3 pool: min=0, max=2
- No direct `psycopg.connect()` calls outside the pool
- Keepalive pings every 4 min (already in place)
- `connect_timeout=5` everywhere (already in place)
- `statement_timeout=8000` to kill runaway queries

## Changes needed

### 1. asyncpg pool (backend/app/db.py)
- Reduce max from 10 → 3
- Add `command_timeout=8` (kills queries running > 8s)
- Add `server_settings={"statement_timeout": "8000"}` 

### 2. psycopg3 pool (backend/app/tickets.py)
- Already min=0, max=5 — reduce max to 2
- Add `max_waiting=10` (queue requests rather than open new connections)

### 3. Consolidate all sync DB access through one shared pool
- Currently kb.py, organizations.py, observability.py, admin.py all call `psycopg.connect()` directly (no pool)
- Move them all to use the shared psycopg3 pool from tickets.py
- This is the biggest win — removes up to 8 simultaneous direct connections

### 4. Wake endpoint
- `GET /api/wake` — pre-warms asyncpg pool + runs `SELECT 1`
- Returns `{"ready": true, "db_latency_ms": N, "pool": "ok"}`
- Bookmark this URL to warm the system before demos

## Implementation log

### 1. asyncpg pool (`backend/app/db.py`)
- `min_size`: 2 → 0 (no background connections when idle)
- `max_size`: 10 → 3
- `command_timeout`: 30 → 8
- Added `server_settings['statement_timeout'] = '8000'` (kills runaway queries at DB level)

### 2. psycopg3 pool — extracted to `backend/app/db_sync.py` (NEW)
Single shared pool replacing the four independent direct-connect functions:

| File | Before | After |
|---|---|---|
| `tickets.py` | local pool, max=5 | imports from `db_sync` |
| `organizations.py` | `psycopg.connect()` per request | imports from `db_sync`, re-exports for `invites.py` |
| `kb.py` | `psycopg.connect()` per request | imports from `db_sync` |
| `observability.py` | `psycopg.connect()` per request (×2) | imports from `db_sync` |

Pool settings in `db_sync.py`:
- `min_size=0`, `max_size=2`, `max_waiting=10`
- `options="-c statement_timeout=8000"` on every connection
- `reconnect_timeout=60` — stops hammering Supabase after failure

### 3. Wake endpoint (`backend/app/main.py`)
`GET /api/wake` — pre-warms both pools, runs `SELECT 1`, returns latency:
```json
{"ready": true, "asyncpg": {"ok": true, "latency_ms": 1553}, "psycopg3": {"ok": true, "latency_ms": 1228}}
```
Bookmark `http://localhost:8000/api/wake` (or your Render URL + `/api/wake`) and hit it before demos.

### Before / After connection budget
| Pool | Before | After |
|---|---|---|
| asyncpg | min=2, max=10 | min=0, max=3 |
| psycopg3 (tickets) | min=0, max=5 | merged into db_sync |
| psycopg3 (organizations) | direct (unbounded) | merged into db_sync |
| psycopg3 (kb) | direct (unbounded) | merged into db_sync |
| psycopg3 (observability) | direct (unbounded) | merged into db_sync |
| **psycopg3 total** | **0–unlimited** | **0–2** |
| **Grand total max** | **10 + unlimited** | **5** |
