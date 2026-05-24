# 05 - Pilot Deployment & Operations Guide

**Document Version:** 1.0
**Last Updated:** March 6, 2026
**Audience:** Company admins, IT leads, and support team managers running TicketPilot for the first time

---

## Before You Start — What This Guide Covers

This guide walks your team through:

1. Deploying TicketPilot to production (one-time setup)
2. First-run configuration after deployment
3. Daily operations — what your team does every day
4. Understanding the AI confidence score
5. Maintaining the knowledge base
6. Troubleshooting the 10 most common issues

No prior experience with FastAPI, Next.js, or PostgreSQL is required to follow this guide. Where technical steps are needed, exact commands are given.

---

## Part 1 — What You Need Before Deploying

### Required Accounts (All Free Tiers Available)

| Service | What It's For | Where to Sign Up |
|---------|---------------|-----------------|
| **Supabase** | Database + user authentication | supabase.com |
| **Google AI Studio** | AI responses + knowledge base search | aistudio.google.com |
| **Render.com** | Hosting the backend API | render.com |
| **Vercel** | Hosting the frontend (user interface) | vercel.com |
| **GitHub** | Storing the codebase | github.com |

### What You Will Collect During Setup

Before starting, open a text file and save these values as you collect them:

```
SUPABASE_URL          = https://xxxx.supabase.co
SUPABASE_ANON_KEY     = eyJhbGci...  (starts with eyJ)
SUPABASE_JWT_SECRET   = your-jwt-signing-secret
DATABASE_URL          = postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres
GOOGLE_API_KEY        = AIza...
```

---

## Part 2 — One-Time Deployment Steps

### Step 1 — Set Up Supabase

1. Go to **supabase.com** and create a new project
2. Choose a strong database password and save it — you will need it for `DATABASE_URL`
3. After the project is ready, go to **Settings → API**:
   - Copy **Project URL** → this is `SUPABASE_URL`
   - Copy **anon / public key** → this is `SUPABASE_ANON_KEY`
   - Copy **JWT Secret** (under "JWT Settings") → this is `SUPABASE_JWT_SECRET`
4. Go to **Settings → Database → Connection string → URI** — copy the URI and replace `[YOUR-PASSWORD]` with your database password → this is `DATABASE_URL`

### Step 2 — Run Database Migrations

Migrations create all the tables the application needs. Run them in order from your local machine (requires `psql` installed):

```bash
git clone https://github.com/your-org/ticketpilot.git
cd ticketpilot

psql "$DATABASE_URL" -f backend/migrations/0001_user_roles.sql
psql "$DATABASE_URL" -f backend/migrations/0002_kb.sql
psql "$DATABASE_URL" -f backend/migrations/0003_tickets_core.sql
psql "$DATABASE_URL" -f backend/migrations/0004_ai_chat.sql
psql "$DATABASE_URL" -f backend/migrations/0005_rep_console.sql
psql "$DATABASE_URL" -f backend/migrations/0005a_admin_roles.sql
psql "$DATABASE_URL" -f backend/migrations/0006_ai_feedback.sql
psql "$DATABASE_URL" -f backend/migrations/0007_organizations.sql
psql "$DATABASE_URL" -f backend/migrations/0008_add_organization_id.sql
psql "$DATABASE_URL" -f backend/migrations/0009_migrate_existing_data.sql
psql "$DATABASE_URL" -f backend/migrations/0010_enable_rls.sql
```

Each command should complete without errors. If any fails, stop and check the error before continuing.

### Step 3 — Get a Google AI API Key

1. Go to **aistudio.google.com**
2. Click **Get API Key** → Create API key in a new project
3. Copy the key → this is `GOOGLE_API_KEY`

### Step 4 — Deploy the Backend to Render

1. Go to **render.com** → New → Web Service
2. Connect your GitHub repository
3. Set the following:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Under **Environment Variables**, add all of these:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Supabase connection string |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_JWT_SECRET` | Your Supabase JWT secret |
| `GOOGLE_API_KEY` | Your Google AI key |
| `WEB_ORIGIN` | Your Vercel frontend URL (fill after Step 5) |
| `ENVIRONMENT` | `production` |
| `LOG_LEVEL` | `INFO` |

5. Click **Deploy**. The first deploy takes 3–5 minutes.
6. Copy the URL Render gives you (e.g. `https://ticketpilot-api.onrender.com`) — this is your `NEXT_PUBLIC_API_URL`

