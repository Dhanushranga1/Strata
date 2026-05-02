"""
Demo setup script — uploads KB doc and creates two demo tickets.

Ticket 1: "How do I reset my password?" — AI should RESOLVE (topic is in KB)
Ticket 2: "Salesforce two-way sync stops after SFDC token expires" — AI should ESCALATE (not in KB)
"""

import jwt
import time
import requests
import json

# ── Config ──────────────────────────────────────────────────────────────────

JWT_SECRET = "WG25lhDljOsexJhRLt3m2FOoja0udZexfeoPRQVhbK9AeElM9+/gB5uRa70GM9yM2dcgSwMSqq9a4d1ss7fydw=="
BACKEND = "http://localhost:8000"

# dg1513@srmist.edu.in — owner of ventura_demo, has global admin role
ADMIN_ID    = "cfa54340-eea2-43af-b0fd-6cc11ea68b5f"
ADMIN_EMAIL = "dg1513@srmist.edu.in"

# anaya.purohit09@gmail.com — member/customer in ventura_demo
CUSTOMER_ID    = "912ee847-2a27-4388-8e8b-3a38edcbc9c3"
CUSTOMER_EMAIL = "anaya.purohit09@gmail.com"

ORG_ID   = "050f64b5-d575-43db-9b0e-6fdd38f74bae"  # ventura_demo
ORG_SLUG = "ventura_demo"

KB_FILE = "/home/dhanush/Documents/ticketpilot/rag_test_kb.md"


# ── Helpers ─────────────────────────────────────────────────────────────────

def make_token(user_id: str, email: str) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "iss": "supabase",
        "iat": now,
        "exp": now + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def headers(token: str, org_id: str | None = None) -> dict:
    h = {"Authorization": f"Bearer {token}"}
    if org_id:
        h["X-Organization-ID"] = org_id
    return h


def ok(resp: requests.Response, label: str):
    if resp.status_code not in (200, 201):
        print(f"  ✗ {label} → {resp.status_code}: {resp.text[:300]}")
        return False
    print(f"  ✓ {label}")
    return True


# ── 1. Upload KB doc ─────────────────────────────────────────────────────────

admin_token = make_token(ADMIN_ID, ADMIN_EMAIL)

print("\n[1] Uploading KB document …")
with open(KB_FILE, "rb") as f:
    resp = requests.post(
        f"{BACKEND}/api/kb/ingest",
        headers=headers(admin_token, ORG_ID),
        files={"file": ("rag_test_kb.md", f, "text/markdown")},
    )
ok(resp, "KB ingest")
if resp.ok:
    data = resp.json()
    print(f"     doc_id={data['document_id']}  chunks={data['chunks_ingested']}  vectors={data['vectors_added']}")


# ── 2. Create Ticket A — AI should RESOLVE ───────────────────────────────────

customer_token = make_token(CUSTOMER_ID, CUSTOMER_EMAIL)

print("\n[2] Creating Ticket A — Password Reset (AI should resolve) …")
resp = requests.post(
    f"{BACKEND}/api/tickets",
    headers={**headers(customer_token, ORG_ID), "Content-Type": "application/json"},
    json={
        "title": "I can't log in — forgot my password",
        "body": "Hi, I've been trying to log in but I can't remember my password. "
                "How do I reset it? Does the reset link expire?",
        "priority": "medium",
    },
)
ok(resp, "Create ticket A")
ticket_a_id = None
if resp.ok:
    ticket_a_id = resp.json()["id"]
    print(f"     ticket_id={ticket_a_id}")


# ── 3. Trigger AI chat on Ticket A ───────────────────────────────────────────

if ticket_a_id:
    print("\n[3] Triggering AI chat on Ticket A …")
    resp = requests.post(
        f"{BACKEND}/api/tickets/{ticket_a_id}/chat",
        headers={**headers(customer_token, ORG_ID), "Content-Type": "application/json"},
        json={"query": "How do I reset my password? Does the link expire?"},
    )
    ok(resp, "AI chat — Ticket A")
    if resp.ok:
        data = resp.json()
        print(f"     confidence={data.get('confidence', 'n/a')}")
        print(f"     escalate={data.get('suggest_escalation', False)}")
        body = data.get("answer") or data.get("response") or ""
        print(f"     answer[:200]={body[:200]}")


# ── 4. Create Ticket B — AI should ESCALATE ──────────────────────────────────

print("\n[4] Creating Ticket B — Salesforce sync (AI should escalate) …")
resp = requests.post(
    f"{BACKEND}/api/tickets",
    headers={**headers(customer_token, ORG_ID), "Content-Type": "application/json"},
    json={
        "title": "Salesforce two-way sync breaks after OAuth token expiry",
        "body": "We have TicketPilot integrated with Salesforce via a custom OAuth app. "
                "Every 90 days the SFDC access token expires and the sync stops silently. "
                "There's no alert, and tickets don't appear in our CRM. "
                "We need either auto-token-refresh or at least a webhook alert when sync fails. "
                "Our SFDC org is in the EU data centre. Is there a known fix?",
        "priority": "high",
    },
)
ok(resp, "Create ticket B")
ticket_b_id = None
if resp.ok:
    ticket_b_id = resp.json()["id"]
    print(f"     ticket_id={ticket_b_id}")


# ── 5. Trigger AI chat on Ticket B ───────────────────────────────────────────

if ticket_b_id:
    print("\n[5] Triggering AI chat on Ticket B …")
    resp = requests.post(
        f"{BACKEND}/api/tickets/{ticket_b_id}/chat",
        headers={**headers(customer_token, ORG_ID), "Content-Type": "application/json"},
        json={"query": "How do we fix the Salesforce OAuth token expiry issue? Can you auto-refresh?"},
    )
    ok(resp, "AI chat — Ticket B")
    if resp.ok:
        data = resp.json()
        print(f"     confidence={data.get('confidence', 'n/a')}")
        print(f"     escalate={data.get('suggest_escalation', False)}")
        body = data.get("answer") or data.get("response") or ""
        print(f"     answer[:200]={body[:200]}")


# ── Done ─────────────────────────────────────────────────────────────────────

print(f"""
Done!
  Org:      ventura_demo  ({ORG_ID})
  Ticket A: {ticket_a_id}   ← expect AI resolve
  Ticket B: {ticket_b_id}   ← expect AI escalate
Open the app, switch to ventura_demo org, and view these tickets.
""")
