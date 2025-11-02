# 🔑 GitHub Secrets Configuration Guide

## Required GitHub Repository Secrets

Go to: https://github.com/Dhanushranga1/ticketpilot/settings/secrets/actions

Click **"New repository secret"** and add each of these:

### 🔵 Vercel Configuration
```
VERCEL_TOKEN = Q1gT9To4ewmtHkyyIbicz72j
VERCEL_ORG_ID = team_fSwUAUyPDRzgTG0Yxvi1vUWz
VERCEL_PROJECT_ID = [NEED TO GET THIS - See instructions below]
```

### 🚂 Railway Configuration  
```
RAILWAY_TOKEN = 803cad39-3b88-41ad-93d1-e1b276b1d583
RAILWAY_PROJECT_ID = b7ec1cd3-1925-4db7-88ca-104b145a6619
RAILWAY_SERVICE_ID = [NEED TO GET THIS - See instructions below]
RAILWAY_APP_URL = [WILL BE GENERATED AFTER FIRST DEPLOYMENT]
```

### 🗄️ Application Configuration (Use your existing values)
```
NEXT_PUBLIC_SUPABASE_URL = [your existing supabase url]
NEXT_PUBLIC_SUPABASE_ANON_KEY = [your existing supabase anon key]
SUPABASE_URL = [same as above]
SUPABASE_SERVICE_KEY = [your existing supabase service key]
GOOGLE_API_KEY = [your existing google api key]
NEXT_PUBLIC_API_URL = [will be your railway app url]
```

### 🔒 Optional Security Tools
```
SNYK_TOKEN = [optional - for advanced security scanning]
```

## 📋 Missing Values - How to Get Them

### 1. Get Vercel Project ID
```bash
cd frontend
vercel link  # This will create/link the project
cat .vercel/project.json  # Shows project ID
```

### 2. Get Railway Service ID  
```bash
cd backend
railway status  # Shows service information
```

### 3. Deploy to get Railway App URL
```bash
cd backend  
railway up  # This will give you the deployment URL
```

## 🚀 Quick Setup Commands

Run these commands to get the missing values:

```bash
# 1. Setup Vercel project
cd frontend
vercel link --yes
echo "Vercel Project ID:"
cat .vercel/project.json | grep projectId

# 2. Setup Railway service  
cd ../backend
railway link b7ec1cd3-1925-4db7-88ca-104b145a6619
railway status

# 3. Deploy to Railway to get URL
railway up
```