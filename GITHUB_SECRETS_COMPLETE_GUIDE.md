# 🔑 GitHub Repository Secrets Configuration Guide

## ✅ CONFIRMED VALUES (from your credentials)

Go to: https://github.com/Dhanushranga1/ticketpilot/settings/secrets/actions
Click "New repository secret" and add each of these:

### 🔵 Vercel Configuration (Confirmed)
```
Name: VERCEL_TOKEN
Value: Q1gT9To4ewmtHkyyIbicz72j

Name: VERCEL_ORG_ID  
Value: team_fSwUAUyPDRzgTG0Yxvi1vUWz
```

### 🚂 Railway Configuration (Confirmed)
```
Name: RAILWAY_TOKEN
Value: 803cad39-3b88-41ad-93d1-e1b276b1d583

Name: RAILWAY_PROJECT_ID
Value: b7ec1cd3-1925-4db7-88ca-104b145a6619
```

## ❓ MISSING VALUES (need to get these)

### 🎯 Get Vercel Project ID
**Option 1: Manual Setup**
1. Go to https://vercel.com/dashboard  
2. Create new project → Import from GitHub → Select ticketpilot/frontend
3. In project settings → General → copy Project ID

**Option 2: Use existing project if you have one**
- Find your ticketpilot project in Vercel dashboard
- Go to Settings → General → copy Project ID

### 🎯 Get Railway Service ID & URL
**Option 1: Manual Setup**  
1. Go to https://railway.app/dashboard
2. Find project "ticketpilot" (ID: b7ec1cd3-1925-4db7-88ca-104b145a6619)
3. Deploy your backend folder
4. Copy Service ID from project settings
5. Copy the generated URL

**Option 2: From CLI (if Railway login works)**
```bash
cd backend
railway login  # Follow prompts
railway link b7ec1cd3-1925-4db7-88ca-104b145a6619  
railway status  # Shows Service ID and URL
```

## 📝 COMPLETE GITHUB SECRETS LIST

Once you have the missing values, add all of these:

```
# Vercel
VERCEL_TOKEN=Q1gT9To4ewmtHkyyIbicz72j
VERCEL_ORG_ID=team_fSwUAUyPDRzgTG0Yxvi1vUWz
VERCEL_PROJECT_ID=[GET_FROM_VERCEL_DASHBOARD]

# Railway  
RAILWAY_TOKEN=803cad39-3b88-41ad-93d1-e1b276b1d583
RAILWAY_PROJECT_ID=b7ec1cd3-1925-4db7-88ca-104b145a6619
RAILWAY_SERVICE_ID=[GET_FROM_RAILWAY_DASHBOARD]
RAILWAY_APP_URL=[GET_FROM_RAILWAY_DEPLOYMENT]

# Application (use your existing values)
NEXT_PUBLIC_SUPABASE_URL=[your_existing_supabase_url]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your_existing_supabase_anon_key]
SUPABASE_URL=[same_as_supabase_url]  
SUPABASE_SERVICE_KEY=[your_existing_supabase_service_key]
GOOGLE_API_KEY=[your_existing_google_api_key]
NEXT_PUBLIC_API_URL=[same_as_railway_app_url]

# Optional
SNYK_TOKEN=[optional_for_security_scanning]
```

## 🚀 SIMPLIFIED SETUP STEPS

### Step 1: Deploy manually first (easier)

**Deploy Frontend to Vercel:**
1. Go to https://vercel.com/new
2. Import from GitHub → ticketpilot repository
3. Set root directory to `frontend`
4. Add environment variables
5. Deploy & copy Project ID

**Deploy Backend to Railway:**
1. Go to https://railway.app/new  
2. Deploy from GitHub → ticketpilot repository
3. Set root directory to `backend`
4. Add environment variables
5. Deploy & copy Service ID + URL

### Step 2: Add all secrets to GitHub

### Step 3: Test the pipeline
```bash
git add .
git commit -m "feat: configure CI/CD pipeline"
git push origin main

# Create test PR
git checkout -b test-cicd
echo "# Test CI/CD" >> README.md  
git add .
git commit -m "test: trigger CI/CD pipeline"
git push origin test-cicd
# Go to GitHub and create PR
```

## 💡 PRO TIP
The **Development CI pipeline** will work immediately with just the application secrets (Supabase, Google API). The deployment pipelines need the platform-specific secrets.

You can test code quality checks right away, then add deployment secrets later!