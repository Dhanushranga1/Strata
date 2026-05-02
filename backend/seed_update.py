"""
Demo seed update — run from backend/ directory:
  python3 seed_update.py

Does:
  1. Fix citations on existing Ticket A (password reset)
  2. Ingest 3 new detailed KB docs into ventura_demo
  3. Create 3 more demo tickets with correct citation format
"""
import os, sys, json, hashlib, re
import psycopg
from psycopg.rows import dict_row
from pathlib import Path
import google.generativeai as genai

# ── Config ────────────────────────────────────────────────────────────────────
DATABASE_URL = "postgresql://postgres.nvgmgvplfpukckfkjuso:1819@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
GOOGLE_API_KEY = "AIzaSyBp3I2xu2kv0eRq1z5EAvzsjS5xSDFbHz8"
EMBED_MODEL = "models/gemini-embedding-001"

genai.configure(api_key=GOOGLE_API_KEY)

ORG_ID      = "050f64b5-d575-43db-9b0e-6fdd38f74bae"
ADMIN_ID    = "cfa54340-eea2-43af-b0fd-6cc11ea68b5f"
CUSTOMER_ID = "912ee847-2a27-4388-8e8b-3a38edcbc9c3"

# Existing IDs from DB
DOC_KB_ID     = "90e2f768-7d41-4fb6-aad1-b48660822fa4"
CHUNK_0_ID    = "d1c99f55-c4e7-4e9a-9d26-c1ca81c40d47"   # Account & Billing / password reset
CHUNK_1_ID    = "31e78f87-93a9-4838-b456-5efce6b0393c"   # CASPER / AI quality
CHUNK_2_ID    = "5df55e94-5494-43c2-9dfd-bea2d12054f8"   # Ticket workflow

TICKET_A_ID   = "05e0025e-c088-4792-9f19-8d7d9a73278f"
TICKET_B_ID   = "30d4f178-72ef-4dee-b2bc-ead2afa546f4"

KB_DIR = Path(__file__).parent / "data" / "kb"

print("=== DEMO SEED UPDATE ===", flush=True)

# ── Helpers ───────────────────────────────────────────────────────────────────

def db():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=15)

def sha256(text):
    return hashlib.sha256(text.encode()).hexdigest()

def make_chunks(text, size=2400, overlap=400):
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    chunks, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            b = text.rfind('\n\n', start, end)
            if b > start + size // 2:
                end = b
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap if end < len(text) else len(text)
    return chunks

def embed_texts(texts):
    results = []
    for t in texts:
        r = genai.embed_content(model=EMBED_MODEL, content=t, task_type="retrieval_document")
        results.append(r["embedding"])
    return results

def citation(label, doc_id, chunk_id, faiss_id, score):
    return {"label": label, "doc_id": doc_id, "chunk_id": chunk_id, "faiss_id": faiss_id, "score": score}

# ── 1. Fix Ticket A citations ─────────────────────────────────────────────────

print("\n[1] Fixing Ticket A citations …", flush=True)
with db() as conn:
    cur = conn.cursor()
    cur.execute("SELECT id, meta FROM app.messages WHERE ticket_id=%s AND sender_role='ai'", (TICKET_A_ID,))
    row = cur.fetchone()
    if row:
        meta = row["meta"] or {}
        meta["citations"] = [
            citation(
                label="TicketPilot Support KB § Account & Billing — How do I reset my password?",
                doc_id=DOC_KB_ID, chunk_id=CHUNK_0_ID, faiss_id=0, score=0.91
            )
        ]
        cur.execute("UPDATE app.messages SET meta=%s WHERE id=%s", (json.dumps(meta), row["id"]))
        conn.commit()
        print("  Fixed Ticket A — 1 citation with label, doc_id, chunk_id, faiss_id, score", flush=True)
    else:
        print("  No AI message found on Ticket A", flush=True)

# ── 2. Ingest new KB docs ─────────────────────────────────────────────────────

NEW_DOCS = [
    ("product_troubleshooting.md",  "TicketPilot Product Troubleshooting Guide"),
    ("team_management.md",          "TicketPilot Team Management & Onboarding Guide"),
    ("billing_subscriptions.md",    "TicketPilot Billing & Subscription Guide"),
]

doc_map = {}   # filename → (doc_id, chunks_info)
# chunks_info: list of {"id":..., "faiss_id":..., "preview":...}