### Step 5 — Deploy the Frontend to Vercel

1. Go to **vercel.com** → New Project → Import your GitHub repository
2. Set **Root Directory** to `frontend`
3. Under **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_API_URL` | Your Render backend URL |

4. Click **Deploy**. Vercel will give you a URL like `https://ticketpilot.vercel.app`
5. Go back to Render and update `WEB_ORIGIN` to this Vercel URL, then redeploy

### Step 6 — Verify Deployment

Open your browser and visit `https://your-render-url.onrender.com/api/health`

You should see:
```json
{"ok": true, "api": "ticketpilot", "version": "0.1.0"}
```

If you see this, the backend is running. Then open your Vercel URL and you should see the TicketPilot login page.

---

## Part 3 — Critical First-Run Setup

> **Read this section before inviting anyone to use the system.**

### 3.1 — The Knowledge Base Must Be Built After Every Deployment

**This is the most important operational fact about TicketPilot.**

The AI assistant works by searching your uploaded documents (the "Knowledge Base") to find answers. These documents are stored on the server's local disk, not in the database. When Render or Railway deploys a new version of the app, the disk is wiped clean and **all previously uploaded documents are gone from the AI's memory**.

The database still knows *which* documents were uploaded (title, date, etc.) but the AI cannot search them anymore.

**What this means for you:**
- After every deployment or server restart, re-upload your KB documents
- You will know the KB is empty if the AI responds with low confidence scores (below 50%) on questions it used to answer well
- The backend logs will show this warning on startup: `FAISS data directory does not exist — no KB indices loaded`

**How to re-upload documents:** See Part 4, Section 4.2.

### 3.2 — Create Your First Admin Account

1. Open your Vercel URL and click **Sign Up**
2. Use the email address that will be your admin account
3. Check your inbox for a verification email from Supabase and click the link
4. Log in — you will be taken to the dashboard with a new organization automatically created

At this point, your account has the role of `customer` in the database. To make yourself an admin, run this SQL in the Supabase SQL editor (**Dashboard → SQL Editor**):

```sql
UPDATE app.user_roles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your-email@company.com'
);
```

Replace `your-email@company.com` with your actual email. Log out and log back in. You now have admin access.

### 3.3 — Invite Your Team

**To add a support rep:**
1. Go to the **Organizations** page in TicketPilot
2. Click **Add Member** and enter their email
3. Set their role to **Rep**

The invited user must sign up using that same email address. Once they do, they will appear in your organization with the rep role.

**Roles explained:**

| Role | What They Can Do |
|------|-----------------|
| **Owner** | Everything — manages organization settings and members |
| **Admin** | Upload/delete KB documents, view analytics, manage members |
| **Rep** | Handle tickets, use AI assistant, see the full queue |
| **Customer** | Create tickets, view their own tickets only |

---

## Part 4 — Daily Operations

### 4.1 — What Reps Do Every Day

**Starting the day:**
1. Log in and open the **Rep Console** (`/rep`)
2. Check the **Needs Attention** tab first — these are escalated tickets requiring immediate response
3. Work through the **Open** tab next

**Handling a ticket:**
1. Click a ticket to open it
2. Read the customer's message
3. Click **AI Assist** if you need help formulating a response — the AI will search your knowledge base and suggest an answer
4. Review the AI's response and confidence score (see Part 5)
5. If the answer looks good, click **Insert** to put it in the reply box, then edit if needed
6. Click **Send** to reply to the customer
7. Update the ticket status appropriately:
   - **In Progress** — you're working on it
   - **Resolved** — you've answered and expect no further questions
   - **Closed** — the issue is fully done

**When to escalate:**
- The AI confidence score is below 50% and you also don't know the answer
- The customer is reporting a billing or legal issue
- You've gone back and forth more than 3 times without resolution

Click **Escalate** on the ticket. It will move to the **Needs Attention** queue so a senior rep or admin can take over.

### 4.2 — What Admins Do (Knowledge Base Management)

The AI is only as good as the documents you upload. Keep the knowledge base current.

