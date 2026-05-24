#!/usr/bin/env python3
"""
Multi-Organization Security Testing Suite
Tests data isolation between organizations

Usage:
    python test_multi_org_security.py

This script creates two test organizations with separate data
and verifies that:
1. Users cannot access other organization's tickets
2. Users cannot modify other organization's tickets
3. AI suggestions respect org boundaries
4. Rep queue only shows own org's tickets
5. Knowledge base is properly isolated
"""

import os
import sys
import requests
import json
from typing import Dict, Optional, Tuple
from datetime import datetime

# Configuration
BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
API_BASE = f"{BASE_URL}/api"

# ANSI Colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"
BOLD = "\033[1m"

# Test Results
test_results = []


def log(message: str, level: str = "INFO"):
    """Log formatted messages"""
    colors = {
        "INFO": BLUE,
        "SUCCESS": GREEN,
        "ERROR": RED,
        "WARN": YELLOW
    }
    color = colors.get(level, RESET)
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"{color}[{timestamp}] {level}: {message}{RESET}")


def test_result(test_name: str, passed: bool, details: str = ""):
    """Record test result"""
    test_results.append({
        "test": test_name,
        "passed": passed,
        "details": details
    })
    status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
    log(f"{test_name}: {status} {details}", "SUCCESS" if passed else "ERROR")


class TestUser:
    """Represents a test user with authentication"""
    
    def __init__(self, email: str, password: str, org_id: Optional[str] = None):
        self.email = email
        self.password = password
        self.token: Optional[str] = None
        self.org_id = org_id
        self.user_id: Optional[str] = None
    
    def headers(self, org_id: Optional[str] = None) -> Dict[str, str]:
        """Get request headers with auth and org context"""
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        if org_id or self.org_id:
            headers["X-Organization-ID"] = org_id or self.org_id
        return headers


def create_test_user(email: str, password: str, full_name: str) -> Tuple[TestUser, str]:
    """Create a test user and organization"""
    log(f"Creating test user: {email}")
    
    # Register user
    response = requests.post(
        f"{API_BASE}/auth/signup",
        json={
            "email": email,
            "password": password,
            "full_name": full_name
        }
    )
    
    if response.status_code != 200:
        log(f"Failed to create user: {response.text}", "ERROR")
        return None, None
    
    data = response.json()
    user = TestUser(email, password)
    user.token = data.get("access_token")
    user.user_id = data.get("user", {}).get("id")
    
    # Get user's default organization
    org_response = requests.get(
        f"{API_BASE}/organizations",
        headers={"Authorization": f"Bearer {user.token}"}
    )
    
    if org_response.status_code == 200:
        orgs = org_response.json()
        if orgs:
            user.org_id = orgs[0]["id"]
            org_name = orgs[0]["name"]
            log(f"User {email} assigned to org: {org_name} ({user.org_id})", "SUCCESS")
            return user, org_name
    
    log(f"Failed to get organization for {email}", "ERROR")
    return user, None


def create_test_ticket(user: TestUser, title: str, description: str) -> Optional[str]:
    """Create a test ticket"""
    response = requests.post(
        f"{API_BASE}/tickets",
        headers=user.headers(),
        json={
            "title": title,
            "description": description,
            "priority": "medium"
        }
    )
    
    if response.status_code == 200:
        ticket_id = response.json().get("id")
        log(f"Created ticket: {ticket_id}", "SUCCESS")
        return ticket_id
    
    log(f"Failed to create ticket: {response.text}", "ERROR")
    return None


def test_cross_org_ticket_access(user_a: TestUser, user_b: TestUser, 
                                  ticket_a: str, ticket_b: str):
    """Test 1: Users cannot access other org's tickets"""
    log("=" * 80)
    log("TEST 1: Cross-Organization Ticket Access", "INFO")
    log("=" * 80)
    
    # Test 1a: User A tries to access User B's ticket
    log("Test 1a: User A accessing User B's ticket (should fail)")
    response = requests.get(
        f"{API_BASE}/tickets/{ticket_b}",
        headers=user_a.headers()
    )
    
    test_result(
        "Cross-org ticket access blocked",
        response.status_code == 404,
        f"Status: {response.status_code} (expected 404)"
    )
    
    # Test 1b: User B tries to access User A's ticket
    log("Test 1b: User B accessing User A's ticket (should fail)")
    response = requests.get(
        f"{API_BASE}/tickets/{ticket_a}",
        headers=user_b.headers()
    )
    
    test_result(
        "Cross-org ticket access blocked (reverse)",
        response.status_code == 404,
        f"Status: {response.status_code} (expected 404)"
    )
    
    # Test 1c: User A can access own ticket
    log("Test 1c: User A accessing own ticket (should succeed)")
    response = requests.get(
        f"{API_BASE}/tickets/{ticket_a}",
        headers=user_a.headers()
    )
    
    test_result(
        "Same-org ticket access works",
        response.status_code == 200,
        f"Status: {response.status_code} (expected 200)"
    )


