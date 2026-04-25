# 🎬 TicketPilot Demo Flow Test Guide

## Testing Customer → Admin → Rep Flow

**Date:** February 18, 2026  
**Goal:** Test complete ticket lifecycle from customer creation to admin/rep resolution

---

## 🎯 Quick Setup

### Method 1: Multiple Browser Windows (Recommended)
1. **Regular Window:** Customer user
2. **Incognito/Private Window:** Admin user
3. **Another Incognate/Different Browser:** Rep user

### Method 2: Different Browsers
1. **Chrome:** Customer
2. **Firefox:** Admin  
3. **Edge/Safari:** Rep

---

## 📋 SCENARIO 1: Customer Creates Ticket → Admin Sees It

### Step 1: Login as Customer (Window 1)
```
URL: http://localhost:3000/login
Email: [your customer email]
Password: [your password]
```

**After Login:**
- You should see the dashboard
- Navigate to **Tickets** in sidebar
- Should see ticket list (may be empty if first time)

### Step 2: Create a Ticket
1. Click **"+ New Ticket"** button
2. Fill in:
   - **Title:** "Need help with account access"
   - **Description:** "I can't log into my account from mobile device. Getting error code 500."
3. Click **Submit**
4. ✅ You should see:
   - Toast notification "Ticket created successfully"
   - New ticket appears in your ticket list
   - Ticket has status badge (usually "open")

### Step 3: Note the Ticket ID
- Look at the ticket you just created
- Note the **Ticket ID** (e.g., "abc123...")
- Keep this window open

### Step 4: Login as Admin (Window 2 - Incognito)
```
URL: http://localhost:3000/login
Email: [your admin email]
Password: [your password]
```

**Important:** Make sure you're in the SAME ORGANIZATION as the customer!
- Check the organization selector in the sidebar
- If different, switch to the customer's organization

### Step 5: View Tickets as Admin
1. Navigate to **Tickets** in sidebar
2. ✅ You should see the ticket created by customer!
3. Click on the ticket to see details
4. You'll see:
   - Title and description
   - Customer information
   - Status
   - Creation time

---

## 📋 SCENARIO 2: Complete Flow (Customer → Rep → Resolution)

### Setup: Create 3 Users
You need:
1. **Customer:** Regular user
2. **Rep:** Support representative
3. **Admin:** (optional for viewing analytics)

### Flow Test:

#### Part 1: Customer Creates Urgent Ticket
**Window 1 (Customer):**
1. Login to http://localhost:3000
2. Go to **Tickets**
3. Click **"+ New Ticket"**
4. Enter:
   ```
   Title: URGENT: Payment not processing
   Description: I tried to make a payment 3 times but it keeps failing. 
   Transaction ID: TXN-12345. Please help ASAP!
   ```
5. Submit and keep window open

#### Part 2: Rep Sees Ticket in Queue
**Window 2 (Rep - Incognito):**
1. Login to http://localhost:3000
2. Navigate to **Rep Console** (sidebar)
3. ✅ You should see:
   - Ticket count in "Needs Attention" or "Open/Active"
   - The customer's ticket in the queue
   - Customer email displayed
4. Click on the ticket to expand details

#### Part 3: Rep Uses AI Assistant
**Still in Window 2 (Rep):**
1. With ticket selected, click **"Ask AI"** button
2. ✅ Wait for AI response (may take 5-10 seconds)
3. You should see:
   - Suggested response from AI
   - **Confidence Score** (e.g., 78%)
   - **Source citations** (if KB documents exist)
   - 7-factor confidence breakdown
4. Review the AI suggestion
5. Click **"Copy to Clipboard"** (optional)

#### Part 4: Rep Takes Action
**Still in Window 2 (Rep):**
1. Click **"Assign to Me"** button
2. ✅ Ticket should show "Assigned to: [your name]"
3. Add a response to customer (use AI suggestion or custom)
4. Click **"Resolve"** button
5. ✅ Ticket moves to resolved status

#### Part 5: Customer Sees Resolution
**Back to Window 1 (Customer):**
1. Refresh the tickets page or click on your ticket
2. ✅ You should see:
   - Ticket status changed to "Resolved"
   - Rep's response message
   - Timestamp of resolution

#### Part 6: Admin Views Analytics (Optional)
**Window 3 (Admin - another incognito):**
1. Login to http://localhost:3000
2. Navigate to **Admin → Analytics**
3. ✅ You should see:
   - Total tickets count increased
   - Ticket in "Resolved" status
   - Response time metrics
   - Charts updated

---

## 🔑 Important Notes

