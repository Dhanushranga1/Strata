Awesome—here’s the deep-dive you asked for. First is a **complete, developer-facing context doc** that explains the intended RAG system, all AI features, where they live in your backend/frontend, how they interact, what to log, and how to score/guard responses. Then you’ll get a **copy-paste agent prompt** that tells your AI agent to audit your codebase, compare it to this spec (and the Phase 1–5A specs), and implement anything missing.

---

# TicketPilot — AI & RAG System (Authoritative Context for Build & Audit)

**Models in use**

* **LLM (generation):** Google Gemini `gemini-1.5-pro` (quality) and `gemini-1.5-flash` (latency) via `google-generativeai`.
* **Embeddings (retrieval):** Google **text-embedding-004** (768-dim), as implemented in Phase 2.

**Subsystems touched**

* Knowledge Base (Phase 2): ingestion, chunking, embeddings, FAISS.
* Ticketing (Phase 3): tickets, messages.
* AI Chat (Phase 4): `/api/tickets/{id}/chat`, RAG pipeline, citations, confidence, escalation suggestion.
* Rep Console (Phase 5): queues, escalation actions, auto-flagging on low confidence / AI suggestion.
* Roles & Admin (Phase 5A): who can ingest KB, who can see rep console.

---

## 1) What “RAG per Ticket” Means Here

**Goal:** Inside any ticket, reps (and customers, if allowed) can ask AI to draft a reply that is **grounded** in your org’s knowledge base—never “freewheel.” The AI response must:

1. Be **ticket-aware** (read the last N messages and ticket metadata),
2. Use **retrieved context** (FAISS top-K chunks from Phase 2),
3. Return **citations** (source ↔ chunk ↔ similarity),
4. Include **confidence scoring** and **escalation hinting**,
5. Persist as an **AI message** in the ticket’s thread with structured `meta`.

**Minimal promise:** If the KB doesn’t support the answer, the model should say so clearly and suggest next steps, **not invent facts**.

---

## 2) End-to-End Flow (Sequence)

```
User → UI (“Ask AI”) → POST /api/tickets/{id}/chat
  └─ server:
     1) Authz: user can see this ticket? (Phase 3)
     2) Safety: scrub PII in inputs (Phase 4 `redact.py`)
     3) Retrieve:
        - Embed (text-embedding-004) query (or use query+recent thread summary)
        - FAISS cosine/IP top-K lookup (Phase 2 `store.py`)
        - Fetch chunk texts + doc meta, dedupe, cap by char budget
     4) Assemble prompt:
        - System prompt (support policy, tone, refusal policy, citation rules)
        - Ticket context (title, status, last M messages)
        - KB snippets (ranked, labeled, capped by `RAG_MAX_CONTEXT_CHARS`)
        - User query
     5) Generate (Gemini 1.5):
        - Choose `pro` vs `flash` by latency/size policy
        - Temperature ~0.1, max_tokens ~500 (env driven)
     6) Post-process:
        - Extract references (citations)
        - Score confidence (heuristics + LLM self-rating)
        - If confidence < threshold → suggest escalation
     7) Persist:
        - Insert AI message into `app.messages` (sender_role='ai', `meta` JSONB includes citations+confidence)
        - Append to `app.ai_runs` audit row
        - If suggest_escalation & ticket not closed → set `needs_attention = true` + system message
     8) Respond:
        - Return ChatResponse { text, citations[], confidence, suggest_escalation }
```

---

## 3) Components & Contracts

### 3.1 Knowledge Base (Phase 2 recap)

* **Ingestion** `POST /api/kb/ingest` (rep-only):

  * Accepts file upload or `raw_text`.
  * Reads text (`utils.py`—pdf/txt/md/docx), normalizes, dedup (doc + chunk SHA256).
  * Chunks: windowed 2400 chars, 400 overlap (env overrides).
  * Embeds: `text-embedding-004` (768d), **normalize vectors** for cosine/IP.
  * Store: FAISS `IndexFlatIP` on disk; JSON map chunk\_id↔faiss\_id; DB rows in `app.documents` and `app.chunks`.

