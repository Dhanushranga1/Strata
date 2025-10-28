# TicketPilot Multi-Tenancy Testing Guide

## 🎯 Testing Overview

This guide provides step-by-step instructions for testing the multi-tenancy implementation in TicketPilot Phase 3.

---

## 🚀 Pre-Testing Setup

### 1. Verify Servers Are Running

**Frontend:**
```bash
# Should be running on port 3001
curl http://localhost:3001
```

**Backend:**
```bash
# Check backend process
ps aux | grep uvicorn
# Should show: uvicorn app.main:app --reload --port 8000
```

### 2. Test User Requirements

You need a test user with access to **multiple organizations** (2+) to properly test org switching.

**Check in database:**
```sql
-- Find your test user's organizations
SELECT 
  o.id, 
  o.name, 
  o.slug,
  om.role,
  om.is_default
FROM organizations o
JOIN organization_members om ON o.id = om.organization_id
WHERE om.user_id = '<your-test-user-id>';
```

**Expected result:**
```
id                  | name           | slug        | role  | is_default
--------------------|----------------|-------------|-------|------------
uuid-1              | Tech Support   | tech-support| owner | true
uuid-2              | Acme Corp      | acme-corp   | admin | false
```

### 3. Browser Setup

- Open browser in **private/incognito mode** (clean slate)
- Navigate to http://localhost:3001
- Open DevTools Console (F12) to monitor errors

---

## 🧪 Test Suite 1: Organization Context Loading

### Test 1.1: Initial Load
**Steps:**
1. Go to http://localhost:3001
2. Login with test credentials
3. Wait for sidebar to load

**Expected Results:**
- ✅ Organization selector visible in sidebar
- ✅ Shows current organization name
- ✅ Dropdown icon (ChevronDown) visible
- ✅ No console errors
- ✅ User info displays above org selector

**Screenshot Checklist:**
```
┌─────────────────────┐
│ Sidebar             │
│                     │
│ [User Avatar]       │
│ John Doe            │
│ john@example.com    │
│                     │
│ ┌─────────────────┐ │
│ │ Tech Support  ▼ │ │ ← Organization Selector
│ └─────────────────┘ │
│                     │
│ [Dashboard]         │
│ [Tickets]           │
│ ...                 │
└─────────────────────┘
```

### Test 1.2: Organization Dropdown
**Steps:**
1. Click on organization selector
2. Dropdown menu opens

**Expected Results:**
- ✅ Dropdown shows all organizations
- ✅ Current org has checkmark (✓)
- ✅ Default org has badge: "(Default)"
- ✅ Each org shows role (Owner/Admin/Member)
- ✅ Can scroll if many orgs

**Example:**
```
┌────────────────────────┐
│ ✓ Tech Support        │ ← Current
│   Owner (Default)      │
├────────────────────────┤
│   Acme Corp           │
│   Admin               │
├────────────────────────┤
│   Startup Inc         │
│   Member              │
└────────────────────────┘
```

---

## 🧪 Test Suite 2: Organization Switching

### Test 2.1: Basic Org Switch
**Steps:**
1. Start on `/tickets` page with Org A selected
2. Note the ticket count and first few ticket titles
3. Click org selector, choose Org B
4. Wait for page to reload data

**Expected Results:**
- ✅ Dropdown closes immediately
- ✅ Sidebar shows new org name
- ✅ Page shows loading state briefly
- ✅ Ticket list updates with Org B's tickets
- ✅ Ticket count changes
- ✅ Console shows: "Switching to organization: [Org B ID]"
- ✅ localStorage updated: `ticketpilot_current_org_id`

**Verification:**
```javascript
// In DevTools Console
localStorage.getItem('ticketpilot_current_org_id')
// Should show: "uuid-of-org-b"
```

### Test 2.2: Org Switch Persistence
**Steps:**
1. Switch to Org B
2. Refresh page (F5)
3. Check which org is selected

