#!/usr/bin/env python3
"""Run a focused logical-flow API test across two orgs and report results."""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
import psycopg


def load_env_file(path: Path) -> None:
    if not path.exists():
        raise RuntimeError(f"Missing env file: {path}")
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def admin_create_user(session: requests.Session, supabase_url: str, service_key: str, email: str, password: str, metadata: dict | None = None) -> str:
    payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": metadata or {},
    }
    resp = session.post(
        f"{supabase_url}/auth/v1/admin/users",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"admin_create_user failed: {resp.status_code} {resp.text}")
    data = resp.json()
    return data.get("id") or (data.get("user") or {}).get("id")


def login(session: requests.Session, supabase_url: str, anon_key: str, email: str, password: str) -> str:
    resp = session.post(
        f"{supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": anon_key, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"login failed: {resp.status_code} {resp.text}")
    return resp.json()["access_token"]


def auth_context(session: requests.Session, api_base: str, token: str) -> dict[str, Any]:
    resp = session.get(
        f"{api_base}/auth/context",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"auth_context failed: {resp.status_code} {resp.text}")
    return resp.json()


def ensure_org(session: requests.Session, api_base: str, token: str, name: str) -> str:
    ctx = auth_context(session, api_base, token)
    orgs = ctx.get("organizations", [])
    if orgs:
        return orgs[0]["id"]
    resp = session.post(
        f"{api_base}/organizations",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"name": name},
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"create_organization failed: {resp.status_code} {resp.text}")
    return resp.json()["id"]


def add_member(session: requests.Session, api_base: str, admin_token: str, org_id: str, user_id: str, role: str) -> None:
    resp = session.post(
        f"{api_base}/organizations/{org_id}/members",
        headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"},
        json={"user_id": user_id, "role": role},
        timeout=30,
    )
    if resp.status_code != 201:
        raise RuntimeError(f"add_member failed: {resp.status_code} {resp.text}")


