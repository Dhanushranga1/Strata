# 📋 TicketPilot Deployment Checklist

Use this checklist to track your deployment progress.

---

## ✅ Phase 1: Local Development Setup

### Environment Configuration
- [x] Backend `.env` file created with all variables
- [x] Frontend `.env.local` file created with all variables
- [x] Supabase project created (nvgmgvplfpukckfkjuso)
- [x] Google API key configured
- [ ] **Fix Supabase CORS issue** ⚠️ CURRENT BLOCKER

### Dependencies
- [x] Python 3.11+ installed
- [x] Node.js 18+ installed
- [x] Backend virtual environment created
- [x] Backend dependencies installed
- [x] Frontend node_modules installed

### Services Running
- [ ] Backend running on http://localhost:8000
- [ ] Frontend running on http://localhost:3000
- [ ] Can access API docs at http://localhost:8000/docs
- [ ] Can login/signup on frontend

**Quick Start Command:**
```bash
./quick-start.sh
```

---

## ✅ Phase 2: Fix Supabase CORS (CURRENT ISSUE)

### Option A: Fix in Supabase Dashboard (Recommended)
- [ ] Go to https://supabase.com/dashboard/project/nvgmgvplfpukckfkjuso
- [ ] Navigate to Settings → API
- [ ] Scroll to "CORS Configuration"
- [ ] Add `http://localhost:3000` to allowed origins
- [ ] Save changes
- [ ] Restart frontend: `npm run dev`

### Option B: Use Local Supabase
- [ ] Install Supabase CLI: `npm install -g supabase`
- [ ] Start local Supabase: `supabase start`
- [ ] Update `.env.local` with local URLs
- [ ] Restart frontend

### Option C: Temporary Development Workaround
- [ ] Open Chrome with disabled security:
  ```bash
  google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev" http://localhost:3000
  ```

### Verification
- [ ] No CORS errors in browser console
- [ ] Can login successfully
- [ ] Can create tickets
- [ ] Backend API calls work

---

## ✅ Phase 3: Database Setup

### Migrations
- [ ] Run migrations in Supabase SQL Editor
- [ ] Verify `app.user_roles` table exists
- [ ] Verify `app.documents` table exists
- [ ] Verify `app.chunks` table exists
- [ ] Verify `app.tickets` table exists

### Test Data
- [ ] Create test user account
- [ ] Grant 'rep' role to test user
- [ ] Upload test document to knowledge base
- [ ] Create test ticket
- [ ] Test AI response on ticket

**Test Commands:**
```bash
# Test database connection
psql "postgresql://postgres:1819@db.nvgmgvplfpukckfkjuso.supabase.co:6543/postgres" -c "SELECT version();"

# Check tables
psql "postgresql://postgres:1819@db.nvgmgvplfpukckfkjuso.supabase.co:6543/postgres" -c "\dt app.*"
```

---

## ✅ Phase 4: Production Deployment Setup

### Vercel (Frontend)

#### Account Setup
- [ ] Create Vercel account at https://vercel.com
- [ ] Connect GitHub account
- [ ] Verify team ID: `team_fSwUAUyPDRzgTG0Yxvi1vUWz`

#### Project Configuration
- [ ] Import GitHub repository: `Dhanushranga1/ticketpilot`
- [ ] Set root directory to: `frontend`
- [ ] Configure build settings:
  - Framework: Next.js
  - Build Command: `npm run build`
  - Output Directory: `.next`
  
#### Environment Variables (Vercel)
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Add `NEXT_PUBLIC_API_URL` (Railway URL - add after Railway setup)

#### Deployment
- [ ] Deploy to production
- [ ] Copy Vercel project ID: `__________________`
- [ ] Copy deployment URL: `https://______.vercel.app`
- [ ] Test deployed frontend works

---

### Railway (Backend)

#### Account Setup
- [ ] Create Railway account at https://railway.app
- [ ] Connect GitHub account
- [ ] Project ID confirmed: `b7ec1cd3-1925-4db7-88ca-104b145a6619`

#### Project Configuration
- [ ] Create new project from GitHub repo
- [ ] Set root directory to: `backend`
- [ ] Verify start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

#### Environment Variables (Railway)
- [ ] Add all backend environment variables:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_JWT_SECRET`
  - [ ] `DATABASE_URL`
  - [ ] `GOOGLE_API_KEY`
  - [ ] `CHUNK_SIZE_CHARS`
  - [ ] `CHUNK_OVERLAP_CHARS`
  - [ ] `VECTOR_INDEX_DIR`
  - [ ] `VECTOR_MAP_DIR`
  - [ ] `GENAI_MODEL`
  - [ ] All other AI/RAG configuration variables

#### Deployment
- [ ] Deploy backend to Railway
- [ ] Copy Railway service ID: `__________________`
- [ ] Copy deployment URL: `https://______.railway.app`
- [ ] Test backend health: `curl https://______.railway.app/api/health`

#### CORS Configuration
- [ ] Add Vercel URL to CORS origins in Railway env
- [ ] Redeploy backend
- [ ] Verify no CORS errors from Vercel frontend

---

### Update Cross-References
- [ ] Update Vercel `NEXT_PUBLIC_API_URL` with Railway URL
- [ ] Redeploy Vercel frontend
- [ ] Test end-to-end: Vercel frontend → Railway backend → Supabase

---

## ✅ Phase 5: CI/CD Pipeline

### GitHub Secrets Configuration

Go to: https://github.com/Dhanushranga1/ticketpilot/settings/secrets/actions

