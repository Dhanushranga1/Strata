# P8 — Materialized View: Ticket Counts Dashboard

**Status:** ✅ Done (pg_cron auto-refresh pending Supabase dashboard enable)  
**Sprint:** Month 2 — Speed Sprint  
**Effort:** ~45 min

---

## What This Is

A PostgreSQL materialized view (`app.mv_ticket_counts`) that pre-computes ticket counts grouped by organization and status. The platform hub page (`/platform`) and any dashboard summary cards read from this view instead of running live `COUNT(*)` aggregations on every page load.

---

## What It Touches

| File | Change |
|------|--------|
| `backend/migrations/0030_mv_dashboard.sql` | Creates the MV, its unique index, and the pg_cron schedule |
| `backend/app/tickets.py` | `GET /api/tickets/platform-stats` — reads from MV, falls back to live query |

---

## The Materialized View

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS app.mv_ticket_counts AS
SELECT
    organization_id,
    status,
    COUNT(*)                                                        AS ticket_count,
    COUNT(*) FILTER (WHERE priority = 'urgent')                    AS urgent_count,
    COUNT(*) FILTER (WHERE priority = 'high')                      AS high_count,
    COUNT(*) FILTER (WHERE is_overdue = true
                      AND status NOT IN ('resolved','closed'))      AS overdue_count
FROM app.tickets
GROUP BY organization_id, status;

CREATE UNIQUE INDEX ON app.mv_ticket_counts(organization_id, status);
```

The unique index allows `REFRESH MATERIALIZED VIEW CONCURRENTLY` — the view can be refreshed without locking reads.

---

## Auto-Refresh (pg_cron)

```sql
SELECT cron.schedule(
    'refresh-mv-ticket-counts',
    '*/5 * * * *',
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY app.mv_ticket_counts $$
);
```

**Status:** The `cron.schedule()` call requires `pg_cron` enabled in Supabase.  
**To enable:** Supabase Dashboard → Database → Extensions → search "pg_cron" → Enable.  
After enabling, re-run the `cron.schedule()` line manually in the SQL editor.

---

## The Platform Stats Endpoint

`GET /api/tickets/platform-stats` (in `backend/app/tickets.py`)

**Logic:**
1. Try reading from `mv_ticket_counts` for the org
2. Aggregate counts into `{"stats": ["14 open tickets", "2 overdue"], "health": "warning"}`
3. If the MV query fails for any reason (e.g., MV not yet created), roll back and fall back to a live `GROUP BY` query
4. Return `ModuleStats` shape: `{stats: string[], health: "healthy"|"warning"|"critical"}`

**Health logic:**
- `critical` — any overdue tickets
- `warning` — any urgent tickets
- `healthy` — everything else

---

## Performance Impact

| Scenario | Before | After |
|----------|--------|-------|
| Dashboard load (1 org, 5k tickets) | 5–8 live COUNT queries | 1 indexed lookup |
| Dashboard load (50 orgs concurrent) | 250–400 queries | 50 indexed lookups |
| Data freshness | Real-time | Max 5 min stale |

The 5-minute staleness is acceptable for a summary dashboard — individual ticket pages still show live data.

---

## How to Verify

```sql
-- Check the MV exists and has data
SELECT * FROM app.mv_ticket_counts LIMIT 10;

-- Check the cron job is scheduled (after enabling pg_cron)
SELECT * FROM cron.job WHERE jobname = 'refresh-mv-ticket-counts';
```

```bash
# Hit the endpoint
curl http://localhost:8000/api/tickets/platform-stats \
  -H "Authorization: Bearer <token>" \
  -H "X-Organization-ID: <org_id>"
# Expected: {"stats": ["N open tickets", ...], "health": "healthy"|"warning"|"critical"}
```
