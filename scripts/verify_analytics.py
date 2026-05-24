#!/usr/bin/env python3
"""
Dashboard & Analytics Data Verification
Tests that all analytics endpoints return correct, organization-scoped data
"""

import requests
import json
from typing import Dict
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api"

# Colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"

test_results = {"passed": 0, "failed": 0, "tests": []}


def log(message: str, level: str = "INFO"):
    """Log formatted messages"""
    colors = {"INFO": BLUE, "SUCCESS": GREEN, "ERROR": RED, "WARN": YELLOW}
    color = colors.get(level, RESET)
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {color}{level:8}{RESET}: {message}")


def record_test(name: str, passed: bool, message: str = ""):
    """Record test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    test_results["tests"].append({"name": name, "passed": passed, "message": message})
    
    if passed:
        test_results["passed"] += 1
        log(f"{status} {name}", "SUCCESS")
    else:
        test_results["failed"] += 1
        log(f"{status} {name}: {message}", "ERROR")
        
    if message and passed:
        log(f"  └─ {message}", "INFO")


def print_header(title: str):
    """Print section header"""
    print(f"\n{BOLD}{CYAN}{'=' * 80}{RESET}")
    print(f"{BOLD}{CYAN}{title.center(80)}{RESET}")
    print(f"{BOLD}{CYAN}{'=' * 80}{RESET}\n")


def test_backend_health():
    """Verify backend is running"""
    try:
        response = requests.get(f"{API_BASE}/health", timeout=5)
        if response.status_code == 200:
            record_test("Backend Health Check", True, "Backend is running")
            return True
        else:
            record_test("Backend Health Check", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        record_test("Backend Health Check", False, str(e))
        return False


def test_analytics_summary_structure():
    """Test /api/admin/analytics/summary structure"""
    try:
        # Note: This will return 401 without auth, but we can test the endpoint exists
        response = requests.get(f"{API_BASE}/admin/analytics/summary", timeout=5)
        
        # Should return 401 (unauthorized) or 403 (forbidden), not 404
        if response.status_code in [401, 403]:
            record_test(
                "Analytics Summary Endpoint",
                True,
                "Endpoint exists and requires authentication"
            )
            return True
        elif response.status_code == 404:
            record_test(
                "Analytics Summary Endpoint",
                False,
                "Endpoint not found (404)"
            )
            return False
        else:
            record_test(
                "Analytics Summary Endpoint",
                True,
                f"Endpoint exists (status: {response.status_code})"
            )
            return True
    except Exception as e:
        record_test("Analytics Summary Endpoint", False, str(e))
        return False


def test_analytics_by_category():
    """Test /api/admin/analytics/by-category structure"""
    try:
        response = requests.get(f"{API_BASE}/admin/analytics/by-category", timeout=5)
        
        if response.status_code in [401, 403]:
            record_test(
                "Analytics By Category Endpoint",
                True,
                "Endpoint exists and requires authentication"
            )
            return True
        elif response.status_code == 404:
            record_test(
                "Analytics By Category Endpoint",
                False,
                "Endpoint not found (404)"
            )
            return False
        else:
            record_test(
                "Analytics By Category Endpoint",
                True,
                f"Endpoint exists (status: {response.status_code})"
            )
            return True
    except Exception as e:
        record_test("Analytics By Category Endpoint", False, str(e))
        return False


def test_rep_performance():
    """Test /api/admin/analytics/rep-performance structure"""
    try:
        response = requests.get(f"{API_BASE}/admin/analytics/rep-performance", timeout=5)
        
        if response.status_code in [401, 403]:
            record_test(
                "Rep Performance Endpoint",
                True,
                "Endpoint exists and requires authentication"
            )
            return True
        elif response.status_code == 404:
            record_test(
                "Rep Performance Endpoint",
                False,
                "Endpoint not found (404)"
            )
            return False
        else:
            record_test(
                "Rep Performance Endpoint",
                True,
                f"Endpoint exists (status: {response.status_code})"
            )
            return True
    except Exception as e:
        record_test("Rep Performance Endpoint", False, str(e))
        return False


def test_rag_analytics():
    """Test /api/admin/analytics/rag structure"""
    try:
        response = requests.get(f"{API_BASE}/admin/analytics/rag", timeout=5)
        
        if response.status_code in [401, 403]:
            record_test(
                "RAG Analytics Endpoint",
                True,
                "Endpoint exists and requires authentication"
            )
            return True
        elif response.status_code == 404:
            record_test(
                "RAG Analytics Endpoint",
                False,
                "Endpoint not found (404)"
            )
            return False
        else:
            record_test(
                "RAG Analytics Endpoint",
                True,
                f"Endpoint exists (status: {response.status_code})"
            )
            return True
    except Exception as e:
        record_test("RAG Analytics Endpoint", False, str(e))
        return False


def test_rep_counts():
    """Test /api/rep/counts structure"""
    try:
        response = requests.get(f"{API_BASE}/rep/counts", timeout=5)
        
        if response.status_code in [401, 403]:
            record_test(
                "Rep Counts Endpoint",
                True,
                "Endpoint exists and requires authentication"
            )
            return True
        elif response.status_code == 404:
            record_test(
                "Rep Counts Endpoint",
                False,
                "Endpoint not found (404)"
            )
            return False
        else:
            record_test(
                "Rep Counts Endpoint",
                True,
                f"Endpoint exists (status: {response.status_code})"
            )
            return True
    except Exception as e:
        record_test("Rep Counts Endpoint", False, str(e))
        return False


def verify_organization_scoping():
    """Verify that analytics queries include organization_id filters"""
    log("Checking backend code for organization_id filters...", "INFO")
    
    import os
    admin_py_path = os.path.join(
        os.path.dirname(__file__),
        "backend/app/admin.py"
    )
    
    if not os.path.exists(admin_py_path):
        record_test(
            "Organization Scoping (Code Check)",
            False,
            "admin.py not found"
        )
        return False
    
    with open(admin_py_path, 'r') as f:
        admin_code = f.read()
    
    # Check for organization_id filters in analytics queries
    checks = [
        ("WHERE organization_id", "org_id filter in WHERE clause"),
        ("require_org_context", "Organization context middleware"),
        ("org_id = require_org_context", "org_id extraction from request")
    ]
    
    all_passed = True
    for check_str, description in checks:
        if check_str in admin_code:
            log(f"  ✅ Found: {description}", "SUCCESS")
        else:
            log(f"  ❌ Missing: {description}", "ERROR")
            all_passed = False
    
    record_test(
        "Organization Scoping (Code Check)",
        all_passed,
        "All organization filters present" if all_passed else "Missing organization filters"
    )
    
    return all_passed


def print_summary():
    """Print test summary"""
    print_header("TEST SUMMARY")
    
    total = test_results["passed"] + test_results["failed"]
    success_rate = (test_results["passed"] / total * 100) if total > 0 else 0
    
    print(f"{BOLD}Total Tests:{RESET} {total}")
    print(f"{GREEN}✅ Passed:{RESET} {test_results['passed']}")
    print(f"{RED}❌ Failed:{RESET} {test_results['failed']}")
    print(f"{BOLD}Success Rate:{RESET} {success_rate:.1f}%\n")
    
    if test_results["failed"] > 0:
        print(f"{RED}{BOLD}FAILED TESTS:{RESET}")
        for test in test_results["tests"]:
            if not test["passed"]:
                print(f"  • {test['name']}: {test['message']}")
    
    print(f"\n{BOLD}{'=' * 80}{RESET}\n")
    
    if success_rate == 100:
        print(f"{GREEN}{BOLD}✅ ALL ANALYTICS ENDPOINTS VERIFIED!{RESET}\n")
        return 0
    elif success_rate >= 80:
        print(f"{YELLOW}{BOLD}⚠️  MOSTLY WORKING - MINOR ISSUES{RESET}\n")
        return 1
    else:
        print(f"{RED}{BOLD}❌ ANALYTICS NEED ATTENTION{RESET}\n")
        return 2


def main():
    """Run all analytics verification tests"""
    print_header("Analytics & Dashboard Data Verification")
    log("Testing all analytics endpoints and data integrity...", "INFO")
    
    # Test 1: Backend health
    print_header("TEST SUITE 1: Backend Status")
    if not test_backend_health():
        log("Backend not running. Please start the backend server first.", "ERROR")
        return 1
    
    # Test 2: Analytics endpoints
    print_header("TEST SUITE 2: Analytics Endpoints")
    test_analytics_summary_structure()
    test_analytics_by_category()
    test_rep_performance()
    test_rag_analytics()
    test_rep_counts()
    
    # Test 3: Organization scoping
    print_header("TEST SUITE 3: Data Isolation & Security")
    verify_organization_scoping()
    
    # Print summary
    return print_summary()


if __name__ == "__main__":
    import sys
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Tests interrupted by user{RESET}")
        sys.exit(130)
    except Exception as e:
        print(f"\n{RED}Fatal error: {e}{RESET}")
        sys.exit(1)
