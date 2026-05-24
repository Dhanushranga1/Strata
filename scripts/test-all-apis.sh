#!/bin/bash
# TicketPilot API Health Check
# Tests all major API endpoints

echo "🔍 TicketPilot API Health Check"
echo "================================"
echo ""

API_BASE="http://localhost:8000"
FRONTEND_BASE="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_code=$3
    local description=$4
    local data=$5
    
    echo -n "Testing: $description... "
    
    if [ -z "$data" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$API_BASE$endpoint")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$API_BASE$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_code, got $response)"
        ((FAILED++))
    fi
}

# Check if services are running
echo "📡 Service Status"
echo "=================="
if pgrep -f "uvicorn.*app.main" > /dev/null; then
    echo -e "${GREEN}✓${NC} Backend running (FastAPI)"
else
    echo -e "${RED}✗${NC} Backend NOT running"
    echo "Start with: cd backend && .venv/bin/python -m uvicorn app.main:app --reload"
    exit 1
fi

if pgrep -f "next dev" > /dev/null || lsof -i:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend running (Next.js)"
else
    echo -e "${YELLOW}⚠${NC} Frontend may not be running"
fi

echo ""
echo "🔧 Backend API Tests"
echo "===================="

# Public endpoints (no auth required)
test_endpoint "GET" "/docs" "200" "API Documentation"
test_endpoint "GET" "/openapi.json" "200" "OpenAPI Schema"

# Auth endpoints (should return proper error codes without auth)
test_endpoint "POST" "/api/signup" "422" "Signup endpoint exists"
test_endpoint "POST" "/api/login" "422" "Login endpoint exists"
test_endpoint "GET" "/api/me" "401" "Auth required for /me"

# Protected endpoints (should require auth - 401 or 403)
test_endpoint "GET" "/api/tickets" "401" "Tickets endpoint (protected)"
test_endpoint "GET" "/api/organizations" "401" "Organizations endpoint (protected)"
test_endpoint "GET" "/api/kb/documents" "401" "KB documents endpoint (protected)"
test_endpoint "GET" "/api/admin/users" "401" "Admin users endpoint (protected)"
test_endpoint "GET" "/api/admin/analytics/summary" "401" "Admin analytics endpoint (protected)"
test_endpoint "GET" "/api/rep/queue" "401" "Rep queue endpoint (protected)"
test_endpoint "GET" "/api/rep/counts" "401" "Rep counts endpoint (protected)"

echo ""
echo "🎨 Frontend Tests"
echo "================="

echo -n "Testing: Frontend homepage... "
frontend_status=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_BASE")
if [ "$frontend_status" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $frontend_status)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (Got $frontend_status)"
    ((FAILED++))
fi

echo -n "Testing: Frontend login page... "
login_status=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_BASE/login")
if [ "$login_status" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $login_status)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC} (Got $login_status)"
    ((FAILED++))
fi

echo ""
echo "📊 Summary"
echo "=========="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "Total:  $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ ALL TESTS PASSED! System is ready for demo.${NC}"
    echo ""
    echo "Access Points:"
    echo "  🌐 Frontend: $FRONTEND_BASE"
    echo "  🔧 Backend API: $API_BASE/docs"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Some tests failed. Review above for details.${NC}"
    exit 1
fi
