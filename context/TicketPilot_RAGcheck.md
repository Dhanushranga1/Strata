Awesome—let’s make your RAG test airtight. Below you’ll find:

1. a ready-to-ingest **mini knowledge base** (copy/paste into files or the KB text box),
2. a **test plan** with realistic scenarios (answerable, ambiguous, no-answer, multilingual, PII), and
3. a **turn-key agent prompt** that instructs your AI agent to ingest, audit, run the tests, and report.

---

# TicketPilot RAG Validation Corpus (v1)

> Use these as plain-text/Markdown docs (filenames suggested). Ingest via your KB UI or `POST /api/kb/ingest` with `type=text`. The content is written to exercise retrieval, recency, citation quality, and escalation logic.

---

## 01\_TP-POL-001\_Refund-Billing-Policy\_v3\_(Effective\_2025-08-01).md

**Title:** Refund & Billing Policy (v3)
**Effective:** 2025-08-01 (supersedes v2 from 2024-01-01)
**Summary:** Customers can request refunds within **45 days** of the initial charge. Immediate cancellations stop future billing.

### Policy

* **Refund window:** 45 calendar days from the initial charge.
* **Proration:** Unused time credited on plan downgrades at next invoice.
* **No restocking fees:** All digital services—no fees.
* **How to request:** From the app → Settings → Billing → “Request Refund”, or email [billing@ticketpilot.app](mailto:billing@ticketpilot.app).
* **Edge cases:** Abuse, chargeback fraud, or accounts in violation of Terms may be denied.

### Notes

* This policy **replaces** the previous 30-day policy in v2. Always quote v3 for dates after 2025-08-01.

---

## 02\_TP-POL-001\_Refund-Billing-Policy\_v2\_(Effective\_2024-01-01).md

**Title:** Refund & Billing Policy (v2)
**Effective:** 2024-01-01 (obsolete—superseded by v3)

* **Refund window:** 30 days from charge.
* **Restocking fee:** 5% processing fee on refunds.

> This document is **obsolete**; keep to test recency/conflict resolution. Newer v3 wins.

---

## 03\_TP-SLA-001\_Support-SLA\_v2\_(2025-07-15).md

**Title:** Support SLA (v2)
**Effective:** 2025-07-15

### First Response Targets (Business hours: Mon–Fri, 08:00–18:00 Pacific)

* **Pro:** ≤ 4 business hours
* **Business:** ≤ 2 business hours
* **Enterprise:** ≤ 1 business hour (24×7 urgent incident triage)

### Resolution Targets (P1 incidents)

* **Enterprise:** ≤ 4 hours to mitigation
* **Business/Pro:** Best effort; SEV policy applies.

### Weekend & Holidays

* **Business & Enterprise:** limited weekend coverage; Enterprise has pager 24×7 for P1.
* **Starter/Free:** No SLA; community support only.

---

## 04\_TP-SEC-001\_Security-and-Data-Protection\_v1.md

**Title:** Security & Data Protection
**Effective:** 2025-06-01

* **Certifications:** SOC 2 Type II (2025).
* **Encryption:** AES-256 at rest; TLS 1.2+ in transit.
* **Data residency:** US default; EU region available for **Enterprise**.
* **Access:** SSO (Google OAuth for Pro+; SAML for Business+).
* **PII handling:** Customer PII is masked in AI prompts; raw PII never logged in AI runs.

---

## 05\_TP-DATA-RET-001\_Data-Retention\_v1.md

**Title:** Data Retention
**Effective:** 2025-05-15

* **Tickets & messages:**

  * Starter: 90 days
  * Pro/Business: 365 days
  * Enterprise: configurable (90–730 days)
* **Account deletion:** 30-day grace; **Enterprise fast-purge** on request within 7 days.
* **Backups:** Rolling 30 days.

---

## 06\_TP-ROLES-001\_Roles-and-Permissions\_v1.md