**Expected Results:**
- ✅ Page loads with Org B still selected
- ✅ No flash of Org A content
- ✅ All data loads for Org B immediately

### Test 2.3: Rapid Org Switching
**Steps:**
1. Click org selector
2. Click Org B
3. Immediately click org selector again
4. Click Org C (before Org B finishes loading)

**Expected Results:**
- ✅ No duplicate API calls
- ✅ Only final org (Org C) loads
- ✅ No race conditions or errors
- ✅ Loading state shows until Org C data loads

---

## 🧪 Test Suite 3: Tickets Page

### Test 3.1: Ticket List Filtering
**Steps:**
1. Login and go to `/tickets`
2. Org A selected - note ticket count (e.g., 7 tickets)
3. Switch to Org B
4. Note new ticket count (e.g., 1 ticket)

**Expected Results:**
- ✅ Ticket count changes
- ✅ Different tickets shown
- ✅ No overlap between orgs
- ✅ Status filter still works
- ✅ Search still works (within org)

### Test 3.2: Create Ticket
**Steps:**
1. Select Org A
2. Click "New Ticket" button
3. Fill form: title, description, priority
4. Submit
5. Switch to Org B
6. Check if new ticket appears

**Expected Results:**
- ✅ Ticket created successfully
- ✅ Ticket appears in Org A's list
- ✅ Ticket does NOT appear in Org B's list
- ✅ API call includes X-Organization-ID: [Org A ID]

**Network Tab Verification:**
```
POST /api/tickets
Headers:
  Authorization: Bearer <token>
  X-Organization-ID: <org-a-id>
```

### Test 3.3: Ticket Detail View
**Steps:**
1. Select Org A
2. Click on a ticket from Org A
3. View ticket details
4. Send a message
5. Get AI response
6. Go back, switch to Org B
7. Try to access Org A's ticket URL directly

**Expected Results:**
- ✅ Ticket details load correctly
- ✅ Messages show for correct ticket
- ✅ AI chat uses correct org's KB
- ✅ Accessing Org A ticket from Org B context shows error/redirects

---

## 🧪 Test Suite 4: Knowledge Base

### Test 4.1: KB Stats
**Steps:**
1. Go to `/kb`
2. Note stats for Org A (e.g., 18 documents, 25 chunks)
3. Switch to Org B
4. Check new stats (e.g., 1 document, 3 chunks)

**Expected Results:**
- ✅ Stats update immediately
- ✅ Document count changes
- ✅ Chunk count changes
- ✅ Processing queue count correct

### Test 4.2: Document List
**Steps:**
1. In Org A, view document list
2. Note document titles
3. Switch to Org B
4. Check document list

**Expected Results:**
- ✅ Different documents shown
- ✅ No overlap between orgs
- ✅ Each doc shows correct title, chunks, status

### Test 4.3: KB Search
**Steps:**
1. In Org A, search for "refund"
2. Note results (e.g., 3 chunks found)
3. Switch to Org B
4. Search for "refund"
5. Note results (e.g., 0 chunks found)

**Expected Results:**
- ✅ Search results scoped to current org
- ✅ Different results per org
- ✅ Relevance scores shown correctly

### Test 4.4: Document Upload
**Steps:**
1. Select Org A
2. Upload a test document (e.g., test.txt)
3. Wait for processing
4. Switch to Org B
5. Check if document appears

**Expected Results:**
- ✅ Document uploads successfully
- ✅ Processing starts immediately
- ✅ Document appears in Org A's list
- ✅ Document does NOT appear in Org B's list

**Network Tab Verification:**
```
POST /api/kb/ingest
Headers:
  Authorization: Bearer <token>
  X-Organization-ID: <org-a-id>
  Content-Type: multipart/form-data
```

---

## 🧪 Test Suite 5: Rep Console

### Test 5.1: Queue Loading
**Steps:**
1. Go to `/rep`
2. Note queue size for Org A (e.g., 5 tickets)
3. Note queue counts by status
4. Switch to Org B
5. Check new queue (e.g., 1 ticket)

