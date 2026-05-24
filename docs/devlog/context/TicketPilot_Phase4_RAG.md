RAbsolutely—here’s the full, copy-paste friendly **Phase 4 (AI Chat with RAG per Ticket)** spec inline.

# TicketPilot — Phase 4 (AI Chat with RAG per Ticket)

**Goal:** Add AI-assisted replies inside each ticket using Retrieval-Augmented Generation (RAG) over the Phase-2 FAISS index. Persist AI messages with citations + confidence and surface a low-confidence hint for escalation. Keep it lean (no streaming).

---

## 0) Outcomes & Acceptance Criteria

**Outcomes**

* ✅ Backend endpoint to **generate an AI reply** on a ticket using RAG context.
* ✅ AI reply is **saved as a message** (`sender_role='ai'`) with **citations** and **confidence**.
* ✅ Retrieval pulls top-k chunks from **FAISS** (Phase 2) and fetches chunk text from DB.
* ✅ **PII scrubbing** is applied to the user query and retrieved context before LLM.
* ✅ UI: ticket detail page has **“Ask AI”** and renders citations + confidence.
* ✅ Low confidence yields `suggest_escalation=true` (used in Phase 5).

**Acceptance Checklist**

1. `POST /api/tickets/{id}/chat` returns `{ message_id, content, citations[], confidence, suggest_escalation }` and stores an AI message.
2. Response includes **at least one citation** when retrieval returns context.
3. Confidence ∈ \[0,1]; below threshold (e.g. 0.55) → `suggest_escalation: true`.
4. Unauthorized → 401/403; missing ticket → 404.
5. Frontend shows AI bubble, citations (collapsible), confidence badge; low confidence hint appears.

**Non-Goals**

* ❌ No streaming/SSE/WebSockets.
* ❌ No tool/function calls.
* ❌ No auto-escalation or assignment (Phase 5).
* ❌ No multi-store retrieval; use single FAISS index.

---

## 1) Tech & Versions

* **LLM:** Google Gemini (`gemini-1.5-pro` or `gemini-1.5-flash`) via `google-generativeai`.
* **Embeddings:** Reuse Google `text-embedding-004` (Phase 2).
* **Index:** FAISS (cosine via inner-product normalization), persisted from Phase 2.
* **Backend:** FastAPI (existing).
* **Frontend:** Next.js (extend ticket detail page).

---

## 2) Repository Changes

```
ticketpilot/
├─ backend/
│  ├─ app/
│  │  ├─ ai.py            # LLM wrapper (generate_completion)
│  │  ├─ rag.py           # retrieval pipeline (embed → FAISS → fetch → build context)
│  │  ├─ redact.py        # PII scrubbing helpers
│  │  ├─ citations.py     # labels for sources (optional helper)
│  │  ├─ tickets.py       # add POST /api/tickets/{id}/chat
│  │  ├─ embeddings.py    # (Phase 2) reused
│  │  ├─ store.py         # (Phase 2) reused
│  │  ├─ utils.py         # (Phase 2) reused
│  │  └─ schemas.py       # add ChatRequest/ChatResponse/Citation
│  └─ migrations/
│     └─ 0004_ai_chat.sql # extend messages + optional ai_runs table
└─ frontend/
   └─ app/(protected)/tickets/[id]/page.tsx  # extend UI: Ask AI + citations
```

---

## 3) Environment Variables (Backend)

Append to `backend/.env.example`:

```
# LLM generation
GENAI_MODEL=gemini-1.5-pro        # or gemini-1.5-flash
GENAI_TEMPERATURE=0.2
GENAI_MAX_OUTPUT_TOKENS=1024

# RAG controls
RAG_TOP_K=6
RAG_MIN_SCORE=0.25                # cosine similarity floor (0..1)
RAG_MAX_CONTEXT_CHARS=12000       # safety cap before LLM call

# Confidence & escalation
CONFIDENCE_MIN_CHUNKS=2
CONFIDENCE_THRESHOLD=0.55

# Simple rate limiting (per ticket)
CHAT_COOLDOWN_SECONDS=8
```

Reuse from previous phases: `GOOGLE_API_KEY`, FAISS paths, Supabase JWT secret, CORS origin.

---

## 4) Database Migration — `backend/migrations/0004_ai_chat.sql`

```sql
-- 1) Allow AI/system roles in messages
alter table app.messages
  drop constraint if exists app_messages_sender_role_check;
alter table app.messages
  add constraint app_messages_sender_role_check
  check (sender_role in ('customer','rep','system','ai'));

-- 2) Optional: metadata for citations & confidence
alter table app.messages
  add column if not exists meta jsonb default '{}'::jsonb;

-- 3) Optional audit table for observability
create table if not exists app.ai_runs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references app.tickets(id) on delete cascade,
  user_id uuid not null,
  model text not null,
  prompt_hash text not null,
  top_k int not null,
  confidence numeric,
  suggest_escalation boolean,
  input_chars int,
  output_chars int,
  latency_ms int,
  created_at timestamptz default now()
);
create index if not exists idx_ai_runs_ticket_time on app.ai_runs(ticket_id, created_at desc);
```

