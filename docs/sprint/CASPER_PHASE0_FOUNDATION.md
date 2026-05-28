# CASPER Phase 0 — Foundation Wire-Up

**Status:** ✅ Done  
**Sprint:** Pre-Month 2 — Internal Plumbing  
**Effort:** ~3 days

---

## What This Is

CASPER (Contextual Adaptive Scoring with Probabilistic Ensemble Ranking) existed and worked for TicketPilot, but was only half-wired. It could search the knowledge base and generate answers — but it knew nothing about assets, contracts, articles, or other tickets. It also had stale class names from the Gemini → Groq migration.

Phase 0 completes the wiring so every Strata module is visible to CASPER before any new module is built. Zero user-visible changes — this is internal plumbing that every future feature depends on.

---

## What It Touches

| File | Change |
|------|--------|
| `backend/app/ai.py` | Renamed `GeminiResponse → CASPERResponse`, `GeminiCitation → CASPERCitation`; dual-mode system prompt |
| `backend/app/casper/engine.py` | Added 4 new entity namespace registrations in `startup()` |
| `backend/app/casper/correlator.py` | `EntityNamespace` for asset / contract / article / ticket |
| `backend/app/casper/tools.py` | Added 5 module-specific CASPER tools |
| `backend/app/knowbase.py` | Added `embed_entity()` call after create/update article |
| `backend/app/assets.py` | `embed_entity()` after create/update asset (already wired) |
| `backend/app/contractvault.py` | `embed_entity()` after create/update contract (already wired) |
| `backend/app/tickets.py` | New `GET /api/tickets/{id}/correlations` endpoint |
| `frontend/.../tickets/[id]/page.tsx` | New `RelatedEntitiesPanel` in sidebar |

---

## 0.1 — Stale Class Rename

**Why it mattered:** `GeminiResponse` and `GeminiCitation` were defined in `ai.py` from when the LLM was Gemini. After the Groq migration, these names confused anyone reading the code — they referred to a model that's no longer in use.

**What changed:** Renamed to `CASPERResponse` and `CASPERCitation`. Backward-compat aliases kept:
```python
GeminiCitation = CASPERCitation   # remove after all callers updated
GeminiResponse = CASPERResponse
```

---

## 0.2 — Entity Namespace Registration

**Before:** `casper_engine.startup()` called only `_register_kb_namespace()`. CASPER could search knowledge base chunks and nothing else.

**After:** `startup()` calls all 5:
```python
await self._register_kb_namespace()
await self._register_asset_namespace()
await self._register_contract_namespace()
await self._register_article_namespace()
await self._register_ticket_namespace()
```

Each namespace's `search_fn` queries `app.entity_embeddings` filtered by `entity_type`, then joins to the entity table for metadata. The `format_fn` returns a list of `{"label": ..., "score": ..., "href": ..., "entity_type": ...}` results.

**Ticket namespace constraint:** Only `resolved` and `closed` tickets are searched — open tickets are noise. The intent is to surface *proven fixes*, not ongoing work.

---

## 0.3 — embed_entity in Every Module

When a new entity is created or updated, its text representation is embedded into Jina v5 and stored in `app.entity_embeddings`. This populates the FAISS index for that org so the namespace search functions can find it.

```python
# After creating an asset:
await casper_engine.embed_entity(
    entity_type="asset",
    entity_id=str(asset_id),
    text=f"{name} {category} {department} {notes}",
    org_id=str(org_id)
)
```

The `embed_entity` call runs in a background thread (via `asyncio.get_event_loop().run_in_executor`) so it never blocks the API response.

---

## 0.4 — Five New CASPER Tools

These tools are callable by CASPER mid-conversation. They're registered in `casper/tools.py` and the `build_default_registry()` function includes them automatically.