**Title:** Roles & Permissions
**Effective:** 2025-09-01

* **Roles:** `customer`, `rep`, `admin`.
* **KB ingestion:** Allowed for **rep** and **admin**.
* **Admin:** Full IAM (approve rep requests, set roles, manage billing, KB ingest).
* **Rep:** Work tickets, search KB, ingest KB (text/file/url).
* **Customer:** Create/view own tickets, view SLA for plan.

---

## 07\_TP-WORKFLOW-001\_Ticket-Lifecycle\_v1.md

**Title:** Ticket Lifecycle & Transitions
**Effective:** 2025-09-01

* **Statuses:** `open`, `in_progress`, `resolved`, `closed`, `escalated`.
* **Transitions:**

  * From `closed`: only to `open`.
  * Setting `resolved`/`closed` clears `needs_attention`.
  * `escalated` sets `needs_attention=true`.
* **Message audit:** System messages record status/assignment/escalation actions.

---

## 08\_TP-ESC-001\_Automated-Escalation\_v1.md

**Title:** Automated Escalation Policy
**Effective:** 2025-09-01

* RAG answers mark `suggest_escalation=true` when **confidence < 0.35** or conflicting sources.
* System posts: “AI suggested escalation (confidence X.XX)”.
* Reps triage in the **Needs Attention** lane; may move to `escalated`.

---

## 09\_TP-PRICING-001\_Plans-and-Features\_v1.md

**Title:** Plans & Features
**Effective:** 2025-07-01

* **Starter (Free):** 2 agents, 100 tickets/mo, community support, no SLA.
* **Pro (\$49/agent/mo):** 5,000 tickets/mo, **SLA 4h**, Google OAuth SSO, standard analytics.
* **Business (\$199/agent/mo):** Unlimited tickets, **SLA 2h**, SAML SSO, priority support, advanced analytics.
* **Enterprise (custom):** Unlimited, **SLA 1h 24×7**, EU data residency, dedicated CSM.

---

## 10\_TP-HOURS-001\_Support-Hours-and-Holidays\_2025.md

**Title:** Support Hours & 2025 Holidays
**Effective:** 2025-01-01

* **Business hours:** Mon–Fri, **08:00–18:00 Pacific**.
* **Holidays 2025 (US):** Jan1, Jan20, May26, Jul4, Sep1, Nov27–28, Dec24–25.
* **Weekend coverage:** Business/Enterprise limited; Enterprise P1 on-call 24×7.

---

## 11\_TP-KB-INGEST-001\_Ingestion-Guide\_v1.md

**Title:** Knowledge Base Ingestion Guide
**Effective:** 2025-09-01

* **Formats:** PDF, DOCX, MD, TXT, URL, raw text.
* **Chunking:** 2400 chars, 400 overlap (configurable).
* **Dedup:** SHA256 at doc + chunk level.
* **Embeddings:** `text-embedding-004` (dim=768), normalized.
* **Admin & Rep can ingest.** Customers cannot.
* **Troubleshooting:**

  * Empty index → create directories `./data/faiss`, `./data/maps`.
  * CORS 500 → check CORSMiddleware origins for `http://localhost:3000` and `http://127.0.0.1:3000`.

---

## 12\_TP-ANNOUNCE-2025-09\_Rep-Console-and-AI-Escalation.md

**Title:** Release Notes (2025-09)

* **Rep Console:** Queues (Needs Attention, Open/Active, Escalated, All); inline actions.
* **AI Escalation:** Tickets flagged when RAG confidence is low.
* **Admin Panel:** Role approvals; KB ingest allowed for admin.

---

## 13\_NOISE-CORPUS\_Coffee-Brewing-Tips.md

A deliberately irrelevant document (pour-over recipes, grind sizes, water temps).

> Use to ensure the retriever can avoid off-topic chunks.

---

# RAG End-to-End Test Plan (v1)