**Uploading a document:**
1. Go to **Knowledge Base** (`/kb`)
2. Click **Upload Document**
3. Drag or select your file (PDF, Word `.docx`, plain `.txt`, or Markdown `.md`)
4. Wait for the progress bar — processing takes 10–30 seconds depending on file size
5. The document appears in the list when done

**What to upload:**
- Product documentation and FAQs
- Company policy documents
- Return / refund / warranty policies
- Pricing and plan details
- Technical specifications
- Previous high-quality support responses (as a FAQ document)

**What NOT to upload:**
- Documents with personal customer data (names, emails, payment info)
- Internal HR or salary information
- Draft or outdated documents (the AI treats all uploaded docs as authoritative)

**Removing outdated documents:**
1. Go to **Knowledge Base** (`/kb`)
2. Find the document and click **Delete**
3. Confirm the deletion — this is permanent

**After re-uploading documents (post-deployment):**
- After any deployment or server restart, re-upload your most important documents
- The AI needs at least 3–5 substantial documents before it can give confident answers
- Test the AI by clicking **AI Assist** on any ticket and asking a question you know the answer to

### 4.3 — What Admins Do (Analytics)

Go to **Dashboard** (`/dashboard`) to see:

- **Ticket volume** — how many tickets opened today vs last week
- **Resolution time** — average time from open to resolved
- **Rep performance** — which reps are handling the most tickets
- **AI confidence trends** — whether the AI's answers are improving
- **Low-confidence queries** — questions the AI struggled with (use these to identify gaps in your KB)

**Weekly review (15 minutes):**
1. Check low-confidence AI queries — what topics is the AI failing on?
2. If you see recurring failures on a topic, upload a document that covers that topic
3. Check unresolved tickets older than 48 hours and assign them to a rep

---

## Part 5 — Understanding the AI Confidence Score

Every AI response shows a confidence score from 0–100%. This tells your team how much to trust the AI's answer before sending it to a customer.

### What the Score Means

| Score | What It Means | Recommended Action |
|-------|---------------|-------------------|
| **80–100%** | The AI found strong, relevant information in your KB | Review and send — likely accurate |
| **60–79%** | The AI found partial information | Review carefully, edit if needed |
| **40–59%** | The AI is uncertain — partial or weak KB match | Use only as a starting point, verify before sending |
| **Below 40%** | The AI could not find relevant information | Do not use — write your own response |

### How the Score is Calculated

The AI score is computed from 7 factors:

1. **Retrieval Quality (30%)** — how closely the KB chunks matched the question
2. **Citation Coverage (20%)** — whether the response cited its sources
3. **Semantic Coherence (20%)** — whether the response actually addressed the question asked
4. **Response Completeness (10%)** — whether the response was substantial, not vague
5. **Information Density (10%)** — how much of the context was actually used
6. **Source Diversity (10%)** — whether the answer drew from multiple documents (not just one)
7. **Uncertainty Penalty** — reduces the score if the AI used phrases like "I'm not sure" or "contact support"

### Why Confidence May Be Low

| Cause | Fix |
|-------|-----|
| No documents in KB | Upload relevant documents |
| Documents are in wrong format or have bad text extraction | Re-upload as plain text or well-formatted PDF |
| Question is about a topic not covered in any document | Upload a document that covers that topic |
| Question contains names/emails (PII) that disrupted the query | Rephrase the question without PII |
| Knowledge base was wiped after deployment | Re-upload documents (see Part 3.1) |

### The Escalation Trigger

The AI will suggest escalating a ticket to human review when:
- Confidence is below 55%, AND
- One or more other signals are present (fewer than 2 KB chunks matched, AI expressed uncertainty, conversation is long)

This is a suggestion — the rep still decides. Do not auto-close or auto-escalate based on the AI score alone.

---

## Part 6 — Troubleshooting Common Issues

### Issue 1 — "AI gives vague or unhelpful answers on everything"

**Cause:** The knowledge base is empty. This happens after a fresh deployment.

**Fix:** Upload your documents in **Knowledge Base** (`/kb`). The AI needs at least 3–5 documents before giving confident answers. After uploading, test immediately with a question you know the answer to.

---

### Issue 2 — "I uploaded documents but the AI still says it doesn't know"

**Cause:** Either the document text could not be extracted, or the document does not cover the topic being asked.