#### Vercel Secrets
- [ ] Add `VERCEL_TOKEN` (from Vercel Settings → Tokens)
- [x] Add `VERCEL_ORG_ID` = `team_fSwUAUyPDRzgTG0Yxvi1vUWz`
- [ ] Add `VERCEL_PROJECT_ID` (from Vercel Project Settings)

#### Railway Secrets
- [x] Add `RAILWAY_TOKEN` = `803cad39-3b88-41ad-93d1-e1b276b1d583`
- [x] Add `RAILWAY_PROJECT_ID` = `b7ec1cd3-1925-4db7-88ca-104b145a6619`
- [ ] Add `RAILWAY_SERVICE_ID` (from Railway service settings)
- [ ] Add `RAILWAY_APP_URL` (your Railway deployment URL)

#### Application Secrets
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Add `SUPABASE_URL`
- [ ] Add `SUPABASE_SERVICE_KEY`
- [ ] Add `GOOGLE_API_KEY`
- [ ] Add `NEXT_PUBLIC_API_URL`

#### Optional
- [ ] Add `SNYK_TOKEN` (for security scanning)

### Testing CI/CD
- [ ] Create test branch
- [ ] Make small change and commit
- [ ] Push and create PR
- [ ] Verify CI pipeline runs successfully
- [ ] Check all quality gates pass
- [ ] Merge PR and verify staging deployment

---

## ✅ Phase 6: Production Verification

### Frontend Checks
- [ ] Frontend loads without errors
- [ ] All pages accessible (/, /login, /signup, /tickets, /kb, /rep)
- [ ] Animations working smoothly
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Performance score >85 (Lighthouse)

### Backend Checks
- [ ] Health endpoint works: `/api/health`
- [ ] API docs accessible: `/docs`
- [ ] Authentication endpoints work
- [ ] Ticket CRUD operations work
- [ ] Knowledge base upload works
- [ ] AI chat responses work
- [ ] CORS properly configured

### Integration Checks
- [ ] User registration works
- [ ] User login works
- [ ] JWT tokens valid
- [ ] Database queries work
- [ ] File uploads work
- [ ] AI responses include citations
- [ ] Role-based access control works

### Performance Checks
- [ ] Frontend loads in <3 seconds
- [ ] Backend API responds in <1 second
- [ ] Database queries optimized
- [ ] Vector search performs well
- [ ] No memory leaks

---

## ✅ Phase 7: Monitoring & Maintenance

### Setup Monitoring
- [ ] Enable Vercel Analytics
- [ ] Monitor Railway metrics (CPU, memory)
- [ ] Set up error tracking (Sentry optional)
- [ ] Configure log aggregation
- [ ] Set up uptime monitoring

### Documentation
- [ ] Update README with deployment URLs
- [ ] Document any custom configurations
- [ ] Create runbook for common issues
- [ ] Document environment variables
- [ ] Update API documentation

### Security
- [ ] All secrets properly stored
- [ ] HTTPS enforced
- [ ] Rate limiting configured
- [ ] Input validation in place
- [ ] SQL injection prevention
- [ ] XSS protection enabled

---

## 📊 Current Status Summary

### ✅ Completed
- Local environment configured
- All dependencies installed
- CI/CD workflows created
- Deployment configurations ready
- Supabase project set up
- Google API configured

### ⚠️ In Progress
- **Fix Supabase CORS errors** (blocking local development)
- Deploy to Vercel (waiting for CORS fix)
- Deploy to Railway (waiting for CORS fix)
- Configure GitHub Secrets (waiting for deployment)

### ❌ Not Started
- Production verification
- Monitoring setup
- Performance optimization

---

## 🚀 Next Steps (Recommended Order)

1. **IMMEDIATE**: Fix Supabase CORS issue
   - Option A: Supabase Dashboard → Settings → API → CORS
   - Option B: Use Chrome with security disabled for dev
   - Option C: Use local Supabase

2. **SHORT TERM**: Deploy to production
   - Deploy backend to Railway
   - Deploy frontend to Vercel
   - Configure cross-origin properly

3. **MEDIUM TERM**: Set up CI/CD
   - Add all GitHub secrets
   - Test pipeline with PR
   - Verify automated deployments

4. **LONG TERM**: Production hardening
   - Set up monitoring
   - Configure alerts
   - Performance optimization
   - Security audit

---

## 💡 Quick Commands Reference

```bash
# Start local development
./quick-start.sh

# Stop local development
./stop-local.sh

# Test backend health
curl http://localhost:8000/api/health

# View backend logs
tail -f backend/backend.log

# View frontend logs  
tail -f frontend/frontend.log

# Deploy to production (after CI/CD setup)
git push origin main

# Manual Vercel deploy
cd frontend && vercel --prod

# Manual Railway deploy
cd backend && railway up

# Database connection test
psql "postgresql://postgres:1819@db.nvgmgvplfpukckfkjuso.supabase.co:6543/postgres" -c "SELECT version();"
```

---

## 📞 Troubleshooting Resources

- **Detailed Setup**: See `SETUP_GUIDE.md`
- **Deployment Guide**: See `ULTIMATE_DEPLOYMENT_GUIDE.md`
- **CI/CD Details**: See `CI_CD_DOCUMENTATION.md`
- **Quick Start**: See `QUICK_START.md`

---

**Last Updated**: October 15, 2025  
**Current Blocker**: Supabase CORS configuration  
**Next Action**: Fix CORS, then proceed with production deployment