# P6 — Virtual Scroll

**Status:** ✅ Done  
**Sprint:** Month 2 — Speed Sprint  
**Depends on:** P5 SWR (done first — cleaner to add after SWR refactor)

---

## What This Is

The tickets page admin/rep desktop list was rendering all loaded tickets as DOM nodes simultaneously. Virtual scrolling renders only the ~20 rows currently visible in the viewport. As the user scrolls, old rows unmount and new rows mount — the DOM stays small regardless of list size.

---

## What Was Changed

| File | Change |
|------|--------|
| `frontend/src/app/(protected)/tickets/page.tsx` | Added `useVirtualizer` to admin/rep desktop list. Replaced `filteredTickets.map()` with virtualizer output inside a fixed-height scroll container. |
| `frontend/package.json` | Added `@tanstack/react-virtual@3` |

The rep page (`/rep`) already has `limit=20` pagination — virtual scroll there adds no value and was skipped.

---

## New Dependency

```
@tanstack/react-virtual@3   # MIT, ~3kb gzipped
```

---

## Implementation

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

const listParentRef = useRef<HTMLDivElement>(null)
const rowVirtualizer = useVirtualizer({
  count: tickets.length,
  getScrollElement: () => listParentRef.current,
  estimateSize: () => 52,   // estimated row height in px
  overscan: 5,              // extra rows above/below viewport
})
```

**Container structure:**
```tsx
<div ref={listParentRef} className="max-h-[640px] overflow-y-auto">
  {/* height = total virtual size (all rows stacked); must be inline — computed at runtime */}
  <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
    {rowVirtualizer.getVirtualItems().map((vItem) => {
      const ticket = tickets[vItem.index]
      return (
        <div
          key={ticket.id}
          /* transform = scroll offset per row; must be inline — changes on every scroll event */
          style={{ transform: `translateY(${vItem.start}px)` }}
          className="absolute top-0 left-0 w-full flex items-center gap-3 group"
        >
          {/* row content unchanged */}
        </div>
      )
    })}
  </div>
</div>
```

Only two `style` props remain inline — `height` (total virtual list size, grows as more tickets load) and `transform` (per-row scroll offset, recalculated on every scroll event). Both are computed at runtime by the virtualizer and cannot be expressed as static Tailwind classes.

---

## Why Only the Admin/Rep List

The tickets page has two render paths:
- **Admin/rep:** custom `.map()` list → now virtualized
- **Customer:** `DataTable` with `pageSize={10}` → already paginated, no need

The customer-facing `DataTable` shows 10 rows at a time and has its own pagination — virtual scroll would add complexity with no benefit.

---

## Performance Impact

| Org size | Before (DOM nodes) | After (DOM nodes) |
|----------|--------------------|--------------------|
| 20 tickets | 20 | ~20 visible + 10 overscan |
| 100 tickets | 100 | ~20 visible + 10 overscan |
| 500 tickets | 500 (slow render) | ~20 visible + 10 overscan |

The row count in the DOM stays constant at ~30 regardless of how many tickets are loaded. At the current API default of 20 tickets per response, the benefit is modest — but if the limit is raised or infinite scroll is added later, the page is already prepared.

---

## How to Verify

```bash
# In frontend dev server:
# 1. Log in as rep/admin
# 2. Navigate to /tickets
# 3. Inspect the DOM in DevTools — the .max-h-[640px] container
#    should contain only the visible rows (not all tickets)
# 4. Scroll down — rows should appear/disappear as you scroll
```
