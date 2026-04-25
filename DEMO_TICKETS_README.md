# 🎫 TicketPilot Demo Tickets - Quick Reference

## What I Created for You

I've prepared **10 realistic demo tickets** and **3 different methods** to create them:

---

## 📦 Files Created

1. **`seed_demo_tickets.py`** - Python script with API integration
2. **`seed_demo_tickets.sql`** - Direct SQL script for database
3. **`create-demo-tickets.sh`** - Interactive shell script (easiest!)
4. **`DEMO_TICKETS_GUIDE.md`** - Complete guide with all details

---

## 🚀 Quick Start (Choose One Method)

### Method 1: Interactive Script (EASIEST) ⭐

```bash
./create-demo-tickets.sh
```

This will:
- Check if Python packages are installed
- Prompt you for AUTH_TOKEN if not set
- Create all 10 demo tickets automatically
- Show progress and results

### Method 2: Python Script (Recommended)

```bash
# Install requirements
pip3 install requests

# Set your auth token (get from browser DevTools after login)
export AUTH_TOKEN="your-jwt-token-here"

# Run the seeder
python3 seed_demo_tickets.py
```

### Method 3: Direct SQL (Alternative)

1. Get your user ID:
   ```sql
   SELECT id FROM auth.users WHERE email = 'your-email@example.com';
   ```

2. Edit `seed_demo_tickets.sql` and replace `YOUR_USER_ID_HERE` with your UUID

3. Run in Supabase SQL Editor or:
   ```bash
   psql $DATABASE_URL -f seed_demo_tickets.sql
   ```

---

## 🎯 The 10 Demo Tickets

### High Priority (3 tickets)
1. **AI Response Not Working - Getting Error 500** ⚠️
2. **AI Giving Incorrect Information About Billing** 💰
3. **Need Help with API Integration** 🔧

### Medium Priority (4 tickets)
4. **Cannot Access Knowledge Base Articles** 📚
5. **Slow Response Time from AI Assistant** 🐌
6. **AI Not Understanding Multi-Part Questions** ❓
7. **No Citations Shown in AI Responses** 📖

### Low Priority (3 tickets)
8. **Feature Request: Export Chat History with AI** 💡
9. **Ticket Status Not Updating Correctly** 🔄
10. **Excellent AI Response - Feature Works Great!** ⭐

---

## 🎬 For Your Demo

### These tickets showcase:

✅ **AI functionality** - Working and not working scenarios  
✅ **System issues** - Performance, bugs, errors  
✅ **Feature requests** - Customer engagement  
✅ **Positive feedback** - Successful implementations  
✅ **Technical support** - Developer/API questions  
✅ **Various priorities** - Realistic ticket distribution

### Demo Flow:
1. Show the ticket list (customer view)
2. Open a high-priority ticket about AI issues
3. Switch to Rep console - show queue management
4. Demonstrate AI assistant on a ticket
5. Show Admin dashboard with statistics
6. Discuss architecture and technologies

---

## 🔑 Getting Your AUTH_TOKEN

### Option 1: Browser DevTools
1. Go to https://ticketpilot.vercel.app
2. Log in to your account
3. Press F12 (open DevTools)
4. Go to **Application** tab → **Local Storage**
5. Find and copy the JWT token value

### Option 2: Network Tab
1. Log in to TicketPilot
2. Open DevTools → **Network** tab
3. Make any API call (create/view ticket)
4. Check request headers for `Authorization: Bearer <token>`

---

## 🎤 Interview Talking Points

When presenting these tickets:

1. **Multi-tenant architecture**: "Notice how each org's data is completely isolated using PostgreSQL RLS"

2. **AI integration**: "These tickets test the FAISS semantic search and LLM response generation"

3. **Real-world scenarios**: "From critical errors to feature requests—covering actual support workflows"

4. **Role-based access**: "Different views for Customer, Rep, and Admin roles with database-level security"

5. **CI/CD automation**: "Deployed via GitHub Actions to Vercel and Render with 99% uptime"

---

## 🐛 Troubleshooting

### "Auth token expired"
→ Get a fresh token (they expire after ~1 hour)

### "Backend not responding"
→ Wait 30-60 seconds - Render backend may be sleeping on first request

### "Organization context missing"
→ Make sure you're logged into an organization via the frontend

### "RLS policy violation"
→ Check your user has proper role assignments in the database

---

## 📊 After Creating Tickets

You'll be able to demonstrate:

- ✅ Ticket list with filtering and pagination
- ✅ Individual ticket details with message history
- ✅ AI assistant functionality (query → semantic search → LLM response)
- ✅ Rep queue management (assign, status changes, escalation)
- ✅ Admin dashboard (metrics, user management, system health)
- ✅ Multi-tenant isolation (switch between organizations)
- ✅ Role-based access control (Customer, Rep, Admin views)

---

## 🧹 Cleanup (After Demo)

```sql
-- Delete demo tickets
DELETE FROM app.tickets 
WHERE created_at > now() - interval '1 hour';
```

Or keep them for future demos!

---

## 📚 More Information

See **`DEMO_TICKETS_GUIDE.md`** for:
- Detailed demo flow suggestions
- Complete troubleshooting guide
- Interview preparation tips
- Technical talking points
- Architecture explanations

---

## ⚡ TL;DR - Do This Now

```bash
# 1. Run the interactive script
./create-demo-tickets.sh

# 2. When prompted, paste your AUTH_TOKEN from browser DevTools

# 3. Visit https://ticketpilot.vercel.app to see your demo tickets

# 4. Practice your demo!
```

---

**Need help?** Check `DEMO_TICKETS_GUIDE.md` for complete documentation.

**Last Updated**: November 21, 2025
