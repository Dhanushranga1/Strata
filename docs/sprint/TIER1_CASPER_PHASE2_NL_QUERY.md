# Tier 1: CASPER Phase 2 — Natural Language Query Bar

**Status:** ✅ Shipped  
**Effort:** ~0.5 days  
**Gate:** No feature gate — available to all logged-in users

---

## What it does

A ⌘K command bar embedded in the Platform Mission Control page.  
Users type a plain-English question; CASPER embeds the query and runs it across every registered entity namespace — returning ranked entity cards the user can click to navigate.

**Example queries:**
- "MacBook Pro M3"
- "support contract expiring soon"
- "VPN setup guide"
- "laptop tickets from last month"

---

## Architecture

```
User types → 350ms debounce → POST /api/casper/query
    → embed query (Jina v3 1024-dim)
    → EntityCorrelator.correlate(q_emb, org_id, top_k=5)
        → kb_chunk namespace     (FAISS search)
        → asset namespace        (entity_embeddings cosine)
        → contract namespace     (entity_embeddings cosine)
        → resolved_ticket namespace
    → Sort by score DESC
    → Return EntityCard[]
Frontend renders clickable chip rows grouped by namespace
```

---

## Files

### Backend
| File | Change |
|------|--------|
| `backend/app/casper/query.py` | New — POST /api/casper/query endpoint |
| `backend/app/main.py` | Register `casper_query_router` |

### Frontend
| File | Change |
|------|--------|
| `frontend/src/components/CommandBar.tsx` | New — ⌘K palette with debounced search |
| `frontend/src/app/(protected)/platform/page.tsx` | Import and mount `CommandBar` in header |

---

## API

**POST** `/api/casper/query`  
Auth required. Org context required.

Request:
```json
{ "query": "MacBook Pro warranty", "top_k": 5 }
```

Response:
```json
{
  "results": [
    {
      "entity_type": "asset",
      "entity_id": "uuid",
      "label": "MacBook Pro M3 (IT-0041)",
      "score": 0.847,
      "href": "/assets/uuid",
      "namespace": "asset"
    }
  ],
  "query": "MacBook Pro warranty"
}
```

---

## UI Behaviour

- **Trigger:** ⌘K (Mac) / Ctrl+K (Win/Linux) anywhere on /platform, or click the search button in the header
- **Debounce:** 350ms after last keystroke before API call fires
- **Empty state:** "Ask anything — CASPER searches across all your data"
- **No results:** "No results for '{query}'"
- **Score:** Shown as percentage next to each result
- **Escape:** Closes the palette

---

## Namespaces active at launch

| Namespace | Entities | Populated by |
|-----------|----------|-------------|
| `kb_chunk` | KB article chunks | Existing KB upload flow |
| `asset` | Hardware/software assets | AssetLog create/update |
| `contract` | Vendor contracts | ContractVault create/update |
| `knowbase_article` | KnowBase articles | KnowBase publish |
| `resolved_ticket` | Closed tickets with resolutions | Ticket resolve |

---

## Phase 3 next steps

- Add `ticket` namespace (open tickets)
- Add `purchase_request` namespace (ProcureFlow)
- Move CommandBar to global layout so ⌘K works on any page, not just /platform
- Add keyboard navigation (arrow keys, enter to navigate)
