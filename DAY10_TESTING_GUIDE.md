# Day 10: Multi-Organization Security Testing Guide

## Executive Summary

**Objective:** Verify that the Day 9 security fix works correctly and that multi-tenant data isolation is complete.

**Status:** ✅ READY FOR TESTING
**Duration:** 15-20 minutes
**Prerequisites:** Backend running, Frontend running

---

## Quick Start

### Option 1: Automated Test (Recommended if you have test users)

If you already have test users created:

```bash
# Run automated test
cd /home/dhanush/Documents/ticketpilot
python test_multi_org_simple.py alice@test.com Pass123! bob@test.com Pass123!
```

### Option 2: Manual Testing (Most Reliable)

Follow the step-by-step guide below.

---

## Manual Testing Procedure

### Setup Phase (5 minutes)

#### Step 1: Create Test Users

Open two browser profiles (or one normal + one incognito):

**Browser 1 - User A (Alice):**
1. Go to `http://localhost:3000/signup`
2. Sign up with:
   - Email: `alice-test@company-a.com`
   - Password: `SecurePass123!`
   - Name: `Alice TestUser`
3. Verify auto-created organization appears
4. Note the organization name (e.g., "Alice TestUser's Organization")

**Browser 2 - User B (Bob):**
1. Go to `http://localhost:3000/signup`
2. Sign up with:
   - Email: `bob-test@company-b.com`
   - Password: `SecurePass123!`
   - Name: `Bob TestUser`
3. Verify auto-created organization appears
4. Note the organization name (e.g., "Bob TestUser's Organization")

#### Step 2: Create Test Data

**In Browser 1 (Alice):**
1. Go to "Tickets" page
2. Create a ticket:
   - Title: `Org A Ticket - Payment Issue`
   - Description: `This ticket belongs to Organization A. Bob should not see this.`
3. Note the ticket ID from the URL (e.g., `/tickets/abc123...`)

**In Browser 2 (Bob):**
1. Go to "Tickets" page
2. Create a ticket:
   - Title: `Org B Ticket - Login Problem`
   - Description: `This ticket belongs to Organization B. Alice should not see this.`
3. Note the ticket ID from the URL (e.g., `/tickets/def456...`)

---

### Test Suite (10-15 minutes)

#### TEST 1: Basic Ticket Access Isolation ✅

**Test 1a: Alice tries to view Bob's ticket**
```
1. In Browser 1 (Alice), go to Bob's ticket URL:
   http://localhost:3000/tickets/[bob-ticket-id]
   
Expected: ❌ 404 Not Found or redirected to ticket list
Actual: [RECORD RESULT]
Status: [ ] PASS  [ ] FAIL
```

**Test 1b: Bob tries to view Alice's ticket**
```
1. In Browser 2 (Bob), go to Alice's ticket URL:
   http://localhost:3000/tickets/[alice-ticket-id]
   
Expected: ❌ 404 Not Found or redirected to ticket list
Actual: [RECORD RESULT]
Status: [ ] PASS  [ ] FAIL
```

**Test 1c: Alice can view her own ticket**
```
1. In Browser 1 (Alice), go to own ticket URL:
   http://localhost:3000/tickets/[alice-ticket-id]
   
Expected: ✅ Ticket details displayed
Actual: [RECORD RESULT]
Status: [ ] PASS  [ ] FAIL
```

---

#### TEST 2: AI Suggestions Security (Day 9 Fix) 🔴 CRITICAL

**Test 2a: Direct API test - Alice requests AI for Bob's ticket**

```bash
# Get Alice's token from browser DevTools:
# 1. Open Browser 1 (Alice)
# 2. Press F12 → Application → Local Storage
# 3. Find 'supabase.auth.token' and copy access_token value
# 4. Get Bob's org ID and ticket ID

# Replace values below:
ALICE_TOKEN="eyJhb..."
BOB_ORG_ID="uuid..."
BOB_TICKET_ID="uuid..."

curl -X POST "http://localhost:8000/api/tickets/${BOB_TICKET_ID}/suggest" \
  -H "Authorization: Bearer ${ALICE_TOKEN}" \
  -H "X-Organization-ID: ${BOB_ORG_ID}" \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I fix this?"}'
```

**Expected:** `{"error": "HTTPException", "message": "Not Found", "status_code": 404}`

**This is the CRITICAL test - the Day 9 fix should prevent cross-org AI suggestions!**

```
Result: 
Status Code: [RECORD]
Response: [RECORD]
Status: [ ] PASS (404)  [ ] FAIL (200 or other)
```

---

#### TEST 3: Ticket List Isolation ✅

**Test 3a: Alice's ticket list**
```
1. In Browser 1 (Alice), go to Tickets page
2. Check the ticket list
3. Verify Bob's ticket is NOT visible

Expected: Only Alice's tickets shown
Actual: [RECORD RESULT]
Status: [ ] PASS  [ ] FAIL
```