def upsert_user_role(db_url: str, user_id: str, role: str) -> None:
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO app.user_roles (user_id, role, updated_at)
                VALUES (%s, %s, now())
                ON CONFLICT (user_id)
                DO UPDATE SET role = EXCLUDED.role, updated_at = now()
                """,
                (user_id, role),
            )
        conn.commit()


def create_ticket(session: requests.Session, api_base: str, token: str, org_id: str, title: str, description: str) -> str:
    resp = session.post(
        f"{api_base}/tickets",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Organization-ID": org_id,
            "Content-Type": "application/json",
        },
        json={"title": title, "description": description, "priority": "high", "tags": ["billing", "urgent"]},
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"create_ticket failed: {resp.status_code} {resp.text}")
    return resp.json()["id"]


def api_call(session: requests.Session, method: str, url: str, headers: dict, json_body: dict | None = None) -> tuple[int, str]:
    resp = session.request(method, url, headers=headers, json=json_body, timeout=30)
    return resp.status_code, resp.text


def main() -> None:
    repo_root = Path(__file__).resolve().parent
    load_env_file(repo_root / "backend" / ".env")

    api_base = "http://localhost:8000/api"
    supabase_url = os.environ["SUPABASE_URL"]
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    db_url = os.environ["DATABASE_URL"]

    suffix = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    password = "Test123!"

    session = requests.Session()

    results: list[tuple[str, bool, str]] = []

    def ok(label: str) -> None:
        results.append((label, True, ""))

    def fail(label: str, detail: str) -> None:
        results.append((label, False, detail))

    admin_a_email = f"tp-admin-a-{suffix}@example.com"
    admin_b_email = f"tp-admin-b-{suffix}@example.com"
    rep_a_email = f"tp-rep-a-{suffix}@example.com"
    rep_b_email = f"tp-rep-b-{suffix}@example.com"
    customer_a_email = f"tp-customer-a-{suffix}@example.com"
    customer_b_email = f"tp-customer-b-{suffix}@example.com"

    admin_a_id = admin_create_user(session, supabase_url, service_key, admin_a_email, password, {"display_name": "Admin A"})
    admin_b_id = admin_create_user(session, supabase_url, service_key, admin_b_email, password, {"display_name": "Admin B"})
    rep_a_id = admin_create_user(session, supabase_url, service_key, rep_a_email, password, {"display_name": "Rep A"})
    rep_b_id = admin_create_user(session, supabase_url, service_key, rep_b_email, password, {"display_name": "Rep B"})
    customer_a_id = admin_create_user(session, supabase_url, service_key, customer_a_email, password, {"display_name": "Customer A"})
    customer_b_id = admin_create_user(session, supabase_url, service_key, customer_b_email, password, {"display_name": "Customer B"})

    upsert_user_role(db_url, admin_a_id, "admin")
    upsert_user_role(db_url, admin_b_id, "admin")
    upsert_user_role(db_url, rep_a_id, "rep")
    upsert_user_role(db_url, rep_b_id, "rep")
    upsert_user_role(db_url, customer_a_id, "customer")
    upsert_user_role(db_url, customer_b_id, "customer")

    admin_a_token = login(session, supabase_url, anon_key, admin_a_email, password)
    admin_b_token = login(session, supabase_url, anon_key, admin_b_email, password)

    org_a_id = ensure_org(session, api_base, admin_a_token, f"Test Org A {suffix}")
    org_b_id = ensure_org(session, api_base, admin_b_token, f"Test Org B {suffix}")

    add_member(session, api_base, admin_a_token, org_a_id, rep_a_id, "rep")
    add_member(session, api_base, admin_a_token, org_a_id, customer_a_id, "member")
    add_member(session, api_base, admin_b_token, org_b_id, rep_b_id, "rep")
    add_member(session, api_base, admin_b_token, org_b_id, customer_b_id, "member")

    rep_a_token = login(session, supabase_url, anon_key, rep_a_email, password)
    rep_b_token = login(session, supabase_url, anon_key, rep_b_email, password)
    customer_a_token = login(session, supabase_url, anon_key, customer_a_email, password)
    customer_b_token = login(session, supabase_url, anon_key, customer_b_email, password)

    auth_context(session, api_base, rep_a_token)
    auth_context(session, api_base, rep_b_token)
    auth_context(session, api_base, customer_a_token)
    auth_context(session, api_base, customer_b_token)

    ticket_a = None
    ticket_b = None

    try:
        ticket_a = create_ticket(session, api_base, customer_a_token, org_a_id, "Billing charged twice", "Customer reports double charge on invoice INV-1001.")
        ok("Create ticket in Org A")
    except Exception as exc:
        fail("Create ticket in Org A", str(exc))

    try:
        ticket_b = create_ticket(session, api_base, customer_b_token, org_b_id, "Login fails on mobile", "Customer cannot sign in on iOS app.")
        ok("Create ticket in Org B")
    except Exception as exc:
        fail("Create ticket in Org B", str(exc))

    if ticket_a:
        status, text = api_call(
            session,
            "POST",
            f"{api_base}/rep/tickets/{ticket_a}/accept",
            {"Authorization": f"Bearer {rep_a_token}", "X-Organization-ID": org_a_id},
        )
        ok("Rep accepts ticket") if status == 200 else fail("Rep accepts ticket", f"{status} {text}")

        status, text = api_call(
            session,
            "POST",
            f"{api_base}/rep/tickets/{ticket_a}/status",
            {"Authorization": f"Bearer {rep_a_token}", "X-Organization-ID": org_a_id, "Content-Type": "application/json"},
            {"status": "in_progress"},
        )
        ok("Rep status in_progress") if status == 200 else fail("Rep status in_progress", f"{status} {text}")

        status, text = api_call(
            session,
            "POST",
            f"{api_base}/tickets/{ticket_a}/messages",
            {"Authorization": f"Bearer {rep_a_token}", "X-Organization-ID": org_a_id, "Content-Type": "application/json"},
            {"body": "Internal triage: verify payment gateway logs.", "is_internal": True},
        )
        ok("Rep internal note") if status == 201 else fail("Rep internal note", f"{status} {text}")

        status, text = api_call(
            session,
            "POST",
            f"{api_base}/tickets/{ticket_a}/messages",
            {"Authorization": f"Bearer {rep_a_token}", "X-Organization-ID": org_a_id, "Content-Type": "application/json"},
            {"body": "We are checking the billing gateway and will update shortly.", "is_internal": False},
        )
        ok("Rep public reply") if status == 201 else fail("Rep public reply", f"{status} {text}")

        status, text = api_call(
            session,
            "POST",
            f"{api_base}/rep/tickets/{ticket_a}/escalate",
            {"Authorization": f"Bearer {rep_a_token}", "X-Organization-ID": org_a_id, "Content-Type": "application/json"},
            {"escalated_to_user_id": admin_a_id, "reason": "Needs billing admin approval"},
        )
        ok("Rep escalates ticket") if status == 200 else fail("Rep escalates ticket", f"{status} {text}")

        status, text = api_call(
            session,
            "POST",
            f"{api_base}/tickets/{ticket_a}/resolve",
            {"Authorization": f"Bearer {rep_a_token}", "X-Organization-ID": org_a_id, "Content-Type": "application/json"},
            {"resolution_note": "Duplicate charge refunded; bank reversal in 3-5 days.", "status": "resolved"},
        )
        ok("Rep resolves ticket") if status in (200, 201) else fail("Rep resolves ticket", f"{status} {text}")

        status, text = api_call(
            session,
            "POST",
            f"{api_base}/tickets/{ticket_a}/rating",
            {"Authorization": f"Bearer {customer_a_token}", "X-Organization-ID": org_a_id, "Content-Type": "application/json"},
            {"rating": 5},
        )
        ok("Customer rates ticket") if status == 200 else fail("Customer rates ticket", f"{status} {text}")

    if ticket_a and ticket_b:
        status, _ = api_call(
            session,
            "GET",
            f"{api_base}/tickets/{ticket_b}",
            {"Authorization": f"Bearer {rep_a_token}", "X-Organization-ID": org_a_id},
        )
        ok("Cross-org access blocked (rep A -> ticket B)") if status == 404 else fail("Cross-org access blocked (rep A -> ticket B)", f"status {status}")

        status, _ = api_call(
            session,
            "GET",
            f"{api_base}/tickets/{ticket_a}",
            {"Authorization": f"Bearer {customer_b_token}", "X-Organization-ID": org_b_id},
        )
        ok("Cross-org access blocked (customer B -> ticket A)") if status == 404 else fail("Cross-org access blocked (customer B -> ticket A)", f"status {status}")

    try:
        resp = session.get(
            f"{api_base}/admin/audit-log",
            headers={"Authorization": f"Bearer {admin_a_token}"},
            params={"org_id": org_a_id, "limit": 50},
            timeout=30,
        )
        if resp.status_code == 200:
            actions = [item.get("action") for item in resp.json().get("items", [])]
            needed = ["ticket.accepted", "ticket.status.in_progress", "ticket.escalated"]
            missing = [a for a in needed if a not in actions]
            if missing:
                fail("Audit log actions recorded", f"missing: {', '.join(missing)}")
            else:
                ok("Audit log actions recorded")
        else:
            fail("Audit log actions recorded", f"status {resp.status_code}: {resp.text}")
    except Exception as exc:
        fail("Audit log actions recorded", str(exc))

    print("TEST_RESULTS_START")
    for label, passed, detail in results:
        status = "PASS" if passed else "FAIL"
        line = f"{status} | {label}"
        if detail:
            line += f" | {detail}"
        print(line)
    print("TEST_RESULTS_END")

    print("SUMMARY")
    print(f"Org A: {org_a_id}")
    print(f"Org B: {org_b_id}")
    print(f"Ticket A: {ticket_a}")
    print(f"Ticket B: {ticket_b}")


if __name__ == "__main__":
    main()
