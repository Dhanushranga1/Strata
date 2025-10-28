# 🚀 Phase 3 Testing Quick Start

## TL;DR - Start Testing in 5 Minutes

### Prerequisites Check ✅
```bash
# 1. Backend running?
ps aux | grep uvicorn
# Should show: uvicorn app.main:app --reload --port 8000

# 2. Frontend running?
curl http://localhost:3001
# Should return HTML (not error)
```

### If Servers Not Running
```bash
# Start backend (from project root)
cd backend
source venv/bin/activate  # Or your venv path
python -m uvicorn app.main:app --reload --port 8000

# Start frontend (new terminal)
cd frontend
npm run dev
# Will start on port 3001 (or 3000 if available)
```

---

## 🧪 Quick Test Flow (15 minutes)

### Test 1: Basic Organization Switching (5 min)

1. **Open browser** to http://localhost:3001
2. **Login** with your test credentials
3. **Look for org selector** in sidebar (below user info)
4. **Expected:** Dropdown showing current organization name

5. **Click org selector**
6. **Expected:** Dropdown opens with list of organizations
   - ✓ Checkmark on current org
   - "(Default)" badge on default org
   - Role shown (Owner/Admin/Member)

7. **Select different organization**
8. **Expected:**
   - Dropdown closes
   - Sidebar shows new org name
   - Page reloads data (brief loading state)

9. **Check console** (F12 → Console tab)
10. **Expected:** `Switching to organization: <org-id>`

11. **Refresh page** (F5)
12. **Expected:** Same org still selected (persisted)

**✅ PASS CRITERIA:** Org selector works, switching updates UI, persistence works

---

### Test 2: Tickets Page Data Isolation (5 min)

1. **Go to** http://localhost:3001/tickets
2. **With Org A selected:**
   - Note ticket count (e.g., "7 tickets")
   - Note first ticket title (e.g., "Refund request")
3. **Screenshot or write down** the visible tickets

4. **Switch to Org B**
5. **Expected:**
   - Ticket count changes (e.g., "1 ticket")
   - Different tickets shown
   - Previous tickets from Org A not visible

6. **Create new ticket** (click "New Ticket")
   - Title: "Test Ticket for Org B"
   - Description: "Testing org isolation"
   - Submit

7. **Switch back to Org A**
8. **Expected:** "Test Ticket for Org B" is NOT visible

**✅ PASS CRITERIA:** Different tickets per org, new ticket isolated to creating org

---

### Test 3: Knowledge Base Data Isolation (5 min)

1. **Go to** http://localhost:3001/kb
2. **With Org A selected:**
   - Note document count (e.g., "18 documents")
   - Note total chunks (e.g., "45 chunks")
3. **Screenshot or write down** the stats

4. **Switch to Org B**
5. **Expected:**
   - Document count changes (e.g., "1 document")
   - Chunk count different (e.g., "3 chunks")
   - Different documents in list

6. **Search for something** (e.g., "refund")
   - In Org A: Note results (e.g., "3 results")
   - In Org B: Search same term
   - Expected: Different results or zero results

**✅ PASS CRITERIA:** Different KB data per org, search isolated

---

## 🐛 Common Issues & Quick Fixes

### Issue: Org selector not visible
**Fix:** Refresh page, check if you're logged in, verify OrganizationContext loaded

### Issue: Data not updating when switching orgs
**Fix:** 
- Check browser console for errors
- Verify backend is running
- Check Network tab - API calls should include `X-Organization-ID` header

### Issue: "Organization context not loaded" error
**Fix:**
- Wait a few seconds for context to load
- Refresh page
- Check if `/api/auth/context` endpoint is working:
  ```bash
  curl http://127.0.0.1:8000/api/auth/context \
    -H "Authorization: Bearer <your-token>"
  ```

### Issue: Page shows old org's data after switch
**Fix:**
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear localStorage: `localStorage.clear()` in console
- Check if useEffect dependencies include `orgId`

---

## 📊 Quick Test Report Template

```markdown
## Quick Test Results

**Date:** [Date]
**Tester:** [Your Name]

### Test 1: Organization Switching
- [ ] Org selector visible: YES / NO
- [ ] Dropdown works: YES / NO
- [ ] Switching updates UI: YES / NO
- [ ] Persistence works: YES / NO
- **Status:** PASS / FAIL
- **Notes:**

### Test 2: Tickets Data Isolation
- Org A ticket count: ___
- Org B ticket count: ___
- [ ] Different tickets shown: YES / NO
- [ ] New ticket isolated: YES / NO
- **Status:** PASS / FAIL
- **Notes:**

### Test 3: KB Data Isolation
- Org A doc count: ___
- Org B doc count: ___
- [ ] Different docs shown: YES / NO
- [ ] Search isolated: YES / NO
- **Status:** PASS / FAIL
- **Notes:**

### Overall Result
- **Total Tests:** 3
- **Passed:** ___
- **Failed:** ___
- **Ready for Production:** YES / NO

### Issues Found
1. [Issue description]
2. [Issue description]
```

---

## 🔍 Debug Mode

### Check Organization Context
```javascript
// In browser console (F12)
localStorage.getItem('ticketpilot_current_org_id')
// Should show current org UUID
```

### Monitor API Calls
1. Open DevTools (F12)
2. Go to Network tab
3. Filter: `XHR` or `Fetch`
4. Click any API call
5. Check Headers tab
6. Verify:
   - ✅ `Authorization: Bearer <token>` present
   - ✅ `X-Organization-ID: <org-id>` present

### Check React Context State
1. Install React DevTools extension
2. Open DevTools → Components tab
3. Find `OrganizationContext` component
4. Inspect state:
   ```
   currentOrganization: { id: "...", name: "...", ... }
   organizations: [{ ... }, { ... }]
   isReady: true
   loading: false
   ```

---

## ✅ Success Criteria (Must Pass All)

- [x] Org selector visible in sidebar
- [x] Can switch between organizations
- [x] Tickets page shows different data per org
- [x] KB page shows different data per org
- [x] No console errors during normal operation
- [x] localStorage persists org selection
- [x] All API calls include org header

**If all checked:** ✅ **Phase 3 core functionality is working!**

---

## 📚 Full Testing

For comprehensive testing, see **TESTING_GUIDE.md** (30+ tests)

For implementation details, see **PHASE3_FRONTEND_INTEGRATION.md**

For architecture overview, see **PHASE3_COMPLETION_SUMMARY.md**

---

## 🆘 Need Help?

1. Check console for errors
2. Review Network tab for failed API calls
3. Verify backend is running: `ps aux | grep uvicorn`
4. Verify frontend is running: `curl http://localhost:3001`
5. Clear cache and try again
6. Check if you have access to multiple organizations

---

*Quick Start Version 1.0*  
*Last Updated: October 28, 2025*

🎯 **Goal: Verify multi-tenancy works in 15 minutes!**
