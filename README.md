# TicketPilot — AI-Powered Customer Support Platform

A production-ready, multi-tenant customer support ticketing system with AI-powered assistance using RAG (Retrieval-Augmented Generation) via Google Gemini. Built with Next.js 15, FastAPI, and PostgreSQL.

## Overview

TicketPilot is an enterprise-grade support platform that combines traditional ticketing with AI-powered knowledge management. The system features complete multi-tenant isolation, role-based access control, and intelligent document retrieval to assist support representatives in real-time.

**Current Status:** Production-ready with comprehensive security hardening and testing complete.

## Key Features

### Core Functionality
- **Multi-Tenant Architecture**: Complete organization isolation with secure data scoping
- **Role-Based Access Control**: Admin, Representative, and Customer roles with granular permissions
- **AI-Powered Support**: RAG-based intelligent responses using Google Gemini and FAISS vector search
- **Knowledge Base Management**: Document ingestion (PDF, TXT, MD, DOCX) with automatic chunking and embedding
- **Real-Time Analytics**: Comprehensive dashboards for admins and reps with performance metrics
- **Ticket Management**: Full lifecycle management with status tracking, priority levels, and assignment

### Security & Performance
- **Security Headers**: HSTS, CSP, X-Frame-Options, and additional hardening
- **Rate Limiting**: IP-based, per-endpoint rate limiting to prevent abuse
- **JWT Authentication**: Secure token-based authentication via Supabase
- **SQL Injection Protection**: Parameterized queries throughout
- **Organization Scoping**: All queries enforce organization_id filtering
- **Performance**: Average response times under 200ms for analytics queries

### User Experience
- **Responsive Design**: Mobile-optimized interface with touch-friendly interactions
- **Loading States**: Skeleton loaders and progress indicators throughout
- **Error Handling**: Graceful error messages and retry logic
- **Organization Switching**: Seamless multi-organization management for users
- **Accessibility**: ARIA labels and keyboard navigation support

## Documentation

### Getting Started
- [Quick Start Guide](./QUICK_START.md) - Get up and running in 15 minutes
- [Setup Guide](./SETUP_GUIDE.md) - Detailed installation and configuration
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment instructions

### Operations
- [Security Guide](./SECURITY_GUIDE.md) - Security best practices and hardening
- [Launch Checklist](./LAUNCH_CHECKLIST.md) - Pre-launch verification steps
- [Testing Guide](./TESTING_GUIDE.md) - Comprehensive testing procedures

### Reports & Analysis
- [Day 14 Completion Report](./DAY14_COMPLETE.md) - Final testing results (16/16 tests passed)
- [Analytics Verification](./ANALYTICS_VERIFICATION_REPORT.md) - Dashboard data verification
- [Deployment Ready](./DEPLOYMENT_READY.md) - Production readiness assessment
- [Product Audit](./audit/VISUAL_AUDIT_SUMMARY.md) - UX/UI analysis and improvements

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router, React Server Components)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **State Management**: React Context API
- **Authentication**: Supabase Auth (client-side)
- **API Client**: Custom fetch wrapper with JWT handling

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Database**: PostgreSQL (via Supabase)
- **Vector Store**: FAISS (Facebook AI Similarity Search)
- **AI/ML**: Google Generative AI (text-embedding-004, gemini-1.5-flash)
- **Authentication**: JWT verification with Supabase
- **ORM**: Raw SQL with asyncpg (connection pooling)

### Infrastructure
- **Deployment**: Railway (backend), Vercel (frontend)
- **Database**: Supabase (managed PostgreSQL)
- **File Storage**: Supabase Storage (optional)
- **Monitoring**: Built-in logging and health checks

## Project Structure