* **Search** `GET /api/kb/search?q=&k=`:

  * For diagnostics. Semantically search KB and return snippet previews.

* **Stats** `GET /api/kb/stats`:

  * Total docs/chunks.

**Expected files:** `utils.py`, `chunker.py`, `embeddings.py`, `store.py`, `kb.py`, migrations `0002_kb.sql`.

### 3.2 Ticketing (Phase 3)

* `app.tickets` and `app.messages` with UUIDs, indexes, triggers for counts/timestamps.
* Endpoints:

  * `POST /api/tickets` (create), `GET /api/tickets` (list), `GET /api/tickets/{id}` (detail+messages),
  * `POST /api/tickets/{id}/messages` (add user/rep/system/ai message).

### 3.3 AI Chat (Phase 4)

* **Endpoint:** `POST /api/tickets/{id}/chat`
* **Schemas (example)**:

  * `ChatRequest`: `{ query: string, top_k?: number, temperature?: number }`
  * `Citation`: `{ doc_id: string, chunk_id: string, title?: string, score?: number }`
  * `ChatResponse`: `{ text: string, citations: Citation[], confidence: number, suggest_escalation: boolean }`
* **Files:** `ai.py` (Gemini adapter), `rag.py` (retrieval + prompt assembly), `redact.py` (PII scrub).
* **DB extension:** `app.messages.sender_role` supports `'ai'`, `app.messages.meta` JSONB.
* **Observability:** `app.ai_runs` (model, prompt\_hash, top\_k, confidence, suggest\_escalation, sizes, latency).

### 3.4 Rep Console Integration (Phase 5)

* **Auto-flagging patch:** If `suggest_escalation=true` for `/chat`, set `tickets.needs_attention=true` and insert a system message like:

  * `"[system] AI suggested escalation (confidence <0.xx>)"`

### 3.5 Admin / Roles (Phase 5A)

* KB ingestion must be **rep-only**.
* Rep console is **rep/admin only**.
* Customers can **request rep**; admins can **grant roles**. (Does not impact RAG directly, but enforces access.)

---

## 4) Retrieval Details (What “Good RAG” Requires)

### 4.1 Query Formation

* **Input sources**:

  * The explicit `query` from the user **and**
  * A short **thread summary** from the last M messages (e.g., last 6), obtained with a tiny LLM pass or a deterministic heuristic (trim/strip quotes).
* **Final retrieval query**:

  * Prefer the explicit query; if it’s too short/vague, concatenate with the one-line thread summary (“contextualized query”).
  * Hard limit: 1000 chars (return 422 if exceeded; Phase 6 guard).

### 4.2 Embedding & Vector Search

* **Embedding model:** `text-embedding-004` → 768D vector.
* **Normalize** vectors (unit length) to use FAISS `IndexFlatIP` as cosine similarity.
* **Top-K:** default `RAG_MAX_CHUNKS=5` (env).
* **Score threshold:** discard hits with similarity < 0.75 (tunable).
* **Dedupe** near-duplicates by chunk\_hash or high mutual similarity.

### 4.3 Context Construction

* **Character budget:** `RAG_MAX_CONTEXT_CHARS=2000` (env).
* **Ranking:** by similarity (desc); break ties by recency if available.
* **Formatting:** numbered blocks with IDs for citation alignment, e.g.:

```
[1] Title: Refund Policy (doc: 7b3..., chunk: c12...)
"... text snippet ..."
(similarity=0.88)

[2] Title: Shipping SLA (doc: 9e1..., chunk: a02...)
"... text snippet ..."
(similarity=0.83)
```

* **Ticket context:** include title, status, and the last M messages as a short summary or bullet list (limit to \~800 chars).

### 4.4 Prompt Template (System + User)

**System Prompt (core rules):**