---

## 5) Backend Modules

### 5.1 `redact.py` — PII scrubbing

```python
import re
EMAIL = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
PHONE = re.compile(r'(?<!\d)(?:\+?\d{1,3}[-. ]?)?(?:\(?\d{3}\)?[-. ]?)?\d{3}[-. ]?\d{4}(?!\d)')
CARD  = re.compile(r'\b(?:\d[ -]*?){13,19}\b')

def scrub(text: str) -> str:
  text = EMAIL.sub('[email]', text)
  text = PHONE.sub('[phone]', text)
  text = CARD.sub('[card]', text)
  return text
```

### 5.2 `ai.py` — LLM wrapper

```python
import os, time, hashlib
import google.generativeai as genai

MODEL = os.getenv("GENAI_MODEL", "gemini-1.5-pro")
TEMP = float(os.getenv("GENAI_TEMPERATURE", "0.2"))
MAX_OUT = int(os.getenv("GENAI_MAX_OUTPUT_TOKENS", "1024"))

def init():
  key = os.getenv("GOOGLE_API_KEY")
  if not key: raise RuntimeError("GOOGLE_API_KEY is required")
  genai.configure(api_key=key)

SYSTEM_PROMPT = """You are TicketPilot, a helpful support assistant.
- Answer ONLY from the provided CONTEXT.
- If the answer is not in CONTEXT, say you don't have enough information.
- Cite sources using bracketed numbers [1], [2], etc. matching the SOURCES.
- Keep answers concise and actionable.
"""

def generate_completion(context: str, question: str, sources: list[str]) -> tuple[str,int]:
  init()
  prompt = f"""{SYSTEM_PROMPT}

CONTEXT:
{context}

SOURCES:
{chr(10).join(f"[{i+1}] " + s for i,s in enumerate(sources))}

QUESTION:
{question}

RESPONSE:"""
  start = time.time()
  model = genai.GenerativeModel(MODEL)
  res = model.generate_content(prompt, generation_config={"temperature": TEMP, "max_output_tokens": MAX_OUT})
  latency = int((time.time() - start) * 1000)
  text = getattr(res, "text", "") or (res.candidates[0].content.parts[0].text if getattr(res, "candidates", None) else "")
  return text, latency
```

### 5.3 `rag.py` — retrieval

```python
import os
from typing import List, Dict, Tuple
from .embeddings import embed_texts
from .store import search_vectors

TOP_K = int(os.getenv("RAG_TOP_K", "6"))
MIN_SCORE = float(os.getenv("RAG_MIN_SCORE", "0.25"))
MAX_CTX = int(os.getenv("RAG_MAX_CONTEXT_CHARS", "12000"))

def retrieve(q: str, fetch_chunk_fn) -> tuple[list[dict], list[str], str, list[float], list[int]]:
  # 1) embed query and FAISS search
  vec = embed_texts([q])[0]
  scores, ids = search_vectors(vec, k=TOP_K)
  # 2) filter low scores and invalid ids
  pairs = [(s, i) for s, i in zip(scores, ids) if s >= MIN_SCORE and i >= 0]
  faiss_ids = [i for _, i in pairs]
  top_scores = [s for s, _ in pairs]
  # 3) fetch chunk rows for these faiss ids (user-supplied callback; must preserve order)
  chunks = fetch_chunk_fn(faiss_ids)  # each: {chunk_id, doc_id, text, faiss_id, title?}
  # 4) build context and sources
  ctx_parts, sources = [], []
  for rank, (s, fid, ch) in enumerate(zip(top_scores, faiss_ids, chunks), start=1):
    title = ch.get("title") or ch.get("doc_title") or f"doc:{ch['doc_id'][:8]}"
    sources.append(f"{title} (faiss:{fid}, score={s:.2f})")
    ctx_parts.append(f"[{rank}] { (ch['text'] or '').strip() }")
  context = ("\n\n").join(ctx_parts)
  if len(context) > MAX_CTX:
    context = context[:MAX_CTX] + "\n…"
  return chunks, sources, context, top_scores, faiss_ids
```

### 5.4 `schemas.py` additions

```python
from pydantic import BaseModel
from typing import List, Optional

class ChatRequest(BaseModel):
  query: str

class Citation(BaseModel):
  label: str
  doc_id: Optional[str] = None
  chunk_id: Optional[str] = None
  faiss_id: Optional[int] = None
  score: Optional[float] = None

class ChatResponse(BaseModel):
  message_id: str
  content: str
  citations: List[Citation]
  confidence: float
  suggest_escalation: bool
```

---

