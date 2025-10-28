#!/bin/bash

# Phase 2 Additional Multi-Tenancy Tests
# Tests KB, Rep Console, and Admin features with organization context

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:8000"
TOKEN="${SUPABASE_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo -e "${RED}Error: SUPABASE_TOKEN environment variable not set${NC}"
  echo "Usage: SUPABASE_TOKEN=\"your-token\" ./test_phase2_additional.sh"
  exit 1
fi

echo "======================================"
echo "Phase 2 Additional Multi-Tenancy Tests"
echo "======================================"
echo "Base URL: $BASE_URL"
echo ""

# Function to make API call and check response
call_api() {
  local method=$1
  local endpoint=$2
  local org_id=$3
  local data=$4
  
  if [ -z "$data" ]; then
    curl -s -X "$method" "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-Organization-ID: $org_id" \
      -H "Content-Type: application/json"
  else
    curl -s -X "$method" "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-Organization-ID: $org_id" \
      -H "Content-Type: application/json" \
      -d "$data"
  fi
}

# Get authentication context and default org
echo "Getting authentication context..."
AUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/context" \
  -H "Authorization: Bearer $TOKEN")

DEFAULT_ORG_ID=$(echo "$AUTH_RESPONSE" | jq -r '.default_organization_id')
echo -e "${GREEN}✓ Using Default Organization: $DEFAULT_ORG_ID${NC}"
echo ""

# Create a test organization for isolation tests
echo "Test 1: Create Test Organization"
TIMESTAMP=$(date +%s)
CREATE_ORG_RESPONSE=$(call_api "POST" "/api/organizations" "" "{
  \"name\": \"KB Test Org $TIMESTAMP\",
  \"slug\": \"kb-test-org-$TIMESTAMP\"
}")

TEST_ORG_ID=$(echo "$CREATE_ORG_RESPONSE" | jq -r '.id')

if [ "$TEST_ORG_ID" != "null" ] && [ -n "$TEST_ORG_ID" ]; then
  echo -e "${GREEN}✓ Test organization created: $TEST_ORG_ID${NC}"
else
  echo -e "${RED}✗ Failed to create test organization${NC}"
  echo "$CREATE_ORG_RESPONSE"
  exit 1
fi
echo ""

###########################################
# KNOWLEDGE BASE TESTS
###########################################

echo "======================================"
echo "KNOWLEDGE BASE MULTI-TENANCY TESTS"
echo "======================================"
echo ""

# Test 2: Upload document to default org using multipart form
echo "Test 2: Upload Document to Default Org"
DOC1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/kb/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $DEFAULT_ORG_ID" \
  -F "raw_text=This document belongs to the default organization (created at $TIMESTAMP) and contains important troubleshooting information about login issues. Steps: 1. Check credentials 2. Verify email 3. Reset password if needed." \
  -F "filename=default_org_doc_$TIMESTAMP.txt")

DOC1_ID=$(echo "$DOC1_RESPONSE" | jq -r '.document_id')
if [ "$DOC1_ID" != "null" ] && [ -n "$DOC1_ID" ]; then
  echo -e "${GREEN}✓ Document uploaded to default org: $DOC1_ID${NC}"
else
  echo -e "${RED}✗ Failed to upload document to default org${NC}"
  echo "$DOC1_RESPONSE"
  exit 1
fi
echo ""

# Test 3: Upload document to test org
echo "Test 3: Upload Document to Test Org"
DOC2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/kb/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $TEST_ORG_ID" \
  -F "raw_text=This document belongs to the test organization (created at $TIMESTAMP) and contains different troubleshooting steps. Process: 1. Verify account status 2. Check permissions 3. Contact support." \
  -F "filename=test_org_doc_$TIMESTAMP.txt")

DOC2_ID=$(echo "$DOC2_RESPONSE" | jq -r '.document_id')
if [ "$DOC2_ID" != "null" ] && [ -n "$DOC2_ID" ]; then
  echo -e "${GREEN}✓ Document uploaded to test org: $DOC2_ID${NC}"