| Tool | What It Does | Key DB Query |
|------|-------------|-------------|
| `lookup_asset` | Find assets by name, tag, or serial | `ILIKE` on `name`, `asset_tag`, `specs::text` |
| `get_contract_status` | Active contracts for a vendor, nearest expiry | JOIN contracts + vendors by vendor name |
| `find_similar_resolved_tickets` | Resolved/closed tickets matching the symptom | `ILIKE` on title + description |
| `create_asset_ticket` | Create a ticket pre-linked to an asset | INSERT ticket + INSERT asset_tickets |
| `flag_contract_renewal` | Warn about upcoming contract expiry | INSERT system message into ticket thread |

**RBAC:** All tools require `required_role = "rep"`. Customers can't trigger tool calls even if they craft a message that would invoke one — the tool executor checks the caller's role before executing.

---

## 0.5 — Dual-Mode CASPER System Prompt

**Why two modes:** TicketPilot is the market entry wedge — a sharp, focused IT support desk. The system prompt for ticket chat must reflect that: direct, no ITIL jargon, SME-friendly. The Strata mode is broader — used when CASPER is queried across modules (not yet exposed to users, reserved for the `/api/casper/query` endpoint in Phase 2).

**`_build_system_prompt(tool_schemas=None, context="ticketpilot")`** — `backend/app/ai.py`

```
TicketPilot mode (default):
"You are CASPER, the AI assistant for TicketPilot — the smartest IT support desk for SMEs.
Your job is to help IT teams resolve support tickets faster with less back-and-forth.
...Be direct, practical, and SME-friendly. No ITIL jargon."

Strata mode:
"You are CASPER, the AI core of Strata — an IT operations platform for SMEs.
You can query and correlate across modules: TicketPilot, AssetLog, ContractVault, KnowBase, ProcureFlow.
Use the tools available to look up entities, surface insights, and take lightweight actions."
```

All existing ticket endpoints pass `casper_context="ticketpilot"` (default — no change in behaviour). The future `/api/casper/query` endpoint will pass `casper_context="strata"`.

---

## 0.6 — Related Entities Panel (Ticket Detail)

**`GET /api/tickets/{id}/correlations`** — `backend/app/tickets.py`

1. Fetches the ticket's `title + description`
2. Embeds it via Jina
3. Calls `casper_engine.correlator.correlate(q_emb, org_id, top_k_per_namespace=3)`
4. Filters out `kb_chunk` results (shown elsewhere in the sidebar) and the ticket itself
5. Returns `{"correlations": [{"entity_type", "entity_id", "label", "score", "href"}, ...]}`

**`RelatedEntitiesPanel`** — `frontend/.../tickets/[id]/page.tsx`

Renders in the ticket detail sidebar (below metadata, above activity timeline). Shows colored chips grouped by entity type:
- 📦 Blue — AssetLog entities
- 📄 Green — ContractVault contracts
- 🎫 Violet — Related tickets
- 📖 Indigo — KnowBase articles

Each chip is a link to the entity's detail page. Scores ≥ 80% are bold. Skeleton loaders while fetching.

---

## Verification

```bash
# 1. Create an asset → check entity_embeddings
SELECT * FROM app.entity_embeddings WHERE entity_type = 'asset' ORDER BY created_at DESC LIMIT 5;

# 2. Open a ticket whose text matches an asset name → RelatedEntitiesPanel should show the asset chip

# 3. Ask CASPER in a ticket: "Is this device under warranty?"
#    → Check app.casper_tool_calls for a lookup_asset call

# 4. Confirm no GeminiResponse/GeminiCitation in ai.py (only the alias lines)
grep -n "GeminiResponse\|GeminiCitation" backend/app/ai.py
```

---

## Why This Matters for the Roadmap

Without Phase 0, every new module is an island — it can store data but CASPER can't reason across modules. With Phase 0:
- CASPER can answer "Is the asset in this ticket under a support contract?" without being explicitly told
- The Related Entities panel makes connections visible without the user having to navigate
- Future Phase 2 (NL Queries) and Phase 3 (Proactive Intelligence) have the embedding infrastructure they need
