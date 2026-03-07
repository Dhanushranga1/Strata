# TicketPilot Demo Script

## Setup (do this before the demo)

### 1. Start the app
```bash
# Terminal 1 — Backend
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

### 2. Log in and get your org ID
- Open http://localhost:3000 → Login
- Go to Organizations → copy the org UUID from the URL or the card

### 3. Seed demo data
```bash
cd backend
python demo/seed_demo.py \
  --email YOUR_EMAIL \
  --password YOUR_PASSWORD \
  --org-id YOUR_ORG_UUID \
  --supabase-url https://nvgmgvplfpukckfkjuso.supabase.co \
  --anon-key eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

This uploads 3 KB documents and creates 5 realistic demo tickets.

---

## Demo Flow (~10 minutes)

### Step 1 — Landing page & sign up (1 min)
- Show http://localhost:3000 — marketing page, hero, value props
- Click "Get Started" → show signup flow
- *"Multi-tenant SaaS — each company gets its own isolated workspace"*

### Step 2 — Dashboard (1 min)
- After login, show the dashboard with ticket stats
- *"Role-based dashboard — admins see org-wide analytics, reps see their queue, customers see their tickets"*

### Step 3 — Knowledge Base & RAG (3 min) ← KEY FEATURE
- Navigate to **Knowledge Base** in the sidebar
- Show the 3 documents already indexed (Billing Guide, Technical Guide, FAQ)
- Click on a document to show chunk count and metadata
- *"Documents are chunked at 2400 chars with 400-char overlap, embedded with Google text-embedding-004, and stored in a FAISS index"*
- Go to **Tickets** → open the "AI assistant not responding" ticket
- Click **Chat with AI** → type: *"Why isn't the AI responding on my tickets?"*
- AI responds with cited answer (e.g., [2] Technical Guide) within seconds
- Point out: confidence score, citation numbers, escalation flag if triggered
- *"RAG pipeline: FAISS semantic search → MMR re-ranking → Gemini generates cited response → confidence scoring decides if human escalation is needed"*

### Step 4 — Rep Console (2 min)
- Navigate to **Rep Console**
- Show the ticket queue: urgent, needs attention, open
- Open the "Cannot upgrade to Growth plan" ticket
- Show the conversation thread — AI has already drafted an initial response
- Rep types a reply → show the response going back to customer
- Click **Resolve** → ticket moves to closed
- *"Reps see tickets in priority order. AI handles the first response, reps handle complex/escalated cases"*

### Step 5 — Admin Analytics (1 min)
- Navigate to **Analytics** or **Admin**
- Show: total tickets, resolution rate, avg response time by category
- *"Full observability — admins can see which ticket categories are spiking and where AI confidence is lowest"*

### Step 6 — Invite System (1 min)
- Navigate to **Organizations**
- Click the **invite icon** on your org card
- Enter an email → show the invite modal with role selector (rep/admin/member)
- *"Token-based invite system — generates a secure link, sends email in production, or copy-paste link for local dev"*

### Step 7 — Multi-tenancy (1 min)
- Show the organization switcher in the sidebar
- *"Full Row-Level Security enforced at the database — switching org shows completely isolated data. An agent in Org A can never see Org B's tickets, even if they share a database row"*

---

## Key Technical Points to Mention

| Feature | Implementation |
|---|---|
| Auth | Supabase JWT + FastAPI dependency injection |
| Multi-tenancy | PostgreSQL RLS with `app.organizations` + `org_middleware` |
| RAG | FAISS vector search + MMR re-ranking + Google Gemini |
| Embeddings | Google text-embedding-004 via `google-generativeai` |
| Confidence | Custom scoring: retrieval quality + citation coverage + semantic coherence |
| Escalation | Multi-signal: confidence < 55% + uncertainty phrases + conversation length |
| PII | Auto-redacted from context before sending to Gemini (`redact.py`) |
| Frontend | Next.js 15 App Router, shadcn/ui, framer-motion |
| Hosting | Vercel (frontend) + Railway/Render (backend) |

---

## Common Questions & Answers

**Q: How does the AI know when to escalate?**
A: Multiple signals: confidence < 55%, fewer than 2 relevant chunks found, uncertainty phrases detected, or conversation length > 8 turns. Any 2 signals trigger escalation.

**Q: Is customer data kept private from the AI?**
A: Yes — PII is scrubbed from document chunks before they're sent to Gemini. Emails, phone numbers, and other identifiers are redacted.

**Q: Can you bring your own LLM?**
A: The `ai.py` module uses an abstracted `generate_completion()` function. Swapping Gemini for OpenAI or a self-hosted model is a single-file change.

**Q: How does multi-tenancy work at the database level?**
A: Every table has an `organization_id` column. PostgreSQL RLS policies reject any query where `organization_id` doesn't match the JWT's org claim. The backend enforces this via `X-Organization-ID` header + `org_middleware.py`.
