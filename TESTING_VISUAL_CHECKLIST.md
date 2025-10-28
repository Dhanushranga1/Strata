# 📋 Phase 3 Visual Testing Checklist

## Quick Reference Guide for Manual Testing

---

## ✅ 1. Initial Setup Verification

### Servers Running
```
Backend:  http://127.0.0.1:8000     [ ] Running
Frontend: http://localhost:3001     [ ] Running
```

### Browser Setup
```
Browser:        [ ] Chrome/Firefox/Safari
Private Mode:   [ ] Enabled
DevTools:       [ ] Open (F12)
Console Tab:    [ ] Visible
Network Tab:    [ ] Enabled
```

---

## ✅ 2. Organization Selector - Visual Check

### Sidebar Elements (Should be visible)
```
┌─────────────────────────────┐
│ Sidebar                     │
│                             │
│ ┌─────────────────────────┐ │
│ │ [Avatar] John Doe       │ │  [ ] User info visible
│ │ john@example.com        │ │  [ ] Email visible
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ Tech Support         ▼  │ │  [ ] Org selector visible
│ └─────────────────────────┘ │  [ ] Dropdown icon present
│                             │  [ ] Current org name shown
│ [Dashboard]                 │
│ [Tickets]                   │
│ [Knowledge Base]            │
│ ...                         │
└─────────────────────────────┘
```

### Click Org Selector - Dropdown Check
```
┌──────────────────────────────┐
│ ✓ Tech Support              │  [ ] Checkmark on current org
│   Owner (Default)           │  [ ] Default badge shown
├──────────────────────────────┤  [ ] Role displayed
│   Acme Corp                 │  [ ] Other orgs listed
│   Admin                     │  [ ] Hover effect works
├──────────────────────────────┤
│   Startup Inc               │
│   Member                    │
└──────────────────────────────┘
```

---

## ✅ 3. Organization Switching Test

### Before Switch (Org A: "Tech Support")
```
Page: /tickets
Ticket Count: ______ (write down)
First Ticket: __________________ (write down)
Second Ticket: _________________ (write down)
```

### During Switch
```
Action: Click org selector → Choose "Acme Corp"
Expected:
  [ ] Dropdown closes immediately
  [ ] Sidebar updates to "Acme Corp"
  [ ] Page shows loading indicator
  [ ] Console log: "Switching to organization: ..."
```

### After Switch (Org B: "Acme Corp")
```
Page: /tickets (same page)
Ticket Count: ______ (should be different)
First Ticket: __________________ (should be different)
Second Ticket: _________________ (should be different)

Verification:
  [ ] Different tickets shown
  [ ] Counts are different
  [ ] No overlap with Org A tickets
```

---

## ✅ 4. Tickets Page Tests

### Test 4.1: View Tickets (Org A)
```
Navigate to: http://localhost:3001/tickets
Current Org: Tech Support

Visual Check:
  [ ] Ticket list loads
  [ ] Shows ticket count (e.g., "7 tickets")
  [ ] Each ticket shows: title, status, priority
  [ ] Status badges colored correctly
  [ ] Search box visible
  [ ] "New Ticket" button visible

Write down ticket count: ______
```

### Test 4.2: Switch Org & Verify
```
Action: Switch to Acme Corp

Visual Check:
  [ ] Page reloads data
  [ ] Ticket count changes
  [ ] Different tickets shown
  [ ] No tickets from Tech Support visible

Write down new ticket count: ______
Difference confirms isolation: [ ] YES / [ ] NO
```

### Test 4.3: Create Ticket
```
Org: Acme Corp
Action: Click "New Ticket"

Form Fill:
  Title: "Test Isolation Ticket"
  Description: "Testing org isolation"
  Priority: High
  [ ] Submit button clicked

After Submit:
  [ ] Success message shown
  [ ] Redirected to ticket list
  [ ] New ticket visible in list
  [ ] Ticket count increased by 1

Switch to Tech Support:
  [ ] "Test Isolation Ticket" NOT visible
  [ ] Ticket count unchanged from step 4.1

Result: [ ] PASS / [ ] FAIL
```