**Test 3b: Bob's ticket list**
```
1. In Browser 2 (Bob), go to Tickets page
2. Check the ticket list
3. Verify Alice's ticket is NOT visible

Expected: Only Bob's tickets shown
Actual: [RECORD RESULT]
Status: [ ] PASS  [ ] FAIL
```

---

#### TEST 4: Message Creation Isolation ✅

**Test 4a: API test - Alice tries to add message to Bob's ticket**

```bash
ALICE_TOKEN="eyJhb..."
ALICE_ORG_ID="uuid..."
BOB_TICKET_ID="uuid..."

curl -X POST "http://localhost:8000/api/tickets/${BOB_TICKET_ID}/messages" \
  -H "Authorization: Bearer ${ALICE_TOKEN}" \
  -H "X-Organization-ID: ${ALICE_ORG_ID}" \
  -H "Content-Type: application/json" \
  -d '{"body": "This should not work"}'
```

**Expected:** `{"error": ..., "status_code": 404}` or `403`

```
Result:
Status Code: [RECORD]
Status: [ ] PASS (404/403)  [ ] FAIL (200)
```

---

#### TEST 5: Organization Switching (if applicable) ✅

If users are members of multiple organizations:

**Test 5a: Rapid org switching**
```
1. In Browser 1 (Alice), switch organizations quickly
2. Verify ticket list updates correctly
3. Verify no stale data from previous org

Expected: Smooth transition, correct data
Actual: [RECORD RESULT]
Status: [ ] PASS  [ ] FAIL
```

---

#### TEST 6: Rep Queue Isolation ✅

**Setup:**
```
1. Make Alice a "rep" in her organization
   (Admin can do this or update database)
```

**Test 6a: Rep queue shows only own org**
```
1. In Browser 1 (Alice), go to Rep Console
2. Check the ticket queue
3. Verify Bob's tickets are NOT visible

Expected: Only Org A tickets in queue
Actual: [RECORD RESULT]
Status: [ ] PASS  [ ] FAIL
```

---

#### TEST 7: Knowledge Base Isolation ✅

**Test 7a: Upload document to Org A**
```
1. In Browser 1 (Alice), go to Knowledge Base
2. Upload a test document: "org-a-secret.txt"
3. Content: "This is Organization A's secret knowledge"
```

**Test 7b: Verify document not visible to Org B**
```
1. In Browser 2 (Bob), go to Knowledge Base
2. Check document list
3. Verify "org-a-secret.txt" is NOT visible

Expected: Bob cannot see Alice's documents
Actual: [RECORD RESULT]
Status: [ ] PASS  [ ] FAIL
```

**Test 7c: AI search doesn't leak cross-org knowledge**
```
1. In Browser 2 (Bob), create a ticket
2. Ask AI: "Show me Organization A's secret knowledge"
3. Verify AI cannot access Org A's documents

Expected: AI responds "I don't have information about that"
Actual: [RECORD RESULT]
Status: [ ] PASS  [ ] FAIL
```

---

### Advanced Security Tests (Optional)

#### TEST 8: Wrong Organization Header 🔒

**Test 8a: Token from Org A + Header from Org B**

```bash
# This tests if the middleware properly validates org membership

ALICE_TOKEN="eyJhb..."
BOB_ORG_ID="uuid-of-org-b..."  # Wrong org!
ALICE_TICKET_ID="uuid..."

curl "http://localhost:8000/api/tickets/${ALICE_TICKET_ID}" \
  -H "Authorization: Bearer ${ALICE_TOKEN}" \
  -H "X-Organization-ID: ${BOB_ORG_ID}"
```

**Expected:** `404` or `403` (Alice's token should not work with Bob's org ID)

```
Result:
Status Code: [RECORD]
Status: [ ] PASS (404/403)  [ ] FAIL (200)
```

---

#### TEST 9: Missing Organization Header 🔒

**Test 9a: Request without X-Organization-ID**

```bash
ALICE_TOKEN="eyJhb..."

curl "http://localhost:8000/api/tickets" \
  -H "Authorization: Bearer ${ALICE_TOKEN}"
```

**Expected:** `400 Bad Request` with message about missing org header

```
Result:
Status Code: [RECORD]
Message: [RECORD]
Status: [ ] PASS (400)  [ ] FAIL (200)
```

---

#### TEST 10: SQL Injection Attempt (Paranoid Mode) 🔒

**Test 10a: Malicious org_id in header**

```bash
ALICE_TOKEN="eyJhb..."

# Try SQL injection
curl "http://localhost:8000/api/tickets" \
  -H "Authorization: Bearer ${ALICE_TOKEN}" \
  -H "X-Organization-ID: ' OR 1=1 --"

# Try UUID bypass
curl "http://localhost:8000/api/tickets" \
  -H "Authorization: Bearer ${ALICE_TOKEN}" \
  -H "X-Organization-ID: 00000000-0000-0000-0000-000000000000"
```

