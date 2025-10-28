#!/bin/bash

# Phase 2 Multi-Tenancy Testing Script
# Tests organization management and data isolation

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8000}"
TOKEN="${SUPABASE_TOKEN}"

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Error: SUPABASE_TOKEN environment variable is required${NC}"
    echo "Usage: SUPABASE_TOKEN=<your_token> ./test_phase2.sh"
    exit 1
fi

echo -e "${YELLOW}Starting Phase 2 Multi-Tenancy Tests${NC}"
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Get Authentication Context
echo -e "${YELLOW}Test 1: Get Authentication Context${NC}"
AUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/context" \
  -H "Authorization: Bearer $TOKEN")

echo "$AUTH_RESPONSE" | jq '.'

if echo "$AUTH_RESPONSE" | jq -e '.organizations' > /dev/null; then
    echo -e "${GREEN}✓ Authentication context retrieved${NC}"
    DEFAULT_ORG_ID=$(echo "$AUTH_RESPONSE" | jq -r '.default_organization_id')
    echo "Default Organization ID: $DEFAULT_ORG_ID"
else
    echo -e "${RED}✗ Failed to get authentication context${NC}"
    exit 1
fi
echo ""

# Test 2: List Organizations
echo -e "${YELLOW}Test 2: List Organizations${NC}"
ORGS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/organizations" \
  -H "Authorization: Bearer $TOKEN")

echo "$ORGS_RESPONSE" | jq '.'

if echo "$ORGS_RESPONSE" | jq -e 'length > 0' > /dev/null; then
    echo -e "${GREEN}✓ Organizations listed successfully${NC}"
else
    echo -e "${RED}✗ Failed to list organizations${NC}"
    exit 1
fi
echo ""

# Test 3: Create New Organization
echo -e "${YELLOW}Test 3: Create New Organization${NC}"
TIMESTAMP=$(date +%s)
CREATE_ORG_RESPONSE=$(curl -s -X POST "$BASE_URL/api/organizations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Test Org $TIMESTAMP\"}")

echo "$CREATE_ORG_RESPONSE" | jq '.'

if echo "$CREATE_ORG_RESPONSE" | jq -e '.id' > /dev/null; then
    echo -e "${GREEN}✓ Organization created successfully${NC}"
    NEW_ORG_ID=$(echo "$CREATE_ORG_RESPONSE" | jq -r '.id')
    echo "New Organization ID: $NEW_ORG_ID"
else
    echo -e "${RED}✗ Failed to create organization${NC}"
    exit 1
fi
echo ""

# Test 4: Create Ticket in Default Organization
echo -e "${YELLOW}Test 4: Create Ticket in Default Organization${NC}"
TICKET1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tickets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $DEFAULT_ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Ticket Default Org",
    "description": "Testing multi-tenancy in default org",
    "category": "technical"
  }')

echo "$TICKET1_RESPONSE" | jq '.'

if echo "$TICKET1_RESPONSE" | jq -e '.id' > /dev/null; then
    echo -e "${GREEN}✓ Ticket created in default organization${NC}"
    TICKET1_ID=$(echo "$TICKET1_RESPONSE" | jq -r '.id')
    echo "Ticket ID: $TICKET1_ID"
else
    echo -e "${RED}✗ Failed to create ticket in default org${NC}"
    exit 1
fi
echo ""

# Test 5: Create Ticket in New Organization
echo -e "${YELLOW}Test 5: Create Ticket in New Organization${NC}"
TICKET2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tickets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $NEW_ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Ticket New Org",
    "description": "Testing multi-tenancy in new org",
    "category": "billing"
  }')

echo "$TICKET2_RESPONSE" | jq '.'

if echo "$TICKET2_RESPONSE" | jq -e '.id' > /dev/null; then
    echo -e "${GREEN}✓ Ticket created in new organization${NC}"
    TICKET2_ID=$(echo "$TICKET2_RESPONSE" | jq -r '.id')
    echo "Ticket ID: $TICKET2_ID"
else
    echo -e "${RED}✗ Failed to create ticket in new org${NC}"
    exit 1
fi
echo ""

# Test 6: List Tickets in Default Organization
echo -e "${YELLOW}Test 6: List Tickets in Default Organization${NC}"
TICKETS_DEFAULT=$(curl -s -X GET "$BASE_URL/api/tickets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $DEFAULT_ORG_ID")

echo "$TICKETS_DEFAULT" | jq '.'

TICKET1_FOUND=$(echo "$TICKETS_DEFAULT" | jq --arg id "$TICKET1_ID" '.items[] | select(.id == $id)')
TICKET2_FOUND=$(echo "$TICKETS_DEFAULT" | jq --arg id "$TICKET2_ID" '.items[] | select(.id == $id)')

