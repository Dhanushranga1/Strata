Got it—here’s a practical, “make-it-work” spec for TicketPilot’s RAG that uses Gemini correctly, plus copy-pasteable building blocks. Keep this as your source of truth while you wire everything up.

---

# TicketPilot RAG: What it must do (and how to do it with Gemini)

## 0) Outcomes (non-negotiable)

* **Answer inside each ticket** with short, support-style replies that:

  * quote relevant facts from your KB,
  * attach **citations** (doc + snippet),
  * return a **confidence score**,
  * set **`suggest_escalation`** when the answer is risky/uncertain/out-of-policy.
* **Never bluff**: if top-k is weak, say “not enough info” and guide the rep to next steps.
* **Fast path by default**: sub-2.5s p50 using `gemini-1.5-flash`; auto-upgrade to `gemini-1.5-pro` only when asked to reason across many snippets or when flash confidence is low.
* **Per-tenant safety**: retrieval is hard-scoped to the ticket’s tenant; PII scrubbed before LLM input.

---

## 1) Data & indexing (FAISS + metadata)

* **Embeddings**: `text-embedding-004` (dim=768). Normalize vectors (L2) and use **inner product** index.
* **Chunking**: 700–900 tokens (≈3–4k chars) with 120–160 token overlap. Keep **section/title/page** metadata.
* **Metadata per chunk**:

  ```json
  {
    "doc_id":"…", "doc_title":"…", "source_url":null|"...",
    "page": 3, "section":"Refund Policy > EU",
    "tenant_id":"…", "ingested_at":"…", "hash":"…"
  }
  ```
* **On ingest**: dedupe by `hash`, upsert vectors; store **character offsets** so you can pull clean snippets for citations.

---

## 2) Retrieval pipeline (fast, safe, accurate)

1. **Preprocess query**

   * Strip PII (`redact.py`) → keep masked copy for logging.
   * **Expand** the query (multi-query) with Flash (≤150 tokens) to catch synonyms/edge cases.
2. **Search**

   * Embed: original + 2–3 expansions.
   * **Filter by tenant\_id** and (optionally) doc types relevant to ticket category.
   * **Vector search (k=30)** → **MMR re-rank to 8–10** diverse chunks.
   * Optional lexical booster: BM25 over titles to rescue obvious keyword matches.
3. **Build context**

   * Merge contiguous chunks from same doc, trim to **≤ 6–8k tokens** total.
   * **Create snippets**: 240–360 chars around the best sentence; keep `char_start/char_end`.
4. **Guardrails before LLM**

   * If `top1_sim < 0.25` **or** `avg(top5_sim) < 0.20` → skip generation and return “no-answer” with `suggest_escalation=true`.
5. **Generation**

   * Use `gemini-1.5-flash` by default; switch to **Pro** when:

     * `len(context_tokens) > 6k`,
     * there are **3+** conflicting snippets (policy edge),
     * or Flash returns self-confidence < 0.5 (see section 4).
6. **Post-process**

   * Build citations from the exact snippets you injected.
   * Compute **confidence** (section 4).
   * Persist `ai_runs` and the `messages` row (`role='ai'`) with `meta.citations/confidence/suggest_escalation`.

---

## 3) Gemini: correct usage patterns

### 3.1 Embeddings (Python, `google-generativeai`)

```python
import google.generativeai as genai

genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
EMBED_MODEL = "text-embedding-004"

def embed_texts(texts: list[str]) -> list[list[float]]:
    # Batch for throughput & cost
    out = genai.embed_content(model=EMBED_MODEL, content=texts)
    # API returns {'embedding': {'values': [...]}} for single, or list for batch
    if isinstance(out, dict):  # single
        return [out["embedding"]["values"]]
    return [item["embedding"]["values"] for item in out["data"]]
```

### 3.2 Generation (structured JSON, streaming optional)

