#!/bin/bash
# Complete TicketPilot API Verification
# Tests all major endpoints with proper paths

echo "🔍 TicketPilot Complete API Verification"
echo "=========================================="
echo ""

API_BASE="http://localhost:8000"
FRONTEND_BASE="http://localhost:3000"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_code=$3
    local description=$4
    
    printf "%-50s " "$description..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$API_BASE$endpoint" 2>/dev/null)
    
    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓${NC} HTTP $response"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} Expected $expected_code, got $response"
        ((FAILED++))
    fi
}

# Service Status
echo "📡 SERVICES STATUS"
echo "==================="
BACKEND_PID=$(pgrep -f "uvicorn.*app.main" | head -1)
FRONTEND_PID=$(pgrep -f "node.*next dev" | head -1)

if [ -n "$BACKEND_PID" ]; then
    echo -e "${GREEN}✓${NC} Backend (FastAPI) running - PID: $BACKEND_PID"
    echo "  URL: http://localhost:8000/docs"
else
    echo -e "${RED}✗${NC} Backend NOT running!"
    exit 1
fi

if [ -n "$FRONTEND_PID" ]; then
    echo -e "${GREEN}✓${NC} Frontend (Next.js) running - PID: $FRONTEND_PID"
    echo "  URL: http://localhost:3000"
else
    echo -e "${YELLOW}⚠${NC} Frontend may not be running"
fi

echo ""
echo "🔧 BACKEND API ENDPOINTS"
echo "========================="

# Core API endpoints
test_endpoint "GET" "/docs" "200" "API Documentation (Swagger UI)"
test_endpoint "GET" "/openapi.json" "200" "OpenAPI Specification"

echo ""
echo "🔐 Authentication Endpoints"
test_endpoint "GET" "/api/me" "401" "GET /api/me (requires auth)"
test_endpoint "GET" "/api/auth/context" "401" "GET /api/auth/context (requires auth)"

echo ""
echo "🎫 Tickets Endpoints"
test_endpoint "GET" "/api/tickets" "401" "GET /api/tickets (protected)"
test_endpoint "POST" "/api/tickets" "401" "POST /api/tickets (protected)"

echo ""
echo "🏢 Organizations Endpoints"
test_endpoint "GET" "/api/organizations" "401" "GET /api/organizations (protected)"
test_endpoint "POST" "/api/organizations" "401" "POST /api/organizations (protected)"

echo ""
echo "📚 Knowledge Base Endpoints"
test_endpoint "GET" "/api/kb/documents" "401" "GET /api/kb/documents (protected)"
test_endpoint "POST" "/api/kb/upload" "401" "POST /api/kb/upload (protected)"
test_endpoint "GET" "/api/kb/search" "401" "GET /api/kb/search (protected)"

echo ""
echo "👨‍💼 Admin Endpoints"
test_endpoint "GET" "/api/admin/users" "401" "GET /api/admin/users (admin only)"
test_endpoint "GET" "/api/admin/analytics/summary" "401" "GET /api/admin/analytics/summary"
test_endpoint "GET" "/api/admin/analytics/by-status" "401" "GET /api/admin/analytics/by-status"
test_endpoint "GET" "/api/admin/analytics/by-priority" "401" "GET /api/admin/analytics/by-priority"
test_endpoint "GET" "/api/admin/role-requests" "401" "GET /api/admin/role-requests"

echo ""
echo "🎧 Rep Console Endpoints"
test_endpoint "GET" "/api/rep/queue" "401" "GET /api/rep/queue (rep only)"
test_endpoint "GET" "/api/rep/counts" "401" "GET /api/rep/counts (rep only)"

echo ""
echo "🤖 AI Endpoints"
test_endpoint "POST" "/api/ai/suggest-response" "401" "POST /api/ai/suggest-response"
test_endpoint "POST" "/api/feedback/ai" "401" "POST /api/feedback/ai"

echo ""
echo "🎨 FRONTEND PAGES"
echo "=================="

test_frontend() {
    local path=$1
    local description=$2
    
    printf "%-50s " "$description..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_BASE$path" 2>/dev/null)
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓${NC} HTTP $response"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} HTTP $response"
        ((FAILED++))
    fi
}

test_frontend "/" "Homepage"
test_frontend "/login" "Login page"
test_frontend "/signup" "Signup page"

echo ""
echo "📊 SUMMARY"
echo "==========="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "Total:  $((PASSED + FAILED))"

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ ALL SYSTEMS OPERATIONAL!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo ""
    echo "🚀 Ready for Demo!"
    echo ""
    echo "Access Points:"
    echo "  🌐 Frontend:  http://localhost:3000"
    echo "  🔧 Backend:   http://localhost:8000"
    echo "  📖 API Docs:  http://localhost:8000/docs"
    echo ""
    echo "All protected endpoints correctly require authentication (401)."
    echo "This is expected behavior and means the security is working!"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some checks had unexpected results.${NC}"
    echo "Review output above for details."
    exit 1
fi
