# 🚀 TicketPilot Complete Deployment Guide
**The Ultimate Step-by-Step Guide for Production Deployment**

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
4. [Production Deployment](#production-deployment)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Troubleshooting](#troubleshooting)
7. [Post-Deployment](#post-deployment)

---

## 🎯 Project Overview

**TicketPilot** is an AI-powered customer support ticket management system with:
- **Frontend**: Next.js 15 + React 19 + Framer Motion + HeroUI
- **Backend**: FastAPI (Python) + Google Gemini AI + FAISS Vector Store
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Authentication
- **AI Features**: RAG (Retrieval-Augmented Generation) for intelligent ticket responses

### Current Configuration Status:
✅ **Supabase Project**: `nvgmgvplfpukckfkjuso.supabase.co`  
✅ **Environment Files**: Configured  
✅ **CI/CD Pipeline**: GitHub Actions ready  
✅ **Deployment Configs**: Vercel + Railway configured  

---

## 🔧 Prerequisites

### Required Accounts & Services:
- ✅ **GitHub Account** (already set up: Dhanushranga1/ticketpilot)
- ✅ **Supabase Account** (project already created)
- ✅ **Google Cloud Account** (API key configured)
- 🔲 **Vercel Account** (need to connect)
- 🔲 **Railway Account** (need to connect)

### Required Tools:
- Node.js 18+ (for frontend)
- Python 3.11+ (for backend)
- Git
- npm or pnpm

---

## 💻 Local Development Setup

### Step 1: Environment Verification

Your environment files are already configured! Let's verify them:

**Frontend (.env.local):**
```bash
cd /home/dhanush/Documents/ticketpilot/frontend
cat .env.local
```
Should contain:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `NEXT_PUBLIC_API_URL`

**Backend (.env):**
```bash
cd /home/dhanush/Documents/ticketpilot/backend
cat .env
```
Should contain:
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_JWT_SECRET`
- ✅ `DATABASE_URL` (Connection Pooler: port 6543)
- ✅ `GOOGLE_API_KEY`

### Step 2: Start Backend Server

```bash
cd /home/dhanush/Documents/ticketpilot/backend

# Activate virtual environment
source .venv/bin/activate

# Install/update dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Backend will be available at:** http://localhost:8000  
**API docs:** http://localhost:8000/docs

### Step 3: Start Frontend Server

```bash
cd /home/dhanush/Documents/ticketpilot/frontend

# Install dependencies (if needed)
npm install

# Start Next.js development server
npm run dev
```

**Frontend will be available at:** http://localhost:3000

### Step 4: Fix Supabase CORS Issue (Current Problem)

The CORS errors you're seeing are because Supabase is blocking requests. Here's how to fix it:

**Option 1: Disable Browser Security (Development Only)**
```bash
# Linux
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev" http://localhost:3000

# Or use Firefox with CORS disabled extension
```

**Option 2: Use Supabase Local Development**
```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Update .env.local with local URLs
```

**Option 3: Check Supabase Network Settings** (Recommended)
1. Go to https://supabase.com/dashboard/project/nvgmgvplfpukckfkjuso
2. Settings → API → CORS Configuration
3. Add `http://localhost:3000` to allowed origins
4. Restart your frontend

### Step 5: Verify Local Setup

```bash
# Test backend health
curl http://localhost:8000/api/health

# Test frontend
curl http://localhost:3000

# Check if both are running
lsof -i :8000  # Backend
lsof -i :3000  # Frontend
```

---

## 🌐 Production Deployment

### Option A: Vercel (Frontend) + Railway (Backend)

This is the **recommended** approach for production deployment.

#### Step 1: Deploy Frontend to Vercel

**Method 1: Vercel Dashboard (Easiest)**

1. **Login to Vercel**: https://vercel.com/login
   - Use GitHub account for seamless integration

2. **Import Project**:
   - Go to https://vercel.com/new
   - Click "Import Git Repository"
   - Select `Dhanushranga1/ticketpilot`
   - Click "Import"

3. **Configure Build Settings**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

4. **Add Environment Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://nvgmgvplfpukckfkjuso.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52Z21ndnBsZnB1a2NrZmtqdXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MDAwODEsImV4cCI6MjA3Mzk3NjA4MX0.rNpPIyKQwAm2OB2JFM7Ol3r_vp6eenxd-eTfAeZq6uA
   NEXT_PUBLIC_API_URL=[YOUR_RAILWAY_BACKEND_URL]
   ```
   ⚠️ **Note**: You'll get the Railway backend URL in the next step

5. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes for build to complete
   - Copy the deployment URL (e.g., `https://ticketpilot-xxx.vercel.app`)

**Method 2: Vercel CLI**

```bash
cd /home/dhanush/Documents/ticketpilot/frontend

# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Follow prompts to configure
```

#### Step 2: Deploy Backend to Railway

**Method 1: Railway Dashboard (Easiest)**

1. **Login to Railway**: https://railway.app/login
   - Use GitHub account

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `Dhanushranga1/ticketpilot`
   - Click "Deploy"

3. **Configure Service**:
   - **Root Directory**: `backend`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Railway will auto-detect Python and use the `railway.toml` config

4. **Add Environment Variables**:
   Go to your service → Variables → Raw Editor and paste:
   ```
   SUPABASE_URL=https://nvgmgvplfpukckfkjuso.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52Z21ndnBsZnB1a2NrZmtqdXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MDAwODEsImV4cCI6MjA3Mzk3NjA4MX0.rNpPIyKQwAm2OB2JFM7Ol3r_vp6eenxd-eTfAeZq6uA
   SUPABASE_JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52Z21ndnBsZnB1a2NrZmtqdXNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODQwMDA4MSwiZXhwIjoyMDczOTc2MDgxfQ.YuYAznR8K9NI_i7M0Bg08Mpkv9y24VEIzTQfs5GGt3c
   DATABASE_URL=postgresql://postgres:1819@db.nvgmgvplfpukckfkjuso.supabase.co:6543/postgres
   GOOGLE_API_KEY=AIzaSyBp3I2xu2kv0eRq1z5EAvzsjS5xSDFbHz8
   CHUNK_SIZE_CHARS=2400
   CHUNK_OVERLAP_CHARS=400
   VECTOR_INDEX_DIR=./data/faiss
   VECTOR_MAP_DIR=./data/maps
   GENAI_MODEL=gemini-1.5-pro
   GENAI_TEMPERATURE=0.2
   GENAI_MAX_OUTPUT_TOKENS=1024
   RAG_TOP_K=6
   RAG_MIN_SCORE=0.25
   ```

5. **Get Deployment URL**:
   - Click on your service
   - Go to "Settings" → "Domains"
   - Copy the Railway-provided URL (e.g., `https://ticketpilot-production.up.railway.app`)

6. **Update Vercel Frontend**:
   - Go back to Vercel dashboard
   - Project Settings → Environment Variables
   - Update `NEXT_PUBLIC_API_URL` with your Railway URL
   - Redeploy frontend

**Method 2: Railway CLI**

```bash
cd /home/dhanush/Documents/ticketpilot/backend

# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to project (or create new)
railway link

# Deploy
railway up
```

#### Step 3: Update CORS in Backend

After deployment, you need to allow your Vercel domain in the backend CORS settings:

1. **Update Railway Environment Variables**:
   Add this variable:
   ```
   FRONTEND_URL=https://your-vercel-url.vercel.app
   ```

2. **Or update in code** (backend/app/main.py):
   ```python
   origins = [
       "http://localhost:3000",
       "https://your-vercel-url.vercel.app",
   ]
   ```

3. **Redeploy Railway backend**

---

### Option B: Deploy Both to Render (Alternative)

If you prefer a single platform:

1. **Create Render Account**: https://render.com/login

2. **Deploy Backend**:
   - New → Web Service
   - Connect GitHub repo
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Add all environment variables

3. **Deploy Frontend**:
   - New → Static Site
   - Connect GitHub repo
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Publish Directory: `.next`
   - Add environment variables

---

## 🔄 CI/CD Pipeline Setup

You already have GitHub Actions workflows configured! Let's activate them:

### Step 1: Add GitHub Secrets

Go to: https://github.com/Dhanushranga1/ticketpilot/settings/secrets/actions

Add these secrets (based on your deployment):

#### For Vercel + Railway:
```
# Vercel
VERCEL_TOKEN=<from_vercel_settings>
VERCEL_ORG_ID=team_fSwUAUyPDRzgTG0Yxvi1vUWz
VERCEL_PROJECT_ID=<from_vercel_project_settings>

# Railway
RAILWAY_TOKEN=803cad39-3b88-41ad-93d1-e1b276b1d583
RAILWAY_PROJECT_ID=b7ec1cd3-1925-4db7-88ca-104b145a6619
RAILWAY_SERVICE_ID=<from_railway_service_settings>
RAILWAY_APP_URL=<your_railway_url>

# Application
NEXT_PUBLIC_SUPABASE_URL=https://nvgmgvplfpukckfkjuso.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52Z21ndnBsZnB1a2NrZmtqdXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MDAwODEsImV4cCI6MjA3Mzk3NjA4MX0.rNpPIyKQwAm2OB2JFM7Ol3r_vp6eenxd-eTfAeZq6uA
SUPABASE_URL=https://nvgmgvplfpukckfkjuso.supabase.co
SUPABASE_SERVICE_KEY=<your_service_role_key>
GOOGLE_API_KEY=AIzaSyBp3I2xu2kv0eRq1z5EAvzsjS5xSDFbHz8
NEXT_PUBLIC_API_URL=<your_railway_url>
```

### Step 2: Test CI/CD Pipeline

```bash
# Create a test branch
git checkout -b test-deployment

# Make a small change
echo "# Deployment test" >> README.md

# Commit and push
git add .
git commit -m "test: trigger CI/CD pipeline"
git push origin test-deployment

# Create PR on GitHub - this will trigger the CI pipeline
```

### Step 3: Monitor Pipeline

- Go to https://github.com/Dhanushranga1/ticketpilot/actions
- Watch the workflows run:
  - ✅ Development CI (quality checks)
  - ✅ Staging Deployment (auto-deploy to staging)
  - ✅ Security Scan (weekly security audits)

---

## 🔧 Troubleshooting

### Issue: Supabase CORS Errors (Current Problem)

**Symptoms:**
```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource
```

**Solutions:**

1. **Check Supabase Dashboard**:
   - Go to https://supabase.com/dashboard/project/nvgmgvplfpukckfkjuso
   - Settings → API → Allowed Origins
   - Ensure `http://localhost:3000` is listed

2. **Network/Firewall Issue**:
   ```bash
   # Test Supabase connectivity
   curl -I https://nvgmgvplfpukckfkjuso.supabase.co/auth/v1/health
   
   # If this fails, check:
   - VPN/Proxy settings
   - Firewall rules
   - DNS resolution
   ```

3. **Browser Cache**:
   ```bash
   # Clear browser cache and cookies
   # Or test in incognito mode
   ```

4. **Use Connection Pooler** (Already configured):
   Your `DATABASE_URL` correctly uses port 6543 (connection pooler) instead of 5432

### Issue: Backend Won't Start

**Solution:**
```bash
cd /home/dhanush/Documents/ticketpilot/backend

# Check Python version
python --version  # Should be 3.11+

# Recreate virtual environment
rm -rf .venv
python -m venv .venv
source .venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt

# Check for errors
python -c "from app.main import app; print('✅ App loads successfully')"
```

### Issue: Frontend Build Errors

**Solution:**
```bash
cd /home/dhanush/Documents/ticketpilot/frontend

# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Build
npm run build
```

### Issue: Missing Environment Variables

**Quick Check:**
```bash
# Backend
cd backend && source .venv/bin/activate
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('SUPABASE_URL:', os.getenv('SUPABASE_URL'))"

# Frontend
cd frontend
cat .env.local | grep NEXT_PUBLIC
```

### Issue: Database Connection Fails

**Solution:**
```bash
# Test database connection
psql "postgresql://postgres:1819@db.nvgmgvplfpukckfkjuso.supabase.co:6543/postgres" -c "SELECT version();"

# If fails, check:
1. Password is correct
2. Using port 6543 (connection pooler) not 5432
3. Supabase project is active
```

---

## 🎯 Post-Deployment Checklist

### After Successful Deployment:

- [ ] **Frontend URL works**: Test login, signup, navigation
- [ ] **Backend API works**: Test `/api/health`, `/docs`
- [ ] **Authentication works**: Create test user, login
- [ ] **Database connected**: Check user roles, tickets
- [ ] **AI Features work**: Test knowledge base upload, AI chat
- [ ] **CORS configured**: No CORS errors in production
- [ ] **Environment variables**: All secrets properly set
- [ ] **CI/CD pipeline**: Test with a PR
- [ ] **Monitoring setup**: Check logs in Vercel/Railway
- [ ] **Custom domain** (optional): Configure DNS

### Performance Optimization:

1. **Enable Vercel Analytics**:
   - Go to Vercel project → Analytics → Enable

2. **Railway Metrics**:
   - Monitor CPU/Memory usage
   - Set up alerts for errors

3. **Supabase Monitoring**:
   - Check API usage
   - Monitor database performance

### Security Checklist:

- [ ] All secrets in GitHub Secrets (not in code)
- [ ] HTTPS enforced in production
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] JWT secrets rotated regularly
- [ ] Database backups enabled (Supabase auto-backups)

---

## 📊 Deployment Commands Quick Reference

### Local Development:
```bash
# Backend
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload

# Frontend
cd frontend && npm run dev
```

### Production Deploy:
```bash
# Via Git (triggers CI/CD)
git push origin main

# Manual Vercel deploy
cd frontend && vercel --prod

# Manual Railway deploy
cd backend && railway up
```

### Health Checks:
```bash
# Local
curl http://localhost:8000/api/health
curl http://localhost:3000

# Production
curl https://your-backend.railway.app/api/health
curl https://your-frontend.vercel.app
```

---

## 🎓 SDE Interview Ready Features

Your deployment demonstrates:
- ✅ **Modern DevOps**: GitHub Actions CI/CD
- ✅ **Cloud-Native**: Vercel + Railway serverless
- ✅ **Security**: Environment secrets, JWT auth
- ✅ **Scalability**: Connection pooling, vector databases
- ✅ **Monitoring**: Health checks, logging
- ✅ **Best Practices**: Separate frontend/backend, proper CORS

**Talk Points for Interviews:**
- "Deployed full-stack AI application with RAG capabilities"
- "Implemented CI/CD pipeline with automated testing and security scanning"
- "Used modern JAMstack architecture with Next.js and FastAPI"
- "Configured production-grade database connection pooling"
- "Integrated AI/ML models with vector stores for semantic search"

---

## 📞 Need Help?

1. **Check Documentation**: 
   - `/SETUP_GUIDE.md` - Detailed local setup
   - `/DEPLOYMENT.md` - Deployment overview
   - `/CI_CD_DOCUMENTATION.md` - CI/CD details

2. **Test Scripts Available**:
   - `./verify_setup.sh` - Verify local environment
   - `./deploy.sh` - Interactive deployment helper
   - `./start-local.sh` - Start local development

3. **Common Commands**:
   - `npm run dev` - Start frontend
   - `uvicorn app.main:app --reload` - Start backend
   - `git push origin main` - Deploy via CI/CD

---

**🎉 You're Ready to Deploy!**

Start with local development to fix the CORS issue, then proceed to production deployment. The infrastructure is already set up - you just need to connect the deployment platforms and add the GitHub secrets.

Good luck! 🚀