### ⚠️ Organization Context
**CRITICAL:** All users must be in the **SAME ORGANIZATION** to see each other's data!

- Check organization selector in sidebar (top left)
- If users are in different orgs, they won't see each other's tickets
- This is by design (multi-tenancy isolation)

**To verify same org:**
1. Login as each user
2. Check the organization name in sidebar
3. If different, use organization selector to switch

### 🎭 User Roles Required

For complete testing, you need these roles:

| Role | Can Do | Test Account |
|------|--------|--------------|
| **Customer** | Create tickets, view own tickets | [Your email] |
| **Rep** | View all tickets, use AI, assign, resolve | Need rep role |
| **Admin** | View analytics, manage users, upload KB | Need admin role |

### 📝 How to Assign Roles

**Method 1: Via Database**
```sql
-- Connect to your Supabase database
-- Update user role
UPDATE app.user_roles 
SET role = 'rep'  -- or 'admin'
WHERE user_id = 'USER_ID_HERE';
```

**Method 2: Via Admin UI** (if you have an admin account)
1. Login as admin
2. Go to **Admin → Users**
3. Find user and change role

---

## 🧪 Test Scenarios

### Test 1: Basic Ticket Creation ✅
- Customer creates ticket
- Ticket appears in customer's ticket list
- Admin/Rep can see ticket

### Test 2: Organization Isolation ✅
- Create 2 organizations
- Customer in Org A creates ticket
- Rep in Org B should NOT see it
- Switch Rep to Org A → Now sees ticket

### Test 3: AI Assistant ✅
- Rep opens ticket
- Click "Ask AI"
- AI returns response with confidence score
- Sources are cited

### Test 4: Ticket Lifecycle ✅
- Customer creates (status: open)
- Rep assigns to self
- Rep adds response
- Rep resolves (status: resolved)
- Customer sees resolution

### Test 5: Queue Management ✅
- Rep sees tickets in different lanes:
  - Needs Attention (flagged)
  - Open/Active (all active)
  - Escalated (high priority)
- Rep can filter "Mine Only"
- Auto-refresh works (30 seconds)

---

## 💡 Quick Testing Tips

### Speed Test Setup
```bash
# Create test tickets quickly via script
cd /home/dhanush/Documents/ticketpilot
./create-demo-tickets.sh
```

### Browser Shortcuts
- **Open Incognito:**
  - Chrome/Edge: `Ctrl+Shift+N`
  - Firefox: `Ctrl+Shift+P`
  - Safari: `Cmd+Shift+N`

### Clear Session (Start Fresh)
1. Logout from application
2. Clear browser cookies for localhost
3. Or use fresh incognito window

---

## ✅ Expected Results Checklist

After testing, you should have verified:

- [ ] Customer can create tickets
- [ ] Tickets appear in customer's ticket list
- [ ] Admin can see all tickets in organization
- [ ] Rep can see tickets in queue
- [ ] Rep can use AI assistant
- [ ] AI provides confidence score
- [ ] Rep can assign tickets to self
- [ ] Rep can resolve tickets
- [ ] Customer sees ticket status updates
- [ ] Organization isolation works (different orgs don't see each other)
- [ ] Analytics update when tickets are created/resolved

---

## 🚨 Troubleshooting

### Issue: "No tickets showing up"
**Solution:** Check organization context
1. Look at organization selector in sidebar
2. Verify both users are in same org
3. Try switching organizations

### Issue: "AI button not working"
**Solutions:**
1. Check backend logs for errors
2. Verify GOOGLE_API_KEY in backend/.env
3. Check if KB documents are uploaded
4. Look at browser console for errors

### Issue: "Rep console empty"
**Solutions:**
1. Verify user has 'rep' role
2. Check organization context
3. Create a test ticket first
4. Refresh the page

### Issue: "Can't login"
**Solutions:**
1. Verify Supabase is configured
2. Check frontend .env.local has correct Supabase URL
3. Try resetting password via Supabase dashboard

---

## 📞 Quick Reference

### URLs
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

### Key Pages
- **/tickets** - Customer ticket list
- **/rep** - Rep console queue
- **/admin** - Admin dashboard
- **/admin/analytics** - Analytics charts

### Keyboard Shortcuts (in app)
- **Refresh ticket list:** F5 or Ctrl+R
- **Search tickets:** Start typing in search box

---

## 🎬 Ready to Test!

**Start here:**
1. Open http://localhost:3000 in regular window
2. Login as customer
3. Create a ticket
4. Open http://localhost:3000 in incognito
5. Login as admin/rep
6. See the ticket!

**Good luck with your demo! 🚀**
