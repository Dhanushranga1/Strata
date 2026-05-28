# P5 — SWR Frontend Data Layer

**Status:** ✅ Done  
**Sprint:** Month 2 — Speed Sprint  
**Effort:** ~1.5 hours  

---

## What This Is

Replace `useState + useEffect + fetch` with `useSWR` on the two most-visited pages. SWR (Stale-While-Revalidate) serves cached data instantly on navigation, then revalidates in the background.

**Before:** Navigate to `/tickets` → spinner → data loads. Navigate away and back → spinner again.  
**After:** Navigate to `/tickets` → data appears instantly (from cache) → silently re-fetches. No spinner on repeat visits.

---

## What Was Changed

| File | Change |
|------|--------|
| `frontend/src/app/(protected)/tickets/page.tsx` | Replaced `tickets` / `loading` / `error` state + loading `useEffect` with `useSWR`. `mutate()` replaces manual re-fetches after bulk actions. |
| `frontend/src/app/(protected)/rep/page.tsx` | Replaced `tickets` / `counts` / `total` / `ticketsLoading` / `countsLoading` state + `loadQueue` / `loadTickets` / `loadCounts` functions + load-on-filter-change + auto-refresh `setInterval` with two `useSWR` calls. |
| `frontend/package.json` | Added `swr@2` |

---

## New Dependency

```
swr@2   # MIT, ~5kb gzipped
```

---

## Tickets Page (`/tickets`)

**Before:**
```typescript
const [tickets, setTickets] = useState<TicketSummary[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  setLoading(true)
  api.get('/api/tickets?...', orgId).then(r => setTickets(r.items)).finally(...)
}, [statusFilter, debouncedSearch, isReady, orgId])
```

**After:**
```typescript
const { data, isLoading: loading, error, mutate } = useSWR(
  (isReady && orgId) ? ['tickets', orgId, statusFilter, debouncedSearch] : null,
  async ([, org, status, search]) => {
    const params = new URLSearchParams()
    if (status !== 'all') params.append('status_filter', status)
    if (search) params.append('q', search)
    return api.get<TicketListResponse>(`/api/tickets?${params}`, org)
  }
)
const tickets = data?.items ?? []
```

`mutate()` is called after bulk actions to invalidate and refetch in one line.

---

## Rep Page (`/rep`)

The rep page had two separate data streams (queue + counts) plus a 30-second auto-refresh interval.

**Before:**
```typescript
const [tickets, setTickets] = useState<QueueItem[]>([])
const [counts, setCounts] = useState<QueueCounts>(...)
const [total, setTotal] = useState(0)
// ... loadQueue, loadTickets, loadCounts functions
// ... useEffect for filter changes
// ... setInterval for 30s auto-refresh
```

**After:**
```typescript
const { data: queueData, isLoading: ticketsLoading, mutate: mutateQueue } = useSWR(
  queueKey,
  async ([, org, lane, off, q, mine]) => api.get(`/api/rep/queue?${params}`, org),
  { refreshInterval: 30000, onSuccess: () => setLastRefresh(Date.now()) }
)
const { data: countsData, mutate: mutateCounts } = useSWR(
  countsKey,
  async ([, org]) => api.get(`/api/rep/counts`, org),
  { refreshInterval: 30000 }
)
const tickets = queueData?.items ?? []
const counts  = countsData ?? defaultCounts
const total   = queueData?.total ?? 0
```

`refreshInterval: 30000` replaces the manual `setInterval`. `onSuccess` updates the "Last updated" timestamp the same way `setLastRefresh` did before.

---

## Key SWR Behaviours

| Behaviour | Effect |
|-----------|--------|
| Stale-while-revalidate | Old data shown instantly on revisit; background fetch updates silently |
| Key-based cache | Same key from different components = one request |
| Auto-revalidation on focus | Tab regain → fresh data (built-in) |
| `refreshInterval` | Replaces the manual `setInterval` on the rep page |
| `mutate()` | Triggers immediate refetch after a mutation (create, bulk action, ticket action) |

---

## Lines Removed

- **Tickets page:** ~20 lines (3 state vars + full `loadTickets` effect + manual re-fetch in `bulkAction`)
- **Rep page:** ~55 lines (5 state vars + `loadQueue` + `loadTickets` + `loadCounts` + two useEffects + 11 optimistic-update call sites replaced with `mutateQueue()`)

---

## How to Verify

```bash
# Start frontend dev server:
cd frontend && npm run dev

# 1. Visit /tickets — note time-to-data
# 2. Navigate away to /dashboard
# 3. Navigate back to /tickets — data appears without spinner (SWR cache)
# 4. Create a ticket — list updates immediately after mutate()
# 5. Visit /rep — note auto-refresh every 30s (visible in "Last updated" timestamp)
```