print("\n[2] Ingesting KB documents …", flush=True)

# Get current max faiss_id
with db() as conn:
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(MAX(faiss_id), 2) AS m FROM app.chunks WHERE organization_id=%s", (ORG_ID,))
    next_faiss = int(cur.fetchone()["m"]) + 1

for filename, title in NEW_DOCS:
    filepath = KB_DIR / filename
    raw = filepath.read_text()
    doc_hash = sha256(raw)

    with db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app.documents WHERE doc_hash=%s AND organization_id=%s", (doc_hash, ORG_ID))
        existing = cur.fetchone()
        if existing:
            doc_id = str(existing["id"])
            cur.execute("SELECT COUNT(*) AS c FROM app.chunks WHERE organization_id=%s AND doc_id=%s", (ORG_ID, doc_id))
            n = cur.fetchone()["c"]
            if n > 0:
                print(f"  {filename}: already ingested ({n} chunks) — loading IDs", flush=True)
                cur.execute("SELECT id, faiss_id, left(text,60) AS p FROM app.chunks WHERE organization_id=%s AND doc_id=%s ORDER BY chunk_index", (ORG_ID, doc_id))
                doc_map[filename] = (doc_id, [{"id": str(r["id"]), "faiss_id": r["faiss_id"], "preview": r["p"]} for r in cur.fetchall()])
                continue

    # Insert document record
    with db() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO app.documents (organization_id, title, source, mime_type, size_bytes, doc_hash, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (ORG_ID, title, f"upload:{filename}", "text/markdown", len(raw.encode()), doc_hash, ADMIN_ID))
        doc_id = str(cur.fetchone()["id"])
        conn.commit()

    chunks = make_chunks(raw)
    print(f"  {filename}: {len(chunks)} chunks — embedding …", flush=True)
    vectors = embed_texts(chunks)

    chunk_infos = []
    with db() as conn:
        cur = conn.cursor()
        for i, (chunk_text, vec) in enumerate(zip(chunks, vectors)):
            faiss_id = next_faiss
            next_faiss += 1
            cur.execute("""
                INSERT INTO app.chunks (doc_id, chunk_index, text, chunk_hash, token_count, organization_id, faiss_id, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (doc_id, chunk_index) DO NOTHING
                RETURNING id
            """, (doc_id, i, chunk_text, sha256(chunk_text), len(chunk_text.split()), ORG_ID, faiss_id, vec))
            row = cur.fetchone()
            if row:
                chunk_infos.append({"id": str(row["id"]), "faiss_id": faiss_id, "preview": chunk_text[:60]})
        conn.commit()

    doc_map[filename] = (doc_id, chunk_infos)
    print(f"  {filename}: stored {len(chunk_infos)} chunks (faiss_ids {chunk_infos[0]['faiss_id']}–{chunk_infos[-1]['faiss_id']})", flush=True)


# ── 3. More demo tickets ──────────────────────────────────────────────────────

def make_ticket(title, description, priority, status="open"):
    with db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM app.tickets WHERE organization_id=%s AND title=%s", (ORG_ID, title))
        if cur.fetchone():
            return None
        cur.execute("""
            INSERT INTO app.tickets (organization_id, created_by, title, description, status, priority, priority_level)
            VALUES (%s, %s, %s, %s, %s, %s,
              CASE %s WHEN 'urgent' THEN 2 WHEN 'high' THEN 2 WHEN 'normal' THEN 4 WHEN 'low' THEN 6 END)
            RETURNING id
        """, (ORG_ID, CUSTOMER_ID, title, description, status, priority, priority))
        tid = str(cur.fetchone()["id"])
        conn.commit()
    return tid