**Fix:**
1. Go to **Knowledge Base** → check the chunk count on the document (should be > 0)
2. If chunk count is 0, the file may be a scanned PDF (image-based). Re-create it as a text PDF or paste the content as a `.txt` file
3. If chunk count looks fine, the topic genuinely isn't in the document — add a new document that covers it

---

### Issue 3 — "A user signed up but can't see any tickets or gets access errors"

**Cause:** The user's role in the database is `customer` by default. They may need to be `rep` or `admin`.

**Fix:**
1. Go to **Organizations** → find the user → change their role to Rep or Admin
2. Ask the user to log out and log back in — roles are cached for 60 seconds

---

### Issue 4 — "A user forgot their password and can't log in"

**Cause:** Password reset is not yet implemented as a self-service flow.

**Temporary fix (admin action):**
1. Go to your **Supabase dashboard** → Authentication → Users
2. Find the user by email
3. Click **Send password recovery email** — Supabase will email them a reset link directly

This is a known limitation. A self-service "Forgot Password" link is planned for the next version.

---

### Issue 5 — "Login gives a 'Token verification failed' or 500 error"

**Cause:** The `SUPABASE_JWT_SECRET` environment variable on Render does not match the JWT secret in your Supabase project.

**Fix:**
1. Go to Supabase → **Settings → API → JWT Settings** → copy the **JWT Secret**
2. Go to Render → your backend service → **Environment Variables**
3. Update `SUPABASE_JWT_SECRET` with the exact value from Supabase
4. Trigger a manual redeploy on Render

---

### Issue 6 — "Tickets are visible to the wrong organization"

**Cause:** The `X-Organization-ID` header is missing from a request, or the organization context was not properly set before the query. This should not happen in normal use.

**Fix:**
1. Have the user log out and log back in
2. Confirm they have selected the correct organization in the top-left organization selector
3. If the problem persists, check Render logs for `organization context` errors

---

### Issue 7 — "The backend is slow — AI responses take more than 5 seconds"

**Cause:** The AI pipeline makes multiple calls to Google's API. Each call takes 50–500ms. Under the free tier Google rate limits, queries can queue.

**Fix (short term):** Upgrade the Google AI API to a paid tier — this raises rate limits from 15 requests/minute to 1500 requests/minute, eliminating queuing.

**Fix (long term):** This is a known architectural item — the AI pipeline is being optimized to reduce the number of Google API calls per query.

---

### Issue 8 — "A document shows in the list but the AI ignores it after a redeploy"

**Cause:** This is the FAISS persistence issue described in Part 3.1. The document metadata is in the database but the search index was wiped.

**Fix:** Delete and re-upload the document. The database record and the search index will both be rebuilt.

---

### Issue 9 — "Render logs show 'FAISS data directory does not exist'"

**Cause:** This is expected on a fresh deployment. It's a warning, not an error. It means the KB is empty.

**Fix:** Upload your KB documents via the Knowledge Base page. The warning will not appear on the next startup once documents have been indexed.

---

### Issue 10 — "A rep has admin role in the org but sees 'access denied' on admin pages"

**Cause:** There are two separate role systems. The **organization role** (owner/admin/rep/member) controls what you see in the UI. The **global role** (admin/rep/customer in the `user_roles` table) is what the API checks for backend access. A user can be marked as `admin` in their organization but still have a global role of `customer`, which causes API-level 403 errors.

**Fix:** Run this in the Supabase SQL editor:
```sql
UPDATE app.user_roles
SET role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'user@company.com'
);
```

Replace the email address. The user must log out and back in after this change.

---

## Part 7 — RAG System Health Checks

Run these checks after any deployment to confirm the AI is working.

### Check 1 — Backend Startup Log

Open **Render → your service → Logs** immediately after a deploy. Look for one of these lines:

```
# Good — documents are indexed
INFO  FAISS: found indices for 1 organisation(s): ['org-uuid-here']

# Warning — KB is empty, action required
WARNING  FAISS data directory './data/faiss' does not exist — no KB indices loaded.
         AI responses will have low confidence until documents are re-uploaded.
```

If you see the warning, upload documents before going live.

### Check 2 — AI Response Test

1. Log in as a rep
2. Open any ticket (or create a test ticket)
3. Click **AI Assist** and type a question that your KB documents cover
4. The confidence score should be above 60%

If confidence is below 40% on a question clearly covered in your documents, the KB did not load correctly. Delete and re-upload the relevant document.

