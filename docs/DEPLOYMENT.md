# TicketPilot Deployment Guide 🚀

This guide will walk you through deploying TicketPilot to GitHub and production environments.

## 📁 Project Structure

```
ticketpilot/
├── frontend/                 # Next.js 15 frontend application
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   │   ├── (marketing)/ # Landing page
│   │   │   ├── (public)/    # Login/signup pages
│   │   │   └── (protected)/ # Dashboard & authenticated pages
│   │   ├── components/      # Shared components
│   │   ├── ui/             # UI components & animations
│   │   └── lib/            # Utilities & configurations
│   ├── public/             # Static assets
│   ├── package.json
│   └── next.config.ts
├── backend/                  # FastAPI Python backend
│   ├── app/                 # Application modules
│   │   ├── main.py         # FastAPI entry point
│   │   ├── auth.py         # Authentication
│   │   ├── ai.py           # AI/RAG functionality
│   │   ├── admin.py        # Admin operations
│   │   ├── tickets.py      # Ticketing system
│   │   └── ...
│   ├── migrations/         # Database migrations
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Environment variables
├── data/                   # FAISS vector store & maps
├── context/               # Project documentation
├── milestones/           # Development phases
└── README.md
```

## 🛠️ Prerequisites

1. **Git** - Version control
2. **Node.js 18+** - For frontend
3. **Python 3.11+** - For backend
4. **Supabase Account** - Database & auth
5. **Vercel Account** - Frontend deployment (recommended)
6. **Railway/Render Account** - Backend deployment (recommended)

## 🔐 Environment Setup

### Frontend Environment (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Backend Environment (.env)
```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:6543/postgres

# Google API (for AI)
GOOGLE_API_KEY=your_google_api_key

# Vector Store Configuration
CHUNK_SIZE_CHARS=2400
CHUNK_OVERLAP_CHARS=400
VECTOR_INDEX_DIR=./data/faiss
VECTOR_MAP_DIR=./data/maps

# AI Configuration
GENAI_MODEL=gemini-1.5-pro
GENAI_TEMPERATURE=0.2
GENAI_MAX_OUTPUT_TOKENS=1024
RAG_TOP_K=6
RAG_MIN_SCORE=0.25
```

## 📤 Push to GitHub

### 1. Initialize Git Repository
```bash
cd /home/dhanush/Documents/ticketpilot
git init
git add .
git commit -m "Initial commit: TicketPilot MVP with Midnight Prism UI"
```

### 2. Create GitHub Repository
- Go to GitHub.com
- Click "New Repository"
- Name: `ticketpilot`
- Description: "AI-powered customer support with RAG and modern UI"
- Keep it private (recommended for now)

### 3. Connect and Push
```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ticketpilot.git
git push -u origin main
```

## 🚀 Deployment Options

### Option 1: Vercel (Frontend) + Railway (Backend)

#### Frontend on Vercel:
1. **Connect Repository:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Select `frontend` folder as root directory

2. **Environment Variables:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Build Settings:**
   - Framework: Next.js
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `.next`

#### Backend on Railway:
1. **Connect Repository:**
   - Go to [railway.app](https://railway.app)
   - New Project → Deploy from GitHub
   - Select your repository

2. **Environment Variables:**
   - Add all backend environment variables
   - Set `PORT=8000`

3. **Railway Configuration:**
   - Create `railway.toml` in backend folder:
   ```toml
   [build]
   builder = "NIXPACKS"

   [deploy]
   startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
   ```

### Option 2: Vercel (Frontend) + Render (Backend)

#### Backend on Render:
1. **Create Web Service:**
   - Connect GitHub repository
   - Root Directory: `backend`
   - Environment: Python 3
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Option 3: Full Vercel Deployment

#### Vercel Configuration (vercel.json):
```json
{
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/next"
    },
    {
      "src": "backend/app/main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "backend/app/main.py"
    },
    {
      "src": "/(.*)",
      "dest": "frontend/$1"
    }
  ]
}
```

## 🔧 Database Setup

### 1. Supabase Setup:
```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Run migrations in order
\i migrations/0001_user_roles.sql
\i migrations/0002_kb.sql
\i migrations/0003_tickets_core.sql
\i migrations/0004_ai_chat.sql
\i migrations/0005_rep_console.sql
\i migrations/0005a_admin_roles.sql
```

### 2. Vector Store Setup:
- Upload `data/faiss/kb.index` and `data/maps/kb_map.json` to your deployment
- Or regenerate using the knowledge base API

## 🧪 Testing Deployment

### Frontend Testing:
```bash
cd frontend
npm run build
npm run start
```

### Backend Testing:
```bash
cd backend
source .venv/bin/activate  # or create new venv
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Integration Testing:
1. Test authentication flow
2. Verify database connections
3. Test AI/RAG functionality
4. Check admin panel access

## 🔒 Security Checklist

- [ ] Environment variables are properly set
- [ ] Database credentials are secure
- [ ] CORS is configured correctly
- [ ] JWT secrets are strong and unique
- [ ] API keys are not exposed in frontend
- [ ] Rate limiting is enabled
- [ ] HTTPS is enforced in production

## 📊 Monitoring & Analytics

### Recommended Tools:
- **Vercel Analytics** - Frontend performance
- **Sentry** - Error tracking
- **Supabase Dashboard** - Database monitoring
- **Google Analytics** - User analytics

## 🚨 Common Issues & Solutions

### CORS Issues:
```python
# In backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Database Connection:
- Use connection pooling URL (port 6543)
- Ensure SSL settings match your environment
- Check firewall/network restrictions

### Build Failures:
- Verify Node.js version compatibility
- Check Python version requirements
- Ensure all dependencies are listed

## 🔄 CI/CD Pipeline

### GitHub Actions (Optional):
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy TicketPilot
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Deploy Frontend
        run: |
          cd frontend
          npm ci
          npm run build
      # Add deployment steps
```

## 📞 Support

If you encounter any issues:
1. Check the logs in your deployment platform
2. Verify environment variables
3. Test locally first
4. Check database connectivity

---

**Happy Deploying! 🎉**