```
ticketpilot/
├── frontend/                           # Next.js application
│   ├── src/
│   │   ├── app/                       # App Router pages
│   │   │   ├── (public)/              # Public routes (login, signup)
│   │   │   ├── (protected)/           # Protected routes (dashboard, tickets, etc.)
│   │   │   │   ├── dashboard/         # Admin/Rep dashboards
│   │   │   │   ├── tickets/           # Ticket management
│   │   │   │   ├── rep/               # Rep console (AI assistance)
│   │   │   │   ├── kb/                # Knowledge base management
│   │   │   │   ├── admin/             # Admin analytics
│   │   │   │   └── organizations/     # Organization management
│   │   │   └── layout.tsx
│   │   ├── components/                # React components
│   │   │   ├── ui/                    # Base UI components
│   │   │   ├── rep/                   # Rep-specific components
│   │   │   └── skeletons/             # Loading states
│   │   ├── contexts/                  # React contexts (Organization, etc.)
│   │   └── lib/
│   │       ├── supabaseClient.ts      # Supabase client
│   │       ├── api-client.ts          # API wrapper with auth
│   │       └── utils.ts
│   └── .env.local.example
│
├── backend/                            # FastAPI application
│   ├── app/
│   │   ├── main.py                    # Application entry point
│   │   ├── auth.py                    # JWT auth & user management
│   │   ├── tickets.py                 # Ticket CRUD operations
│   │   ├── rep.py                     # Rep console endpoints
│   │   ├── admin.py                   # Admin analytics & management
│   │   ├── kb.py                      # Knowledge base routes
│   │   ├── organizations.py           # Multi-tenant organization management
│   │   ├── feedback.py                # AI feedback collection
│   │   ├── security.py                # Security middleware & rate limiting
│   │   ├── org_middleware.py          # Organization context extraction
│   │   ├── error_handlers.py          # Global error handling
│   │   ├── embeddings.py              # Google embeddings API
│   │   ├── chunker.py                 # Document chunking
│   │   ├── store.py                   # FAISS vector store
│   │   └── utils.py                   # Utilities
│   ├── migrations/                    # SQL migration scripts
│   │   ├── 0001_user_roles.sql
│   │   ├── 0002_kb.sql
│   │   ├── 0003_tickets.sql
│   │   ├── 0004_messages.sql
│   │   ├── 0005_feedback.sql
│   │   ├── 0006_rag_requests.sql
│   │   ├── 0007_organizations.sql
│   │   ├── 0008_add_organization_id.sql
│   │   ├── 0009_migrate_existing_data.sql
│   │   └── 0010_enable_rls.sql
│   ├── data/                          # Runtime data (gitignored)
│   │   ├── faiss/                     # FAISS indices per organization
│   │   └── maps/                      # Chunk-to-vector mappings
│   ├── requirements.txt
│   └── .env.example
│
├── docs/                               # Documentation
│   ├── SECURITY_GUIDE.md
│   ├── DEPLOYMENT.md
│   └── TESTING_GUIDE.md
│
└── tests/                              # Test suites
    ├── day14_final_testing.py         # Comprehensive test suite
    ├── verify_analytics.py            # Analytics verification
    └── test_multi_org_security.py     # Multi-tenant security tests
```

## Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- Python 3.10+
- Supabase account (free tier works)
- Google AI API key

### 1. Clone and Setup Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run all migrations in `backend/migrations/` in your SQL editor (in order)
3. Note your Supabase URL, anon key, and JWT secret

### 2. Get API Keys

- **Google AI**: Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### 3. Configure Environment

**Backend** (`backend/.env`):
```bash
cp backend/.env.example backend/.env
# Edit and fill in:
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret
DATABASE_URL=your_postgres_connection_string
GOOGLE_API_KEY=your_google_api_key
ENVIRONMENT=development
```

**Frontend** (`frontend/.env.local`):
```bash
cp frontend/.env.local.example frontend/.env.local
# Edit and fill in:
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Install Dependencies

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
pnpm install
```

### 5. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
pnpm dev
```

Visit `http://localhost:3000` and create an account to get started!

For detailed setup instructions, see [SETUP_GUIDE.md](./SETUP_GUIDE.md).

---

## API Endpoints

### Health & User
- `GET /api/health` - System health check (public)
- `GET /api/me` - Get current authenticated user

### Authentication & Organizations
- `POST /api/organizations` - Create new organization
- `GET /api/organizations` - List user's organizations
- `POST /api/organizations/{id}/members` - Add organization member

### Tickets
- `GET /api/tickets` - List tickets (organization-scoped)
- `POST /api/tickets` - Create new ticket
- `GET /api/tickets/{id}` - Get ticket details
- `PATCH /api/tickets/{id}` - Update ticket
- `GET /api/tickets/{id}/messages` - Get ticket messages
- `POST /api/tickets/{id}/messages` - Add message to ticket

### Knowledge Base
- `POST /api/kb/ingest` - Ingest documents (admin/rep only)
- `GET /api/kb/documents` - List documents
- `GET /api/kb/stats` - Get KB statistics
- `GET /api/kb/search` - Search knowledge base