**Expected Results:**
- ✅ Queue updates with org-specific tickets
- ✅ Queue counts update (New, In Progress, etc.)
- ✅ No tickets from other orgs visible
- ✅ Auto-refresh maintains org context (30s)

### Test 5.2: Quick Actions
**Steps:**
1. In Org A, pick a ticket from queue
2. Click "Quick Call" button
3. View ticket messages - call logged
4. Switch to Org B
5. Pick a different ticket
6. Click "Quick Email" button
7. View ticket messages - email logged

**Expected Results:**
- ✅ Call logged to Org A's ticket
- ✅ Email logged to Org B's ticket
- ✅ Messages show in correct tickets only
- ✅ API calls include correct org IDs

### Test 5.3: AI Suggestions
**Steps:**
1. In Org A, select a ticket with messages
2. Wait for AI suggestion to generate
3. Suggestion appears based on Org A's KB
4. Switch to Org B
5. Select a ticket
6. Check AI suggestion (should use Org B's KB)

**Expected Results:**
- ✅ AI suggestions use correct org's knowledge base
- ✅ Different suggestions per org (based on their KB)
- ✅ Token count shown correctly
- ✅ No KB leakage between orgs

---

## 🧪 Test Suite 6: Admin Pages

### Test 6.1: Admin Dashboard
**Steps:**
1. Login as admin user
2. Go to `/admin`
3. Note stats for Org A:
   - Total tickets
   - Resolution rate
   - Avg response time
   - User count
   - Role requests
4. Switch to Org B
5. Check new stats

**Expected Results:**
- ✅ Stats update with org-specific data
- ✅ Ticket counts different per org
- ✅ User counts different per org
- ✅ Resolution rates calculated per org
- ✅ Role requests filtered by org

### Test 6.2: Admin Analytics
**Steps:**
1. Go to `/admin/analytics`
2. In Org A, view:
   - Summary stats (total, resolution rate, response time)
   - Tickets by category (new, in progress, resolved, closed)
   - Rep performance (tickets handled, avg resolution time)
3. Switch to Org B
4. Compare all metrics

**Expected Results:**
- ✅ Summary stats different per org
- ✅ Category breakdown different per org
- ✅ Rep performance shows only reps in that org
- ✅ Charts/graphs update correctly
- ✅ Time-based data scoped to org

### Test 6.3: User Management
**Steps:**
1. In Org A, view users list
2. Note user count (e.g., 5 users)
3. Switch to Org B
4. Check users list (e.g., 3 users)

**Expected Results:**
- ✅ Different users shown per org
- ✅ Only org members visible
- ✅ Roles shown correctly (owner/admin/rep/user)

---

## 🧪 Test Suite 7: Edge Cases

### Test 7.1: Single Organization User
**Steps:**
1. Login as user with only 1 org
2. Check org selector

**Expected Results:**
- ✅ Org selector still visible
- ✅ Shows single org name
- ✅ Dropdown works but only shows 1 org
- ✅ Switching doesn't break anything

### Test 7.2: No Organizations
**Steps:**
1. Create new user
2. Don't assign to any org
3. Try to login and access pages

**Expected Results:**
- ✅ Shows helpful error message
- ✅ "No organizations found" state
- ✅ Prompt to contact admin
- ✅ Doesn't crash or show errors

### Test 7.3: Removed from Organization
**Steps:**
1. Login with Org A selected
2. Have another admin remove you from Org A
3. Refresh page

**Expected Results:**
- ✅ Org A no longer in dropdown
- ✅ Auto-switches to another org (if available)
- ✅ Or shows "No organizations" message
- ✅ No crash or infinite loop

### Test 7.4: Network Errors
**Steps:**
1. Open DevTools Network tab
2. Switch to Org B
3. Immediately go offline (DevTools: Offline mode)
4. Wait for requests to fail
5. Go back online

**Expected Results:**
- ✅ Shows error message (not just crash)
- ✅ Can retry loading data
- ✅ Doesn't leave app in broken state
- ✅ Error boundary catches issues

---

## 🧪 Test Suite 8: Data Isolation Verification

### Test 8.1: Ticket Isolation
**Steps:**
1. In Org A, create ticket: "Test Ticket A"
2. Note ticket ID
3. Switch to Org B
4. Search for "Test Ticket A"
5. Try to access Org A's ticket URL directly

**Expected Results:**
- ✅ Ticket not found in Org B's search
- ✅ Direct URL access denied or shows error
- ✅ API returns 403 Forbidden or 404 Not Found
- ✅ Perfect isolation - no data leakage

### Test 8.2: KB Document Isolation
**Steps:**
1. In Org A, upload document: "Secret Doc A"
2. In Org B, search for content from "Secret Doc A"
3. Check if any chunks returned

**Expected Results:**
- ✅ Zero results in Org B
- ✅ Document only accessible from Org A
- ✅ KB search fully isolated
- ✅ No cross-org data leakage

### Test 8.3: Rep Queue Isolation
**Steps:**
1. In Org A, view rep queue (e.g., 5 tickets)
2. Note ticket titles
3. Switch to Org B
4. Check if any Org A tickets visible in queue

**Expected Results:**
- ✅ Completely different queue
- ✅ No tickets from Org A visible
- ✅ Queue counts independent
- ✅ Perfect isolation

---

## 📊 Test Results Template

```markdown
## Test Execution Report

**Date:** YYYY-MM-DD  
**Tester:** [Your Name]  
**Environment:** 
- Frontend: http://localhost:3001
- Backend: http://127.0.0.1:8000

### Summary
- Total Tests: 30
- Passed: X
- Failed: Y
- Skipped: Z

### Detailed Results

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 1.1 | Initial Load | ✅ Pass | - |
| 1.2 | Organization Dropdown | ✅ Pass | - |
| 2.1 | Basic Org Switch | ❌ Fail | Data not updating |
| ... | ... | ... | ... |

### Issues Found

**Issue 1: Data Not Updating on Org Switch**
- **Severity:** High
- **Steps to Reproduce:** ...
- **Expected:** ...
- **Actual:** ...
- **Console Errors:** ...

### Recommendations
1. Fix Issue 1 before proceeding
2. Add loading indicators for Test 2.3
3. Improve error messages for Test 7.2
```

---

## 🔍 Debugging Tips

### Check Organization Context
```javascript
// In DevTools Console
localStorage.getItem('ticketpilot_current_org_id')
// Should match selected org
```

### Monitor Network Requests
```javascript
// All API calls should include these headers:
Authorization: Bearer <supabase-token>
X-Organization-ID: <current-org-id>
```

### React DevTools
- Install React DevTools extension
- Find `OrganizationContext` component
- Inspect state:
  - `currentOrganization`
  - `organizations`
  - `isReady`
  - `loading`

### Check Console for Errors
Common errors to watch for:
- ❌ `Organization context not loaded`
- ❌ `Failed to fetch /api/...`
- ❌ `Cannot read property 'id' of undefined`
- ❌ `X-Organization-ID header missing`

---

## ✅ Success Criteria

**Phase 3 is ready for production when:**

1. ✅ All 30+ tests pass
2. ✅ Zero data leakage between orgs
3. ✅ Org switching is smooth (< 1s)
4. ✅ No console errors during normal operation
5. ✅ Edge cases handled gracefully
6. ✅ Error messages are user-friendly
7. ✅ Network errors don't crash the app
8. ✅ Performance is acceptable (no lag)

---

## 📞 Support

**Found a bug?**
- Document steps to reproduce
- Include console errors
- Note which org context
- Share network request details

**Need help?**
- Check PHASE3_FRONTEND_INTEGRATION.md
- Review OrganizationContext implementation
- Verify backend is running and org middleware active

---

*Last Updated: October 28, 2025 18:30 UTC*
*Version: 1.0 - Initial testing guide*