```python
SYSTEM = """You are TicketPilot, a support co-pilot.
- Answer with facts from the provided CONTEXT only.
- If the answer is not in context, say you don’t have enough info.
- Use concise, courteous support tone.
- Include suggested next steps if info is missing.
- Absolutely do not invent policy or numbers.
"""

RESPONSE_SCHEMA = {
  "type": "object",
  "properties": {
    "answer": {"type":"string"},
    "citations": {
      "type":"array",
      "items": {
        "type":"object",
        "properties": {
          "doc_id":{"type":"string"},
          "doc_title":{"type":"string"},
          "page":{"type":"integer"},
          "snippet":{"type":"string"}
        },
        "required":["doc_id","doc_title","snippet"]
      }
    },
    "self_confidence":{"type":"number","minimum":0,"maximum":1},
    "suggest_escalation":{"type":"boolean"},
    "notes":{"type":"string"}
  },
  "required":["answer","citations","self_confidence","suggest_escalation"]
}

def generate_answer(context_blocks: list[dict], user_prompt: str, model_hint: str="flash"):
    model_name = "gemini-1.5-flash" if model_hint=="flash" else "gemini-1.5-pro"
    model = genai.GenerativeModel(
        model_name,
        system_instruction=SYSTEM,
        generation_config={
            "temperature": 0.2,
            "top_p": 0.9,
            "max_output_tokens": 600,
            "response_mime_type": "application/json",
            "response_schema": RESPONSE_SCHEMA,
        },
        safety_settings={  # relax blocks that hurt support answers, keep illegal/sexually explicit blocked
            "HARASSMENT": "BLOCK_ONLY_HIGH",
            "HATE": "BLOCK_MEDIUM_AND_ABOVE",
            "SEXUAL": "BLOCK_MEDIUM_AND_ABOVE",
            "DANGEROUS": "BLOCK_ONLY_HIGH",
        }
    )

    # Concise, serialized context (never dump raw 100k chars)
    def fmt(b):
        return (f"[DOC:{b['doc_id']} | {b.get('doc_title','')} | page {b.get('page','?')}]\n"
                f"{b['snippet']}\n")
    context_text = "\n\n".join(fmt(b) for b in context_blocks)

    prompt = f"""USER QUESTION:
{user_prompt}

CONTEXT (cite only from here):
{context_text}
"""

    resp = model.generate_content(prompt)  # or stream with .generate_content_async
    return resp.text  # JSON string; parse then persist
```

**Why this is “correct” with Gemini**

* You set a **system instruction**, enforce **JSON** with `response_schema`, keep **low temp**, and pass **only curated context**.
* Safety settings are permissive enough for support, but still safe.

---

## 4) Confidence & escalation (practical formula)

Compute a single `confidence ∈ [0,1]` and the boolean `suggest_escalation`:

* Retrieval quality:

  * `sim_top1`, `avg_top5`, and **density** (how many chunks come from 1–2 docs).
  * `c_retrieval = clamp(0.1 + 0.6*avg_top5 + 0.3*sim_top1, 0, 1)`
* Coverage heuristic (does answer cite ≥1 chunk whose title/section semantically matches the question subject?):

  * `c_coverage ∈ {0.0, 0.2, 0.4}`
* Model self-rating: parsed `self_confidence` from Gemini (trained via instruction).
* Final:

  ```text
  confidence = 0.55*c_retrieval + 0.25*c_coverage + 0.20*self_confidence
  suggest_escalation = (confidence < 0.35) or policy_edge or conflicting_docs>=2
  ```

Store both in `messages.meta` and `ai_runs`.

---

## 5) Query expansion (small, cheap, effective)

Use Flash to generate 2–3 alternate phrasings and specific terms (SKU, policy alias), then embed all:

```python
def expand_query(q: str) -> list[str]:
    model = genai.GenerativeModel("gemini-1.5-flash",
        generation_config={"temperature":0.1, "max_output_tokens":120})
    r = model.generate_content(
      f"Rewrite the support question into 3 concise alternative searches.\nOriginal: {q}\nReturn as bullet list.")
    alts = [line.strip("-• ").strip() for line in r.text.splitlines() if line.strip()]
    return [q] + alts[:3]
```

---

## 6) Frontend contract (what the endpoint returns)

`POST /api/tickets/{id}/chat`

```json
{
  "message_id":"…",
  "answer":"…",
  "citations":[
    {"doc_id":"…","doc_title":"Refund Policy","page":2,"snippet":"…"}
  ],
  "confidence":0.62,
  "suggest_escalation":false,
  "model":"gemini-1.5-flash",
  "latency_ms":1430
}
```