def test_cross_org_ticket_modification(user_a: TestUser, user_b: TestUser, ticket_b: str):
    """Test 2: Users cannot modify other org's tickets"""
    log("=" * 80)
    log("TEST 2: Cross-Organization Ticket Modification", "INFO")
    log("=" * 80)
    
    # Test 2a: User A tries to add message to User B's ticket
    log("Test 2a: User A adding message to User B's ticket (should fail)")
    response = requests.post(
        f"{API_BASE}/tickets/{ticket_b}/messages",
        headers=user_a.headers(),
        json={"body": "This should not work"}
    )
    
    test_result(
        "Cross-org message creation blocked",
        response.status_code in [404, 403],
        f"Status: {response.status_code} (expected 404 or 403)"
    )
    
    # Test 2b: User A tries to update User B's ticket status
    log("Test 2b: User A updating User B's ticket status (should fail)")
    response = requests.patch(
        f"{API_BASE}/tickets/{ticket_b}/status",
        headers=user_a.headers(),
        json={"status": "closed"}
    )
    
    test_result(
        "Cross-org status update blocked",
        response.status_code in [404, 403],
        f"Status: {response.status_code} (expected 404 or 403)"
    )


def test_ai_suggestions_security(user_a: TestUser, ticket_b: str):
    """Test 3: AI suggestions respect org boundaries (CRITICAL - Day 9 fix)"""
    log("=" * 80)
    log("TEST 3: AI Suggestions Security (Day 9 Fix Verification)", "INFO")
    log("=" * 80)
    
    # Test 3a: User A tries to get AI suggestions for User B's ticket
    log("Test 3a: User A requesting AI suggestion for User B's ticket (should fail)")
    response = requests.post(
        f"{API_BASE}/tickets/{ticket_b}/suggest",
        headers=user_a.headers(),
        json={"query": "How do I fix this?"}
    )
    
    # This is the critical test - the Day 9 fix should prevent this
    test_result(
        "Cross-org AI suggestion blocked (Day 9 fix)",
        response.status_code == 404,
        f"Status: {response.status_code} (expected 404) - Day 9 security fix verified"
    )
    
    if response.status_code != 404:
        log(f"CRITICAL: Day 9 fix may not be working! Response: {response.text}", "ERROR")


def test_rep_queue_isolation(user_a: TestUser, user_b: TestUser):
    """Test 4: Rep queue only shows own org's tickets"""
    log("=" * 80)
    log("TEST 4: Rep Queue Organization Isolation", "INFO")
    log("=" * 80)
    
    # Make users reps in their orgs (if possible)
    log("Test 4a: User A viewing rep queue")
    response = requests.get(
        f"{API_BASE}/rep/queue?lane=unassigned",
        headers=user_a.headers()
    )
    
    if response.status_code == 200:
        tickets = response.json().get("tickets", [])
        # Check that none of the tickets belong to org B
        has_other_org_tickets = any(
            ticket.get("organization_id") == user_b.org_id 
            for ticket in tickets
        )
        
        test_result(
            "Rep queue shows only own org tickets",
            not has_other_org_tickets,
            f"Found {len(tickets)} tickets, none from other org" if not has_other_org_tickets 
            else "ERROR: Found tickets from other org!"
        )
    else:
        log(f"User A may not be a rep (status {response.status_code})", "WARN")


def test_ticket_list_isolation(user_a: TestUser, user_b: TestUser):
    """Test 5: Ticket list only shows own org's tickets"""
    log("=" * 80)
    log("TEST 5: Ticket List Organization Isolation", "INFO")
    log("=" * 80)
    
    # User A gets their ticket list
    log("Test 5a: User A viewing ticket list")
    response = requests.get(
        f"{API_BASE}/tickets",
        headers=user_a.headers()
    )
    
    if response.status_code == 200:
        tickets = response.json()
        # Check that none of the tickets belong to org B
        has_other_org_tickets = any(
            ticket.get("organization_id") == user_b.org_id 
            for ticket in tickets
        )
        
        test_result(
            "Ticket list shows only own org tickets",
            not has_other_org_tickets,
            f"Found {len(tickets)} tickets, none from other org" if not has_other_org_tickets 
            else "ERROR: Found tickets from other org!"
        )
    else:
        log(f"Failed to get ticket list: {response.text}", "ERROR")