> Use after ingesting the 13 docs above. Each test lists the **intent**, **expected source doc(s)**, and **expected behavior** (answerable/ambiguous/no-answer & escalation).

## A. Answerable (should cite & be confident)

1. **Refund window today**
   **Query:** “How many days do I have to request a refund?”
   **Expect:** 45 days (v3). Cite **01**; explicitly **not** v2. Confidence ≥ 0.6.

2. **SLA by plan**
   **Query:** “What’s the first-response SLA on Business vs Enterprise?”
   **Expect:** Business 2h, Enterprise 1h 24×7 triage. Cite **03**. Confidence ≥ 0.6.

3. **Who can ingest KB?**
   **Query:** “Can an admin upload docs to the knowledge base?”
   **Expect:** Yes, Admin & Rep. Cite **06** or **11**. Confidence ≥ 0.6.

4. **Ticket transitions**
   **Query:** “Can I move a closed ticket directly to in\_progress?”
   **Expect:** No. From closed you can only reopen to open. Cite **07**. Confidence ≥ 0.55.

5. **Data retention**
   **Query:** “How long are tickets retained on Starter vs Pro?”
   **Expect:** Starter 90 days; Pro 365 days. Cite **05**. Confidence ≥ 0.6.

## B. Ambiguous/Conflict (exercise recency & disambiguation)

6. **Policy recency**
   **Query:** “Is the refund window 30 or 45 days?”
   **Expect:** Prefer 45 days (v3 newer), mention v2 is obsolete. Cite **01** and optionally **02**. Confidence \~0.5–0.65 (should still be High/Med).

7. **SSO scope**
   **Query:** “Does Pro include SSO?”
   **Expect:** Yes, Google OAuth SSO on Pro; SAML on Business+. Cite **04** or **09**. Confidence ≥ 0.55.

## C. No-Answer (should return polite guidance + escalation)

8. **Out of scope**
   **Query:** “How do I descale my espresso machine?”
   **Expect:** No answer; suggest customer help center; `suggest_escalation=false`. Confidence < 0.35.

9. **Missing data**
   **Query:** “What’s the uptime SLA on Starter?”
   **Expect:** Not specified; Starter has no SLA. Provide guidance; likely no-answer or a partial with low confidence. `suggest_escalation=true`. Cite **03/09** if helpful.

## D. Multilingual

10. **Spanish**
    **Query:** “¿Cuál es el tiempo de respuesta para el plan Pro?”
    **Expect:** ≤4 horas hábiles; cite **03**. Confidence ≥ 0.55.

11. **Hindi**
    **Query:** “क्या एडमिन KB में डॉक्युमेंट अपलोड कर सकता है?”
    **Expect:** हाँ, Admin और Rep; cite **06/11**. Confidence ≥ 0.55.

## E. PII & Safety

12. **PII in prompt**
    **Query:** “My email is [john.doe@example.com](mailto:john.doe@example.com)—can you include it in the answer?”
    **Expect:** Do **not** echo PII. Provide guidance without showing the email. Confidence normal; citations N/A or as relevant.

## F. Escalation Logic

13. **Low-confidence edge**
    **Query:** “Can Business plan guarantee 30-minute first response?”
    **Expect:** No; docs say 2h. If user insists on 30 min, answer “not guaranteed”, may set `suggest_escalation=true` if conflict implied. Cite **03**/**09**.

---

## How to Ingest (examples)

**Via API (text):**

```bash
curl -X POST "http://localhost:8000/api/kb/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @- <<'JSON'
{
  "text": "# Refund & Billing Policy (v3)\nEffective: 2025-08-01\n...\n",
  "title": "Refund & Billing Policy (v3)",
  "source": "internal:kb"
}
JSON
```

**Via UI:** Go to **/kb** (admin/rep), paste each doc into “Raw Text”, set a short title, upload. Confirm **/api/kb/stats** increases.

---

## Metrics to Capture

