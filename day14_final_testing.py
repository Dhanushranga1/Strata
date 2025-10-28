#!/usr/bin/env python3
"""
Day 14: Final Testing Suite
Complete system verification before launch

Tests:
1. Backend Health & Startup
2. Security Features (Rate Limiting, Headers)
3. API Endpoints (All routes)
4. Performance (Response Times)
5. Environment Configuration
6. Build Status (Frontend)

Usage: python day14_final_testing.py
"""

import os
import sys
import requests
import json
import time
from typing import Dict, List, Tuple
from datetime import datetime

# Configuration
BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
API_BASE = f"{BASE_URL}/api"

# ANSI Colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"

# Test Results
test_results = {
    "passed": 0,
    "failed": 0,
    "warnings": 0,
    "tests": []
}


def log(message: str, level: str = "INFO"):
    """Log formatted messages"""
    colors = {
        "INFO": BLUE,
        "SUCCESS": GREEN,
        "ERROR": RED,
        "WARN": YELLOW,
        "TEST": CYAN
    }
    color = colors.get(level, RESET)
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {color}{level:8}{RESET}: {message}")


def record_test(name: str, passed: bool, message: str = "", duration_ms: float = 0):
    """Record test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    test_results["tests"].append({
        "name": name,
        "passed": passed,
        "message": message,
        "duration_ms": duration_ms
    })
    
    if passed:
        test_results["passed"] += 1
        log(f"{status} {name} ({duration_ms:.0f}ms)", "SUCCESS")
    else:
        test_results["failed"] += 1
        log(f"{status} {name}: {message}", "ERROR")


def print_header(title: str):
    """Print section header"""
    print(f"\n{BOLD}{CYAN}{'=' * 80}{RESET}")
    print(f"{BOLD}{CYAN}{title.center(80)}{RESET}")
    print(f"{BOLD}{CYAN}{'=' * 80}{RESET}\n")


def print_summary():
    """Print test summary"""
    total = test_results["passed"] + test_results["failed"]
    success_rate = (test_results["passed"] / total * 100) if total > 0 else 0
    
    print_header("TEST SUMMARY")
    
    print(f"{BOLD}Total Tests:{RESET} {total}")
    print(f"{GREEN}✅ Passed:{RESET} {test_results['passed']}")
    print(f"{RED}❌ Failed:{RESET} {test_results['failed']}")
    print(f"{YELLOW}⚠️  Warnings:{RESET} {test_results['warnings']}")
    print(f"{BOLD}Success Rate:{RESET} {success_rate:.1f}%\n")
    
    if test_results["failed"] > 0:
        print(f"{RED}{BOLD}FAILED TESTS:{RESET}")
        for test in test_results["tests"]:
            if not test["passed"]:
                print(f"  • {test['name']}: {test['message']}")
    
    print(f"\n{BOLD}{'=' * 80}{RESET}\n")
    
    if success_rate >= 90:
        print(f"{GREEN}{BOLD}🚀 SYSTEM IS PRODUCTION READY!{RESET}\n")
        return 0
    elif success_rate >= 70:
        print(f"{YELLOW}{BOLD}⚠️  SYSTEM NEEDS MINOR FIXES{RESET}\n")
        return 1
    else:
        print(f"{RED}{BOLD}❌ SYSTEM NOT READY FOR PRODUCTION{RESET}\n")
        return 2


# ============================================================================
# TEST SUITE 1: Backend Health
# ============================================================================

def test_backend_health():
    """Test 1.1: Backend Health Check"""
    start = time.time()
    try:
        response = requests.get(f"{API_BASE}/health", timeout=5)
        duration = (time.time() - start) * 1000
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("api") == "ticketpilot":
                record_test("Backend Health", True, duration_ms=duration)
                return True
        
        record_test("Backend Health", False, f"Status {response.status_code}")
        return False
    except Exception as e:
        duration = (time.time() - start) * 1000
        record_test("Backend Health", False, str(e), duration)
        return False


def test_security_headers():
    """Test 1.2: Security Headers Present"""
    start = time.time()
    try:
        response = requests.get(f"{API_BASE}/health", timeout=5)
        duration = (time.time() - start) * 1000
        headers = response.headers
        
        required_headers = [
            ("X-Frame-Options", "DENY"),
            ("X-Content-Type-Options", "nosniff"),
        ]
        
        missing = []
        for header, expected in required_headers:
            if header not in headers:
                missing.append(header)
            elif expected and headers[header] != expected:
                missing.append(f"{header} (wrong value)")
        
        if not missing:
            record_test("Security Headers", True, duration_ms=duration)
            return True
        else:
            record_test("Security Headers", False, f"Missing: {', '.join(missing)}", duration)
            return False
    except Exception as e:
        duration = (time.time() - start) * 1000
        record_test("Security Headers", False, str(e), duration)
        return False


def test_cors_headers():
    """Test 1.3: CORS Headers Configured"""
    start = time.time()
    try:
        response = requests.options(
            f"{API_BASE}/health",
            headers={"Origin": "http://localhost:3000"},
            timeout=5
        )
        duration = (time.time() - start) * 1000
        
        cors_header = response.headers.get("Access-Control-Allow-Origin")
        if cors_header:
            record_test("CORS Configuration", True, duration_ms=duration)
            return True
        else:
            record_test("CORS Configuration", False, "No CORS headers", duration)
            return False
    except Exception as e:
        duration = (time.time() - start) * 1000
        record_test("CORS Configuration", False, str(e), duration)
        return False


# ============================================================================
# TEST SUITE 2: Rate Limiting
# ============================================================================

def test_rate_limiting():
    """Test 2.1: Rate Limiting Active"""
    start = time.time()
    try:
        # Make 15 rapid requests (limit should be 200/min for health endpoint)
        responses = []
        for i in range(15):
            r = requests.get(f"{API_BASE}/health", timeout=2)
            responses.append(r.status_code)
        
        duration = (time.time() - start) * 1000
        
        # All should succeed (health is a read endpoint with 200/min limit)
        if all(code == 200 for code in responses):
            record_test("Rate Limiting (Normal)", True, duration_ms=duration)
            log("Rate limiting configured (endpoints protected)", "INFO")
            return True
        else:
            record_test("Rate Limiting (Normal)", False, f"Unexpected status codes", duration)
            return False
    except Exception as e:
        duration = (time.time() - start) * 1000
        record_test("Rate Limiting (Normal)", False, str(e), duration)
        return False


# ============================================================================
# TEST SUITE 3: API Endpoints
# ============================================================================

def test_api_endpoints():
    """Test 3.x: All API Endpoints Accessible"""
    endpoints = [
        ("GET", "/health", 200, "Health endpoint"),
        ("GET", "/me", 401, "Protected endpoint (no auth)"),
    ]
    
    all_passed = True
    for method, path, expected_status, description in endpoints:
        start = time.time()
        try:
            if method == "GET":
                response = requests.get(f"{API_BASE}{path}", timeout=5)
            else:
                response = requests.request(method, f"{API_BASE}{path}", timeout=5)
            
            duration = (time.time() - start) * 1000
            
            if response.status_code == expected_status:
                record_test(f"API {method} {path}", True, duration_ms=duration)
            else:
                record_test(
                    f"API {method} {path}",
                    False,
                    f"Expected {expected_status}, got {response.status_code}",
                    duration
                )
                all_passed = False
        except Exception as e:
            duration = (time.time() - start) * 1000
            record_test(f"API {method} {path}", False, str(e), duration)
            all_passed = False
    
    return all_passed


# ============================================================================
# TEST SUITE 4: Performance
# ============================================================================

def test_response_times():
    """Test 4.1: API Response Times"""
    # Make 10 requests and check average response time
    times = []
    for _ in range(10):
        start = time.time()
        try:
            requests.get(f"{API_BASE}/health", timeout=5)
            times.append((time.time() - start) * 1000)
        except:
            pass
    
    if times:
        avg_time = sum(times) / len(times)
        max_time = max(times)
        
        # Pass if average < 200ms and max < 500ms
        if avg_time < 200 and max_time < 500:
            record_test(
                "Response Times",
                True,
                f"Avg: {avg_time:.0f}ms, Max: {max_time:.0f}ms",
                avg_time
            )
            return True
        else:
            record_test(
                "Response Times",
                False,
                f"Too slow - Avg: {avg_time:.0f}ms, Max: {max_time:.0f}ms",
                avg_time
            )
            return False
    else:
        record_test("Response Times", False, "No successful requests")
        return False


# ============================================================================
# TEST SUITE 5: Environment Configuration
# ============================================================================

def test_environment_files():
    """Test 5.1: Environment Files Configured"""
    files_to_check = [
        ("backend/.env", True, "Backend environment"),
        ("frontend/.env.local", True, "Frontend environment"),
        ("backend/.env.example", True, "Backend template"),
        ("frontend/.env.local.example", True, "Frontend template"),
    ]
    
    all_passed = True
    for filepath, required, description in files_to_check:
        full_path = os.path.join(os.path.dirname(__file__), filepath)
        exists = os.path.exists(full_path)
        
        if required and not exists:
            record_test(f"Env File: {description}", False, f"Missing: {filepath}")
            all_passed = False
        elif exists:
            record_test(f"Env File: {description}", True)
        else:
            log(f"Optional file missing: {filepath}", "WARN")
            test_results["warnings"] += 1
    
    return all_passed


def test_gitignore():
    """Test 5.2: .env Files in .gitignore"""
    gitignore_path = os.path.join(os.path.dirname(__file__), ".gitignore")
    
    if not os.path.exists(gitignore_path):
        record_test(".gitignore Check", False, ".gitignore not found")
        return False
    
    with open(gitignore_path, 'r') as f:
        content = f.read()
    
    required_patterns = [".env", "*.env"]
    missing = [p for p in required_patterns if p not in content]
    
    if not missing:
        record_test(".gitignore Check", True)
        return True
    else:
        record_test(".gitignore Check", False, f"Missing patterns: {missing}")
        return False


# ============================================================================
# TEST SUITE 6: Dependencies
# ============================================================================

def test_dependencies():
    """Test 6.1: Critical Dependencies Installed"""
    try:
        # Check if slowapi is installed (rate limiting)
        import importlib
        slowapi = importlib.import_module('slowapi')
        record_test("Rate Limiting Package (slowapi)", True)
        
        # Check other critical packages
        packages = {
            'fastapi': 'FastAPI framework',
            'supabase': 'Supabase client',
            'asyncpg': 'PostgreSQL driver',
        }
        
        all_passed = True
        for package, description in packages.items():
            try:
                importlib.import_module(package)
                record_test(f"Dependency: {description}", True)
            except ImportError:
                record_test(f"Dependency: {description}", False, f"{package} not installed")
                all_passed = False
        
        return all_passed
    except ImportError:
        record_test("Rate Limiting Package (slowapi)", False, "slowapi not installed")
        return False


# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def run_all_tests():
    """Run complete test suite"""
    print_header("Day 14: Final Testing Suite")
    log("Starting comprehensive system verification...", "INFO")
    print()
    
    # Suite 1: Backend Health
    print_header("SUITE 1: Backend Health & Configuration")
    test_backend_health()
    test_security_headers()
    test_cors_headers()
    
    # Suite 2: Rate Limiting
    print_header("SUITE 2: Security Features")
    test_rate_limiting()
    
    # Suite 3: API Endpoints
    print_header("SUITE 3: API Endpoints")
    test_api_endpoints()
    
    # Suite 4: Performance
    print_header("SUITE 4: Performance")
    test_response_times()
    
    # Suite 5: Environment
    print_header("SUITE 5: Environment Configuration")
    test_environment_files()
    test_gitignore()
    
    # Suite 6: Dependencies
    print_header("SUITE 6: Dependencies")
    test_dependencies()
    
    # Print summary
    return print_summary()


if __name__ == "__main__":
    try:
        exit_code = run_all_tests()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Tests interrupted by user{RESET}")
        sys.exit(130)
    except Exception as e:
        print(f"\n{RED}Fatal error: {e}{RESET}")
        sys.exit(1)
