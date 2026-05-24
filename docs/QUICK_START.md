# TicketPilot Quick Setup Commands

## 🚀 Quick Start (Execute in Order)

### 1. Supabase Setup
1. Create project at https://supabase.com
2. Save these from Settings → Database:
   - Host: `db.xxxxxxxxxxxxx.supabase.co`
   - Password: (your project password)
3. Save these from Settings → API:
   - Project URL: `https://xxxxxxxxxxxxx.supabase.co`
   - anon key: `eyJhbGci...`
   - JWT Secret: (long string under JWT Settings)

### 2. Google API Setup
1. Create project at https://console.cloud.google.com
2. Enable "Generative Language API"
3. Create API Key: APIs & Services → Credentials → Create Credentials → API Key
4. Save the key: `AIzaSy...`

### 3. Create Environment Files

**Backend .env:**
```bash
cd /home/dhanush/Documents/ticketpilot/backend
cat > .env << 'EOF'
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase
DATABASE_URL=postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
GOOGLE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CHUNK_SIZE_CHARS=2400
CHUNK_OVERLAP_CHARS=400
VECTOR_INDEX_DIR=./data/faiss
VECTOR_MAP_DIR=./data/maps
EOF
```

**Frontend .env.local:**
```bash
cd /home/dhanush/Documents/ticketpilot/frontend
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF
```

### 4. Run Database Migrations
```bash
cd /home/dhanush/Documents/ticketpilot/backend

# Test connection first
psql "postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres" -c "SELECT version();"

# Run migrations
psql "postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres" < migrations/0001_user_roles.sql
psql "postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres" < migrations/0002_kb.sql

# Verify tables
psql "postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres" -c "\dt app.*"
```

### 5. Setup Backend
```bash
cd /home/dhanush/Documents/ticketpilot/backend

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create data directories
mkdir -p data/faiss data/maps

# Test installation
python test_phase2.py

# Start backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 6. Setup Frontend
```bash
cd /home/dhanush/Documents/ticketpilot/frontend

# Install dependencies
npm install

# Start frontend
npm run dev
```

### 7. Create Test User with Rep Role
```bash
# 1. First, register a user at http://localhost:3000
# 2. Then grant rep role:

psql "postgresql://postgres:your-password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres" << EOF
-- Find your user ID (replace email)
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Grant rep role (replace USER_ID with actual UUID from above)
INSERT INTO app.user_roles (user_id, role) 
VALUES ('USER_ID_HERE', 'rep') 
ON CONFLICT (user_id) DO UPDATE SET role = 'rep';
EOF
```

### 8. Test Knowledge Base API
```bash
# Get JWT token by logging in at http://localhost:3000
# Open browser dev tools → Network → find Authorization header

# Test document upload
curl -X POST "http://localhost:8000/api/kb/ingest" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "raw_text=This is a test document for the knowledge base system.&filename=test.txt"

# Test search
curl "http://localhost:8000/api/kb/search?q=test document&k=3" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check stats
curl "http://localhost:8000/api/kb/stats" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## ✅ Success Checklist
- [ ] Supabase project created and configured
- [ ] Google API key created and Generative Language API enabled
- [ ] Backend .env file created with all variables
- [ ] Frontend .env.local file created
- [ ] Database migrations run successfully
- [ ] Backend dependencies installed and server running on :8000
- [ ] Frontend dependencies installed and server running on :3000
- [ ] Test user created with rep role
- [ ] Knowledge base API tested successfully

## 🆘 Quick Troubleshooting
- **Database connection fails**: Check DATABASE_URL format and password
- **Google API errors**: Verify API key and ensure Generative Language API is enabled
- **Permission denied**: Ensure user has 'rep' role in app.user_roles table
- **Import errors**: Run `pip install -r requirements.txt` again
- **Frontend won't start**: Check NEXT_PUBLIC_* variables in .env.local

## 📝 Replace These Placeholders:
- `xxxxxxxxxxxxx` → Your actual Supabase project ID
- `your-password` → Your actual Supabase database password
- `your-jwt-secret-from-supabase` → Actual JWT secret from Supabase Settings → API
- `eyJhbGci...` → Your actual Supabase anon key
- `AIzaSy...` → Your actual Google API key
- `your-email@example.com` → Your test user email
- `USER_ID_HERE` → Actual user UUID from database
- `YOUR_JWT_TOKEN` → Actual JWT token from browser login