* Role: “You are TicketPilot AI assistant for customer support.”
* Goals:

  1. Cite facts from provided **KB context** only; no external facts.
  2. If KB lacks an answer, say so and propose next steps or ask clarifying questions.
  3. Prefer concise, stepwise answers; for policies, quote key lines with citations.
  4. Redact or omit PII in outputs; never echo full credit cards, etc.
  5. Always output **“References”** with bracketed IDs from the context or state **“No relevant sources found.”**
  6. Return an internal “confidence” rating from 0.0–1.0 in hidden XML (captured via parsing), based on coverage and agreement of sources.
  7. If confidence < `RAG_CONFIDENCE_THRESHOLD` (e.g., 0.3), propose escalation.

**User Prompt:**

* Short “Task” line with the user’s query.
* “Ticket Summary” line.
* “Context (do not assume beyond this):” with the numbered snippets.

**Model choice:**

* `gemini-1.5-pro` when: large context (≥ 1200 chars), legal/policy answers, multi-part instructions.
* `gemini-1.5-flash` when: short Q\&A, simple policy lookup, or mobile-light requests.

**Generation params (env-driven defaults):**

* `temperature=0.1`, `max_output_tokens=500`, `top_p=1.0`.
* Disable unsafe creative features; keep deterministic tone.

### 4.5 Post-processing

* **Citations extraction:**

  * Parse the answer: look for `[1]`, `[2]`… present in “References” section; map to doc\_id/chunk\_id/scores from retrieval.
  * If the LLM forgets to include references but retrieval happened → add them anyway below the answer (“Autogenerated references”).
* **Confidence scoring (hybrid):**

  * **Heuristics:** mean(top-K similarity) × coverage\_factor × agreement\_factor.

    * `coverage_factor`: 1.0 if ≥2 snippets used; else 0.7.
    * `agreement_factor`: 1.0 if multiple sources agree (LLM-rated), else 0.8.
  * **LLM self-rating:** ask model in hidden footer: `<confidence>0.42</confidence>`.
  * Final: `0.5 * heuristic + 0.5 * llm_confidence`, clipped to \[0,1].
* **Escalation:**

  * `suggest_escalation = (final_confidence < RAG_CONFIDENCE_THRESHOLD)` (default 0.3).
  * Don’t escalate closed tickets; otherwise set `needs_attention=true` and add system message.

### 4.6 Persistence

* Insert AI message (`sender_role='ai'`, `body` = final text, `meta` JSONB):

```json
{
  "citations": [
    { "doc_id": "uuid", "chunk_id": "uuid", "title": "Refund Policy", "score": 0.88 }
  ],
  "confidence": 0.42,
  "model": "gemini-1.5-pro",
  "top_k": 5,
  "retrieval": { "query": "x", "used_chunks": 3, "mean_similarity": 0.81 },
  "suggest_escalation": true
}
```

* Insert `app.ai_runs` row for observability with latency and prompt\_hash.

---

## 5) Endpoint Map & Expected Behaviors

### 5.1 Backend

* **`POST /api/kb/ingest`** (rep-only)

  * Validates file type/size, normalizes text, chunk+embed, FAISS update, DB rows.
  * Returns `{ document_id, chunks_ingested, vectors_added }`.

* **`GET /api/kb/search?q=&k=`** (auth)

  * Returns top-K matches: `{ faiss_id, similarity, document_id, chunk_id, text_preview }`.

* **`POST /api/tickets/{id}/chat`** (auth for ticket)

  * Guard: cooldown (8s), query length ≤ 1000.
  * RAG pipeline; returns `{ text, citations[], confidence, suggest_escalation }`.
  * Persists AI message + ai\_runs; may set `needs_attention=true` and add system message when `suggest_escalation`.

* **Rep console** `POST /api/rep/tickets/{id}/acknowledge|status|escalate|assign|priority` (rep/admin)

  * Acknowledge clears `needs_attention`.
  * Status transitions validated; escalate sets status='escalated' & needs\_attention=true.

* **Admin** `/api/admin/*` (Phase 5A)

  * Role management and (optional) role request approval.

**Edge-case behaviors to verify in code:**

