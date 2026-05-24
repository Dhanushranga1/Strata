"""
Standalone demo seed — NO imports from app.*
Directly uses psycopg + Google AI REST API.
Run:  python3 seed_standalone.py   (from backend/)
"""
import os, sys, json, hashlib, re, time
import psycopg
from psycopg.rows import dict_row
from pathlib import Path
import urllib.request, urllib.error

# ── Config ───────────────────────────────────────────────────────────────────
DATABASE_URL = "postgresql://postgres.nvgmgvplfpukckfkjuso:1819@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
GOOGLE_API_KEY = "AIzaSyBp3I2xu2kv0eRq1z5EAvzsjS5xSDFbHz8"
EMBED_MODEL = "models/gemini-embedding-001"

import google.generativeai as genai
genai.configure(api_key=GOOGLE_API_KEY)

ORG_ID      = "050f64b5-d575-43db-9b0e-6fdd38f74bae"   # ventura_demo
ADMIN_ID    = "cfa54340-eea2-43af-b0fd-6cc11ea68b5f"   # dg1513@srmist.edu.in
CUSTOMER_ID = "912ee847-2a27-4388-8e8b-3a38edcbc9c3"  # anaya.purohit09@gmail.com

KB_FILE = Path(__file__).parent.parent / "rag_test_kb.md"

print("=== DEMO SEED ===", flush=True)

# ── Helpers ──────────────────────────────────────────────────────────────────

def db():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=15)

def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def make_chunks(text: str, size: int = 2400, overlap: int = 400) -> list:
    """Simple character-based chunker."""
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        # Try to break at paragraph boundary
        if end < len(text):
            boundary = text.rfind('\n\n', start, end)
            if boundary > start + size // 2:
                end = boundary
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap if end < len(text) else len(text)
    return chunks

def embed_batch(texts: list) -> list:
    """Embed texts using Google AI genai library."""
    results = []
    for text in texts:
        result = genai.embed_content(
            model=EMBED_MODEL,
            content=text,
            task_type="retrieval_document",
        )
        results.append(result["embedding"])
    return results

# ── 1. KB Ingest ─────────────────────────────────────────────────────────────

print("\n[1] KB Ingest", flush=True)

raw_text = KB_FILE.read_text()
doc_hash = sha256(raw_text)

with db() as conn:
    cur = conn.cursor()
    cur.execute("SELECT id FROM app.documents WHERE doc_hash=%s AND organization_id=%s", (doc_hash, ORG_ID))
    existing = cur.fetchone()
    cur.execute("SELECT COUNT(*) AS c FROM app.chunks WHERE organization_id=%s", (ORG_ID,))
    chunk_count = cur.fetchone()["c"]

if existing and chunk_count > 0:
    print(f"  Already ingested (doc={existing['id']}, chunks={chunk_count}) — skipping.", flush=True)
    DOC_DONE = True
else:
    DOC_DONE = False

if not DOC_DONE:
    # Upsert document
    with db() as conn:
        cur = conn.cursor()
        if existing:
            doc_id = str(existing["id"])
            print(f"  Doc exists: {doc_id[:8]}… re-using", flush=True)
        else:
            cur.execute("""
                INSERT INTO app.documents (organization_id, title, source, mime_type, size_bytes, doc_hash, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """, (ORG_ID, "TicketPilot Support Knowledge Base", "upload:rag_test_kb.md",
                  "text/markdown", len(raw_text.encode()), doc_hash, ADMIN_ID))
            doc_id = str(cur.fetchone()["id"])
            conn.commit()
            print(f"  Created doc: {doc_id[:8]}…", flush=True)

    chunks = make_chunks(raw_text)
    print(f"  {len(chunks)} chunks", flush=True)

    # Embed in batches of 5
    print("  Embedding…", flush=True)
    all_vecs = []
    for i in range(0, len(chunks), 5):
        batch = chunks[i:i+5]
        vecs = embed_batch(batch)
        all_vecs.extend(vecs)
        print(f"  embedded {min(i+5, len(chunks))}/{len(chunks)}", flush=True)

    # Insert chunks
    with db() as conn:
        cur = conn.cursor()
        # Simple FAISS-like: assign sequential IDs starting from max existing
        cur.execute("SELECT COALESCE(MAX(faiss_id), -1) AS m FROM app.chunks WHERE organization_id=%s", (ORG_ID,))
        next_faiss = int(cur.fetchone()["m"]) + 1

        for i, (chunk_text, vec) in enumerate(zip(chunks, all_vecs)):
            chunk_hash = sha256(chunk_text)
            token_count = len(chunk_text.split())
            faiss_id = next_faiss + i
            cur.execute("""
                INSERT INTO app.chunks
                  (doc_id, chunk_index, text, chunk_hash, token_count, organization_id, faiss_id, embedding)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (doc_id, chunk_index) DO NOTHING
            """, (doc_id, i, chunk_text, chunk_hash, token_count, ORG_ID, faiss_id, vec))
        conn.commit()
    print(f"  Stored {len(chunks)} chunks in DB", flush=True)
    print("  NOTE: Restart the backend (or hit /api/kb/ingest once) to rebuild FAISS index.", flush=True)

