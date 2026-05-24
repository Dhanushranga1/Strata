# TicketPilot Phase 2 Complete Setup Guide

## 🚀 Prerequisites
- Node.js and npm (for frontend)
- Python 3.13+ (for backend)
- Git
- A Google Cloud account
- A Supabase account

## 📋 Table of Contents
1. [Supabase Database Setup](#1-supabase-database-setup)
2. [Google API Configuration](#2-google-api-configuration)
3. [Environment Variables Setup](#3-environment-variables-setup)
4. [Database Migrations](#4-database-migrations)
5. [Backend Setup](#5-backend-setup)
6. [Frontend Setup](#6-frontend-setup)
7. [Testing the System](#7-testing-the-system)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Supabase Database Setup

### Step 1.1: Create Supabase Project
1. Go to [Supabase](https://supabase.com)
2. Sign up/Login and click "New Project"
3. Choose your organization
4. Fill in project details:
   - **Name**: `ticketpilot`
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your location
5. Click "Create new project"
6. Wait for the project to be ready (2-3 minutes)

### Step 1.2: Get Database Connection Details
1. In your Supabase dashboard, go to **Settings** → **Database**
2. Copy the following information:
   - **Host**: `db.xxxxxxxxxxxxx.supabase.co`
   - **Database name**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: (the one you set during project creation)

### Step 1.3: Get Supabase API Keys
1. Go to **Settings** → **API**
2. Copy these keys (you'll need them later):
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGci...` (starts with eyJ)
   - **service_role secret key**: `eyJhbGci...` (also starts with eyJ)

### Step 1.4: Configure Authentication
1. Go to **Authentication** → **Settings** → **Auth Providers**
2. Configure your preferred login method:
   - **Email**: Already enabled by default
   - **Google/GitHub/etc**: Optional, configure if needed

---

## 2. Google API Configuration

### Step 2.1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Select a project" → "New Project"
3. Enter project name: `ticketpilot-kb`
4. Click "Create"

### Step 2.2: Enable Required APIs
1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Generative Language API** (for embeddings)
   
### Step 2.3: Create API Key
1. Go to **APIs & Services** → **Credentials**
2. Click "Create Credentials" → "API Key"
3. Copy the API key (starts with `AIza...`)
4. **Optional but Recommended**: Click "Restrict Key"
   - Under "API restrictions", select "Restrict key"
   - Choose "Generative Language API"
   - Click "Save"

### Step 2.4: Test API Access
```bash
# Test your Google API key
curl -H "Content-Type: application/json" \
-d '{"model": "models/text-embedding-004", "content": {"parts": [{"text": "test"}]}}' \
"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=YOUR_API_KEY"
```

---

## 3. Environment Variables Setup

### Step 3.1: Backend Environment (.env)
Create `/home/dhanush/Documents/ticketpilot/backend/.env`:

```bash
# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase

# Database Configuration
DATABASE_URL=postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres

# Google API Configuration
GOOGLE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Knowledge Base Configuration
CHUNK_SIZE_CHARS=2400
CHUNK_OVERLAP_CHARS=400
VECTOR_INDEX_DIR=./data/faiss
VECTOR_MAP_DIR=./data/maps

# Optional: Adjust these for production
# FAISS_INDEX_TYPE=IndexFlatIP
# EMBEDDING_MODEL=text-embedding-004
```

### Step 3.2: Frontend Environment (.env.local)
Create `/home/dhanush/Documents/ticketpilot/frontend/.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Step 3.3: Get JWT Secret from Supabase
1. In Supabase dashboard, go to **Settings** → **API**
2. Scroll down to "JWT Settings"
3. Copy the **JWT Secret** (very long string)
4. Add it as `SUPABASE_JWT_SECRET` in your backend `.env`

---

## 4. Database Migrations

### Step 4.1: Connect to Supabase Database
```bash
# Install PostgreSQL client if not already installed
# On Ubuntu/Debian:
sudo apt install postgresql-client

# On macOS:
brew install postgresql

# On Fedora:
sudo dnf install postgresql
```

### Step 4.2: Test Database Connection
```bash
# Test connection (replace with your details)
psql "postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres"

# If successful, you should see:
# postgres=>
```

### Step 4.3: Run Migrations
```bash
cd /home/dhanush/Documents/ticketpilot/backend

# Run Phase 1 migration (user roles)
psql "postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres" < migrations/0001_user_roles.sql

# Run Phase 2 migration (knowledge base)
psql "postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres" < migrations/0002_kb.sql

# Verify tables were created
psql "postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres" -c "\dt app.*"
```

You should see:
```
         List of relations
 Schema |    Name    | Type  |  Owner   
--------+------------+-------+----------
 app    | chunks     | table | postgres
 app    | documents  | table | postgres
 app    | user_roles | table | postgres
```

---

## 5. Backend Setup

### Step 5.1: Install Dependencies
```bash
cd /home/dhanush/Documents/ticketpilot/backend

# Activate virtual environment
source .venv/bin/activate

# Install all dependencies
pip install -r requirements.txt

# Verify installation
python test_phase2.py
```

### Step 5.2: Create Data Directories
```bash
# Create directories for FAISS storage
mkdir -p data/faiss data/maps

# Set proper permissions
chmod 755 data data/faiss data/maps
```

### Step 5.3: Test Backend Startup
```bash
# Start the backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# You should see:
# INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### Step 5.4: Test API Health
```bash
# In another terminal, test the API
curl http://localhost:8000/

# Should return: {"message": "TicketPilot API"}
```

---

## 6. Frontend Setup

### Step 6.1: Install Dependencies
```bash
cd /home/dhanush/Documents/ticketpilot/frontend

# Install dependencies
npm install

# Or if you prefer yarn
yarn install
```

### Step 6.2: Start Frontend Development Server
```bash
# Start the development server
npm run dev

# Or with yarn
yarn dev

# You should see:
# ▲ Next.js 15.5.3
# - Local:        http://localhost:3000
```

### Step 6.3: Test Frontend
1. Open http://localhost:3000 in your browser
2. You should see the TicketPilot login page
3. Try creating a new account or logging in

---

## 7. Testing the System

### Step 7.1: Create Test User with Rep Role
```bash
# Connect to your database
psql "postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres"

# First, log in through the frontend to create a user account
# Then find the user ID and grant rep role:

# Find your user ID (replace email with your test email)
SELECT id, email FROM auth.users WHERE email = 'your-test-email@example.com';

# Grant rep role (replace USER_ID with the actual UUID)
INSERT INTO app.user_roles (user_id, role) 
VALUES ('USER_ID_HERE', 'rep') 
ON CONFLICT (user_id) DO UPDATE SET role = 'rep';
```

### Step 7.2: Test Knowledge Base API

#### Test 1: Upload a Document
```bash
# First, get a JWT token by logging in through the frontend
# Open browser dev tools → Network tab → login → copy Authorization header

# Test document upload
curl -X POST "http://localhost:8000/api/kb/ingest" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -F "file=@test-document.pdf"

# Or test with raw text
curl -X POST "http://localhost:8000/api/kb/ingest" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "raw_text=This is a test document for the knowledge base.&filename=test.txt"
```

#### Test 2: Check Statistics
```bash
curl "http://localhost:8000/api/kb/stats" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Should return: {"documents": 1, "chunks": X}
```

#### Test 3: Search Knowledge Base
```bash
curl "http://localhost:8000/api/kb/search?q=test document&k=3" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Should return search results with similarity scores
```

### Step 7.3: Test Frontend Integration
1. Log in as a rep user
2. Navigate to the knowledge base section (if implemented)
3. Try uploading a document
4. Try searching for content

---

## 8. Troubleshooting

### Common Issues and Solutions

#### Issue: "SUPABASE_JWT_SECRET is required"
**Solution**: Make sure you've copied the JWT Secret from Supabase Settings → API

#### Issue: "Database connection failed"
**Solutions**:
- Check your DATABASE_URL format
- Ensure your IP is allowed in Supabase (should be open by default)
- Verify password is correct

#### Issue: "Google API key invalid"
**Solutions**:
- Check the API key is correct
- Ensure Generative Language API is enabled
- Check API key restrictions if applied

#### Issue: "Permission denied for knowledge base operations"
**Solutions**:
- Verify user has 'rep' role in app.user_roles table
- Check JWT token is valid and not expired
- Ensure Authorization header is properly formatted

#### Issue: "FAISS import errors"
**Solutions**:
```bash
# Reinstall FAISS
pip uninstall faiss-cpu
pip install faiss-cpu==1.12.0
```

#### Issue: "Text embedding fails"
**Solutions**:
- Check GOOGLE_API_KEY in .env file
- Verify internet connection
- Check Google Cloud billing is enabled

### Debug Commands

```bash
# Check environment variables
cd /home/dhanush/Documents/ticketpilot/backend
python -c "import os; print('Google API Key:', bool(os.getenv('GOOGLE_API_KEY')))"

# Test database connection
python -c "import psycopg; print('✅ Database connection available')"

# Test imports
python test_phase2.py

# Check logs
tail -f uvicorn.log  # if logging to file
```

### Getting Help

If you encounter issues:

1. **Check the logs**: Backend errors will show in the terminal where you ran `uvicorn`
2. **Verify environment**: Double-check all .env variables are set correctly
3. **Test components individually**: Use the test commands above to isolate issues
4. **Check network**: Ensure you can reach Supabase and Google APIs

---

## 🎉 Success!

Once everything is set up correctly, you should have:

- ✅ Supabase database with all required tables
- ✅ Google API configured for embeddings
- ✅ Backend running on http://localhost:8000
- ✅ Frontend running on http://localhost:3000
- ✅ Knowledge base ingestion and search working
- ✅ User authentication and role management

Your TicketPilot Phase 2 knowledge base system is now fully operational! 🚀