def test_org_switching_with_wrong_header(user_a: TestUser, ticket_a: str):
    """Test 6: Using wrong org header fails properly"""
    log("=" * 80)
    log("TEST 6: Wrong Organization Header Handling", "INFO")
    log("=" * 80)
    
    # User A tries to access their own ticket with User B's org header
    fake_org_id = "00000000-0000-0000-0000-000000000000"
    
    log(f"Test 6a: User A accessing own ticket with fake org header")
    response = requests.get(
        f"{API_BASE}/tickets/{ticket_a}",
        headers=user_a.headers(org_id=fake_org_id)
    )
    
    test_result(
        "Wrong org header blocks access to own ticket",
        response.status_code == 404,
        f"Status: {response.status_code} (expected 404)"
    )


def test_missing_org_header():
    """Test 7: Missing org header returns 400"""
    log("=" * 80)
    log("TEST 7: Missing Organization Header", "INFO")
    log("=" * 80)
    
    # Try to access endpoint without org header
    log("Test 7a: Request without X-Organization-ID header (should fail)")
    response = requests.get(
        f"{API_BASE}/tickets",
        headers={"Authorization": "Bearer fake-token"}
    )
    
    test_result(
        "Missing org header returns 400",
        response.status_code == 400,
        f"Status: {response.status_code} (expected 400)"
    )


def print_summary():
    """Print test summary"""
    log("=" * 80)
    log("TEST SUMMARY", "INFO")
    log("=" * 80)
    
    passed = sum(1 for result in test_results if result["passed"])
    total = len(test_results)
    percentage = (passed / total * 100) if total > 0 else 0
    
    print(f"\n{BOLD}Results: {passed}/{total} tests passed ({percentage:.1f}%){RESET}\n")
    
    # Print all results
    for result in test_results:
        status = f"{GREEN}✅ PASS{RESET}" if result["passed"] else f"{RED}❌ FAIL{RESET}"
        print(f"  {status} {result['test']}")
        if result["details"]:
            print(f"      {result['details']}")
    
    print()
    
    # Overall verdict
    if passed == total:
        log(f"🎉 ALL TESTS PASSED! Multi-org security is SOLID.", "SUCCESS")
        return 0
    else:
        log(f"⚠️  {total - passed} test(s) failed. Security issues detected!", "ERROR")
        return 1


def main():
    """Main test execution"""
    log(f"{BOLD}{'=' * 80}{RESET}")
    log(f"{BOLD}Multi-Organization Security Testing Suite{RESET}")
    log(f"{BOLD}Testing TicketPilot Multi-Tenant Isolation{RESET}")
    log(f"{BOLD}{'=' * 80}{RESET}\n")
    
    # Check backend is running
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        if response.status_code != 200:
            log(f"Backend health check failed: {response.status_code}", "ERROR")
            return 1
        log("Backend is running ✓", "SUCCESS")
    except requests.exceptions.RequestException as e:
        log(f"Cannot connect to backend at {BASE_URL}: {e}", "ERROR")
        log("Please start the backend server first.", "ERROR")
        return 1
    
    print()
    
    # Create test users
    log("Setting up test environment...", "INFO")
    user_a, org_a_name = create_test_user(
        f"alice-test-{datetime.now().timestamp()}@test.com",
        "SecurePass123!",
        "Alice Test"
    )
    
    user_b, org_b_name = create_test_user(
        f"bob-test-{datetime.now().timestamp()}@test.com",
        "SecurePass123!",
        "Bob Test"
    )
    
    if not user_a or not user_b:
        log("Failed to create test users", "ERROR")
        return 1
    
    log(f"Created Organization A: {org_a_name} ({user_a.org_id})", "SUCCESS")
    log(f"Created Organization B: {org_b_name} ({user_b.org_id})", "SUCCESS")
    print()
    
    # Create test tickets
    ticket_a = create_test_ticket(
        user_a,
        "Org A Ticket - Test Isolation",
        "This ticket belongs to Organization A and should not be accessible by Organization B"
    )
    
    ticket_b = create_test_ticket(
        user_b,
        "Org B Ticket - Test Isolation",
        "This ticket belongs to Organization B and should not be accessible by Organization A"
    )
    
    if not ticket_a or not ticket_b:
        log("Failed to create test tickets", "ERROR")
        return 1
    
    print()
    
    # Run tests
    test_cross_org_ticket_access(user_a, user_b, ticket_a, ticket_b)
    print()
    
    test_cross_org_ticket_modification(user_a, user_b, ticket_b)
    print()
    
    test_ai_suggestions_security(user_a, ticket_b)
    print()
    
    test_rep_queue_isolation(user_a, user_b)
    print()
    
    test_ticket_list_isolation(user_a, user_b)
    print()
    
    test_org_switching_with_wrong_header(user_a, ticket_a)
    print()
    
    test_missing_org_header()
    print()
    
    # Print summary
    return print_summary()


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        log("\n\nTest interrupted by user", "WARN")
        sys.exit(1)
    except Exception as e:
        log(f"\n\nUnexpected error: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        sys.exit(1)