# ── 2. Ticket A — AI resolves ─────────────────────────────────────────────────

print("\n[2] Ticket A — AI resolves (password reset)", flush=True)

with db() as conn:
    cur = conn.cursor()
    # Check if already exists
    cur.execute("SELECT id FROM app.tickets WHERE organization_id=%s AND title=%s",
                (ORG_ID, "Can't log in — forgot my password"))
    if cur.fetchone():
        print("  Already exists — skipping", flush=True)
    else:
        cur.execute("""
            INSERT INTO app.tickets (organization_id, created_by, title, description, status, priority, priority_level)
            VALUES (%s, %s, %s, %s, 'open', 'normal', 4) RETURNING id
        """, (ORG_ID, CUSTOMER_ID, "Can't log in — forgot my password",
              "Customer locked out — needs password reset instructions."))
        tid_a = str(cur.fetchone()["id"])

        body_a = (
            "Hi team,\n\n"
            "I've been locked out of my account since this morning. I can't remember my password. "
            "How do I reset it? Does the reset link expire? I'm also not seeing the email in my inbox.\n\nThanks"
        )
        cur.execute("""
            INSERT INTO app.messages (ticket_id, organization_id, sender_id, sender_role, body)
            VALUES (%s, %s, %s, 'customer', %s)
        """, (tid_a, ORG_ID, CUSTOMER_ID, body_a))

        ai_body_a = (
            "I can help with that! Here's how to reset your password:\n\n"
            "1. Go to the **login page** and click **\"Forgot password\"**.\n"
            "2. Enter your registered email — you'll receive a reset link **within 2 minutes**.\n"
            "3. Check your **spam/junk folder** if you don't see it right away.\n"
            "4. The link **expires after 30 minutes**, so use it promptly.\n\n"
            "If you're still stuck after trying this, contact us at **help@ticketpilot.io** and we'll sort it out.\n\n"
            "Hope this resolves your issue! 😊"
        )
        meta_a = json.dumps({
            "confidence": 0.87,
            "suggest_escalation": False,
            "model": "gemini-1.5-pro",
            "citations": [{"source": "rag_test_kb.md", "section": "Account & Billing — How do I reset my password?"}],
        })
        cur.execute("""
            INSERT INTO app.messages (ticket_id, organization_id, sender_id, sender_role, body, meta)
            VALUES (%s, %s, %s, 'ai', %s, %s)
        """, (tid_a, ORG_ID, CUSTOMER_ID, ai_body_a, meta_a))

        cur.execute("UPDATE app.tickets SET message_count=2, last_message_at=NOW() WHERE id=%s", (tid_a,))
        conn.commit()
        print(f"  Created: {tid_a[:8]}… (AI confidence=0.87, no escalation)", flush=True)

# ── 3. Ticket B — AI escalates ────────────────────────────────────────────────

print("\n[3] Ticket B — AI escalates (Salesforce OAuth)", flush=True)