UI shows **badges** (High/Med/Low), clickable **citations**, and a subtle **escalation warning** when needed.

---

## 7) Performance & cost playbook

* **Model router**: Flash first; upgrade to Pro only on large/ambiguous cases (section 2.5).
* **Batch embeddings**: 64–128 texts/batch; cache by `hash(text)`.
* **MMR** re-rank in-process (no extra API cost).
* **Context budget**: aim for ≤ 8k tokens; if overflow, keep diverse top passages (by doc/section).
* **Streaming**: wire `.generate_content` streaming to show tokens early (perceived speed). Persist final JSON once complete.

---

## 8) Safety, privacy, multi-tenant

* **Tenant filter** at retrieval (SQL and vector store level).
* **PII scrubbing** of prompts; never store raw PII in `ai_runs`.
* **Audit trail**: store prompt hash, not full prompt; store chunk IDs, not full text.
* **Rate limit**: per ticket 1 req / 8s (you already have this).

---

## 9) Failure modes & fallbacks (what to return)

* **Empty index / bad key** → `{ answer: helpful “no-info” message, citations: [], confidence: 0.0, suggest_escalation: true }`
* **Embedding failure** → retry with exponential backoff; final fallback = no-answer.
* **Generation blocked by safety** → rephrase: change wording and retry once; else no-answer + escalation.

---

## 10) Minimal end-to-end glue (pseudo)

```python
def answer_ticket(ticket_id: str, user_id: str, user_prompt: str):
    q0 = redact(user_prompt)
    queries = expand_query(q0)
    vecs = embed_texts(queries)                  # [n, 768]
    hits = faiss_search_mmrsafe(vecs, tenant_id) # returns ~10 chunks with sims
    if too_weak(hits): return no_answer()

    blocks = build_snippets(hits)
    model_hint = "flash"
    if needs_deeper_reasoning(hits): model_hint = "pro"

    json_str = generate_answer(blocks, q0, model_hint)
    body = json.loads(json_str)

    conf = combine_confidence(hits, body["self_confidence"], body["citations"])
    suggest = conf < 0.35 or body["suggest_escalation"]

    save_ai_message(ticket_id, user_id, body["answer"], {
      "citations": body["citations"],
      "confidence": conf,
      "suggest_escalation": suggest,
      "model": "gemini-1.5-pro" if model_hint=="pro" else "gemini-1.5-flash"
    })
    if suggest: flag_ticket_needs_attention(ticket_id, conf)

    return {...response payload...}
```

---

## 11) QA you can actually run

* **Golden set**: 30 FAQs + expected snippets. Track `EM@1` (exact-match citation found) and **Helpful\@k** (rep thumbs-up).
* **Latency p50/p95** under 2.5s/5.0s with Flash on warm cache.
* **Escalation precision** ≥ 0.7 (when we flag, humans agree) and recall ≥ 0.5 (we catch at least half of the true “hard” ones).

---

## 12) Where this plugs into your phases

* **Phase 4**: `/api/tickets/{id}/chat` already exists—swap internals to the pipeline above; keep DB shape (`messages.meta` with citations/confidence).
* **Phase 5**: when `suggest_escalation=true`, set `needs_attention=true` and optionally move to `escalated` lane per your rules.
* **Admin/KB**: ensure `/api/kb/ingest` and `/api/kb/search` follow the chunk/embedding rules here; grant **admin** full ingest rights.

---

### TL;DR checklists

**Must-have behaviors**

* [ ] Uses Flash first, Pro when necessary
* [ ] Multi-query + MMR retrieval
* [ ] JSON-structured outputs enforced
* [ ] Citations from exact snippets
* [ ] Confidence + escalation wired to Rep Console
* [ ] Tenant-scoped retrieval + PII scrub

**Done-means-done tests**

* [ ] Ingest → Search → AI returns cited answer for 10 real docs
* [ ] 3 “no-info” questions return graceful fallbacks (no hallucinations)
* [ ] Low-confidence answers appear in **Needs Attention** lane
* [ ] p50 < 2.5s on Flash for average tickets

If you want, I can also turn this into a small agent prompt so your automation can implement the exact steps.