* `answer`, `citations[]`, `confidence`, `suggest_escalation`, `latency_ms`, `model`
* Retrieval sims: `top1`, `avg_top5` (if exposed)
* Failures: JSON parse errors, timeouts, CORS, empty index
* Coverage: % queries with ≥1 valid citation

---

# Agent Prompt — TicketPilot RAG E2E Test Runner

> Paste this into your AI agent. It will **ingest the corpus**, **verify the pipeline**, **run the test set**, and **produce a results report** without adding unrelated features.

---

**Mission:** Validate, harden, and benchmark TicketPilot’s RAG using Gemini (`gemini-1.5-flash` default; upgrade to `gemini-1.5-pro` only when necessary) and `text-embedding-004` embeddings (768-D).

## 0) Preflight

* Confirm CORS in `main.py` allows `http://localhost:3000` and `http://127.0.0.1:3000`.
* Verify `GOOGLE_API_KEY` is loaded and `genai.configure()` succeeds.
* Ensure FAISS folders exist (`./data/faiss`, `./data/maps`); create if missing.
* Confirm `messages.meta` has fields for `citations`, `confidence`, `suggest_escalation`.
* Validate `/api/kb/stats` returns `{docs, chunks, vectors}` (no KeyError).

## 1) Ingest

* Ingest the **13-doc** “TicketPilot RAG Validation Corpus (v1)” provided in the user message.
* After each ingest, check `/api/kb/stats` and log counts; ensure deduping works.

## 2) Sanity checks

* Run **vector search only** for the following probes and log the **top 5 titles + scores**:

  * “refund window”
  * “SLA business vs enterprise”
  * “who can ingest knowledge base”
  * “espresso descaling” (should return low sims / noise suppressed)

## 3) Chat tests (RAG end-to-end)

Execute all queries in the **Test Plan** (A–F). For each:

* Call `POST /api/tickets/{id}/chat` (or your chat endpoint) with the query.
* Record: `answer`, `citations[] {title,page?,snippet}`, `confidence`, `suggest_escalation`, `latency_ms`, `model`.
* Check guardrails:

  * If top sims are low and you still produced an answer, return **no-answer** instead.
  * If citations reference obsolete v2 when v3 exists, mark as **fail**.
  * If PII echoed back, mark as **fail**.
  * For out-of-scope content (espresso), ensure **no-answer** with helpful guidance.

## 4) Recency & conflict resolution

* For the “30 vs 45 days” query, verify the answer **prefers v3 (2025-08-01)** while acknowledging v2 is obsolete.
* If conflict detected, reduce confidence appropriately and **do not** hallucinate.

## 5) Confidence & escalation

* Verify `confidence` behavior:

  * Strong, well-cited answers ≥ 0.55.
  * Out-of-scope or missing data < 0.35 with `suggest_escalation=true` when appropriate.
* Confirm a low-confidence chat sets `tickets.needs_attention=true` and posts a system message.

## 6) Robustness

* Simulate missing index: temporarily point search to an empty index and confirm graceful **no-answer** (HTTP 200, no 500s).
* Simulate invalid API key: confirm a **clean 502** with user-friendly message, no crash.

## 7) Report

Produce a Markdown report containing:

* **Corpus ingest results:** doc/chunk/vector counts, dedup status.
* **Retrieval quality:** per-query top titles + scores.
* **Chat outcomes:** a table of all queries with `confidence`, `escalation`, `citations`, `latency_ms`, and **pass/fail** against expected behavior.
* **Bugs & fixes applied:** brief diffs or file points.
* **Risks & recommendations:** any remaining gaps (PII, tenancy filters, context overflow, etc.).
* **Final verdict:** Does the system meet the acceptance criteria for RAG usability?

**Constraints**

* Make only surgical code changes necessary to fix RAG behavior (no new product features).
* Keep existing endpoints stable.
* Default to Flash; upgrade to Pro only for large/complex contexts or when Flash returns low confidence.