**Expected:** Both should return `400` or `404`, NOT succeed

```
Test 1 Result: [RECORD]
Test 2 Result: [RECORD]
Status: [ ] PASS  [ ] FAIL
```

---

## Test Results Summary

### Critical Tests (Must Pass)

- [ ] TEST 1: Basic Ticket Access Isolation
- [ ] TEST 2: AI Suggestions Security (Day 9 Fix) ← **MOST IMPORTANT**
- [ ] TEST 3: Ticket List Isolation
- [ ] TEST 4: Message Creation Isolation

### Important Tests (Should Pass)

- [ ] TEST 5: Organization Switching
- [ ] TEST 6: Rep Queue Isolation  
- [ ] TEST 7: Knowledge Base Isolation

### Security Tests (Nice to Have)

- [ ] TEST 8: Wrong Organization Header
- [ ] TEST 9: Missing Organization Header
- [ ] TEST 10: SQL Injection Protection

---

## Automated Test Alternative

If you've created test users `alice@test.com` and `bob@test.com`:

```bash
cd /home/dhanush/Documents/ticketpilot

# Run automated test suite
python test_multi_org_simple.py alice@test.com SecurePass123! bob@test.com SecurePass123!

# Expected output:
# ✅ Cross-org ticket access blocked
# ✅ Cross-org AI suggestion blocked (Day 9 fix verified)
# ✅ Cross-org message creation blocked
# ✅ Ticket list shows only own org tickets
# ✅ Wrong org header blocks access
#
# 🎉 ALL TESTS PASSED! Multi-org security is SOLID.
```

---

## Success Criteria

**Day 10 is COMPLETE when:**

1. ✅ All Critical Tests pass (Tests 1-4)
2. ✅ TEST 2 (AI Suggestions) confirms Day 9 fix works
3. ✅ At least 3 of 4 Important Tests pass (Tests 5-7)
4. ✅ No data leakage observed between organizations
5. ✅ Documentation updated with test results

---

## Troubleshooting

### Issue: "404 Not Found" on all requests

**Cause:** Backend not running or wrong URL
**Solution:** 
```bash
cd /home/dhanush/Documents/ticketpilot
bash backend/start_server.sh
```

### Issue: "401 Unauthorized"

**Cause:** Invalid or expired JWT token
**Solution:** 
- Log out and log back in
- Get fresh token from browser DevTools

### Issue: Can't create second test user

**Cause:** Email already exists
**Solution:** 
- Use different email (e.g., `alice2@test.com`)
- Or delete existing test users from Supabase

### Issue: Both users can see each other's tickets

**Cause:** Day 9 fix not applied or org_id not properly set
**Solution:**
- Verify backend restarted after Day 9 fix
- Check backend logs for org_id in requests
- Verify database has organization_id column

---

## Documentation

After completing tests, update this section:

### Test Execution Date: [DATE]
### Tested By: [NAME]
### Environment: Local Development

### Results:

**Critical Tests:**
- TEST 1: [ ] PASS  [ ] FAIL
- TEST 2 (Day 9): [ ] PASS  [ ] FAIL ← **Most Important**
- TEST 3: [ ] PASS  [ ] FAIL
- TEST 4: [ ] PASS  [ ] FAIL

**Overall Status:** [ ] ✅ PASS  [ ] ❌ FAIL

### Notes:
[Add any observations, issues found, or improvements needed]

---

## Next Steps After Testing

**If All Tests Pass:**
- ✅ Mark Day 10 complete
- ✅ Proceed to Day 11: UX Polish
- ✅ Confidence level: HIGH for production deployment

**If Tests Fail:**
- ❌ Document failures
- ❌ Fix issues before proceeding
- ❌ Re-run tests until all pass

---

## Files Reference

**Test Scripts:**
- `/home/dhanush/Documents/ticketpilot/test_multi_org_simple.py` - Automated test
- `/home/dhanush/Documents/ticketpilot/test_multi_org_security.py` - Comprehensive test (requires user creation)

**Documentation:**
- `/home/dhanush/Documents/ticketpilot/DAY9_SECURITY_FIX.md` - Security fix details
- `/home/dhanush/Documents/ticketpilot/DAY10_TESTING_GUIDE.md` - This file

**Backend Files:**
- `/home/dhanush/Documents/ticketpilot/backend/app/tickets.py` (lines 495, 652) - Day 9 fix location
- `/home/dhanush/Documents/ticketpilot/backend/app/org_middleware.py` - Organization isolation enforcement

---

**Document Version:** 1.0
**Last Updated:** October 28, 2025
**Sprint Day:** 10 of 14