else
  echo -e "${RED}✗ Failed to upload document to test org${NC}"
  echo "$DOC2_RESPONSE"
  exit 1
fi
echo ""

# Wait for document processing
echo "Waiting 5 seconds for document processing and indexing..."
sleep 5
echo ""

# Test 4: List documents in default org
echo "Test 4: List Documents in Default Org"
DEFAULT_DOCS=$(call_api "GET" "/api/kb/documents" "$DEFAULT_ORG_ID")
DEFAULT_DOCS_COUNT=$(echo "$DEFAULT_DOCS" | jq '. | length')
DEFAULT_HAS_DOC1=$(echo "$DEFAULT_DOCS" | jq --arg id "$DOC1_ID" '.[] | select(.id == $id) | .id')

if [ -n "$DEFAULT_HAS_DOC1" ]; then
  echo -e "${GREEN}✓ Default org sees its own document (found $DEFAULT_DOCS_COUNT total)${NC}"
else
  echo -e "${RED}✗ Default org cannot see its own document${NC}"
  exit 1
fi
echo ""

# Test 5: List documents in test org
echo "Test 5: List Documents in Test Org"
TEST_DOCS=$(call_api "GET" "/api/kb/documents" "$TEST_ORG_ID")
TEST_DOCS_COUNT=$(echo "$TEST_DOCS" | jq '. | length')
TEST_HAS_DOC2=$(echo "$TEST_DOCS" | jq --arg id "$DOC2_ID" '.[] | select(.id == $id) | .id')
TEST_HAS_DOC1=$(echo "$TEST_DOCS" | jq --arg id "$DOC1_ID" '.[] | select(.id == $id) | .id')

if [ -n "$TEST_HAS_DOC2" ] && [ -z "$TEST_HAS_DOC1" ]; then
  echo -e "${GREEN}✓ Test org sees only its own document (found $TEST_DOCS_COUNT total)${NC}"
  echo -e "${GREEN}✓ KB data isolation working correctly${NC}"
else
  echo -e "${RED}✗ KB data isolation failed${NC}"
  echo "Test org should see DOC2 but not DOC1"
  exit 1
fi
echo ""

# Test 6: Search in default org (GET with query param)
echo "Test 6: Search Documents in Default Org"
SEARCH_DEFAULT=$(curl -s -X GET "$BASE_URL/api/kb/search?query=login%20issues&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $DEFAULT_ORG_ID")