## 6) Route — `POST /api/tickets/{ticket_id}/chat`

**Auth:** owner or rep/admin (same rule as view/post message).

**Request**

```json
{ "query": "How do I reset my password?" }
```

**Processing Steps**

1. **Access check**: owner or rep/admin → else 403.
2. **Rate-limit per ticket** using in-memory map keyed by `ticket_id` (ok for dev) and `CHAT_COOLDOWN_SECONDS`; else 429.
3. **Scrub PII** on the query (`redact.scrub`).
4. **Retrieve**: embed query → FAISS top-k → fetch chunks by `faiss_id` with SQL join to get `{chunk_id, doc_id, text, title}`.
5. Build **context** + **sources** (ranked snippets).
6. **Scrub PII** on snippets (defense in depth).
7. **LLM**: `generate_completion(context, query, sources)`.
8. **Compute confidence**:

   * base = mean(top 3 scores) if present else 0
   * minus 0.10 if the model output contains no `[n]` citation markers
   * clamp to \[0,1]
9. `suggest_escalation = (confidence < CONFIDENCE_THRESHOLD) or (len(chunks) < CONFIDENCE_MIN_CHUNKS)`.
10. **Persist message** in `app.messages` with `sender_role='ai'`, body=`model_output`, and `meta` JSON:

    ```json
    {
      "citations": [{ "label": "[1] …", "doc_id": "…", "chunk_id": "…", "faiss_id": 123, "score": 0.71 }],
      "confidence": 0.62,
      "model": "gemini-1.5-pro"
    }
    ```

    Update `tickets.message_count += 1` and `tickets.last_message_at = now()`.
11. (Optional) Insert row in `app.ai_runs` for observability (latency, tokens/chars, etc).

**Response**

```json
{
  "message_id": "…",
  "content": "Here’s how to reset your password… [1]",
  "citations": [{ "label": "[1] KB Handbook: Account", "doc_id": "…", "chunk_id": "…", "faiss_id": 123, "score": 0.71 }],
  "confidence": 0.62,
  "suggest_escalation": false
}
```

**Errors**

* 401/403/404 as applicable.
* 429 if cooldown active.
* 502 for LLM errors (wrap and map SDK failures).

---

## 7) Frontend Changes (ticket detail page)

**UI Additions**

* **Ask AI** box under the human composer:

  * Input (single line or textarea) + “Ask AI” button.
  * Disabled while generating; shows “Generating…” state.
* AI message bubble shows:

  * Model response text (basic markdown ok).
  * **Citations toggle**: list like `[1] Source Title (score 0.71)`.
  * **Confidence badge** e.g., “Confidence: 0.62”.
  * If `suggest_escalation` → show a subtle banner “Low confidence. Consider escalating.” (wire button in Phase 5).

**API call**

```ts
await apiPost(`/api/tickets/${ticketId}/chat`, { query })
```

**Notes**

* No streaming; one request → one AI message.
* Keep styles consistent with existing message bubbles.

---

## 8) SQL Helpers (examples)

**Fetch chunks by faiss ids (preserving order):**

```sql
select c.id as chunk_id, c.doc_id, c.text, c.faiss_id, d.title
from app.chunks c
join app.documents d on d.id = c.doc_id
where c.faiss_id = any(:faiss_ids)
order by array_position(:faiss_ids, c.faiss_id);
```

**Insert AI message with metadata:**

```sql
insert into app.messages (ticket_id, sender_id, sender_role, body, created_at, meta)
values (:ticket_id, :user_id, 'ai', :body, now(), :meta::jsonb)
returning id;
```

---

## 9) Testing (cURL)

```bash
TOKEN="..."
curl -X POST "http://127.0.0.1:8000/api/tickets/<ticket_id>/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the refund policy for cancelled orders?"}'
```

Expect `200` with `message_id`, `content`, `citations[]`, `confidence`, `suggest_escalation`.

---

## 10) Troubleshooting

* **0 citations / low confidence:** Verify Phase 2 vectors exist and `chunks.faiss_id` mapping is set. Check `RAG_MIN_SCORE`.
* **429 cooldown:** Adjust `CHAT_COOLDOWN_SECONDS` or wait.
* **502 model errors:** Confirm `GOOGLE_API_KEY`, `GENAI_MODEL`, and request size (< `RAG_MAX_CONTEXT_CHARS`).
* **403:** Only ticket owner or rep/admin may call the endpoint.

---

## 11) What’s Next (Phase 5 Preview)

* Rep Console + escalation flow: `POST /api/tickets/{id}/escalate` → status `escalated`.
* Assign/close actions, rep reply UX improvements, KB ingest modal for reps.
* “Needs Attention” lane showing low-confidence tickets.

---

If you’d like, I can also generate the **agent prompt** for Phase 4 again (short copy-paste) or move on and prep **Phase 5 (Rep Console & Escalation)**.
