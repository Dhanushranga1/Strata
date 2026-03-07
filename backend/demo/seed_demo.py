#!/usr/bin/env python3
"""
Seed demo data for TicketPilot reviewer demo.

Usage:
  cd backend
  python demo/seed_demo.py --email your@email.com --password yourpass --org-id <uuid>

  Or with a token directly:
  python demo/seed_demo.py --token <jwt> --org-id <uuid>
"""

import argparse
import sys
import os
import json
import requests

BASE_URL = os.getenv("API_BASE", "http://127.0.0.1:8000")
DEMO_DIR = os.path.dirname(__file__)

KB_DOCS = [
    ("kb_getting_started.txt",  "Getting Started Guide"),
    ("kb_billing.txt",          "Billing & Subscription Guide"),
    ("kb_technical.txt",        "Technical Support Guide"),
    ("kb_troubleshooting.txt",  "Troubleshooting Guide"),
    ("kb_faq.txt",              "Frequently Asked Questions"),
    ("kb_roles_permissions.txt","Roles & Permissions Guide"),
]

DEMO_TICKETS = [
    {
        "title": "Cannot upgrade to Growth plan",
        "body": "I've been trying to upgrade my account to the Growth plan for the past hour but keep getting a payment error. My card is definitely valid — I just used it elsewhere. Can you help?",
        "priority": "high",
    },
    {
        "title": "AI assistant not responding on any tickets",
        "body": "Since yesterday the AI stopped responding to customer tickets. It used to reply within a few seconds. I haven't changed anything in the settings. Is there an outage?",
        "priority": "urgent",
    },
    {
        "title": "How do I export my ticket data?",
        "body": "We're doing a quarterly audit and need to export all tickets from the last 3 months including messages. What's the easiest way to do this?",
        "priority": "medium",
    },
    {
        "title": "Widget not showing on our website",
        "body": "I followed the installation instructions and pasted the widget script tag, but nothing appears on our site. I've checked the org ID and it looks correct. Using React with Next.js.",
        "priority": "high",
    },
    {
        "title": "Question about GDPR and data retention",
        "body": "We have EU customers and need to understand what happens to their data. Specifically: where is data stored, what is the retention period, and can we request deletion of a specific customer's data?",
        "priority": "medium",
    },
]


def get_token(email: str, password: str, supabase_url: str, anon_key: str) -> str:
    resp = requests.post(
        f"{supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": anon_key, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=15,
    )
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    return resp.json()["access_token"]


def ingest_doc(token: str, org_id: str, filepath: str, title: str):
    with open(filepath, "rb") as f:
        resp = requests.post(
            f"{BASE_URL}/api/kb/ingest",
            headers={"Authorization": f"Bearer {token}", "X-Organization-ID": org_id},
            files={"file": (os.path.basename(filepath), f, "text/plain")},
            data={"filename": title},
            timeout=60,
        )
    if resp.status_code == 200:
        data = resp.json()
        print(f"  Ingested '{title}': {data['chunks_ingested']} chunks, {data['vectors_added']} vectors")
    else:
        print(f"  Failed '{title}': {resp.status_code} {resp.text[:200]}")


def create_ticket(token: str, org_id: str, ticket: dict):
    resp = requests.post(
        f"{BASE_URL}/api/tickets",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Organization-ID": org_id,
            "Content-Type": "application/json",
        },
        json={
            "title": ticket["title"],
            "description": ticket["body"],
            "priority": ticket["priority"],
        },
        timeout=15,
    )
    if resp.status_code == 201:
        data = resp.json()
        print(f"  Created ticket '{ticket['title'][:50]}...' → {data['id']}")
    else:
        print(f"  Failed ticket '{ticket['title'][:40]}': {resp.status_code} {resp.text[:200]}")


def main():
    parser = argparse.ArgumentParser(description="Seed TicketPilot demo data")
    parser.add_argument("--token", help="JWT access token (skip login)")
    parser.add_argument("--email", help="Account email for login")
    parser.add_argument("--password", help="Account password for login")
    parser.add_argument("--org-id", required=True, help="Organization UUID")
    parser.add_argument("--supabase-url", default=os.getenv("SUPABASE_URL", ""), help="Supabase project URL")
    parser.add_argument("--anon-key", default=os.getenv("SUPABASE_ANON_KEY", ""), help="Supabase anon key")
    parser.add_argument("--skip-kb", action="store_true", help="Skip KB document ingestion")
    parser.add_argument("--skip-tickets", action="store_true", help="Skip ticket creation")
    args = parser.parse_args()

    # Get token
    if args.token:
        token = args.token
    elif args.email and args.password:
        if not args.supabase_url or not args.anon_key:
            print("Error: --supabase-url and --anon-key required for login (or set SUPABASE_URL and SUPABASE_ANON_KEY env vars)")
            sys.exit(1)
        print("Logging in...")
        token = get_token(args.email, args.password, args.supabase_url, args.anon_key)
        print("Logged in successfully")
    else:
        print("Error: provide --token or both --email and --password")
        sys.exit(1)

    org_id = args.org_id

    # Ingest KB documents
    if not args.skip_kb:
        print("\nIngesting Knowledge Base documents...")
        for filename, title in KB_DOCS:
            filepath = os.path.join(DEMO_DIR, filename)
            if not os.path.exists(filepath):
                print(f"  Skipping '{filename}' (file not found)")
                continue
            ingest_doc(token, org_id, filepath, title)

    # Create demo tickets
    if not args.skip_tickets:
        print("\nCreating demo tickets...")
        for ticket in DEMO_TICKETS:
            create_ticket(token, org_id, ticket)

    print("\nDone! Demo data seeded successfully.")
    print(f"Visit: http://localhost:3000/dashboard")


if __name__ == "__main__":
    main()