if [ -n "$TICKET1_FOUND" ] && [ -z "$TICKET2_FOUND" ]; then
    echo -e "${GREEN}✓ Data isolation working: Only default org ticket visible${NC}"
else
    echo -e "${RED}✗ Data isolation broken: Unexpected tickets visible${NC}"
    exit 1
fi
echo ""

# Test 7: List Tickets in New Organization
echo -e "${YELLOW}Test 7: List Tickets in New Organization${NC}"
TICKETS_NEW=$(curl -s -X GET "$BASE_URL/api/tickets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $NEW_ORG_ID")

echo "$TICKETS_NEW" | jq '.'

TICKET1_FOUND=$(echo "$TICKETS_NEW" | jq --arg id "$TICKET1_ID" '.items[] | select(.id == $id)')
TICKET2_FOUND=$(echo "$TICKETS_NEW" | jq --arg id "$TICKET2_ID" '.items[] | select(.id == $id)')

if [ -z "$TICKET1_FOUND" ] && [ -n "$TICKET2_FOUND" ]; then
    echo -e "${GREEN}✓ Data isolation working: Only new org ticket visible${NC}"
else
    echo -e "${RED}✗ Data isolation broken: Unexpected tickets visible${NC}"
    exit 1
fi
echo ""

# Test 8: Try to Access Ticket from Wrong Organization (Should Fail)
echo -e "${YELLOW}Test 8: Data Isolation - Access Ticket from Wrong Org${NC}"
WRONG_ACCESS=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/tickets/$TICKET1_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $NEW_ORG_ID")

HTTP_CODE=$(echo "$WRONG_ACCESS" | tail -n1)
RESPONSE=$(echo "$WRONG_ACCESS" | head -n-1)

echo "Response: $RESPONSE"
echo "HTTP Code: $HTTP_CODE"

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✓ Data isolation working: Access denied from wrong org${NC}"
else
    echo -e "${RED}✗ Data isolation broken: Access allowed from wrong org (HTTP $HTTP_CODE)${NC}"
    exit 1
fi
echo ""

# Test 9: Request Without Organization Header (Should Fail)
echo -e "${YELLOW}Test 9: Request Without Organization Header${NC}"
NO_HEADER=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/tickets" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$NO_HEADER" | tail -n1)
RESPONSE=$(echo "$NO_HEADER" | head -n-1)

echo "Response: $RESPONSE"
echo "HTTP Code: $HTTP_CODE"

if [ "$HTTP_CODE" = "400" ]; then
    echo -e "${GREEN}✓ Middleware working: Request rejected without org header${NC}"
else
    echo -e "${RED}✗ Middleware broken: Request allowed without org header (HTTP $HTTP_CODE)${NC}"
    exit 1
fi
echo ""

# Test 10: Organization Members
echo -e "${YELLOW}Test 10: List Organization Members${NC}"
MEMBERS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/organizations/$NEW_ORG_ID/members" \
  -H "Authorization: Bearer $TOKEN")

echo "$MEMBERS_RESPONSE" | jq '.'

if echo "$MEMBERS_RESPONSE" | jq -e 'length > 0' > /dev/null; then
    echo -e "${GREEN}✓ Organization members listed${NC}"
else
    echo -e "${RED}✗ Failed to list organization members${NC}"
    exit 1
fi
echo ""

# Test 11: Get Organization Details
echo -e "${YELLOW}Test 11: Get Organization Details${NC}"
ORG_DETAILS=$(curl -s -X GET "$BASE_URL/api/organizations/$NEW_ORG_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$ORG_DETAILS" | jq '.'

if echo "$ORG_DETAILS" | jq -e '.id' > /dev/null; then
    echo -e "${GREEN}✓ Organization details retrieved${NC}"
    MEMBER_COUNT=$(echo "$ORG_DETAILS" | jq -r '.member_count')
    YOUR_ROLE=$(echo "$ORG_DETAILS" | jq -r '.your_role')
    echo "Member Count: $MEMBER_COUNT"
    echo "Your Role: $YOUR_ROLE"
else
    echo -e "${RED}✗ Failed to get organization details${NC}"
    exit 1
fi
echo ""

# Summary
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}All Phase 2 Multi-Tenancy Tests Passed!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Summary:"
echo "- Authentication context: ✓"
echo "- Organization management: ✓"
echo "- Data isolation (tickets): ✓"
echo "- Middleware validation: ✓"
echo "- Organization members: ✓"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Test knowledge base multi-tenancy"
echo "2. Test rep console multi-tenancy"
echo "3. Test admin analytics filtering"
echo "4. Integrate with frontend"