* Chat on **empty KB** returns low confidence with “No relevant sources found.”
* Embedding API failures → graceful 503 with retry-after.
* FAISS map sync: ensure `faiss_id` mapping persisted after restart.
* Rate limit: 8s cooldown per ticket (per user) enforced server-side, returns 429 envelope.

### 5.2 Frontend

* **Ticket Detail** `/tickets/[id]`:

  * “Ask AI” form with clear cooldown state (disabled + countdown).
  * AI bubbles render **citations** (expandable “Sources”), **confidence** badge, and **escalation hint**.

* **Rep Console** `/rep`:

  * Needs Attention lane shows tickets flagged by AI.
  * Inline actions: Acknowledge (clears flag), Escalate (dialog with reason), Resolve/Close, Assign to me.

* **KB Ingest Modal**:

  * Upload/paste, success toasts with counts.

* **Admin / Roles**:

  * Not directly AI, but ensures who can ingest KB & see `/rep`.

---

## 6) Safety, Guardrails, & Quality

* **PII scrubbing** (Phase 4 `redact.py`):

  * Emails, phone numbers, credit card patterns removed or masked before LLM.
* **Refusals**:

  * If KB doesn’t cover, answer: “I don’t have a reliable source in the knowledge base for X…” + suggested next steps.
* **Formatting**:

  * Short bullet answers; include references.
* **Language**:

  * Mirror user language (if detectable) or default to English.

---

## 7) Confidence & Escalation (Concrete Numbers)

* **Similarity threshold:** 0.75 (drop below).
* **Coverage requirement:** use ≥2 snippets where possible.
* **LLM self-confidence:** parse from `<confidence>` (0.0–1.0).
* **Final confidence:** `(heuristic + self)/2`.
* **Escalation threshold:** `RAG_CONFIDENCE_THRESHOLD = 0.30` (env).
* **Cooldown:** `RATE_LIMIT_SECONDS = 8` (env).

---

## 8) Observability & Logs

* **`app.ai_runs`** stores: `ticket_id`, `user_id`, `model`, `prompt_hash`, `top_k`, `confidence`, `suggest_escalation`, `input_chars`, `output_chars`, `latency_ms`.
* Log **request\_id** (Phase 6), and **mask PII** in logs.
* For audits, reconstruct ChatResponse by joining latest message meta with ai\_runs.

---

## 9) Gap-Audit Checklist (What your agent must verify)

**A. Files present & wired**

* `backend/app/ai.py` (Gemini wrapper; model switch `pro|flash`)
* `backend/app/rag.py` (retrieval + prompt builder + scoring)
* `backend/app/redact.py` (PII)
* `backend/app/kb.py` (ingest/search/stats)
* `backend/app/store.py` (FAISS CRUD; normalize)
* `backend/app/embeddings.py` (`text-embedding-004`)
* `backend/app/tickets.py` has `/tickets/{id}/chat` route calling `rag.run_chat()`
* `backend/app/schemas.py` contains `ChatRequest`, `ChatResponse`, `Citation`
* `backend/migrations/0004_ai_chat.sql` + applied
* `backend/migrations/0002_kb.sql` + applied
* `backend/migrations/0005_rep_console.sql` patch in Phase 4: **auto-flagging** code exists.

**B. Env variables used (and documented)**

```
GOOGLE_GENERATIVE_AI_API_KEY=...
GEMINI_MODEL=gemini-1.5-pro
RAG_TEMPERATURE=0.1
RAG_MAX_TOKENS=500
RAG_MAX_CHUNKS=5
RAG_MAX_CONTEXT_CHARS=2000
RAG_CONFIDENCE_THRESHOLD=0.3
RATE_LIMIT_SECONDS=8
```

**C. Retrieval quality**

* Vectors are **normalized** before FAISS add/search.
* Top-K, min similarity threshold enforced; dedupe adjacent overlaps.
* Context budget respected; citations labeled `[1]..[K]`.

**D. Post-processing**

* Citations extracted even if model omits them; fallback to “Autogenerated references”.
* Confidence computed hybrid (heuristic + LLM).
* Escalation flag & system message applied conditionally (not for closed tickets).

