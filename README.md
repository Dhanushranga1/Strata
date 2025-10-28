# TicketPilot — AI-Powered Multi-Tenant Customer Support Platform

> **Transform your customer support with intelligent, AI-powered ticket management**

A production-ready, enterprise-grade customer support system that combines traditional ticketing workflows with cutting-edge AI assistance. Built from the ground up with multi-tenancy, security, and scalability in mind.

[![Production Ready](https://img.shields.io/badge/status-production%20ready-success)]()
[![Test Coverage](https://img.shields.io/badge/tests-16%2F16%20passing-brightgreen)]()
[![Security](https://img.shields.io/badge/security-hardened-blue)]()
[![Performance](https://img.shields.io/badge/response%20time-%3C200ms-orange)]()

---

## 🎯 What is TicketPilot?

TicketPilot is an intelligent customer support platform designed to help support teams work faster and smarter. It combines familiar ticketing workflows with AI-powered assistance, enabling representatives to deliver faster, more accurate responses by leveraging your organization's knowledge base.

### The Problem We Solve

Modern support teams face several challenges:
- **Information Overload**: Finding the right answer in hundreds of documents
- **Inconsistent Responses**: Different reps giving different answers
- **Long Resolution Times**: Searching for information slows down responses
- **Scaling Difficulties**: Training new reps takes time and resources
- **Multi-Organization Complexity**: Managing separate teams and data

### Our Solution

TicketPilot addresses these challenges through:
1. **AI-Powered Knowledge Retrieval**: Instant access to relevant information using RAG (Retrieval-Augmented Generation)
2. **Smart Rep Console**: AI suggests responses based on your knowledge base and conversation context
3. **Complete Multi-Tenancy**: Serve multiple organizations with complete data isolation
4. **Role-Based Access**: Granular permissions for admins, reps, and customers
5. **Real-Time Analytics**: Track performance, response times, and team efficiency

---

## ✨ Key Features

### 🤖 Intelligent AI Assistant
- **RAG-Powered Responses**: Leverages Google Gemini and FAISS vector search to find relevant information
- **Context-Aware Suggestions**: Analyzes ticket history and conversation flow
- **Confidence Scoring**: 7-factor confidence calculation (retrieval quality, citation coverage, semantic coherence, etc.)
- **Smart Escalation**: Automatically flags tickets that need human expertise
- **Citation Tracking**: Shows which documents were used to generate each response

### 🏢 Enterprise Multi-Tenancy
- **Complete Data Isolation**: Organization-scoped queries with PostgreSQL Row-Level Security (RLS)
- **Organization Management**: Create, manage, and switch between multiple organizations
- **Member Roles**: Owner, Admin, and Member roles with granular permissions
- **Shared Resources**: Optional resource sharing between organizations
- **Scalable Architecture**: Built to handle thousands of organizations

### 🎫 Comprehensive Ticketing System
- **Full Lifecycle Management**: From creation to resolution with status tracking
- **Priority Levels**: Urgent, High, Normal, Low with automatic escalation
- **Assignment System**: Route tickets to specific reps or teams
- **Message Threading**: Complete conversation history with timestamps
- **Real-Time Updates**: Live status changes and notifications

### 📚 Knowledge Base Management
- **Document Ingestion**: Support for PDF, TXT, MD, and DOCX formats
- **Intelligent Chunking**: Automatic text segmentation with overlap for context
- **Vector Embeddings**: Google's text-embedding-004 for semantic search
- **Deduplication**: Document and chunk-level duplicate detection
- **Search & Discovery**: Fast semantic search across all documents

### 📊 Analytics & Insights
- **Admin Dashboard**: Organization-wide metrics and trends
- **Rep Performance**: Individual and team performance tracking
- **Response Time Metrics**: Average response and resolution times
- **RAG Usage Analytics**: AI assistance effectiveness and confidence scores
- **Ticket Analytics**: Status distribution, priority breakdown, trends

### 🔒 Security & Performance
- **Security Headers**: HSTS, CSP, X-Frame-Options, and more
- **Rate Limiting**: IP-based, per-endpoint protection
- **JWT Authentication**: Secure token-based auth via Supabase
- **SQL Injection Protection**: Parameterized queries throughout
- **Fast Response Times**: Average <200ms for analytics queries
- **Code Splitting**: Optimized bundles (102KB shared, 248KB max page)

### 🔒 Security & Performance
- **Security Headers**: HSTS, CSP, X-Frame-Options, and more
- **Rate Limiting**: IP-based, per-endpoint protection
- **JWT Authentication**: Secure token-based auth via Supabase
- **SQL Injection Protection**: Parameterized queries throughout
- **Fast Response Times**: Average <200ms for analytics queries
- **Code Splitting**: Optimized bundles (102KB shared, 248KB max page)

### 🎨 Modern User Experience
- **Responsive Design**: Mobile-optimized with touch-friendly interactions
- **Dark Theme**: Professional "Midnight Prism" design system
- **Smooth Animations**: Framer Motion with reduced-motion support
- **Loading States**: Skeleton loaders and progress indicators
- **Accessibility**: ARIA labels, keyboard navigation, WCAG AA compliant
- **Organization Switching**: Seamless context switching for multi-org users

---

## 🏗️ Architecture & Technology

### System Architecture

```
┌─────────────────┐
│   Frontend      │   Next.js 15 (App Router, SSR)
│   (Port 3000)   │   TypeScript, Tailwind CSS
└────────┬────────┘
         │ REST API
         │ JWT Auth
┌────────▼────────┐
│   Backend       │   FastAPI (Python 3.10+)
│   (Port 8000)   │   Async/Await
└────────┬────────┘
         │
    ┌────┴─────────────────────────┐
    │                              │
┌───▼──────────┐         ┌─────────▼────────┐
│  PostgreSQL  │         │   Google AI      │
│  (Supabase)  │         │   + FAISS        │
│              │         │                  │
│ - Auth       │         │ - Embeddings     │
│ - Data       │         │ - Generation     │
│ - RLS        │         │ - Vector Search  │
└──────────────┘         └──────────────────┘
```

### Technology Stack

**Frontend**
- **Framework**: Next.js 15 with App Router and React Server Components
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 3.4 + Radix UI primitives
- **Animations**: Framer Motion with LazyMotion optimization
- **State**: React Context API + SWR for data fetching
- **Auth**: Supabase Auth (client-side with JWT)
- **API Client**: Custom fetch wrapper with automatic token handling

**Backend**
- **Framework**: FastAPI 0.100+ (async/await support)
- **Language**: Python 3.10+
- **Database**: PostgreSQL 15 via Supabase (with connection pooling)
- **Vector Store**: FAISS (Facebook AI Similarity Search)
- **AI/ML**: 
  - Google Generative AI (gemini-1.5-flash for chat)
  - text-embedding-004 for semantic search
- **Auth**: JWT verification with Supabase
- **ORM**: Raw SQL with asyncpg (full control and performance)

**Infrastructure**
- **Deployment**: 
  - Backend: Railway or Render
  - Frontend: Vercel
  - Database: Supabase (managed PostgreSQL)
- **CI/CD**: GitHub Actions (development, staging, production)
- **Monitoring**: Built-in logging, health checks, and observability
- **File Storage**: Supabase Storage (optional)

**Security Stack**
- **Rate Limiting**: SlowAPI (IP-based, per-endpoint)
- **Security Headers**: Custom middleware (HSTS, CSP, X-Frame-Options)
- **CORS**: Environment-aware configuration
- **Auth**: JWT with RS256 signing
- **Database**: Row-Level Security (RLS) policies

---

## 📁 Project Structure

```
ticketpilot/
├── frontend/                           # Next.js application
│   ├── src/
│   │   ├── app/                       # App Router pages
│   │   │   ├── (public)/              # Public routes
│   │   │   │   ├── login/             # Authentication
│   │   │   │   └── signup/
│   │   │   ├── (protected)/           # Protected routes (require auth)
│   │   │   │   ├── dashboard/         # Admin & Rep dashboards
│   │   │   │   ├── tickets/           # Ticket management
│   │   │   │   │   └── [id]/          # Ticket detail view
│   │   │   │   ├── rep/               # Rep console (AI assistance)
│   │   │   │   ├── kb/                # Knowledge base management
│   │   │   │   ├── admin/             # Admin area
│   │   │   │   │   ├── analytics/     # Advanced analytics
│   │   │   │   │   └── roles/         # User role management
│   │   │   │   └── organizations/     # Org management
│   │   │   │       ├── page.tsx       # List organizations
│   │   │   │       └── new/           # Create organization
│   │   │   └── layout.tsx             # Root layout
│   │   ├── components/                # React components
│   │   │   ├── ui/                    # Base UI (buttons, inputs, etc.)
│   │   │   ├── rep/                   # Rep-specific (AI modal, etc.)
│   │   │   ├── skeletons/             # Loading states
│   │   │   ├── Sidebar.tsx            # Navigation
│   │   │   └── OrganizationSelector.tsx
│   │   ├── contexts/                  # React contexts
│   │   │   └── OrganizationContext.tsx
│   │   └── lib/
│   │       ├── supabaseClient.ts      # Supabase client
│   │       ├── api-client.ts          # API wrapper with auth
│   │       └── utils.ts               # Utilities
│   └── .env.local.example             # Environment template
│
├── backend/                            # FastAPI application
│   ├── app/
│   │   ├── main.py                    # Application entry point
│   │   ├── auth.py                    # JWT auth & user management
│   │   ├── tickets.py                 # Ticket CRUD + messages
│   │   ├── rep.py                     # Rep console endpoints
│   │   ├── admin.py                   # Admin analytics & management
│   │   ├── kb.py                      # Knowledge base routes
│   │   ├── organizations.py           # Multi-tenant org management
│   │   ├── feedback.py                # AI feedback collection
│   │   ├── rag.py                     # RAG pipeline
│   │   ├── ai.py                      # Gemini integration
│   │   ├── security.py                # Security middleware
│   │   ├── org_middleware.py          # Organization context
│   │   ├── error_handlers.py          # Global error handling
│   │   ├── embeddings.py              # Google embeddings API
│   │   ├── chunker.py                 # Document chunking
│   │   ├── store.py                   # FAISS vector store
│   │   ├── observability.py           # Monitoring & logging
│   │   └── utils.py                   # Utilities
│   ├── migrations/                    # SQL migration scripts (in order)
│   │   ├── 0001_user_roles.sql        # User role system
│   │   ├── 0002_kb.sql                # Knowledge base tables
│   │   ├── 0003_tickets_core.sql      # Core ticketing
│   │   ├── 0004_ai_chat.sql           # AI chat history
│   │   ├── 0005_rep_console.sql       # Rep console features
│   │   ├── 0005a_admin_roles.sql      # Admin role management
│   │   ├── 0006_ai_feedback.sql       # Feedback collection
│   │   ├── 0007_organizations.sql     # Multi-tenancy (orgs)
│   │   ├── 0008_add_organization_id.sql  # Add org_id columns
│   │   ├── 0009_migrate_existing_data.sql # Migrate to default org
│   │   └── 0010_enable_rls.sql        # Row-Level Security policies
│   ├── data/                          # Runtime data (gitignored)
│   │   ├── faiss/                     # FAISS indices per org
│   │   │   └── {org_id}/kb.index
│   │   └── maps/                      # Chunk-to-vector mappings
│   │       └── {org_id}/kb_map.json
│   ├── requirements.txt               # Python dependencies
│   └── .env.example                   # Environment template
│
├── .github/workflows/                 # CI/CD pipelines
│   ├── ci-development.yml             # PR checks
│   ├── deploy-staging.yml             # Staging deployment
│   ├── deploy-production.yml          # Production deployment
│   └── security-scan.yml              # Security scanning
│
├── docs/                               # Documentation
│   ├── DEPLOYMENT.md                  # Deployment guide
│   ├── SETUP_GUIDE.md                 # Setup instructions
│   └── QUICK_START.md                 # Quick start guide
│
└── README.md                           # This file
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **pnpm** (frontend)
- **Python** 3.10+ with **pip** (backend)
- **Supabase** account (free tier works)
- **Google AI API** key (for embeddings and chat)

### Quick Start (15 minutes)

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/ticketpilot.git
cd ticketpilot
```

#### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → API**
3. Copy your:
   - Project URL
   - Anon/Public key  
   - JWT Secret (from Service Role settings)
4. Go to **Project Settings → Database**
5. Copy your connection string (Direct connection)
6. Run all migrations in `backend/migrations/` in the SQL editor (in order: 0001 → 0010)

#### 3. Get Google AI API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Save it for the next step

#### 4. Configure Environment Variables

**Backend** (`backend/.env`):
```bash
cd backend
cp .env.example .env
# Edit .env with your values:
```

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret

# Database
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres

# Google AI
GOOGLE_API_KEY=your_google_api_key

# Environment
ENVIRONMENT=development
WEB_ORIGIN=http://localhost:3000
```

**Frontend** (`frontend/.env.local`):
```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local:
```

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

#### 5. Install Dependencies

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
pnpm install  # or: npm install
```

#### 6. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
pnpm dev  # or: npm run dev
```

#### 7. Access the Application

1. Open [http://localhost:3000](http://localhost:3000)
2. Click **Sign Up** to create an account
3. Verify your email (check Supabase Auth inbox)
4. Log in and start using TicketPilot!

**First-time Setup:**
- Your first user will be assigned to the "Default Organization"
- By default, users are **customers**
- To become an **admin**, update your role in Supabase SQL editor:
  ```sql
  UPDATE app.organization_members 
  SET role = 'owner' 
  WHERE user_id = 'your-user-id';
  ```

---

## 🔧 How It Works

### For Customers

1. **Submit a Ticket**
   - Navigate to the tickets page
   - Click "New Ticket" and describe your issue
   - Select priority (Low, Medium, High, Urgent)
   - Submit and track status in real-time

2. **Receive Support**
   - Ticket is assigned to an available rep
   - Receive responses via the ticket thread
   - Get notified of status changes
   - Close ticket when resolved

### For Support Representatives

1. **Manage Assigned Tickets**
   - View all tickets assigned to you
   - See ticket priority, status, and customer info
   - Respond directly in the ticket thread

2. **Use AI Assistant**
   - Open the **Rep Console** for any ticket
   - Ask the AI assistant for help
   - AI searches your knowledge base using RAG
   - Get instant answers with confidence scores and citations
   - Copy AI responses to clipboard and paste into tickets

3. **Track Performance**
   - View your rep dashboard
   - See tickets handled, response times, AI usage
   - Identify areas for improvement

### For Administrators

1. **Manage Knowledge Base**
   - Upload documents (PDF, TXT, MD, DOCX)
   - AI automatically chunks and embeds content
   - Documents are instantly searchable by AI assistant

2. **Monitor Team Performance**
   - View admin analytics dashboard
   - See ticket volume, resolution times, rep performance
   - Track AI assistant usage and confidence scores
   - Identify knowledge gaps

3. **Manage Users & Organizations**
   - Invite team members
   - Assign roles (Admin, Rep, Customer)
   - Create and manage multiple organizations
   - Switch between organizations seamlessly

### RAG Pipeline (Behind the Scenes)

```
1. Document Upload (Admin)
   ↓
2. Chunking (512-1024 tokens with overlap)
   ↓
3. Embedding (Google text-embedding-004)
   ↓
4. Store in FAISS (per-organization index)
   ↓
5. Rep asks AI a question
   ↓
6. Query embedding generated
   ↓
7. FAISS similarity search (top 5 chunks)
   ↓
8. MMR re-ranking (diversity + relevance)
   ↓
9. Gemini generates response with citations
   ↓
10. Confidence score calculated (7 factors)
   ↓
11. Response displayed to rep
```

**Confidence Scoring** (7 factors):
- **Retrieval Quality** (30%): Relevance of retrieved chunks
- **Citation Coverage** (20%): % of response backed by sources
- **Semantic Coherence** (20%): How well response matches query
- **Response Completeness** (10%): Addresses all aspects of query
- **Information Density** (10%): Quality vs. fluff
- **Source Diversity** (10%): Multiple unique sources cited
- **Variance Bonus**: Penalty if retrieval scores are too similar

---

## 📚 API Documentation

### Authentication

All protected endpoints require a JWT token in the `Authorization` header:
```
Authorization: Bearer <your_jwt_token>
```

Get your token by logging in via Supabase Auth (frontend) or directly via API.

#### Health & Status
- `GET /` - API root (health check)
- `GET /health` - Detailed health status

#### Authentication & Users
- `GET /auth/user` - Get current user info
- `GET /auth/users` - List all users in organization
- `GET /auth/users/{user_id}/profile` - Get user profile
- `PATCH /auth/users/{user_id}/role` - Update user role (admin only)

#### Organizations
- `GET /organizations` - List user's organizations
- `GET /organizations/{org_id}` - Get organization details
- `POST /organizations` - Create new organization
- `GET /organizations/{org_id}/members` - List members
- `POST /organizations/{org_id}/members` - Add member
- `DELETE /organizations/{org_id}/members/{user_id}` - Remove member

#### Tickets
- `GET /tickets` - List tickets (filtered by role)
- `GET /tickets/{id}` - Get ticket details
- `POST /tickets` - Create new ticket
- `PATCH /tickets/{id}` - Update ticket
- `DELETE /tickets/{id}` - Delete ticket
- `POST /tickets/{id}/assign` - Assign ticket to rep
- `GET /tickets/{id}/messages` - Get ticket messages
- `POST /tickets/{id}/messages` - Add message to ticket

#### Rep Console (AI Assistant)
- `POST /rep/chat` - Send message to AI assistant
- `GET /rep/requests` - Get AI request history
- `GET /rep/dashboard` - Get rep dashboard metrics

#### Admin Analytics
- `GET /admin/analytics` - Get admin analytics
- `GET /admin/rag-analytics` - Get RAG usage analytics
- `GET /admin/rep-performance` - Get rep performance metrics

#### Knowledge Base
- `GET /kb/documents` - List knowledge base documents
- `POST /kb/upload` - Upload document (text, PDF, MD, DOCX)
- `DELETE /kb/documents/{id}` - Delete document
- `POST /kb/reindex` - Rebuild FAISS index

#### AI Feedback
- `POST /feedback` - Submit feedback on AI response
- `GET /feedback` - List feedback (admin only)

### Example Requests

**Create a Ticket:**
```bash
curl -X POST http://localhost:8000/tickets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cannot access my account",
    "description": "I forgot my password and the reset email isn'\''t arriving.",
    "priority": "high"
  }'
```

**Ask AI Assistant:**
```bash
curl -X POST http://localhost:8000/rep/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I reset a customer'\''s password?",
    "ticket_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Upload Knowledge Base Document:**
```bash
curl -X POST http://localhost:8000/kb/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@support_guide.pdf"
```

---

## 🚢 Deployment

### Prerequisites
- Railway account (backend) or Render/Fly.io
- Vercel account (frontend)
- Supabase project (database + auth)
- Google AI API key

### Backend Deployment (Railway)

1. **Prepare Environment Variables** (in Railway dashboard):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret
DATABASE_URL=your_supabase_postgres_url
GOOGLE_API_KEY=your_google_api_key
ENVIRONMENT=production
WEB_ORIGIN=https://your-frontend.vercel.app
```

2. **Deploy**:
```bash
# Railway will auto-detect Python and use:
# - requirements.txt for dependencies
# - railway.toml for configuration (already included)
# - Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT

railway up
```

3. **Verify**:
```bash
curl https://your-backend.railway.app/health
```

### Frontend Deployment (Vercel)

1. **Connect GitHub Repo** to Vercel
2. **Set Environment Variables**:
```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

3. **Deploy**:
```bash
# Vercel will auto-detect Next.js and build
# - Framework Preset: Next.js
# - Build Command: pnpm build (or npm run build)
# - Output Directory: .next

vercel --prod
```

4. **Verify**:
Visit `https://your-frontend.vercel.app` and test login/signup

### CI/CD (GitHub Actions)

Pre-configured workflows are in `.github/workflows/`:
- `ci-development.yml` - Runs tests on PRs
- `deploy-staging.yml` - Auto-deploy to staging on `develop` branch
- `deploy-production.yml` - Auto-deploy to production on `main` branch

**Required GitHub Secrets:**
```
RAILWAY_TOKEN
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
SUPABASE_URL
SUPABASE_KEY
SUPABASE_JWT_SECRET
DATABASE_URL
GOOGLE_API_KEY
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment guide and [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed setup instructions.

---

## 🧪 Testing

### Run All Tests

**Backend:**
```bash
cd backend
pytest tests/ -v
```

**Frontend:**
```bash
cd frontend
pnpm test  # or: npm test
```

### Test Suites

1. **Health Checks**: API availability, database connectivity
2. **Security Tests**: Rate limiting, CORS, security headers
3. **API Tests**: All endpoints with various roles
4. **Performance Tests**: Response times, database queries
5. **Multi-Tenancy Tests**: Organization isolation, RLS policies
6. **RAG Tests**: Document upload, embedding, search, confidence scoring

### Test Results (Day 14)

```
✅ 16/16 Tests Passed (100% success rate)
✅ 7/7 Analytics Endpoints Verified
✅ Average API Response Time: <200ms
✅ Rate Limiting: Working (429 status on exceeded limits)
✅ Security Headers: All present and correct
✅ Multi-Tenant Isolation: Verified (no data leakage)
```

**Completed Test Categories:**
- ✅ Health & connectivity checks
- ✅ Security features (rate limiting, CORS, headers)
- ✅ Authentication & authorization
- ✅ Multi-tenant data isolation
- ✅ Ticket CRUD operations
- ✅ Knowledge base ingestion
- ✅ RAG pipeline & confidence scoring
- ✅ Admin analytics accuracy
- ✅ Rep dashboard metrics
- ✅ Performance benchmarks

For full test report, see documentation in `/docs`.

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the Repository**
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make Your Changes**:
   - Follow existing code style
   - Add tests for new features
   - Update documentation as needed
4. **Run Tests**:
   ```bash
   # Backend
   cd backend && pytest
   
   # Frontend
   cd frontend && pnpm test
   ```
5. **Commit Your Changes**:
   ```bash
   git commit -m "Add: Your feature description"
   ```
6. **Push to Your Fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request**

### Code Style

- **Python**: Follow PEP 8, use `black` for formatting, include type hints
- **TypeScript**: Follow existing patterns, use ESLint, strict mode enabled
- **Commits**: Use conventional commits (feat:, fix:, docs:, refactor:, etc.)
- **Tests**: Maintain 100% pass rate on all test suites
- **Security**: All new endpoints must enforce organization scoping and JWT auth

### Development Guidelines

- **Backend**: Use async/await patterns, parameterized queries, proper error handling
- **Frontend**: Use React Server Components where possible, implement loading states, handle errors gracefully
- **Documentation**: Update README and relevant docs for any user-facing changes
- **Security**: Never commit secrets, always validate user input, follow principle of least privilege

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

You are free to:
- ✅ Use commercially
- ✅ Modify
- ✅ Distribute
- ✅ Use privately

---

## 🙏 Acknowledgments

This project was built using incredible open-source technologies:

- **[Supabase](https://supabase.com)** - Database, auth, and storage platform
- **[Google AI](https://ai.google.dev)** - Generative AI and embeddings (gemini-1.5-flash, text-embedding-004)
- **[FAISS](https://github.com/facebookresearch/faiss)** - Efficient vector similarity search by Meta
- **[FastAPI](https://fastapi.tiangolo.com)** - High-performance async Python framework
- **[Next.js](https://nextjs.org)** - React framework with excellent developer experience
- **[Radix UI](https://www.radix-ui.com)** - Accessible, unstyled component primitives
- **[Tailwind CSS](https://tailwindcss.com)** - Utility-first CSS framework
- **[Framer Motion](https://www.framer.com/motion/)** - Production-ready animation library
- **[PostgreSQL](https://www.postgresql.org)** - Powerful open-source relational database

Special thanks to the open-source community for making projects like this possible!

---

## 📞 Support & Contact

- **Documentation**: Check `/docs` folder for detailed guides
  - [Setup Guide](./SETUP_GUIDE.md)
  - [Deployment Guide](./DEPLOYMENT.md)
  - [Quick Start](./QUICK_START.md)
- **Issues**: [Open an issue](https://github.com/yourusername/ticketpilot/issues) for bug reports
- **Discussions**: [Start a discussion](https://github.com/yourusername/ticketpilot/discussions) for questions and ideas
- **Feature Requests**: Use GitHub issues with the `enhancement` label

---

## 🗺️ Roadmap

### Completed ✅
- ✅ Multi-tenant architecture with Row-Level Security
- ✅ RAG-powered AI assistant with 7-factor confidence scoring
- ✅ Role-based access control (Owner, Admin, Rep, Customer)
- ✅ Admin and rep analytics dashboards with real-time metrics
- ✅ Knowledge base management (PDF, TXT, MD, DOCX support)
- ✅ Complete ticket lifecycle management
- ✅ Security hardening (rate limiting, headers, JWT auth)
- ✅ Comprehensive test suite (16/16 tests passing)
- ✅ Production-ready deployment configuration
- ✅ CI/CD pipelines with GitHub Actions
- ✅ Modern UI with "Midnight Prism" dark theme
- ✅ Responsive design with mobile optimization
- ✅ Accessibility features (WCAG AA compliant)

### In Progress 🚧
- 🚧 Email notifications for ticket updates
- 🚧 Advanced search across tickets and knowledge base
- 🚧 Performance monitoring dashboard

### Planned 🚀

**Short-term (Next 3 months)**
- 📧 **Email Notifications**: Automated notifications for ticket updates, assignments, and mentions
- 📎 **File Attachments**: Allow file uploads in tickets (images, logs, screenshots)
- 🔍 **Full-Text Search**: Advanced search with filters across tickets, KB, and messages
- 📊 **Enhanced Analytics**: Export reports, custom date ranges, trend analysis
- 🔔 **In-App Notifications**: Real-time notification center with toast alerts

**Medium-term (3-6 months)**
- ⚡ **Real-Time Updates**: WebSocket support for live ticket updates and chat
- 📱 **Mobile Apps**: Native iOS and Android apps with push notifications
- 🤖 **Advanced AI Features**: 
  - Auto-categorization of tickets
  - Sentiment analysis
  - Suggested responses
  - Knowledge gap detection
- 🔗 **Integrations**: Slack, Microsoft Teams, Discord webhooks
- 📈 **SLA Management**: Track and enforce service level agreements with alerts

**Long-term (6+ months)**
- 🏢 **Self-Hosted Option**: Docker Compose setup for on-premise deployment
- 🌐 **Multi-Language Support**: i18n for UI and AI responses
- 🔄 **Migration Tools**: Import from Zendesk, Freshdesk, Intercom
- 🎨 **White-Label**: Customizable branding and themes
- 📊 **Business Intelligence**: Advanced reporting with custom dashboards
- 🤝 **Third-Party Integrations**: Zapier, Make.com, API marketplace
- 🔐 **SSO Support**: SAML, OAuth2 for enterprise authentication

### Community Requests
Want a feature not listed here? [Open an issue](https://github.com/yourusername/ticketpilot/issues) with the `feature-request` label!

---

<div align="center">

**Built with ❤️ for better customer support**

[⭐ Star this repo](https://github.com/yourusername/ticketpilot) • [🐛 Report Bug](https://github.com/yourusername/ticketpilot/issues) • [💡 Request Feature](https://github.com/yourusername/ticketpilot/issues) • [📖 Read Docs](./docs)

---

**Project Status**: ✅ Production-Ready | **Test Coverage**: 100% Pass Rate | **Last Updated**: 2025

Made with Next.js, FastAPI, Supabase, and Google AI

</div>