def add_msg(ticket_id, role, body, meta=None, sender=None):
    sender = sender or (ADMIN_ID if role == "rep" else CUSTOMER_ID)
    with db() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO app.messages (ticket_id, organization_id, sender_id, sender_role, body, meta)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """, (ticket_id, ORG_ID, sender, role, body, json.dumps(meta) if meta else None))
        mid = str(cur.fetchone()["id"])
        cur.execute("UPDATE app.tickets SET message_count=message_count+1, last_message_at=NOW() WHERE id=%s", (ticket_id,))
        conn.commit()
    return mid

def finalize(ticket_id, status, assignee=None):
    with db() as conn:
        cur = conn.cursor()
        if assignee:
            cur.execute("UPDATE app.tickets SET status=%s, assignee_id=%s WHERE id=%s", (status, assignee, ticket_id))
        else:
            cur.execute("UPDATE app.tickets SET status=%s WHERE id=%s", (status, ticket_id))
        conn.commit()

print("\n[3] Creating demo tickets …", flush=True)

# ── Ticket C: CASPER low confidence — resolved by AI ──────────────────────────
trouble_doc_id, trouble_chunks = doc_map.get("product_troubleshooting.md", (None, []))
team_doc_id,    team_chunks    = doc_map.get("team_management.md",          (None, []))
billing_doc_id, billing_chunks = doc_map.get("billing_subscriptions.md",    (None, []))

tid_c = make_ticket(
    title="CASPER AI keeps assigning low confidence to all tickets",
    description="AI confidence is always below 55% — all tickets escalate to reps instead of auto-resolving.",
    priority="normal",
)
if tid_c:
    add_msg(tid_c, "customer",
        "Hi, CASPER AI is giving a confidence score below 55% on almost every ticket and escalating "
        "them all to reps. We've been using it for 2 weeks but the auto-resolve rate is near zero. "
        "What can we do to improve the AI confidence score?")

    # Chunk 1 of original KB covers CASPER low confidence
    ai_body_c = (
        "Low CASPER confidence (below 55%) usually means one of three things:\n\n"
        "1. **Thin knowledge base** — Your KB has fewer than 10 high-quality documents. "
        "Upload more detailed documentation covering your product's common issues.\n\n"
        "2. **Ambiguous tickets** — Very short or vague ticket bodies give CASPER little to match against. "
        "Encourage customers to include error messages and steps already tried.\n\n"
        "3. **Outdated KB docs** — If your product changed but the docs weren't updated, CASPER's "
        "context will be stale. Re-upload the latest versions.\n\n"
        "**Quick wins to raise confidence:**\n"
        "- Aim for at least 10 documents with step-by-step instructions and specific error codes.\n"
        "- Use plain Markdown or text — avoid PDFs with scanned images.\n"
        "- Include real product names and exact terminology customers use.\n\n"
        "You can also adjust the confidence threshold in Settings → AI → Confidence Threshold "
        "(default 0.55). Lowering it to 0.45 lets CASPER resolve more tickets but may reduce accuracy."
    )
    meta_c = {
        "confidence": 0.84,
        "suggest_escalation": False,
        "model": "gemini-1.5-pro",
        "citations": [
            citation(
                "TicketPilot Support KB § AI Assistant — Why is CASPER's confidence score low?",
                DOC_KB_ID, CHUNK_1_ID, 1, 0.89
            ),
            citation(
                "TicketPilot Support KB § AI Assistant — How do I improve AI response quality?",
                DOC_KB_ID, CHUNK_1_ID, 1, 0.83
            ),
        ],
    }
    add_msg(tid_c, "ai", ai_body_c, meta=meta_c)
    print(f"  Ticket C: {tid_c[:8]}… — CASPER confidence (AI resolves, confidence=0.84)", flush=True)
else:
    print("  Ticket C: already exists", flush=True)

# ── Ticket D: Invite a new rep — resolved by AI ───────────────────────────────
tid_d = make_ticket(
    title="How do I invite a new support rep to my team?",
    description="New hire joining the support team — need to give her access as a rep.",
    priority="low",
)
if tid_d and team_doc_id and team_chunks:
    add_msg(tid_d, "customer",
        "Hi! We just hired a new support engineer and I need to add her to our TicketPilot "
        "workspace as a rep so she can view and reply to tickets. How do I invite her? "
        "What role should I assign? And can I change her role later if needed?")

    ai_body_d = (
        "Great news — inviting a new rep is quick! Here's how:\n\n"
        "**To invite:**\n"
        "1. Go to **Settings → Team → Members** and click **Invite Member**.\n"
        "2. Enter her email and select the role **Rep** "
        "(she can view and reply to tickets, manage KB, but cannot change org settings).\n"
        "3. Click **Send Invite** — she'll get an email with a link valid for **7 days**.\n"
        "4. Once she accepts, she can log in immediately.\n\n"
        "**Role comparison:**\n"
        "- **Rep** — handles tickets and KB, cannot invite or configure settings.\n"
        "- **Admin** — same as Rep plus member management and settings access.\n"
        "- **Member** — customer view only, can only submit tickets.\n\n"
        "**Yes, you can change her role later.** Go to Settings → Team → Members, "
        "click her role badge, and select the new role — it takes effect immediately.\n\n"
        "If her invite expires before she accepts, resend it from Settings → Team → Invites → Resend."
    )
    meta_d = {
        "confidence": 0.92,
        "suggest_escalation": False,
        "model": "gemini-1.5-pro",
        "citations": [
            citation(
                "Team Management Guide § Inviting Team Members — How do I add a new support rep?",
                team_doc_id, team_chunks[0]["id"], team_chunks[0]["faiss_id"], 0.94
            ),
            citation(
                "Team Management Guide § Roles & Permissions — Can I change a rep's role?",
                team_doc_id, team_chunks[0]["id"], team_chunks[0]["faiss_id"], 0.88
            ),
        ],
    }
    add_msg(tid_d, "ai", ai_body_d, meta=meta_d)
    print(f"  Ticket D: {tid_d[:8]}… — Invite rep (AI resolves, confidence=0.92)", flush=True)
elif tid_d:
    print(f"  Ticket D: {tid_d[:8]}… — team KB not ready, skipping AI msg", flush=True)
else:
    print("  Ticket D: already exists", flush=True)

# ── Ticket E: Plan upgrade mid-cycle — resolved by AI ─────────────────────────
tid_e = make_ticket(
    title="Upgrading from Starter to Growth — what happens to current billing?",
    description="Customer wants to upgrade plan mid-billing cycle and is unsure about charges.",
    priority="normal",
)
if tid_e and billing_doc_id and billing_chunks:
    add_msg(tid_e, "customer",
        "We are currently on the Starter plan ($29/month) and we're hitting the 5-rep limit. "
        "We want to upgrade to Growth today, but we're 18 days into our monthly billing cycle. "
        "Will we be charged the full $79 immediately, or just the prorated difference? "
        "Also, do we lose our current ticket data if we upgrade?")

    ai_body_e = (
        "Upgrading from Starter to Growth is straightforward and **you keep all your data**. "
        "Here's exactly what happens:\n\n"
        "**Billing on upgrade:**\n"
        "- You are charged the **prorated difference** immediately — not the full $79.\n"
        "- Example: if you're 18 days into a 30-day cycle, you pay roughly "
        "(12/30) × ($79 − $29) = **$20** today.\n"
        "- Your next full billing date stays the same; the new plan price applies from the next cycle.\n\n"
        "**What changes immediately:**\n"
        "- Rep limit increases from 5 → 20.\n"
        "- Ticket limit increases from 500 → 5,000/month.\n"
        "- AI response limit increases from 200 → 2,000/month.\n"
        "- New limits are active within **60 seconds** of upgrade.\n\n"
        "**Your data is fully preserved** — all tickets, KB documents, and analytics history carry over.\n\n"
        "To upgrade: **Settings → Billing → Upgrade Plan → Growth → Confirm**."
    )
    meta_e = {
        "confidence": 0.89,
        "suggest_escalation": False,
        "model": "gemini-1.5-pro",
        "citations": [
            citation(
                "Billing & Subscription Guide § Plans & Pricing — How do I upgrade my plan?",
                billing_doc_id, billing_chunks[0]["id"], billing_chunks[0]["faiss_id"], 0.91
            ),
            citation(
                "Billing & Subscription Guide § Plans & Pricing — What plans does TicketPilot offer?",
                billing_doc_id, billing_chunks[0]["id"], billing_chunks[0]["faiss_id"], 0.85
            ),
        ],
    }
    add_msg(tid_e, "ai", ai_body_e, meta=meta_e)
    print(f"  Ticket E: {tid_e[:8]}… — Billing upgrade (AI resolves, confidence=0.89)", flush=True)
elif tid_e:
    print(f"  Ticket E: {tid_e[:8]}… — billing KB not ready, skipping AI msg", flush=True)
else:
    print("  Ticket E: already exists", flush=True)

# ── Ticket F: Custom Zapier/Salesforce webhook — AI ESCALATES ─────────────────
tid_f = make_ticket(
    title="Custom webhook payload not matching Zapier's expected schema",
    description="Zapier zap fails with 'unexpected field order' when TicketPilot fires ticket.created event.",
    priority="high",
    status="escalated",
)
if tid_f:
    add_msg(tid_f, "customer",
        "We have a Zap that triggers on TicketPilot's `ticket.created` webhook. It worked fine "
        "for 2 months but since last week Zapier is rejecting the payload with "
        "'unexpected field: priority_level'. We haven't changed anything on our side. "
        "Did TicketPilot change the webhook schema? Is there documentation on the exact "
        "JSON structure sent by each event type? We need field-level docs — "
        "especially for `ticket.created`, `ticket.updated`, and `ticket.resolved`.")

    ai_body_f = (
        "I searched our knowledge base for detailed webhook payload schemas and field-level "
        "documentation for `ticket.created`, `ticket.updated`, and `ticket.resolved`, "
        "but I don't have that level of technical detail available.\n\n"
        "I can confirm that TicketPilot webhooks are documented at "
        "`docs.ticketpilot.io/api/webhooks`, but I can't confirm whether a recent schema "
        "change introduced `priority_level` as a new field.\n\n"
        "**I'm escalating this to a human rep** who can:\n"
        "- Check the release changelog for webhook schema changes in the last 2 weeks\n"
        "- Provide the exact JSON payload structure for each event type\n"
        "- Help you update your Zap filter to handle the new field\n\n"
        "Expected response time: **12 hours** (P2 SLA). Apologies for the disruption."
    )
    meta_f = {
        "confidence": 0.21,
        "suggest_escalation": True,
        "model": "gemini-1.5-pro",
        "citations": [],
        "escalation_info": {
            "requires_human": True,
            "escalation_reason": "Webhook payload schema docs not in knowledge base",
        },
    }
    add_msg(tid_f, "ai", ai_body_f, meta=meta_f)

    # System escalation note
    add_msg(tid_f, "system",
        "[system] AI escalation: Insufficient KB context for Zapier webhook schema (confidence 0.21). Assigned to human rep.")

    # Rep reply
    add_msg(tid_f, "rep",
        "Hi! Thanks for the detailed report. We did release a schema update on April 22nd — "
        "`priority_level` (integer 1–7) was added to all ticket events.\n\n"
        "**Quick fix for your Zap:** add a Zapier 'Filter' step before your action "
        "or update your trigger to use the new field. Here's the full `ticket.created` schema:\n\n"
        "```json\n"
        "{\n"
        "  \"event\": \"ticket.created\",\n"
        "  \"ticket_id\": \"uuid\",\n"
        "  \"title\": \"string\",\n"
        "  \"priority\": \"low|normal|high|urgent\",\n"
        "  \"priority_level\": 1-7,\n"
        "  \"status\": \"open\",\n"
        "  \"created_at\": \"ISO8601\",\n"
        "  \"org_id\": \"uuid\"\n"
        "}\n"
        "```\n\n"
        "Full docs: docs.ticketpilot.io/api/webhooks#schemas\n\n"
        "Let me know if your Zap needs any other adjustments! — Dhanu",
        sender=ADMIN_ID
    )
    finalize(tid_f, "in_progress", assignee=ADMIN_ID)
    print(f"  Ticket F: {tid_f[:8]}… — Zapier schema (AI escalates, confidence=0.21)", flush=True)
else:
    print("  Ticket F: already exists", flush=True)

# ── Done ──────────────────────────────────────────────────────────────────────
print("""
══════════════════════════════════════════════════════════════
  ALL DONE — ventura_demo org is ready for demo
══════════════════════════════════════════════════════════════
  KB documents:
    • TicketPilot Support Knowledge Base  (3 chunks)
    • Product Troubleshooting Guide       (new)
    • Team Management & Onboarding Guide  (new)
    • Billing & Subscription Guide        (new)

  Demo tickets:
    Ticket A — Password reset           → AI resolves (0.87) ✓ FIXED citations
    Ticket B — Salesforce OAuth         → AI escalates (0.18)
    Ticket C — CASPER low confidence    → AI resolves (0.84)
    Ticket D — Invite a new rep         → AI resolves (0.92)
    Ticket E — Plan upgrade billing     → AI resolves (0.89)
    Ticket F — Zapier webhook schema    → AI escalates (0.21)

  NOTE: Restart local backend to rebuild FAISS for new chunks.
══════════════════════════════════════════════════════════════
""", flush=True)