### Check 3 — API Health Endpoint

Visit `https://your-render-url.onrender.com/api/health`

Expected:
```json
{"ok": true, "api": "ticketpilot", "version": "0.1.0"}
```

If this returns an error, the backend is down. Check Render logs for startup errors.

---

## Part 8 — Known Limitations for the Pilot

These are features that are not yet built. Your team should know about them before launch so they are not surprised.

| Limitation | Impact | Workaround |
|-----------|--------|------------|
| No file attachments on tickets | Customers cannot upload screenshots or documents | Ask customers to share files via a link (Google Drive, Dropbox) |
| No password reset (self-service) | Users who forget passwords must contact an admin | Admin resets via Supabase dashboard (see Issue 4) |
| No real-time updates | New messages do not appear automatically — must refresh the page | Refresh the browser to see new messages |
| No email notifications | Users are not notified of replies via email | Users must check the app directly |
| KB documents lost after each deployment | AI must be re-trained after every deploy | Re-upload documents after deployments |
| No multi-factor authentication | Accounts protected by password only | Use strong passwords; MFA planned for v1.1 |
| AI has no conversation memory | Each AI query is independent — the AI does not remember previous questions in the same ticket | Provide full context in each AI query |
| Sessions expire after 1 hour | Users are logged out automatically; unsaved work may be lost | Save responses before the hour mark; refresh the page to log back in |

---

## Part 9 — Maintenance Schedule

### After Every Deployment
- [ ] Check Render logs for the FAISS startup message
- [ ] Re-upload KB documents if the warning is present
- [ ] Test AI assist with 2–3 known questions
- [ ] Confirm login works for at least one rep account

### Daily (5 minutes)
- [ ] Check the **Needs Attention** queue — escalated tickets should not sit more than a few hours
- [ ] Check Render logs for any `ERROR` level entries

### Weekly (15 minutes)
- [ ] Open **Admin Dashboard** → review AI confidence trends
- [ ] Review low-confidence AI queries — identify missing KB topics
- [ ] Upload new documents for any topics the AI consistently fails on
- [ ] Check unresolved tickets older than 48 hours

### Monthly (30 minutes)
- [ ] Review all KB documents — delete outdated ones
- [ ] Check for any users who should have their role updated
- [ ] Review analytics for ticket volume trends
- [ ] Test password recovery flow via Supabase dashboard
- [ ] Check Render and Vercel for any available updates

---

## Part 10 — Contacts and Escalation

| Issue Type | Contact |
|-----------|---------|
| Can't log in / access denied | Your organization admin |
| Wrong AI answers on important topics | Upload corrected documents to KB |
| System is down (health endpoint fails) | Check Render service status page; restart the service |
| Data appears in wrong organization | Log out, log back in; if persists, contact technical support |
| Security concern (unexpected access, data leak) | Immediately contact the system maintainer; disable the affected account in Supabase |

**Technical maintainer:** Dhanush Ranga Gopisetty
**API documentation (Swagger):** `https://your-render-url.onrender.com/docs`

---

## Appendix — Environment Variables Reference

### Backend (Render environment variables)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_JWT_SECRET` | Yes | JWT signing secret from Supabase settings |
| `GOOGLE_API_KEY` | Yes | Google AI Studio API key |
| `WEB_ORIGIN` | Yes | Your Vercel frontend URL (for CORS) |
| `ENVIRONMENT` | Recommended | Set to `production` |
| `LOG_LEVEL` | Optional | `INFO` (default) or `DEBUG` for verbose logs |
| `VECTOR_INDEX_DIR` | Optional | Path to FAISS index storage (default: `./data/faiss`) |
| `RAG_TOP_K` | Optional | Number of KB chunks retrieved per query (default: 6) |
| `RAG_MIN_SCORE` | Optional | Minimum similarity threshold for chunks (default: 0.25) |
| `CHUNK_SIZE_CHARS` | Optional | Document chunk size in characters (default: 2400) |
| `CHUNK_OVERLAP_CHARS` | Optional | Overlap between chunks (default: 400) |

### Frontend (Vercel environment variables)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `NEXT_PUBLIC_API_URL` | Yes | Your Render backend URL |

---

*This document covers everything needed to deploy, operate, and maintain TicketPilot during its pilot phase. Keep it updated as the system evolves.*
