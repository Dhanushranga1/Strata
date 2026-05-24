# TicketPilot Demo Setup Guide

## 🎯 Purpose
Create realistic demo tickets to showcase TicketPilot's AI-powered support system during demos and interviews.

---

## 📋 Demo Tickets Overview

I've created **10 realistic demo tickets** covering various scenarios:

### High Priority Issues (3)
1. ✅ **AI Response Not Working - Getting Error 500**
   - Simulates critical AI functionality failure
   - Shows error handling scenario
   - Demonstrates urgent support need

2. ✅ **AI Giving Incorrect Information About Billing**
   - Tests knowledge base accuracy
   - Shows importance of AI training data quality
   - Highlights citation importance

3. ✅ **Need Help with API Integration**
   - Technical developer support scenario
   - Tests AI's ability to handle complex technical queries
   - Shows documentation gaps

### Medium Priority Issues (4)
4. ✅ **Cannot Access Knowledge Base Articles**
   - UI/UX issue scenario
   - Tests system reliability
   - Demonstrates troubleshooting workflow

5. ✅ **Slow Response Time from AI Assistant**
   - Performance monitoring scenario
   - Shows importance of observability
   - Tests system optimization

6. ✅ **AI Not Understanding Multi-Part Questions**
   - AI capability limitation
   - Shows need for prompt engineering
   - Demonstrates feedback loop

7. ✅ **No Citations Shown in AI Responses**
   - Feature implementation verification
   - Tests transparency requirements
   - Shows importance of source attribution

### Low Priority Issues (3)
8. ✅ **Feature Request: Export Chat History with AI**
   - Product enhancement idea
   - Shows customer engagement
   - Demonstrates feedback collection

9. ✅ **Ticket Status Not Updating Correctly**
   - Minor bug report
   - Tests state management
   - Shows edge case handling

10. ✅ **Excellent AI Response - Feature Works Great!**
    - Positive feedback example
    - Demonstrates successful AI implementation
    - Shows customer satisfaction

---

## 🚀 Method 1: Python Script (Recommended)

### Prerequisites
```bash
pip install requests
```

### Setup Steps