---

## ✅ 5. Knowledge Base Tests

### Test 5.1: KB Stats (Org A)
```
Navigate to: http://localhost:3001/kb
Current Org: Tech Support

Visual Check:
  [ ] Stats section visible
  [ ] Shows "Total Documents"
  [ ] Shows "Total Chunks"
  [ ] Shows "Processing Queue"

Write down stats:
  Total Documents: ______
  Total Chunks: ______
  Processing: ______
```

### Test 5.2: Switch Org & Compare
```
Action: Switch to Acme Corp

Visual Check:
  [ ] Stats update immediately
  [ ] Document count changes
  [ ] Chunk count changes

Write down new stats:
  Total Documents: ______
  Total Chunks: ______
  Processing: ______

Stats are different: [ ] YES / [ ] NO
```

### Test 5.3: Document List
```
Org A (Tech Support):
  Document Count in List: ______
  First Doc Title: __________________

Switch to Org B (Acme Corp):
  Document Count in List: ______
  First Doc Title: __________________

Lists are different: [ ] YES / [ ] NO
No overlap: [ ] YES / [ ] NO
```

### Test 5.4: Search Isolation
```
Org A (Tech Support):
  Search Query: "refund"
  Results Found: ______
  First Result: __________________

Org B (Acme Corp):
  Search Query: "refund" (same query)
  Results Found: ______
  First Result: __________________

Results are different: [ ] YES / [ ] NO
No overlap: [ ] YES / [ ] NO
```

---

## ✅ 6. Rep Console Tests

### Test 6.1: Queue View (Org A)
```
Navigate to: http://localhost:3001/rep
Current Org: Tech Support

Visual Check:
  [ ] Rep queue loads
  [ ] Shows queue counts (New, In Progress, etc.)
  [ ] Ticket list visible
  [ ] Quick action buttons visible

Write down:
  New Tickets: ______
  In Progress: ______
  Total in Queue: ______
```

### Test 6.2: Switch Org & Verify
```
Action: Switch to Acme Corp

Visual Check:
  [ ] Queue updates
  [ ] Different tickets shown
  [ ] Queue counts change

Write down:
  New Tickets: ______
  In Progress: ______
  Total in Queue: ______

Counts are different: [ ] YES / [ ] NO
```

### Test 6.3: Quick Actions
```
Org: Tech Support
Pick first ticket in queue

Action: Click "Quick Call" button

Expected:
  [ ] Modal/toast shown
  [ ] Action logged
  [ ] Can view ticket messages
  [ ] Call action appears in messages

Result: [ ] PASS / [ ] FAIL
```

---

## ✅ 7. Admin Pages Tests

### Test 7.1: Admin Dashboard (Org A)
```
Navigate to: http://localhost:3001/admin
Current Org: Tech Support

Visual Check:
  [ ] Dashboard loads
  [ ] Shows "Total Tickets"
  [ ] Shows "Resolution Rate"
  [ ] Shows "Avg Response Time"
  [ ] Shows "Total Users"
  [ ] Recent activity shown

Write down stats:
  Total Tickets: ______
  Resolution Rate: ______%
  Total Users: ______
```

### Test 7.2: Switch Org & Compare
```
Action: Switch to Acme Corp

Visual Check:
  [ ] All stats update
  [ ] Different numbers shown

Write down new stats:
  Total Tickets: ______
  Resolution Rate: ______%
  Total Users: ______

Stats are different: [ ] YES / [ ] NO
```

### Test 7.3: Analytics Page
```
Navigate to: http://localhost:3001/admin/analytics
Current Org: Tech Support

Visual Check:
  [ ] Analytics page loads
  [ ] Summary stats visible
  [ ] Category breakdown shown (New, In Progress, Resolved, Closed)
  [ ] Rep performance table visible

Write down category breakdown:
  New: ______
  In Progress: ______
  Resolved: ______
  Closed: ______

Switch to Acme Corp:
  [ ] All metrics update
  [ ] Different rep performance shown

Result: [ ] PASS / [ ] FAIL
```