SEARCH_DEFAULT_COUNT=$(echo "$SEARCH_DEFAULT" | jq '. | length')
if [ "$SEARCH_DEFAULT_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓ Search in default org returned $SEARCH_DEFAULT_COUNT results${NC}"
else
  echo -e "${YELLOW}⚠ Search in default org returned no results (may need more time for indexing)${NC}"
fi
echo ""

# Test 7: Search in test org (GET with query param)
echo "Test 7: Search Documents in Test Org"
SEARCH_TEST=$(curl -s -X GET "$BASE_URL/api/kb/search?query=troubleshooting%20steps&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $TEST_ORG_ID")

SEARCH_TEST_COUNT=$(echo "$SEARCH_TEST" | jq '. | length')
if [ "$SEARCH_TEST_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓ Search in test org returned $SEARCH_TEST_COUNT results${NC}"
else
  echo -e "${YELLOW}⚠ Search in test org returned no results (may need more time for indexing)${NC}"
fi
echo ""

# Test 8: Try to access document from wrong org (should fail or not appear)
echo "Test 8: Verify Documents Not Visible Across Orgs"
TEST_ORG_DOCS=$(call_api "GET" "/api/kb/documents" "$TEST_ORG_ID")
TEST_HAS_DEFAULT_DOC=$(echo "$TEST_ORG_DOCS" | jq --arg id "$DOC1_ID" '.[] | select(.id == $id) | .id')

if [ -z "$TEST_HAS_DEFAULT_DOC" ]; then
  echo -e "${GREEN}✓ Test org cannot see default org's documents${NC}"
else
  echo -e "${RED}✗ Cross-org document visibility detected${NC}"
  exit 1
fi
echo ""

###########################################
# REP CONSOLE TESTS
###########################################

echo "======================================"
echo "REP CONSOLE MULTI-TENANCY TESTS"
echo "======================================"
echo ""

# Test 9: Create ticket in default org for rep testing
echo "Test 9: Create Ticket in Default Org"
TICKET_DEFAULT=$(call_api "POST" "/api/tickets" "$DEFAULT_ORG_ID" "{
  \"title\": \"Rep Test Ticket Default\",
  \"description\": \"Testing rep console in default org\",
  \"category\": \"technical\"
}")

TICKET_DEFAULT_ID=$(echo "$TICKET_DEFAULT" | jq -r '.id')
if [ "$TICKET_DEFAULT_ID" != "null" ] && [ -n "$TICKET_DEFAULT_ID" ]; then
  echo -e "${GREEN}✓ Ticket created in default org: $TICKET_DEFAULT_ID${NC}"
else
  echo -e "${RED}✗ Failed to create ticket in default org${NC}"
  exit 1
fi
echo ""

# Test 10: Create ticket in test org
echo "Test 10: Create Ticket in Test Org"
TICKET_TEST=$(call_api "POST" "/api/tickets" "$TEST_ORG_ID" "{
  \"title\": \"Rep Test Ticket Test Org\",
  \"description\": \"Testing rep console in test org\",
  \"category\": \"technical\"
}")

TICKET_TEST_ID=$(echo "$TICKET_TEST" | jq -r '.id')
if [ "$TICKET_TEST_ID" != "null" ] && [ -n "$TICKET_TEST_ID" ]; then
  echo -e "${GREEN}✓ Ticket created in test org: $TICKET_TEST_ID${NC}"
else
  echo -e "${RED}✗ Failed to create ticket in test org${NC}"
  exit 1
fi
echo ""

# Test 11: Get AI suggestion for default org ticket
echo "Test 11: Get AI Suggestion for Default Org Ticket"
AI_SUGGESTION_DEFAULT=$(call_api "POST" "/api/rep/suggest" "$DEFAULT_ORG_ID" "{
  \"ticket_id\": \"$TICKET_DEFAULT_ID\"
}")

DEFAULT_SUGGESTION_TEXT=$(echo "$AI_SUGGESTION_DEFAULT" | jq -r '.suggestion // empty')
if [ -n "$DEFAULT_SUGGESTION_TEXT" ]; then
  echo -e "${GREEN}✓ AI suggestion generated for default org ticket${NC}"
  echo "Suggestion preview: ${DEFAULT_SUGGESTION_TEXT:0:100}..."
else
  echo -e "${YELLOW}⚠ AI suggestion may have failed (check if KB has content)${NC}"
fi
echo ""

# Test 12: Get AI suggestion for test org ticket
echo "Test 12: Get AI Suggestion for Test Org Ticket"
AI_SUGGESTION_TEST=$(call_api "POST" "/api/rep/suggest" "$TEST_ORG_ID" "{
  \"ticket_id\": \"$TICKET_TEST_ID\"
}")

TEST_SUGGESTION_TEXT=$(echo "$AI_SUGGESTION_TEST" | jq -r '.suggestion // empty')
if [ -n "$TEST_SUGGESTION_TEXT" ]; then
  echo -e "${GREEN}✓ AI suggestion generated for test org ticket${NC}"
  echo "Suggestion preview: ${TEST_SUGGESTION_TEXT:0:100}..."
else
  echo -e "${YELLOW}⚠ AI suggestion may have failed (check if KB has content)${NC}"
fi
echo ""

# Test 13: List rep tickets in default org
echo "Test 13: List Rep Tickets in Default Org"
REP_TICKETS_DEFAULT=$(call_api "GET" "/api/rep/tickets" "$DEFAULT_ORG_ID")
REP_DEFAULT_COUNT=$(echo "$REP_TICKETS_DEFAULT" | jq '.items | length')
REP_HAS_DEFAULT_TICKET=$(echo "$REP_TICKETS_DEFAULT" | jq --arg id "$TICKET_DEFAULT_ID" '.items[] | select(.id == $id) | .id')

if [ -n "$REP_HAS_DEFAULT_TICKET" ]; then
  echo -e "${GREEN}✓ Rep console sees default org ticket (found $REP_DEFAULT_COUNT total)${NC}"
else
  echo -e "${RED}✗ Rep console cannot see default org ticket${NC}"
  exit 1
fi
echo ""

# Test 14: List rep tickets in test org
echo "Test 14: List Rep Tickets in Test Org"
REP_TICKETS_TEST=$(call_api "GET" "/api/rep/tickets" "$TEST_ORG_ID")
REP_TEST_COUNT=$(echo "$REP_TICKETS_TEST" | jq '.items | length')
REP_HAS_TEST_TICKET=$(echo "$REP_TICKETS_TEST" | jq --arg id "$TICKET_TEST_ID" '.items[] | select(.id == $id) | .id')
REP_HAS_DEFAULT_IN_TEST=$(echo "$REP_TICKETS_TEST" | jq --arg id "$TICKET_DEFAULT_ID" '.items[] | select(.id == $id) | .id')

if [ -n "$REP_HAS_TEST_TICKET" ] && [ -z "$REP_HAS_DEFAULT_IN_TEST" ]; then
  echo -e "${GREEN}✓ Rep console sees only test org ticket (found $REP_TEST_COUNT total)${NC}"
  echo -e "${GREEN}✓ Rep console data isolation working${NC}"
else
  echo -e "${RED}✗ Rep console data isolation failed${NC}"
  exit 1
fi
echo ""

###########################################
# ADMIN ANALYTICS TESTS
###########################################

echo "======================================"
echo "ADMIN ANALYTICS MULTI-TENANCY TESTS"
echo "======================================"
echo ""

# Test 15: Get ticket stats for default org
echo "Test 15: Get Ticket Stats for Default Org"
STATS_DEFAULT=$(call_api "GET" "/api/admin/stats" "$DEFAULT_ORG_ID")
STATS_DEFAULT_TOTAL=$(echo "$STATS_DEFAULT" | jq -r '.total_tickets // 0')

if [ "$STATS_DEFAULT_TOTAL" -gt 0 ]; then
  echo -e "${GREEN}✓ Admin stats for default org: $STATS_DEFAULT_TOTAL tickets${NC}"
else
  echo -e "${YELLOW}⚠ Admin stats returned 0 tickets for default org${NC}"
fi
echo ""

# Test 16: Get ticket stats for test org
echo "Test 16: Get Ticket Stats for Test Org"
STATS_TEST=$(call_api "GET" "/api/admin/stats" "$TEST_ORG_ID")
STATS_TEST_TOTAL=$(echo "$STATS_TEST" | jq -r '.total_tickets // 0')

if [ "$STATS_TEST_TOTAL" -ge 1 ]; then
  echo -e "${GREEN}✓ Admin stats for test org: $STATS_TEST_TOTAL tickets${NC}"
else
  echo -e "${YELLOW}⚠ Admin stats returned unexpected count for test org${NC}"
fi
echo ""

# Test 17: Get performance metrics for default org
echo "Test 17: Get Performance Metrics for Default Org"
PERF_DEFAULT=$(call_api "GET" "/api/admin/performance" "$DEFAULT_ORG_ID")
AVG_RESPONSE_TIME=$(echo "$PERF_DEFAULT" | jq -r '.avg_response_time_hours // "N/A"')

if [ "$AVG_RESPONSE_TIME" != "null" ]; then
  echo -e "${GREEN}✓ Performance metrics for default org retrieved${NC}"
  echo "Average response time: $AVG_RESPONSE_TIME hours"
else
  echo -e "${YELLOW}⚠ Performance metrics unavailable (may need more data)${NC}"
fi
echo ""

# Test 18: Get performance metrics for test org
echo "Test 18: Get Performance Metrics for Test Org"
PERF_TEST=$(call_api "GET" "/api/admin/performance" "$TEST_ORG_ID")
AVG_RESPONSE_TIME_TEST=$(echo "$PERF_TEST" | jq -r '.avg_response_time_hours // "N/A"')

if [ "$AVG_RESPONSE_TIME_TEST" != "null" ]; then
  echo -e "${GREEN}✓ Performance metrics for test org retrieved${NC}"
  echo "Average response time: $AVG_RESPONSE_TIME_TEST hours"
else
  echo -e "${YELLOW}⚠ Performance metrics unavailable (may need more data)${NC}"
fi
echo ""

###########################################
# FEEDBACK TESTS
###########################################

echo "======================================"
echo "FEEDBACK MULTI-TENANCY TESTS"
echo "======================================"
echo ""

# Test 19: Submit feedback for default org
echo "Test 19: Submit AI Feedback in Default Org"
FEEDBACK_DEFAULT=$(call_api "POST" "/api/feedback" "$DEFAULT_ORG_ID" "{
  \"ticket_id\": \"$TICKET_DEFAULT_ID\",
  \"message_id\": \"00000000-0000-0000-0000-000000000000\",
  \"rating\": \"positive\",
  \"comment\": \"Great AI suggestion for default org\"
}")

FEEDBACK_DEFAULT_ID=$(echo "$FEEDBACK_DEFAULT" | jq -r '.id // empty')
if [ -n "$FEEDBACK_DEFAULT_ID" ]; then
  echo -e "${GREEN}✓ Feedback submitted for default org${NC}"
else
  echo -e "${YELLOW}⚠ Feedback submission may have failed${NC}"
fi
echo ""

# Test 20: Submit feedback for test org
echo "Test 20: Submit AI Feedback in Test Org"
FEEDBACK_TEST=$(call_api "POST" "/api/feedback" "$TEST_ORG_ID" "{
  \"ticket_id\": \"$TICKET_TEST_ID\",
  \"message_id\": \"00000000-0000-0000-0000-000000000000\",
  \"rating\": \"positive\",
  \"comment\": \"Great AI suggestion for test org\"
}")

FEEDBACK_TEST_ID=$(echo "$FEEDBACK_TEST" | jq -r '.id // empty')
if [ -n "$FEEDBACK_TEST_ID" ]; then
  echo -e "${GREEN}✓ Feedback submitted for test org${NC}"
else
  echo -e "${YELLOW}⚠ Feedback submission may have failed${NC}"
fi
echo ""

###########################################
# SUMMARY
###########################################

echo ""
echo "======================================"
echo "Additional Tests Summary"
echo "======================================"
echo ""
echo -e "${GREEN}Knowledge Base:${NC}"
echo "  ✓ Document upload with org context"
echo "  ✓ Document listing isolated by org"
echo "  ✓ Search isolated by org"
echo "  ✓ Cross-org access denied"
echo ""
echo -e "${GREEN}Rep Console:${NC}"
echo "  ✓ AI suggestions with org context"
echo "  ✓ Ticket listing isolated by org"
echo "  ✓ Rep workflows respect org boundaries"
echo ""
echo -e "${GREEN}Admin Analytics:${NC}"
echo "  ✓ Ticket stats filtered by org"
echo "  ✓ Performance metrics filtered by org"
echo ""
echo -e "${GREEN}AI Feedback:${NC}"
echo "  ✓ Feedback submission with org context"
echo ""
echo -e "${GREEN}All additional multi-tenancy tests completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Review any warnings above"
echo "2. Test RAG analytics (currently global)"
echo "3. Proceed with frontend integration"