1. **Get your authentication token:**
   - Log into TicketPilot frontend (https://ticketpilot.vercel.app)
   - Open Browser DevTools (F12)
   - Go to Application/Storage → Local Storage
   - Copy the JWT token value

2. **Set environment variables:**
   ```bash
   export AUTH_TOKEN="your-jwt-token-here"
   export BACKEND_URL="https://ticketpilot-backend.onrender.com"
   ```

3. **Run the seeder script:**
   ```bash
   python seed_demo_tickets.py
   ```

### Expected Output
```
============================================================
TicketPilot Demo Ticket Seeder
============================================================
Backend URL: https://ticketpilot-backend.onrender.com
Tickets to create: 10
============================================================

[1/10] Creating: AI Response Not Working - Getting Error 500...
    ✅ Created ticket ID: abc123...

[2/10] Creating: Cannot Access Knowledge Base Articles...
    ✅ Created ticket ID: def456...

...

============================================================
Summary:
  ✅ Successfully created: 10
  ❌ Failed: 0
  📊 Total: 10
============================================================

🎉 Demo tickets have been created successfully!
   Visit your TicketPilot dashboard to see them.
```

---

## 🗄️ Method 2: Direct SQL (Alternative)

### Prerequisites
- Access to Supabase SQL Editor or PostgreSQL client
- Your user UUID from `auth.users` table

### Setup Steps

1. **Get your user ID:**
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
   ```

2. **Edit the SQL file:**
   - Open `seed_demo_tickets.sql`
   - Replace all instances of `YOUR_USER_ID_HERE` with your actual user UUID

3. **Run the SQL script:**
   - In Supabase: Go to SQL Editor → New Query → Paste the script → Run
   - In psql: `psql your_database_url -f seed_demo_tickets.sql`

4. **Verify creation:**
   ```sql
   SELECT id, title, status, created_at 
   FROM app.tickets 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

---

## 🎬 Using Tickets in Your Demo

### Demo Flow Suggestions

#### 1. **Customer View Demo (5 min)**
- Show ticket list with various issues
- Open "AI Response Not Working" ticket
- Demonstrate ticket detail view
- Show message history
- Try the AI assistant (if working) or explain the issue

#### 2. **Rep Console Demo (5 min)**
- Switch to Rep role
- Show queue with "needs attention" tickets
- Filter by priority/status
- Assign tickets to yourself
- Demonstrate quick responses
- Show AI-suggested responses modal
- Update ticket status

#### 3. **Admin Dashboard Demo (3 min)**
- Switch to Admin role
- Show ticket statistics
- Display response time metrics
- Show customer satisfaction trends
- Demonstrate user management
- Review system health

#### 4. **AI Features Demo (7 min)**
- Show FAISS semantic search in action
- Demonstrate knowledge base retrieval
- Display citations in AI responses
- Explain RAG (Retrieval-Augmented Generation) pattern
- Show confidence scoring
- Discuss escalation triggers

### Key Talking Points

✅ **Multi-Tenancy**: "Notice how all data is isolated by organization using PostgreSQL RLS"

✅ **Role-Based Access**: "As a customer, I only see my tickets. As a rep, I see all org tickets. As admin, I see everything."

✅ **AI Intelligence**: "The system uses FAISS for semantic search—not just keyword matching, but understanding meaning."

✅ **Citations**: "Every AI response includes sources so users can verify information and learn more."

✅ **Real-time Updates**: "Status changes, assignments, and new messages update across all users in real-time."

✅ **Scalability**: "Built on FastAPI + Next.js with CI/CD automation ensures 99% uptime."

---

## 🐛 Troubleshooting

### Issue: "Auth token expired"
**Solution**: Get a fresh token from the frontend. Tokens typically expire after 1 hour.

### Issue: "Organization context missing"
**Solution**: Make sure you're logged into an organization. Create one if needed via the frontend.

### Issue: "Cannot create ticket - RLS policy violation"
**Solution**: Ensure your user has proper role assignments in the database.

### Issue: "Backend URL not responding"
**Solution**: Check if the Render backend is sleeping. First request may take 30-60 seconds to wake up.

### Issue: "Tickets not showing in frontend"
**Solution**: 
1. Refresh the page
2. Check browser console for errors
3. Verify tickets exist in database
4. Check RLS policies are correct

---

## 📊 Quick Stats for Interview

After running the seeder, you'll have:

- **10 demo tickets** across different categories
- **3 high-priority** issues requiring immediate attention
- **4 medium-priority** issues for workflow demonstration
- **3 low-priority** items including feature requests and positive feedback
- **Diverse scenarios** covering AI, performance, bugs, and features

---

## 🎓 Interview Tips

### When Showing Demo Tickets

1. **Start with context**: "I've seeded realistic support tickets to demonstrate the system..."

2. **Highlight variety**: "Notice we have different priority levels, various issue types, and diverse customer needs..."

3. **Emphasize AI focus**: "Several tickets specifically test the AI assistant—showing both successes and areas for improvement..."

4. **Show problem-solving**: "This ticket about incorrect AI information highlights why citations are critical..."

5. **Discuss scalability**: "In production, this system handles hundreds of tickets with the same multi-tenant architecture..."

### What to Emphasize

✅ **Security**: "Every ticket is isolated by organization using database-level RLS policies"

✅ **AI/ML**: "FAISS semantic search + LLM responses with proper citations"

✅ **Architecture**: "Microservices with FastAPI backend, Next.js frontend, PostgreSQL database"

✅ **DevOps**: "CI/CD via GitHub Actions, deployed on Vercel/Render, ~99% uptime"

✅ **Real-world**: "These scenarios are based on actual customer support patterns"

---

## 📝 Cleanup (After Demo)

To remove demo tickets:

```sql
-- Delete all tickets created in the last hour
DELETE FROM app.tickets 
WHERE created_at > now() - interval '1 hour';

-- Or delete specific tickets by ID
DELETE FROM app.tickets WHERE id IN ('id1', 'id2', ...);
```

Or via Python:
```python
import requests

for ticket_id in ticket_ids:
    requests.delete(f"{BASE_URL}/tickets/{ticket_id}", headers=headers)
```

---

## 🚀 Next Steps

1. ✅ Run the seeder script
2. ✅ Verify tickets appear in frontend
3. ✅ Practice your demo flow
4. ✅ Test AI responses on various tickets
5. ✅ Prepare answers for technical questions
6. ✅ Review the Interview Guide document

---

## 📞 Quick Reference Commands

```bash
# Set auth token
export AUTH_TOKEN="your-jwt-token"

# Run Python seeder
python seed_demo_tickets.py

# Check backend health
curl https://ticketpilot-backend.onrender.com/health

# Wake up sleeping backend
curl https://ticketpilot-backend.onrender.com/

# Run SQL seeder (if using psql)
psql $DATABASE_URL -f seed_demo_tickets.sql
```

---

**Created**: November 21, 2025  
**Last Updated**: November 21, 2025  
**Version**: 1.0
