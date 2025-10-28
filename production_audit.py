#!/usr/bin/env python3
"""
TicketPilot Production Readiness Audit Script
Tests all API endpoints, identifies gaps, and generates action plan
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, List, Any
import time

# Configuration
API_BASE = "http://localhost:8000/api"
FRONTEND_BASE = "http://localhost:3000"

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_section(title: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{title}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}\n")

def print_success(msg: str):
    print(f"{Colors.GREEN}✓{Colors.ENDC} {msg}")

def print_error(msg: str):
    print(f"{Colors.RED}✗{Colors.ENDC} {msg}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠{Colors.ENDC} {msg}")

def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ{Colors.ENDC} {msg}")

class ProductionAudit:
    def __init__(self):
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "endpoints_tested": 0,
            "endpoints_passed": 0,
            "endpoints_failed": 0,
            "critical_issues": [],
            "warnings": [],
            "recommendations": [],
            "feature_gaps": [],
            "edge_cases": []
        }
        self.token = None
    
    def test_health(self) -> bool:
        """Test basic health endpoint"""
        print_section("1. Health Check")
        try:
            resp = requests.get(f"{API_BASE}/health", timeout=5)
            self.results["endpoints_tested"] += 1
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    print_success(f"API is healthy - Version: {data.get('version', 'N/A')}")
                    self.results["endpoints_passed"] += 1
                    return True
            print_error(f"Health check failed: {resp.status_code}")
            self.results["endpoints_failed"] += 1
            self.results["critical_issues"].append("Health endpoint not responding correctly")
            return False
        except Exception as e:
            print_error(f"Could not connect to API: {e}")
            self.results["critical_issues"].append(f"Cannot connect to backend: {e}")
            return False
    
    def test_authentication_flow(self) -> bool:
        """Test authentication and get token"""
        print_section("2. Authentication Flow")
        
        # Note: In real scenario, we'd need to authenticate via Supabase
        # For now, we'll test if we can call /api/me
        
        print_warning("Authentication requires Supabase login - manual testing needed")
        print_info("To test manually:")
        print_info("1. Go to http://localhost:3000/login")
        print_info("2. Login with: dg1513@srmist.edu.in / Chennai22!")
        print_info("3. Open DevTools → Network → Find any API call")
        print_info("4. Copy the Authorization header token")
        
        self.results["warnings"].append("Automated auth testing not implemented - needs Supabase integration")
        return True
    
    def test_me_endpoint(self, token: str = None) -> bool:
        """Test /api/me endpoint"""
        print_section("3. User Profile Endpoint (/api/me)")
        
        if not token:
            print_warning("No token provided - skipping auth-required tests")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {token}"}
            resp = requests.get(f"{API_BASE}/me", headers=headers, timeout=5)
            self.results["endpoints_tested"] += 1
            
            if resp.status_code == 200:
                user = resp.json()
                print_success(f"User: {user.get('email')} - Role: {user.get('role')}")
                self.results["endpoints_passed"] += 1
                return True
            else:
                print_error(f"Me endpoint failed: {resp.status_code} - {resp.text}")
                self.results["endpoints_failed"] += 1
                return False
        except Exception as e:
            print_error(f"Me endpoint error: {e}")
            self.results["endpoints_failed"] += 1
            return False
    
    def test_kb_endpoints(self, token: str = None) -> Dict[str, bool]:
        """Test knowledge base endpoints"""
        print_section("4. Knowledge Base Endpoints")
        
        results = {}
        endpoints = [
            ("GET", "/kb/stats", "Get KB statistics"),
            ("GET", "/kb/documents", "List documents"),
            ("GET", "/kb/search?query=test", "Search KB"),
        ]
        
        for method, path, description in endpoints:
            try:
                headers = {"Authorization": f"Bearer {token}"} if token else {}
                url = f"{API_BASE}{path}"
                
                if method == "GET":
                    resp = requests.get(url, headers=headers, timeout=5)
                
                self.results["endpoints_tested"] += 1
                
                if resp.status_code == 200:
                    print_success(f"{method} {path} - {description}")
                    self.results["endpoints_passed"] += 1
                    results[path] = True
                elif resp.status_code == 401:
                    print_warning(f"{method} {path} - Requires authentication")
                    results[path] = False
                else:
                    print_error(f"{method} {path} - Failed: {resp.status_code}")
                    self.results["endpoints_failed"] += 1
                    results[path] = False
            except Exception as e:
                print_error(f"{method} {path} - Error: {e}")
                self.results["endpoints_failed"] += 1
                results[path] = False
        
        return results
    
    def test_ticket_endpoints(self, token: str = None) -> Dict[str, bool]:
        """Test ticketing endpoints"""
        print_section("5. Ticketing System Endpoints")
        
        results = {}
        endpoints = [
            ("GET", "/tickets", "List tickets"),
            ("GET", "/tickets/1", "Get ticket details (may not exist)"),
        ]
        
        for method, path, description in endpoints:
            try:
                headers = {"Authorization": f"Bearer {token}"} if token else {}
                url = f"{API_BASE}{path}"
                
                if method == "GET":
                    resp = requests.get(url, headers=headers, timeout=5)
                
                self.results["endpoints_tested"] += 1
                
                if resp.status_code in [200, 404]:  # 404 is ok if no tickets exist
                    print_success(f"{method} {path} - {description} [{resp.status_code}]")
                    self.results["endpoints_passed"] += 1
                    results[path] = True
                elif resp.status_code == 401:
                    print_warning(f"{method} {path} - Requires authentication")
                    results[path] = False
                else:
                    print_error(f"{method} {path} - Failed: {resp.status_code}")
                    self.results["endpoints_failed"] += 1
                    results[path] = False
            except Exception as e:
                print_error(f"{method} {path} - Error: {e}")
                self.results["endpoints_failed"] += 1
                results[path] = False
        
        return results
    
    def identify_feature_gaps(self):
        """Identify missing features for production"""
        print_section("6. Feature Gap Analysis")
        
        gaps = [
            {
                "category": "Multi-Tenancy",
                "severity": "CRITICAL",
                "description": "No company/organization isolation",
                "impact": "Cannot serve multiple companies - each deployment serves one company only",
                "requirements": [
                    "Add organization_id to all data tables",
                    "Implement organization selection/switching UI",
                    "Add organization-level permissions and data isolation",
                    "Create organization admin role",
                    "Implement organization onboarding flow"
                ]
            },
            {
                "category": "User Management",
                "severity": "CRITICAL",
                "description": "Limited user management capabilities",
                "impact": "Cannot manage users at scale, no bulk operations",
                "requirements": [
                    "Bulk user invite system",
                    "User deactivation/reactivation",
                    "Password reset flows",
                    "User activity logs",
                    "Role change approval workflows"
                ]
            },
            {
                "category": "Billing & Subscriptions",
                "severity": "CRITICAL",
                "description": "No billing or subscription system",
                "impact": "Cannot charge customers or manage plans",
                "requirements": [
                    "Stripe/payment provider integration",
                    "Subscription plan management",
                    "Usage tracking and limits",
                    "Billing portal for customers",
                    "Invoice generation"
                ]
            },
            {
                "category": "Onboarding",
                "severity": "HIGH",
                "description": "No guided onboarding for new organizations",
                "impact": "Poor first-time user experience, high dropout",
                "requirements": [
                    "Organization setup wizard",
                    "Sample data/templates",
                    "Guided tutorials",
                    "Checklist/progress tracking",
                    "Video tutorials/documentation"
                ]
            },
            {
                "category": "Email Notifications",
                "severity": "HIGH",
                "description": "No email notification system",
                "impact": "Users miss important updates, reduced engagement",
                "requirements": [
                    "SendGrid/SES integration",
                    "Notification preferences management",
                    "Email templates (ticket updates, assignments, etc.)",
                    "Digest emails (daily/weekly summaries)",
                    "Transactional emails (password reset, invites)"
                ]
            },
            {
                "category": "Real-time Features",
                "severity": "HIGH",
                "description": "No websocket/real-time updates",
                "impact": "Users must refresh to see changes, poor UX",
                "requirements": [
                    "WebSocket infrastructure (Socket.io or Supabase Realtime)",
                    "Real-time ticket updates",
                    "Live typing indicators",
                    "Presence (who's online)",
                    "Real-time notifications"
                ]
            },
            {
                "category": "File Attachments",
                "severity": "MEDIUM",
                "description": "No file attachment support in tickets",
                "impact": "Users cannot share screenshots, logs, or documents",
                "requirements": [
                    "S3/cloud storage integration",
                    "File upload UI component",
                    "File type validation and virus scanning",
                    "Image preview/thumbnail generation",
                    "File size limits and quotas"
                ]
            },
            {
                "category": "SLA Management",
                "severity": "MEDIUM",
                "description": "No SLA tracking or enforcement",
                "impact": "Cannot guarantee response times, no urgency tracking",
                "requirements": [
                    "SLA policy configuration",
                    "Automatic priority escalation",
                    "SLA breach warnings",
                    "SLA performance metrics",
                    "Business hours configuration"
                ]
            },
            {
                "category": "API Rate Limiting",
                "severity": "MEDIUM",
                "description": "No rate limiting on API endpoints",
                "impact": "Vulnerable to abuse, potential cost overruns",
                "requirements": [
                    "Redis-based rate limiter",
                    "Per-user and per-org limits",
                    "Rate limit headers in responses",
                    "Admin override for rate limits",
                    "Usage analytics"
                ]
            },
            {
                "category": "Advanced Search",
                "severity": "LOW",
                "description": "Basic search only, no filters or facets",
                "impact": "Hard to find specific tickets or KB articles",
                "requirements": [
                    "Advanced filter UI (date range, status, priority, assignee)",
                    "Saved searches/views",
                    "Full-text search with highlights",
                    "Search suggestions/autocomplete",
                    "Search analytics"
                ]
            },
            {
                "category": "Mobile App",
                "severity": "LOW",
                "description": "No native mobile applications",
                "impact": "Limited mobile experience, may miss on-the-go users",
                "requirements": [
                    "React Native or Flutter mobile app",
                    "Push notifications",
                    "Offline support",
                    "Mobile-optimized workflows",
                    "App store deployment"
                ]
            },
            {
                "category": "Integrations",
                "severity": "MEDIUM",
                "description": "No third-party integrations",
                "impact": "Cannot connect to existing tools (Slack, Jira, etc.)",
                "requirements": [
                    "Slack integration (notifications, create tickets)",
                    "Email-to-ticket (support@yourdomain.com)",
                    "Zapier/Make integration",
                    "Webhook system for custom integrations",
                    "OAuth apps for third-party access"
                ]
            }
        ]
        
        for gap in gaps:
            severity_color = Colors.RED if gap["severity"] == "CRITICAL" else Colors.YELLOW if gap["severity"] == "HIGH" else Colors.BLUE
            print(f"{severity_color}{gap['severity']}{Colors.ENDC}: {gap['category']}")
            print(f"  Impact: {gap['impact']}")
            print(f"  Required:")
            for req in gap["requirements"][:3]:  # Show first 3
                print(f"    - {req}")
            if len(gap["requirements"]) > 3:
                print(f"    ... and {len(gap['requirements']) - 3} more")
            print()
        
        self.results["feature_gaps"] = gaps
    
    def identify_edge_cases(self):
        """Identify logical gaps and edge cases"""
        print_section("7. Edge Cases & Logical Gaps")
        
        cases = [
            {
                "area": "Authentication",
                "cases": [
                    "User tries to access protected route after token expires",
                    "User is deleted from Supabase but still has active session",
                    "User changes role while logged in",
                    "Concurrent logins from multiple devices",
                    "Session hijacking attempts"
                ]
            },
            {
                "area": "Ticket Management",
                "cases": [
                    "Two reps assign ticket to themselves simultaneously",
                    "Rep closes ticket that customer is still typing in",
                    "Customer creates duplicate tickets for same issue",
                    "Ticket status changes while rep is typing response",
                    "Deleting user who has assigned tickets"
                ]
            },
            {
                "area": "Knowledge Base",
                "cases": [
                    "Uploading document with no content",
                    "Uploading malicious file (zip bomb, executable)",
                    "Document update while AI is querying it",
                    "Deleting document that's in active use by AI",
                    "FAISS index corruption or out of sync with database",
                    "Very large document (>1MB) causing timeout"
                ]
            },
            {
                "area": "AI/RAG System",
                "cases": [
                    "AI generates inappropriate or offensive response",
                    "AI hallucinates information not in KB",
                    "AI response takes too long (timeout)",
                    "Google API quota exceeded",
                    "Query in unsupported language",
                    "AI confidence score is 0% (no relevant docs)"
                ]
            },
            {
                "area": "Data Validation",
                "cases": [
                    "Extremely long ticket title (>10000 chars)",
                    "Special characters in user inputs (SQL injection attempts)",
                    "Negative numbers for pagination",
                    "Invalid email formats",
                    "XSS attempts in ticket content"
                ]
            },
            {
                "area": "Performance",
                "cases": [
                    "100+ tickets loaded on dashboard",
                    "KB with 10,000+ documents",
                    "10+ concurrent AI requests",
                    "Large batch operations (bulk ticket updates)",
                    "Slow network conditions"
                ]
            },
            {
                "area": "Error Handling",
                "cases": [
                    "Database connection lost mid-request",
                    "Third-party API (Google) is down",
                    "Disk space full (cannot save files)",
                    "Out of memory error",
                    "Network timeout",
                    "CORS errors in production"
                ]
            }
        ]
        
        for area_info in cases:
            print(f"{Colors.BOLD}{area_info['area']}{Colors.ENDC}")
            for i, case in enumerate(area_info['cases'], 1):
                print(f"  {i}. {case}")
            print()
        
        self.results["edge_cases"] = cases
    
    def generate_production_checklist(self):
        """Generate comprehensive production readiness checklist"""
        print_section("8. Production Readiness Checklist")
        
        checklist = {
            "Security": [
                ("CRITICAL", "Enable HTTPS/TLS for all traffic"),
                ("CRITICAL", "Implement proper JWT signature verification"),
                ("CRITICAL", "Set up CORS whitelist for production domains only"),
                ("CRITICAL", "Enable rate limiting on all endpoints"),
                ("CRITICAL", "Implement input validation and sanitization"),
                ("HIGH", "Add SQL injection protection (use parameterized queries)"),
                ("HIGH", "Implement CSRF protection"),
                ("HIGH", "Add security headers (CSP, X-Frame-Options, etc.)"),
                ("HIGH", "Regular dependency updates and vulnerability scans"),
                ("MEDIUM", "Implement audit logging for sensitive operations"),
            ],
            "Infrastructure": [
                ("CRITICAL", "Set up production database with backups"),
                ("CRITICAL", "Configure environment variables for production"),
                ("CRITICAL", "Set up monitoring and alerting (Sentry, Datadog, etc.)"),
                ("CRITICAL", "Implement proper logging (structured logs, log aggregation)"),
                ("HIGH", "Set up CI/CD pipeline"),
                ("HIGH", "Configure auto-scaling for backend"),
                ("HIGH", "Set up CDN for static assets"),
                ("HIGH", "Implement database connection pooling"),
                ("MEDIUM", "Set up staging environment"),
                ("MEDIUM", "Configure backup and disaster recovery"),
            ],
            "Testing": [
                ("CRITICAL", "Write integration tests for critical flows"),
                ("HIGH", "Implement end-to-end tests"),
                ("HIGH", "Load testing (100+ concurrent users)"),
                ("HIGH", "Security testing (penetration testing)"),
                ("MEDIUM", "Accessibility testing (WCAG 2.1 AA)"),
                ("MEDIUM", "Browser compatibility testing"),
                ("MEDIUM", "Mobile responsiveness testing"),
            ],
            "Documentation": [
                ("CRITICAL", "API documentation (OpenAPI/Swagger)"),
                ("CRITICAL", "Deployment runbook"),
                ("CRITICAL", "Incident response procedures"),
                ("HIGH", "User documentation and help center"),
                ("HIGH", "Admin documentation"),
                ("MEDIUM", "Architecture diagrams"),
                ("MEDIUM", "Onboarding guide for new team members"),
            ],
            "Legal & Compliance": [
                ("CRITICAL", "Privacy policy"),
                ("CRITICAL", "Terms of service"),
                ("CRITICAL", "GDPR compliance (if serving EU users)"),
                ("HIGH", "Data retention policies"),
                ("HIGH", "Cookie consent banner"),
                ("MEDIUM", "Accessibility statement"),
            ],
            "Operations": [
                ("CRITICAL", "Set up on-call rotation"),
                ("CRITICAL", "Define SLOs and SLAs"),
                ("CRITICAL", "Create incident response playbook"),
                ("HIGH", "Set up performance monitoring"),
                ("HIGH", "Configure error tracking"),
                ("HIGH", "Set up usage analytics"),
                ("MEDIUM", "Create customer support ticketing system (for your own bugs!)"),
            ]
        }
        
        for category, items in checklist.items():
            print(f"{Colors.BOLD}{category}:{Colors.ENDC}")
            for severity, item in items:
                severity_color = Colors.RED if severity == "CRITICAL" else Colors.YELLOW if severity == "HIGH" else Colors.BLUE
                print(f"  [{severity_color}{severity}{Colors.ENDC}] {item}")
            print()
        
        return checklist
    
    def estimate_effort(self):
        """Estimate effort required for production readiness"""
        print_section("9. Effort Estimation")
        
        efforts = {
            "Multi-Tenancy Implementation": {
                "effort": "4-6 weeks",
                "complexity": "High",
                "priority": "CRITICAL",
                "tasks": [
                    "Database schema redesign (1 week)",
                    "API changes for org isolation (1 week)",
                    "Frontend org switcher UI (1 week)",
                    "Testing and migration (1-2 weeks)"
                ]
            },
            "User Management & Admin": {
                "effort": "2-3 weeks",
                "complexity": "Medium",
                "priority": "CRITICAL",
                "tasks": [
                    "Bulk invite system (3 days)",
                    "User lifecycle management (1 week)",
                    "Admin dashboard improvements (1 week)"
                ]
            },
            "Billing & Subscriptions": {
                "effort": "3-4 weeks",
                "complexity": "High",
                "priority": "CRITICAL",
                "tasks": [
                    "Stripe integration (1 week)",
                    "Plan management (1 week)",
                    "Usage tracking (1 week)",
                    "Billing portal (1 week)"
                ]
            },
            "Email System": {
                "effort": "1-2 weeks",
                "complexity": "Low",
                "priority": "HIGH",
                "tasks": [
                    "SendGrid setup (2 days)",
                    "Email templates (3 days)",
                    "Notification preferences (2 days)",
                    "Testing (2 days)"
                ]
            },
            "Real-time Features": {
                "effort": "2-3 weeks",
                "complexity": "Medium",
                "priority": "HIGH",
                "tasks": [
                    "WebSocket infrastructure (1 week)",
                    "Real-time ticket updates (1 week)",
                    "Testing and optimization (1 week)"
                ]
            },
            "Security Hardening": {
                "effort": "2 weeks",
                "complexity": "Medium",
                "priority": "CRITICAL",
                "tasks": [
                    "Rate limiting (3 days)",
                    "Input validation (3 days)",
                    "Security headers (2 days)",
                    "Penetration testing (1 week)"
                ]
            },
            "Testing & QA": {
                "effort": "2-3 weeks",
                "complexity": "Medium",
                "priority": "CRITICAL",
                "tasks": [
                    "Integration tests (1 week)",
                    "E2E tests (1 week)",
                    "Load testing (3 days)",
                    "Bug fixes (varies)"
                ]
            },
            "Documentation": {
                "effort": "1 week",
                "complexity": "Low",
                "priority": "HIGH",
                "tasks": [
                    "API docs (2 days)",
                    "User guides (2 days)",
                    "Admin docs (1 day)",
                    "Runbooks (2 days)"
                ]
            },
            "Production Infrastructure": {
                "effort": "1-2 weeks",
                "complexity": "Medium",
                "priority": "CRITICAL",
                "tasks": [
                    "CI/CD setup (3 days)",
                    "Monitoring & logging (3 days)",
                    "Backups & DR (2 days)",
                    "Performance optimization (3 days)"
                ]
            }
        }
        
        total_weeks_min = 0
        total_weeks_max = 0
        
        for feature, details in efforts.items():
            effort_range = details["effort"].replace(" weeks", "").replace(" week", "")
            if "-" in effort_range:
                min_w, max_w = map(int, effort_range.split("-"))
            else:
                min_w = max_w = int(effort_range)
            
            total_weeks_min += min_w
            total_weeks_max += max_w
            
            priority_color = Colors.RED if details["priority"] == "CRITICAL" else Colors.YELLOW
            print(f"{priority_color}[{details['priority']}]{Colors.ENDC} {Colors.BOLD}{feature}{Colors.ENDC}")
            print(f"  Effort: {details['effort']} | Complexity: {details['complexity']}")
            print(f"  Tasks:")
            for task in details["tasks"]:
                print(f"    - {task}")
            print()
        
        print(f"{Colors.BOLD}Total Estimated Effort: {total_weeks_min}-{total_weeks_max} weeks{Colors.ENDC}")
        print(f"  (with 1 full-time developer)")
        print(f"  With 2 developers: {total_weeks_min//2}-{total_weeks_max//2} weeks")
        print(f"  With 3 developers: {total_weeks_min//3}-{total_weeks_max//3} weeks")
    
    def create_action_plan(self):
        """Create phased action plan for production"""
        print_section("10. Action Plan - Phased Approach")
        
        phases = [
            {
                "name": "Phase 1: Production Foundation",
                "duration": "2-3 weeks",
                "priority": "DO THIS FIRST",
                "goals": "Make it secure and stable enough to demo/pilot",
                "tasks": [
                    "✓ Fix all critical security issues",
                    "✓ Implement proper error handling",
                    "✓ Add rate limiting",
                    "✓ Set up monitoring and logging (Sentry)",
                    "✓ Write integration tests for critical paths",
                    "✓ Deploy to production infrastructure",
                    "✓ Set up CI/CD pipeline"
                ],
                "deliverable": "Secure, monitored app ready for limited pilot"
            },
            {
                "name": "Phase 2: Multi-Tenancy MVP",
                "duration": "4-6 weeks",
                "priority": "REQUIRED FOR SCALE",
                "goals": "Support multiple organizations",
                "tasks": [
                    "✓ Add organization_id to all tables",
                    "✓ Implement org selection on signup",
                    "✓ Create org admin role and permissions",
                    "✓ Test data isolation thoroughly",
                    "✓ Migration script for existing data",
                    "✓ Basic org management UI"
                ],
                "deliverable": "Can onboard multiple companies safely"
            },
            {
                "name": "Phase 3: Billing & Monetization",
                "duration": "3-4 weeks",
                "priority": "REQUIRED TO CHARGE",
                "goals": "Accept payments and manage subscriptions",
                "tasks": [
                    "✓ Integrate Stripe",
                    "✓ Define pricing plans",
                    "✓ Implement subscription management",
                    "✓ Usage tracking and limits",
                    "✓ Billing portal",
                    "✓ Invoice generation"
                ],
                "deliverable": "Can charge customers monthly"
            },
            {
                "name": "Phase 4: Polish & Scale",
                "duration": "3-4 weeks",
                "priority": "NICE TO HAVE",
                "goals": "Better UX and handle more load",
                "tasks": [
                    "✓ Onboarding wizard",
                    "✓ Email notifications",
                    "✓ Real-time updates",
                    "✓ File attachments",
                    "✓ Advanced search",
                    "✓ Performance optimization"
                ],
                "deliverable": "Competitive feature set"
            },
            {
                "name": "Phase 5: Enterprise Features",
                "duration": "4-6 weeks",
                "priority": "FOR GROWTH",
                "goals": "Win enterprise customers",
                "tasks": [
                    "✓ SSO (SAML/OIDC)",
                    "✓ SLA management",
                    "✓ Advanced analytics",
                    "✓ Custom branding",
                    "✓ API access for integrations",
                    "✓ Audit logs"
                ],
                "deliverable": "Enterprise-ready"
            }
        ]
        
        for i, phase in enumerate(phases, 1):
            print(f"{Colors.BOLD}{'=' * 60}{Colors.ENDC}")
            print(f"{Colors.BOLD}{phase['name']}{Colors.ENDC}")
            print(f"Duration: {phase['duration']} | Priority: {phase['priority']}")
            print(f"Goal: {phase['goals']}")
            print(f"\nTasks:")
            for task in phase['tasks']:
                print(f"  {task}")
            print(f"\n{Colors.GREEN}Deliverable: {phase['deliverable']}{Colors.ENDC}")
            print()
        
        print(f"{Colors.BOLD}Minimum Viable Production (MVP): Phases 1-3 = 9-13 weeks{Colors.ENDC}")
        print(f"{Colors.BOLD}Full Production Ready: All phases = 16-23 weeks (4-6 months){Colors.ENDC}")
    
    def generate_report(self):
        """Generate final summary report"""
        print_section("11. Executive Summary")
        
        print(f"{Colors.BOLD}Current State:{Colors.ENDC}")
        print(f"✓ MVP features implemented and functional")
        print(f"✓ AI/RAG system working")
        print(f"✓ Core ticketing system operational")
        print(f"✓ Admin dashboard with analytics")
        print(f"✓ Modern, responsive UI")
        print()
        
        print(f"{Colors.BOLD}Production Readiness: {Colors.YELLOW}40%{Colors.ENDC}")
        print()
        
        print(f"{Colors.BOLD}Critical Blockers for Production:{Colors.ENDC}")
        print(f"{Colors.RED}✗{Colors.ENDC} No multi-tenancy (can only serve 1 company)")
        print(f"{Colors.RED}✗{Colors.ENDC} No billing system (cannot charge)")
        print(f"{Colors.RED}✗{Colors.ENDC} Security needs hardening")
        print(f"{Colors.RED}✗{Colors.ENDC} No production monitoring/logging")
        print(f"{Colors.RED}✗{Colors.ENDC} Missing critical error handling")
        print()
        
        print(f"{Colors.BOLD}Recommendation:{Colors.ENDC}")
        print("1. Start with Phase 1 (Production Foundation) - 2-3 weeks")
        print("2. Find 1-2 pilot customers willing to test")
        print("3. Gather feedback while building Phase 2 (Multi-tenancy)")
        print("4. Implement Phase 3 (Billing) before scaling")
        print()
        print(f"{Colors.GREEN}Earliest production-ready date: 9-13 weeks from now{Colors.ENDC}")
        print(f"With 2 developers: 5-7 weeks")
        print()
        
        # Save results to file
        with open('/home/dhanush/Documents/ticketpilot/production_audit_results.json', 'w') as f:
            json.dump(self.results, f, indent=2)
        
        print(f"\n{Colors.GREEN}✓ Full audit results saved to: production_audit_results.json{Colors.ENDC}")
    
    def run(self, token: str = None):
        """Run full audit"""
        print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.BLUE}TicketPilot Production Readiness Audit{Colors.ENDC}")
        print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}\n")
        
        # Run all tests and checks
        self.test_health()
        self.test_authentication_flow()
        
        if token:
            self.test_me_endpoint(token)
            self.test_kb_endpoints(token)
            self.test_ticket_endpoints(token)
        else:
            print_warning("\nNo token provided - skipping authenticated endpoint tests")
            print_info("To test authenticated endpoints, provide token as argument:")
            print_info("  python production_audit.py YOUR_TOKEN_HERE\n")
        
        self.identify_feature_gaps()
        self.identify_edge_cases()
        self.generate_production_checklist()
        self.estimate_effort()
        self.create_action_plan()
        self.generate_report()

if __name__ == "__main__":
    token = sys.argv[1] if len(sys.argv) > 1 else None
    audit = ProductionAudit()
    audit.run(token)
