#!/usr/bin/env python3
"""
Simplified Multi-Organization Security Testing
Tests using manually created test users via Supabase

SETUP:
1. Create two test users via Supabase UI or signup page:
   - alice@test-org-a.com (password: Test123!)
   - bob@test-org-b.com (password: Test123!)
2. Each will auto-create their own organization
3. Run this script to verify data isolation

Usage:
    python test_multi_org_simple.py alice@test-org-a.com Test123! bob@test-org-b.com Test123!
"""

import os
import sys
import requests
from typing import Optional
from datetime import datetime

# Configuration
BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://vnubozvpqpdnqgwfqngx.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWJvenZwcXBkbnFnd2Zxbmd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxNDgxNzgsImV4cCI6MjA0ODcyNDE3OH0.tIexIq7eF2t90j6r4Zy9u7hAzlQY_GiJX87wOq0s7ps")

# Colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"
BOLD = "\033[1m"

test_results = []

def log(message: str, level: str = "INFO"):
    colors = {"INFO": BLUE, "SUCCESS": GREEN, "ERROR": RED, "WARN": YELLOW}
    color = colors.get(level, RESET)
    print(f"{color}[{level}] {message}{RESET}")

def test_result(test_name: str, passed: bool, details: str = ""):
    test_results.append({"test": test_name, "passed": passed, "details": details})
    status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
    log(f"{test_name}: {status} {details}", "SUCCESS" if passed else "ERROR")

def login_supabase(email: str, password: str):
    """Login via Supabase and get JWT token"""
    response = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": email, "password": password},
        headers={"apikey": SUPABASE_ANON_KEY}
    )
    
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    
    log(f"Login failed for {email}: {response.text}", "ERROR")
    return None

def get_user_org(token: str) -> tuple:
    """Get user's default organization"""
    response = requests.get(
        f"{BASE_URL}/api/auth/context",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        user = data.get("user", {})
        orgs = data.get("organizations", [])
        if orgs:
            org = orgs[0]
            return user.get("id"), org.get("id"), org.get("name")
    
    return None, None, None

def create_ticket(token: str, org_id: str, title: str, description: str):
    """Create a test ticket"""
    response = requests.post(
        f"{BASE_URL}/api/tickets",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Organization-ID": org_id,
            "Content-Type": "application/json"
        },
        json={"title": title, "description": description, "priority": "medium"}
    )
    
    if response.status_code == 200:
        return response.json().get("id")
    
    log(f"Failed to create ticket: {response.text}", "ERROR")
    return None