**E. Frontend**

* `/tickets/[id]` shows AI message with **confidence badge**, **Sources** expand, **escalation hint** pill.
* `/rep` shows flagged tickets in “Needs Attention”; Acknowledge clears flag.
* KB Ingest modal available in rep UI.

**F. Errors & limits**

* 422 on too-long query; 429 on cooldown; 401/403 on auth; 503 on upstream LLM/embedding failure (with retry advice).
* `/kb/ingest` enforces file type/size.

**G. Tests (at least minimal)**

* Unit: retrieval returns expected top-K; chat returns citations; escalation triggers with low confidence.
* API: auth for chat; cooldown; no KB → low confidence.

---

## 10) Reference JSON (golden shapes)

### Request

```json
POST /api/tickets/{id}/chat
{
  "query": "What is our refund window for EU orders placed over 30 days ago?",
  "top_k": 5
}
```

### Response

```json
{
  "text": "For EU orders, the standard refund window is 30 days from delivery ... [1][2]\n\nReferences:\n[1] Refund Policy → Section 3.1 (Eligibility)\n[2] EU Distance Selling Rules Overview\n",
  "citations": [
    {"doc_id":"9542c804-...","chunk_id":"c12...","title":"Refund Policy","score":0.88},
    {"doc_id":"d735adf7-...","chunk_id":"a02...","title":"EU DSR Overview","score":0.83}
  ],
  "confidence": 0.46,
  "suggest_escalation": true
}
```

---

# Build Notes (Implementation Pseudocode)

```python
# rag.py
def retrieve(query: str, ticket_summary: str, top_k=5):
    q = contextualize(query, ticket_summary)  # maybe concat; trim to 1000 chars
    qv = embed(q)  # 768d, normalized
    hits = faiss.search(qv, top_k*2)          # overfetch
    hits = filter_by_threshold(hits, min_sim=0.75)
    hits = dedupe(hits)
    ctx = assemble_context(hits, char_budget=RAG_MAX_CONTEXT_CHARS)
    return ctx, hits

def prompt(ctx, ticket, query):
    return SYSTEM + serialize(ticket) + serialize(ctx) + "Task: " + query + FOOTER_FOR_CONFIDENCE_XML

def generate(prompt_str):
    model = choose_model(len(prompt_str))
    return gemini.generate(model, prompt_str, temperature=RAG_TEMPERATURE, max_tokens=RAG_MAX_TOKENS)

def score_and_cite(answer_text, hits):
    cited_ids = parse_bracket_refs(answer_text)          # [1], [2], ...
    citations = map_to_chunks(cited_ids, hits)
    heuristic = mean_sim(hits[:min(3,len(hits))]) * coverage_factor(citations) * agreement_factor(answer_text)
    llm_conf = parse_xml_confidence(answer_text) or 0.5
    confidence = 0.5*heuristic + 0.5*llm_conf
    suggest = confidence < RAG_CONFIDENCE_THRESHOLD
    return citations, confidence, suggest

def run_chat(ticket_id, user_id, query, top_k=5):
    guard_cooldown(ticket_id, user_id)
    ticket = get_ticket_enforcing_access(ticket_id, user_id)
    summary = summarize_recent_messages(ticket.messages)  # fast or cached
    ctx, hits = retrieve(query, summary, top_k)
    prompt_str = prompt(ctx, ticket, query)
    t0 = now()
    out = generate(prompt_str)
    latency = ms_since(t0)
    citations, conf, suggest = score_and_cite(out.text, hits)
    msg_id = save_ai_message(ticket_id, out.text, citations, conf, out.model, suggest)
    if suggest and ticket.status != 'closed':
        flag_needs_attention(ticket_id, conf)
    log_ai_run(ticket_id, user_id, out.model, prompt_hash(prompt_str), top_k, conf, suggest, len(prompt_str), len(out.text), latency)
    return ChatResponse(out.text, citations, conf, suggest)
```

---


```