### Rep Console
- `GET /api/rep/counts` - Get ticket counts for rep
- `GET /api/rep/tickets` - Get rep's assigned tickets
- `POST /api/rep/ai-response` - Get AI-powered response suggestion

### Admin Analytics
- `GET /api/admin/analytics/summary` - Overall analytics summary
- `GET /api/admin/analytics/by-category` - Tickets by status/priority
- `GET /api/admin/analytics/rep-performance` - Rep performance metrics
- `GET /api/admin/analytics/rag` - RAG usage analytics

### Feedback
- `POST /api/feedback` - Submit AI response feedback

All protected endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

## Testing

### Automated Test Suites

**Comprehensive Final Tests** (16 tests):
```bash
python day14_final_testing.py
```

**Analytics Verification** (7 tests):
```bash
python verify_analytics.py
```

**Multi-Tenant Security Tests**:
```bash
python test_multi_org_security.py
```

### Manual Testing

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for detailed testing procedures including:
- User role testing
- Multi-organization isolation
- Knowledge base ingestion
- AI response generation
- Analytics verification

---

## Deployment

### Production Checklist

Before deploying to production:

1. **Security**
   - [ ] Rotate all secrets (JWT, database password, API keys)
   - [ ] Set `ENVIRONMENT=production` in backend
   - [ ] Configure production CORS origins
   - [ ] Enable rate limiting
   - [ ] Verify no secrets in git history

2. **Database**
   - [ ] Run all migrations
   - [ ] Set up automated backups
   - [ ] Configure connection pooling

3. **Monitoring**
   - [ ] Set up error tracking (Sentry, etc.)
   - [ ] Configure health check monitoring
   - [ ] Set up log aggregation

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) for complete deployment guides.

### Recommended Platforms

- **Backend**: Railway or Render (see `railway.toml` and `render.yaml`)
- **Frontend**: Vercel (see `vercel.json`)
- **Database**: Supabase (managed PostgreSQL)

---

## Development Status

### Completed Phases

**Phase 1 - Foundation & Auth** ✓
- User authentication (Supabase)
- Protected routes
- JWT verification
- User roles (admin, rep, customer)

**Phase 2 - Multi-Tenancy** ✓
- Organization management
- Multi-tenant data isolation
- Organization-scoped queries
- User-organization relationships

**Phase 3 - Core Ticketing** ✓
- Ticket CRUD operations
- Message threads
- Status & priority management
- Assignment system

**Phase 4 - Knowledge Base & RAG** ✓
- Document ingestion (PDF, TXT, MD, DOCX)
- Text chunking with overlap
- FAISS vector search
- Google embeddings integration
- RAG-powered AI responses

**Phase 5 - Rep Console & Analytics** ✓
- Rep dashboard with queue management
- AI assistance integration
- Admin analytics dashboards
- Performance metrics
- Feedback collection

**Security Hardening** ✓
- Security headers middleware
- Rate limiting (IP-based)
- Organization context enforcement
- Input validation
- Comprehensive testing (100% pass rate)

### Test Results

- **Day 14 Final Tests**: 16/16 passed (100%)
- **Analytics Verification**: 7/7 passed (100%)
- **Security Tests**: All organization isolation verified
- **Performance**: Average response times <200ms

---

## Contributing

This is a portfolio/demonstration project. Feel free to fork and adapt for your own use.

### Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and test thoroughly
3. Update documentation as needed
4. Commit with descriptive messages
5. Push and create pull request

### Code Standards

- **Backend**: Follow PEP 8, use type hints
- **Frontend**: TypeScript strict mode, ESLint compliant
- **Testing**: Maintain 100% pass rate on test suites
- **Security**: All new endpoints must enforce organization scoping

---

## License

[MIT License](LICENSE) - feel free to use this project for learning or as a starting point for your own applications.

---

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) - React framework
- [FastAPI](https://fastapi.tiangolo.com/) - Python web framework
- [Supabase](https://supabase.com/) - Backend-as-a-Service
- [Google AI](https://ai.google.dev/) - Generative AI and embeddings
- [FAISS](https://github.com/facebookresearch/faiss) - Vector similarity search
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Radix UI](https://www.radix-ui.com/) - Headless UI components

---

## Support & Contact

For questions, issues, or feature requests, please open an issue on GitHub.

**Project Status**: Production-ready, actively maintained

**Last Updated**: October 2025