def main():
    if len(sys.argv) != 5:
        print("Usage: python test_multi_org_simple.py <email_a> <pass_a> <email_b> <pass_b>")
        print("\nExample:")
        print("  python test_multi_org_simple.py alice@test.com Pass123! bob@test.com Pass123!")
        print("\nIMPORTANT: Create these users first via:")
        print("  1. Frontend signup page (http://localhost:3000/signup)")
        print("  2. Each user will auto-create their own organization")
        return 1
    
    email_a, pass_a, email_b, pass_b = sys.argv[1:5]
    
    log(f"{BOLD}{'=' * 80}{RESET}")
    log(f"{BOLD}Multi-Organization Security Testing{RESET}")
    log(f"{BOLD}{'=' * 80}{RESET}\n")
    
    # Login users
    log(f"Logging in User A: {email_a}")
    token_a = login_supabase(email_a, pass_a)
    if not token_a:
        log("Failed to login User A", "ERROR")
        return 1
    
    log(f"Logging in User B: {email_b}")
    token_b = login_supabase(email_b, pass_b)
    if not token_b:
        log("Failed to login User B", "ERROR")
        return 1
    
    # Get organizations
    user_a_id, org_a_id, org_a_name = get_user_org(token_a)
    user_b_id, org_b_id, org_b_name = get_user_org(token_b)
    
    if not org_a_id or not org_b_id:
        log("Failed to get organizations", "ERROR")
        return 1
    
    log(f"User A in org: {org_a_name} ({org_a_id})", "SUCCESS")
    log(f"User B in org: {org_b_name} ({org_b_id})", "SUCCESS")
    print()
    
    # Create test tickets
    log("Creating test tickets...")
    ticket_a = create_ticket(token_a, org_a_id, "Org A Ticket", "This belongs to Org A")
    ticket_b = create_ticket(token_b, org_b_id, "Org B Ticket", "This belongs to Org B")
    
    if not ticket_a or not ticket_b:
        log("Failed to create test tickets", "ERROR")
        return 1
    
    log(f"Created ticket in Org A: {ticket_a}", "SUCCESS")
    log(f"Created ticket in Org B: {ticket_b}", "SUCCESS")
    print()
    
    # TEST 1: Cross-org ticket access
    log("=" * 80)
    log("TEST 1: Cross-Organization Ticket Access")
    log("=" * 80)
    
    log("Test 1a: User A accessing User B's ticket (should be 404)")
    response = requests.get(
        f"{BASE_URL}/api/tickets/{ticket_b}",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Organization-ID": org_a_id
        }
    )
    test_result(
        "Cross-org ticket access blocked",
        response.status_code == 404,
        f"Status: {response.status_code}"
    )
    
    log("Test 1b: User A accessing own ticket (should be 200)")
    response = requests.get(
        f"{BASE_URL}/api/tickets/{ticket_a}",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Organization-ID": org_a_id
        }
    )
    test_result(
        "Same-org ticket access works",
        response.status_code == 200,
        f"Status: {response.status_code}"
    )
    print()
    
    # TEST 2: Cross-org AI suggestions (Day 9 fix verification)
    log("=" * 80)
    log("TEST 2: AI Suggestions Security (Day 9 Fix)")
    log("=" * 80)
    
    log("Test 2a: User A requesting AI suggestion for User B's ticket (should be 404)")
    response = requests.post(
        f"{BASE_URL}/api/tickets/{ticket_b}/suggest",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Organization-ID": org_a_id,
            "Content-Type": "application/json"
        },
        json={"query": "How do I fix this?"}
    )
    test_result(
        "Cross-org AI suggestion blocked (Day 9 fix verified)",
        response.status_code == 404,
        f"Status: {response.status_code} - Security fix working!"
    )
    print()
    
    # TEST 3: Cross-org message creation
    log("=" * 80)
    log("TEST 3: Cross-Organization Message Creation")
    log("=" * 80)
    
    log("Test 3a: User A adding message to User B's ticket (should be 404/403)")
    response = requests.post(
        f"{BASE_URL}/api/tickets/{ticket_b}/messages",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Organization-ID": org_a_id,
            "Content-Type": "application/json"
        },
        json={"body": "This should not work"}
    )
    test_result(
        "Cross-org message creation blocked",
        response.status_code in [404, 403],
        f"Status: {response.status_code}"
    )
    print()
    
    # TEST 4: Ticket list isolation
    log("=" * 80)
    log("TEST 4: Ticket List Organization Isolation")
    log("=" * 80)
    
    log("Test 4a: User A's ticket list (should not contain User B's tickets)")
    response = requests.get(
        f"{BASE_URL}/api/tickets",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Organization-ID": org_a_id
        }
    )
    
    if response.status_code == 200:
        tickets = response.json()
        ticket_ids = [t.get("id") for t in tickets]
        has_other_org = ticket_b in ticket_ids
        test_result(
            "Ticket list shows only own org tickets",
            not has_other_org,
            f"Found {len(tickets)} tickets, no cross-org leakage"
        )
    else:
        test_result("Ticket list isolation", False, f"Failed to get tickets: {response.status_code}")
    
    print()
    
    # TEST 5: Wrong org header
    log("=" * 80)
    log("TEST 5: Wrong Organization Header")
    log("=" * 80)
    
    log("Test 5a: User A accessing own ticket with User B's org header (should be 404)")
    response = requests.get(
        f"{BASE_URL}/api/tickets/{ticket_a}",
        headers={
            "Authorization": f"Bearer {token_a}",
            "X-Organization-ID": org_b_id  # Wrong org!
        }
    )
    test_result(
        "Wrong org header blocks access",
        response.status_code == 404,
        f"Status: {response.status_code}"
    )
    print()
    
    # Summary
    log("=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    
    passed = sum(1 for r in test_results if r["passed"])
    total = len(test_results)
    percentage = (passed / total * 100) if total > 0 else 0
    
    print(f"\n{BOLD}Results: {passed}/{total} tests passed ({percentage:.1f}%){RESET}\n")
    
    for result in test_results:
        status = f"{GREEN}✅ PASS{RESET}" if result["passed"] else f"{RED}❌ FAIL{RESET}"
        print(f"  {status} {result['test']}")
        if result["details"]:
            print(f"      {result['details']}")
    
    print()
    
    if passed == total:
        log("🎉 ALL TESTS PASSED! Multi-org security is SOLID.", "SUCCESS")
        log("✅ Day 9 security fix verified working correctly!", "SUCCESS")
        return 0
    else:
        log(f"⚠️  {total - passed} test(s) failed. Security issues detected!", "ERROR")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        log("\nTest interrupted", "WARN")
        sys.exit(1)
    except Exception as e:
        log(f"Unexpected error: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        sys.exit(1)