---

## ✅ 8. Edge Cases

### Test 8.1: Rapid Switching
```
Action: Quickly switch between orgs 5 times
  Tech Support → Acme Corp → Tech Support → Acme Corp → Tech Support

Expected:
  [ ] No errors in console
  [ ] Final org shows correct data
  [ ] No duplicate API calls
  [ ] No race conditions

Result: [ ] PASS / [ ] FAIL
```

### Test 8.2: Page Refresh Persistence
```
Step 1: Select Acme Corp
Step 2: Navigate to /tickets
Step 3: Press F5 (refresh)

Expected:
  [ ] Page reloads with Acme Corp still selected
  [ ] Shows Acme Corp's tickets (not Tech Support's)
  [ ] No flash of wrong data

Result: [ ] PASS / [ ] FAIL
```

### Test 8.3: Direct URL Access
```
Step 1: With Tech Support selected, go to a specific ticket
  URL: /tickets/[ticket-id-from-tech-support]
Step 2: Switch to Acme Corp
Step 3: Access same URL again

Expected:
  [ ] Error shown or redirected
  [ ] Ticket not accessible from wrong org
  [ ] Console shows authorization error

Result: [ ] PASS / [ ] FAIL
```

---

## ✅ 9. Network Verification

### Check API Headers (Pick Any Page)
```
DevTools → Network Tab → XHR/Fetch Filter

Pick any API call, check Request Headers:

[ ] Authorization: Bearer <token> present
[ ] X-Organization-ID: <org-id> present
[ ] Org ID matches current org

Example:
  GET /api/tickets
  Headers:
    Authorization: Bearer eyJ...
    X-Organization-ID: uuid-123-456-...

All API calls have org header: [ ] YES / [ ] NO
```

---

## ✅ 10. Console Check

### No Errors During Normal Use
```
Open Console (F12 → Console)

During entire test session:
  [ ] No red errors (exceptions allowed: expected 404s)
  [ ] Org switching logs visible
  [ ] API calls logged (if debug enabled)
  [ ] No infinite loops
  [ ] No memory warnings

Clean console: [ ] YES / [ ] NO
```

---

## 📊 Final Checklist Summary

### Core Functionality
```
[ ] Organization selector visible in sidebar
[ ] Can switch between organizations smoothly
[ ] Current org displayed correctly
[ ] Org selection persisted (localStorage)
```

### Data Isolation
```
[ ] Tickets page: Different data per org
[ ] KB page: Different documents per org
[ ] Rep console: Different queue per org
[ ] Admin pages: Different stats per org
[ ] Zero data leakage between orgs
```

### API Integration
```
[ ] All API calls include Authorization header
[ ] All API calls include X-Organization-ID header
[ ] Org ID matches current selected org
[ ] Backend validates org access
```

### User Experience
```
[ ] Org switching is smooth (<1s)
[ ] Loading states shown during switch
[ ] No flash of incorrect data
[ ] Errors handled gracefully
[ ] Console is clean (no red errors)
```

### Edge Cases
```
[ ] Rapid switching works
[ ] Page refresh maintains org selection
[ ] Direct URLs protected by org context
[ ] Network errors don't crash app
```

---

## 🎯 Overall Test Result

```
Total Sections:     10
Sections Passed:    ___/10
Overall Status:     [ ] PASS / [ ] FAIL

Ready for Production: [ ] YES / [ ] NO
```

---

## 📝 Issues Found

```
Issue #1:
  Description: ________________________________
  Severity: [ ] Critical [ ] High [ ] Medium [ ] Low
  Steps to Reproduce: __________________________
  Expected: ____________________________________
  Actual: ______________________________________

Issue #2:
  (Repeat as needed)
```

---

## ✅ Sign-Off

```
Tester Name: ________________________
Date: _______________________________
Signature: __________________________

Approved for Next Phase: [ ] YES / [ ] NO
```

---

*Visual Testing Checklist v1.0*  
*Last Updated: October 28, 2025*

**Print this checklist and check boxes as you test!** ✅
