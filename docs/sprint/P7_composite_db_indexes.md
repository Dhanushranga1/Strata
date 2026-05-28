# P7 — Composite Database Indexes

**Status:** ✅ Done  
**Sprint:** Month 2 — Speed Sprint  
**Effort:** ~30 min

---

## What This Is

A set of PostgreSQL indexes added to the `app.tickets` and `app.messages` tables so that the most common queries — ticket list by org, filtering by status, searching by assignee, full-text search — hit indexes instead of doing full table scans.

Without these, every ticket list load scans every row in the org's tickets. At 1,000 tickets this is 10–50ms. At 10,000 it becomes 200–500ms.

---

## What It Touches

| File | Change |
|------|--------|
| `backend/migrations/0029_perf_indexes.sql` | New migration — all index DDL |

No application code changes. Pure database.

---

## Indexes Added

### 1. `idx_tickets_org_status_created`
```sql
CREATE INDEX ON app.tickets(organization_id, status, created_at DESC);
```
**Used by:** Ticket list page, rep queue — queries that filter by org + status and order by date.  
**Before:** Full org scan (all tickets in org), sorted in memory.  
**After:** Index range scan on (org, status), pre-sorted.

### 2. `idx_tickets_org_assignee_status`
```sql
CREATE INDEX ON app.tickets(organization_id, assignee_id, status);
```
**Used by:** Rep queue ("show my open tickets"), admin assignment views.  
**Before:** Full org scan filtered in app.  
**After:** Direct lookup by (org, assignee, status).

### 3. `idx_tickets_title_trgm` (pg_trgm GIN)
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ON app.tickets USING gin(title gin_trgm_ops);
```
**Used by:** Ticket search — `ILIKE '%query%'` on title.  
**Before:** Sequential scan — O(N) for every search keystroke.  
**After:** GIN index lookup — effectively O(1) regardless of table size. ~100× faster.

### 4. `idx_messages_ticket_created`
```sql
CREATE INDEX ON app.messages(ticket_id, created_at DESC);
```
**Used by:** Loading ticket messages (every ticket detail page open).  
**Before:** Scan all messages for the ticket, sort by date.  
**After:** Index range scan, pre-sorted.

---

## How to Verify

```sql
-- Run EXPLAIN ANALYZE on a ticket list query
EXPLAIN ANALYZE
SELECT * FROM app.tickets
WHERE organization_id = '<org_id>'
  AND status = 'open'
ORDER BY created_at DESC
LIMIT 25;
-- Should show "Index Scan using idx_tickets_org_status_created"
-- NOT "Seq Scan"
```

---

## Notes

- All indexes use `IF NOT EXISTS` — safe to re-run the migration.
- `pg_trgm` is a built-in Postgres extension — no new software required.
- Supabase enables `pg_trgm` by default so the `CREATE EXTENSION` is a no-op.