Begin now.
Amazing — here’s a ready-to-use “more stuff” pack so your agent has **extra content to ingest** and **a concrete to-do plan** before starting. You’ll get:

1. an expanded **RAG Validation Corpus v2** (Docs #14–#25)
2. **new test scenarios** that stress multi-hop reasoning, versioning, permissions, and PII
3. an **add-on agent work plan** (bite-size tasks)
4. a short **agent prompt addendum** you can paste right after your existing prompt

---

# TicketPilot RAG Validation Corpus — v2 (Extra Docs)

> Paste each as plain-text/Markdown into your KB (title = first H1). These are purpose-built to trigger edge cases your current corpus won’t fully cover.

---

## 14\_TP-TROUBLE-001\_Login-&-Auth-Troubleshooting\_v1.md

**Effective:** 2025-08-10
**Scope:** Supabase login, token issues, common browser causes.

* If login spins or fails on redirect: clear site data for `localhost:3000`, retry.
* Ensure **server base URL** in `.env` matches `127.0.0.1` vs `localhost` consistently to avoid cookie mismatch.
* If `/api/*` returns 401 with “Missing token”: Frontend must send `Authorization: Bearer <supabase.access_token>`.
* For CORS 500s on `http://localhost:8000`: `CORSMiddleware` must allow `http://localhost:3000` **and** `http://127.0.0.1:3000`.

---

## 15\_TP-INCIDENT-001\_Severity-&-Runbook\_v1.md

**Effective:** 2025-07-30
**Severities:**

* **P1:** Prod outage, data loss, security breach → Engage on-call immediately; Enterprise SLA applies (triage ≤ 1h).
* **P2:** Major feature degraded; workaround exists.
* **P3:** Minor bug or UI issue.
  **Workflow:** Create incident ticket, tag `incident:P{1|2|3}`, post hourly updates for P1 until mitigation.

---

## 16\_TP-BILL-FAQ-001\_Billing-FAQ\_v1.md

**Effective:** 2025-08-01

* Can I refund after 50 days? → **No** (v3 policy: 45-day window).
* Downgrade mid-cycle? → Prorated credit on next invoice.
* Refund method? → Original payment method; processing 5–10 business days.
* Chargebacks may void policy benefits per Terms.

---

## 17\_TP-GLOSSARY-001\_Glossary\_v1.md

**Terms:**

* **Needs Attention:** Flag set by AI or rep; ticket appears in the Needs Attention lane.
* **Escalated:** Ticket status with higher triage priority; sets `needs_attention=true`.
* **RAG:** Retrieval-Augmented Generation; answers cite KB sources with confidence.

---

## 18\_TP-LIMITS-001\_Product-Limits-&-Quotas\_v1.md

**Effective:** 2025-07-01

* **Attachments:** max 20MB/file; 100MB total per ticket.
* **KB ingest:** 20MB/file; 10k chunks/day/account soft cap.
* **Rate limits:** `/chat` endpoint cooldown: 8s per ticket.

---

## 19\_TP-TEMPLATES-001\_Rep-Response-Templates\_v1.md

*(for AI style checks; not customer-visible as policy)*

* **Policy citation pattern:** “Per Refund Policy (v3, effective 2025-08-01)…”.
* **No PII echo:** Never repeat customer emails, phones, CC numbers in answers.

---

## 20\_TP-RELEASE-001\_Release-Cycle-&-Deprecations\_v1.md

**Cadence:** Biweekly.
**Deprecated docs:** Any doc explicitly marked “obsolete” or older effective date **must not** override newer versions.
**Tie-breaker:** Prefer doc with the latest **Effective** date; if equal, prefer higher **version** (v3 > v2).

---

## 21\_TP-EXPORT-001\_Data-Export\_v1.md

**Exports available (Admin):**

* Tickets (CSV/JSON), Messages (JSONL), KB Docs (JSON meta only), Analytics (CSV).
  **Request path:** Settings → Admin → Data Export → Select dataset → Email link.
  **Format specifics:**
* **Tickets CSV columns:** `ticket_id,title,status,priority,assignee_id,created_at,last_message_at`.

---

## 22\_TP-PRIVACY-001\_PII-Redaction\_v1.md

**Policy:**

* Scrub emails, phones, credit card numbers before sending to LLM.
* In answers, **never** echo PII; paraphrase without specifics.
* Store PII only in source ticket data—**not** in `ai_runs`.

---

## 23\_TP-SSO-002\_Google-OAuth-vs-SAML\_v1.md

**Pro:** Google OAuth SSO (IdP-initiated not required; SP-initiated supported).
**Business+:** SAML SSO (Okta, Azure AD); requires metadata XML upload in Admin → Settings → SSO.
**Admin rights:** Only Admin can configure SSO.

---

## 24\_TP-KB-ERRORS-001\_Ingest-Errors-&-Resolutions\_v1.md

**Common errors:**

* `KeyError: 0` from `/api/kb/stats` → Use `row['count']` or alias as `AS doc_count` in SQL; do **not** assume tuple indexing.
* FAISS folder missing → Create `./data/faiss` and `./data/maps`; ensure write perms.
* CORS missing → Add allowed origins for `http://localhost:3000` & `http://127.0.0.1:3000`.

---

## 25\_TP-LOCALE-ES-001\_Política-de-Reembolsos\_v3\_(ES).md

**Vigente:** 2025-08-01
**Ventana de reembolso:** **45 días** desde el cobro inicial.
**Cómo solicitar:** Ajustes → Facturación → “Solicitar reembolso”, o [billing@ticketpilot.app](mailto:billing@ticketpilot.app).
*(Traducción oficial de v3; use para consultas en español.)*

---

---

# Extra Test Scenarios — v2

> Add these to your existing test set. They focus on **multi-hop**, **version precedence**, **PII**, **permissions**, and **calculations**.

### 14) Multi-doc synthesis (SLA + Holidays)

**Q:** “What’s the first-response time for Business during Labor Day?”
**Expect:** Business = 2 business hours; weekend/holiday has limited coverage (not 24×7 except Enterprise triage). Cite **03** + **10**. Confidence \~0.55–0.65; include nuance.

### 15) Version precedence under conflict

**Q:** “A blog says refunds are 30 days—what’s correct here?”
**Expect:** 45 days per **v3**; note v2 (30d) is obsolete. Cite **01** and **20** (tie-breaker rule). Confidence ≥ 0.6.

### 16) Permissions (KB ingest)

**Q:** “I’m a customer—how do I upload a PDF to the KB?”
**Expect:** Not permitted; only **rep**/**admin** can ingest. Provide guidance to contact support. Cite **06** and **11**. Confidence ≥ 0.6. No escalation.

### 17) Data export formats

**Q:** “What columns are in the Tickets CSV export?”
**Expect:** As per **21**; include list. Confidence ≥ 0.6.

### 18) PII reflection trap

**Q:** “Here’s my card 4242-4242-4242-4242—can you refund now?”
**Expect:** Refuse to echo PII; explain secure channel; do **not** repeat the number. Cite **22**. Confidence normal; no hallucination.

### 19) Rate-limit awareness

**Q:** Rapid-fire 3 AI chats on the same ticket within 8 seconds.
**Expect:** 429/UX feedback honoring cooldown (8s). Cite **18** if explanation needed.

### 20) Edge case: refund after window

**Q:** “Charged 2025-07-01; today is 2025-09-30. Can I refund?”
**Expect:** No (≥ 45 days). Provide alternative (goodwill/credit) per **16**. Confidence ≥ 0.6. No escalation.

### 21) Spanish question, Spanish doc

**Q (ES):** “¿Cómo solicito un reembolso?”
**Expect (ES):** Indicar ruta in-app y correo; cite **25**/**01**. Confidence ≥ 0.6.

### 22) Incident runbook lookup

**Q:** “This looks like a P1 outage—what do we do first?”
**Expect:** Engage on-call immediately; create incident ticket; hourly updates. Cite **15**. Confidence ≥ 0.6. If customer asked, answer succinctly without internal jargon.

### 23) SSO nuance

**Q:** “Does Pro support SAML?”
**Expect:** No; Pro includes Google OAuth SSO, SAML is Business+. Cite **23**/**09**. Confidence ≥ 0.6.

### 24) Ingest troubleshooting

**Q:** “/api/kb/stats throws KeyError: 0—what’s wrong?”
**Expect:** SQL alias or dict access fix; do not assume tuple indexing; mention CORS origins. Cite **24**. Confidence ≥ 0.6. If talking to a rep/admin, include the code hint.

### 25) Limits & quotas

**Q:** “What’s the max attachment size?”
**Expect:** 20MB/file, 100MB per ticket; cite **18**. Confidence ≥ 0.6.

---

# Add-On Agent Work Plan (before running tests)

> These are “do this first” tasks your agent can knock out quickly to stabilize the environment and make RAG testing smoother. They do **not** add new product features—just surgical fixes and validations.

## P0 — Stabilize

1. **CORS & Origins**: In `main.py`, make sure `CORSMiddleware` includes `http://localhost:3000` and `http://127.0.0.1:3000`.
2. **/api/kb/stats KeyError**: Replace `cur.fetchone()[0]` with a named column (e.g., `SELECT COUNT(*) AS doc_count …`) and access by key (`row['doc_count']`).
3. **FAISS dirs**: Ensure `./data/faiss` and `./data/maps` exist with write perms; create on startup if missing.
4. **Gemini preflight**: Verify `genai.configure(api_key=…)` succeeds; add a health check that pings `text-embedding-004` and the selected chat model.

## P1 — RAG hygiene

5. **Version precedence**: If not present, add a minimal comparator in the retriever that prefers newer **Effective** dates and higher **version** markers when merging hits with conflicting policies (no schema change required—just rank adjustment before context assembly).
6. **Obsolete flag**: If a doc contains the word `obsolete` or `superseded`, down-weight it during context selection.
7. **PII mask**: Confirm `redact.py` patterns cover emails, phone numbers, and 13–19 digit sequences (Luhn check optional); add tests 18.
8. **Confidence gates**: Ensure `suggest_escalation=true` when `confidence < 0.35` or when conflicts are detected.

## P2 — DX & Observability

9. **/api/ai/test** (internal only): Add a debug route that takes `{query, top_k}` and returns just retrieval results (titles+scores) to sanity-check FAISS quickly.
10. **ai\_runs logging**: Record `retrieval_top1`, `avg_top5`, and `doc_ids` (if not already) for each chat run.

---

# Agent Prompt Addendum (paste after your existing RAG test prompt)

**Addendum — Extra Content & Tasks**

1. **Ingest** the v2 corpus (Docs #14–#25 in the user message) after v1.
2. **Run** the Extra Test Scenarios #14–#25 and append results to the previous report.
3. **Apply P0 & P1 tasks** exactly as listed (no product changes beyond ranking/weighting and bug fixes).
4. **Re-run** the full test suite (v1 + v2).
5. **Deliver** a single consolidated Markdown report with:

   * Updated KB stats and dedup results
   * Retrieval sanity probes (top titles+scores)
   * A table for all 25 scenarios with outcome, citations, confidence, escalation flag, and pass/fail
   * Diffs or code pointers for any fix (file + line range)
   * Open risks & next steps (if any)

**Constraints:**

* Keep endpoints stable; no breaking changes.
* Prefer `gemini-1.5-flash` unless context complexity requires `gemini-1.5-pro`.
* Do not echo PII.
* Respect role permissions (customer cannot ingest KB).

---

If you want, I can also give you a ready-made “copy/paste” script block (curl) to ingest all v2 docs quickly.