with db() as conn:
    cur = conn.cursor()
    cur.execute("SELECT id FROM app.tickets WHERE organization_id=%s AND title=%s",
                (ORG_ID, "Salesforce two-way sync breaks after OAuth token expiry"))
    if cur.fetchone():
        print("  Already exists — skipping", flush=True)
    else:
        cur.execute("""
            INSERT INTO app.tickets (organization_id, created_by, title, description, status, priority, priority_level)
            VALUES (%s, %s, %s, %s, 'escalated', 'high', 2) RETURNING id
        """, (ORG_ID, CUSTOMER_ID, "Salesforce two-way sync breaks after OAuth token expiry",
              "Salesforce OAuth token expires every 90 days — silent sync failure, no alert."))
        tid_b = str(cur.fetchone()["id"])

        body_b = (
            "Hi,\n\nWe have TicketPilot connected to Salesforce via a custom OAuth2 app. "
            "Every 90 days the SFDC token expires and sync stops silently — "
            "new tickets don't appear in our CRM and CRM updates don't reflect here. "
            "No alert appears in TicketPilot.\n\n"
            "We need auto-refresh OR a webhook alert when sync fails. "
            "Our SFDC org is on the EU15 pod. Is there a fix?\n\nRegards, Anaya"
        )
        cur.execute("""
            INSERT INTO app.messages (ticket_id, organization_id, sender_id, sender_role, body)
            VALUES (%s, %s, %s, 'customer', %s)
        """, (tid_b, ORG_ID, CUSTOMER_ID, body_b))

        ai_body_b = (
            "Thank you for reaching out. I searched our knowledge base for Salesforce OAuth token "
            "refresh and EU data centre sync configurations, but I don't have enough documentation "
            "to give you a reliable answer on this specific issue.\n\n"
            "**I'm escalating this to a human support rep** who will be able to:\n"
            "- Advise on automatic token refresh options\n"
            "- Check EU15 pod-specific configuration\n"
            "- Set up a webhook alert for sync failures\n\n"
            "You should hear back within **12 hours** (P2 SLA). Apologies for the inconvenience."
        )
        meta_b = json.dumps({
            "confidence": 0.18,
            "suggest_escalation": True,
            "model": "gemini-1.5-pro",
            "citations": [],
            "escalation_info": {
                "requires_human": True,
                "escalation_reason": "No relevant KB content for Salesforce OAuth integration",
            },
        })
        cur.execute("""
            INSERT INTO app.messages (ticket_id, organization_id, sender_id, sender_role, body, meta)
            VALUES (%s, %s, %s, 'ai', %s, %s)
        """, (tid_b, ORG_ID, CUSTOMER_ID, ai_body_b, meta_b))

        # System escalation note
        cur.execute("""
            INSERT INTO app.messages (ticket_id, organization_id, sender_id, sender_role, body)
            VALUES (%s, %s, %s, 'system', %s)
        """, (tid_b, ORG_ID, CUSTOMER_ID,
              "[system] AI escalation: Insufficient knowledge base context (confidence 0.18). Assigned to human rep."))

        # Rep reply
        rep_body = (
            "Hi Anaya,\n\nThanks for the detailed report. Automatic OAuth token refresh for "
            "Salesforce is on our Q3 roadmap — it's a known limitation.\n\n"
            "**Workaround until then:** Re-authenticate every 85 days via "
            "Settings → Integrations → Salesforce. I'll flag your account for our engineering team "
            "to prioritise the EU15 fix.\n\nI'll follow up once auto-refresh ships!\n\n— Dhanu (Support)"
        )
        cur.execute("""
            INSERT INTO app.messages (ticket_id, organization_id, sender_id, sender_role, body)
            VALUES (%s, %s, %s, 'rep', %s)
        """, (tid_b, ORG_ID, ADMIN_ID, rep_body))

        cur.execute("""
            UPDATE app.tickets
            SET message_count=4, last_message_at=NOW(),
                assignee_id=%s, escalated_to=%s, escalated_at=NOW(), status='in_progress'
            WHERE id=%s
        """, (ADMIN_ID, ADMIN_ID, tid_b))
        conn.commit()
        print(f"  Created: {tid_b[:8]}… (AI confidence=0.18, escalated → rep replied)", flush=True)

# ── Done ─────────────────────────────────────────────────────────────────────

print("""
══════════════════════════════════════════════════
  DONE!  Log in as dg1513@srmist.edu.in
  Switch to org: ventura_demo
  Ticket A: password reset  → AI resolved  (0.87)
  Ticket B: Salesforce OAuth → AI escalated (0.18)
══════════════════════════════════════════════════
""", flush=True)
