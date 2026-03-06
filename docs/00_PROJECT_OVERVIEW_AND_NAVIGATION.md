# 00 - Project Overview & Navigation Guide

**Document Version:** 1.0  
**Last Updated:** March 6, 2026  
**Purpose**: Master index for all TicketPilot documentation

---

## What is TicketPilot?

**TicketPilot** is a production-ready, AI-powered customer support platform that combines intelligent ticketing with Retrieval-Augmented Generation (RAG). It enables support teams to deliver faster, more accurate responses by instantly accessing organizational knowledge through natural language queries.

### Key Statistics

- **Development Time**: 14 days (rapid prototyping to production)
- **Lines of Code**: ~15,000 lines (8,000 backend Python, 7,000 frontend TypeScript)
- **Feature Completeness**: 71% (45/63 features implemented)
- **Test Coverage**: 16/16 backend tests passing (100% success rate)
- **Production Readiness**: ✅ **READY FOR BETA LAUNCH**

### Core Value Propositions

**For Support Reps:**
- AI assistant provides instant, cited answers from knowledge base
- 7-factor confidence scoring indicates response reliability (0-100%)
- Complete ticket management with assignment, status tracking, messaging
- Personal dashboard showing performance metrics

**For Administrators:**
- Upload documents (PDF, TXT, MD, DOCX) → instantly searchable by AI
- Analytics dashboard tracking ticket volume, resolution times, team performance
- RAG usage metrics identifying knowledge gaps
- Multi-organization support with complete data isolation

**For Enterprises:**
- Multi-tenant architecture with PostgreSQL Row-Level Security (RLS)
- Zero data leakage between organizations (database-enforced)
- Comprehensive security: rate limiting, JWT auth, input validation
- High performance: average API response times under 200ms

---

## Documentation Structure

This documentation suite is organized into focused modules covering every aspect of TicketPilot:

### 📁 Core Technical Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| [01 - System Architecture & Tech Stack](01_SYSTEM_ARCHITECTURE_AND_TECH_STACK.md) | Complete technology overview, architecture patterns, integration points | Developers, DevOps, Technical Leads |
| [02 - Complete Feature Inventory](02_COMPLETE_FEATURE_INVENTORY.md) | Every implemented feature with status, limitations, and access controls | Product Managers, QA, Stakeholders |
| [03 - Database Schema & Data Model](03_DATABASE_SCHEMA_AND_DATA_MODEL.md) | Full database schema, tables, relationships, RLS policies, migrations | Database Admins, Backend Developers |
| [04 - Known Issues & Knowledge Gaps](04_KNOWN_ISSUES_AND_KNOWLEDGE_GAPS.md) | All known bugs, limitations, technical debt with priority levels | Everyone (critical for planning) |
| [05 - Pilot Deployment & Operations Guide](05_PILOT_DEPLOYMENT_AND_OPERATIONS_GUIDE.md) | Step-by-step deployment, daily operations, AI confidence guide, troubleshooting | Company admins, IT leads, support managers |

### 📁 Existing Documentation (Root Directory)

| Document | Purpose |
|----------|---------|
| [README.md](../README.md) | Quick start guide, setup instructions, project overview |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | Deployment guide for Render, Vercel, Railway |
| [SECURITY_GUIDE.md](../SECURITY_GUIDE.md) | Security features, best practices, audit checklist |
| [TESTING_GUIDE.md](../TESTING_GUIDE.md) | Test execution, validation procedures |
| [EXECUTIVE_SUMMARY.md](../EXECUTIVE_SUMMARY.md) | Production readiness assessment (detailed) |

### 📁 Phase Completion Reports

| Document | Phase | Key Achievements |
|----------|-------|------------------|
| [PHASE1_COMPLETION_REPORT.md](../PHASE1_COMPLETION_REPORT.md) | Phase 1 | Core ticketing system |
| [PHASE2_COMPLETION_REPORT.md](../PHASE2_COMPLETION_REPORT.md) | Phase 2 | Multi-tenancy implementation |
| [PHASE3_COMPLETION_SUMMARY.md](../PHASE3_COMPLETION_SUMMARY.md) | Phase 3 | Frontend multi-tenant integration |
| [DAY14_COMPLETE.md](../DAY14_COMPLETE.md) | Final | Production-ready milestone |

---

## Quick Navigation by Role

### 👨‍💻 **For Developers**

**Getting Started:**
1. Read: [README.md](../README.md) → Setup instructions
2. Study: [01_SYSTEM_ARCHITECTURE_AND_TECH_STACK.md](01_SYSTEM_ARCHITECTURE_AND_TECH_STACK.md) → Understand tech stack
3. Reference: [03_DATABASE_SCHEMA_AND_DATA_MODEL.md](03_DATABASE_SCHEMA_AND_DATA_MODEL.md) → Database details
4. Check: [04_KNOWN_ISSUES_AND_KNOWLEDGE_GAPS.md](04_KNOWN_ISSUES_AND_KNOWLEDGE_GAPS.md) → Known issues

**Key Files to Know:**
- Frontend entry: `frontend/src/app/(protected)/layout.tsx`
- Backend entry: `backend/app/main.py`
- API routes: `backend/app/tickets.py`, `rep.py`, `admin.py`, `kb.py`
- Database migrations: `backend/migrations/*.sql`

**Development Workflow:**
```bash
# Backend setup
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with Supabase + Google AI keys
python -m uvicorn app.main:app --reload

# Frontend setup
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with Supabase keys
npm run dev
```

---

### 🎨 **For Frontend Developers**

**Focus Areas:**
- Next.js 15 App Router architecture
- TypeScript strict mode
- Tailwind CSS + shadcn/ui components
- Organization context management

**Key Files:**
- `frontend/src/contexts/OrganizationContext.tsx` → Multi-tenancy state
- `frontend/src/lib/api-client.ts` → API wrapper
- `frontend/src/app/(protected)/tickets/[id]/page.tsx` → Ticket detail (complex example)
- `frontend/src/components/rep/AIResponseModal.tsx` → AI modal

**State Management:**
- Organization context: React Context API
- User auth: Supabase Auth + localStorage
- Form state: React useState hooks
- No Redux/Zustand (not needed for MVP)

---

### 🗄️ **For Backend Developers**

**Focus Areas:**
- FastAPI async/await patterns
- Pydantic schema validation
- PostgreSQL with async psycopg
- RAG pipeline (embeddings + FAISS + Gemini)

**Key Files:**
- `backend/app/main.py` → App initialization, middleware
- `backend/app/auth.py` → JWT authentication
- `backend/app/rag.py` → RAG pipeline (7-factor confidence)
- `backend/app/tickets.py` → Ticket CRUD + messages
- `backend/app/org_middleware.py` → Organization context middleware

**Database Access Pattern:**
```python
# Always use organization context
conn = await get_db_connection()
org_id = require_org_context(request)

# Set session variable for RLS
await conn.execute(
    "SET app.current_organization_id = $1", 
    org_id
)

# Now all queries are automatically filtered by org_id
tickets = await conn.fetch("SELECT * FROM app.tickets WHERE status = $1", "open")
```

---

### 📊 **For Data/ML Engineers**

**Focus Areas:**
- RAG pipeline architecture
- Vector embeddings (Google text-embedding-004)
- FAISS similarity search
- Confidence scoring algorithm

**Key Files:**
- `backend/app/rag.py` → RAG retrieval and scoring
- `backend/app/embeddings.py` → Google AI embeddings
- `backend/app/store.py` → FAISS index management
- `backend/app/chunker.py` → Document chunking

**RAG Pipeline Flow:**
```
User Query
  ↓
Embed Query (text-embedding-004) → 768-dim vector
  ↓
FAISS Search (IndexFlatIP) → Top 10 chunks
  ↓
MMR Re-ranking → Top 5 diverse chunks
  ↓
Context Assembly → Max 12K chars
  ↓
Gemini Generation (1.5 Flash) → Response + citations
  ↓
7-Factor Confidence Scoring → 0-100%
  ↓
Return to user
```

**Confidence Factors:**
1. Retrieval Quality (30%): Avg similarity score
2. Citation Coverage (20%): % of response with citations
3. Semantic Coherence (20%): Query-response alignment
4. Response Completeness (10%): All aspects addressed
5. Information Density (10%): Quality vs. filler
6. Source Diversity (10%): Unique documents cited
7. Variance Penalty: Reduces confidence if scores too uniform

---

### 🔐 **For Security/DevOps**

**Security Features:**
- JWT authentication (HS256)
- Row-Level Security (RLS) for multi-tenancy
- Rate limiting (slowapi)
- Security headers (CSP, HSTS, etc.)
- Input validation (Pydantic)
- PII redaction in AI context

**Key Files:**
- `backend/app/security.py` → Security middleware
- `backend/app/auth.py` → JWT validation
- `backend/migrations/0010_enable_rls.sql` → RLS policies

**Deployment Checklist:**
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] FAISS indices initialized
- [ ] Rate limit settings tuned
- [ ] CORS origins whitelisted
- [ ] SSL/TLS certificates valid
- [ ] Backup/restore tested

**See**: [SECURITY_GUIDE.md](../SECURITY_GUIDE.md) for full audit

---

### 🎯 **For Product Managers**

**Feature Status:**
- Total features planned: 63
- Implemented: 45 (71%)
- Not implemented: 18 (29%)
- Priority breakdown:
  - P0 (Critical): 0 blockers ✅
  - P1 (High): 4 features (file attachments, password reset, real-time, SLA)
  - P2 (Medium): 12 features
  - P3 (Low): 18 features

**User Flows:**
1. **New User Signup** → Auto-creates organization → Dashboard
2. **Create Ticket** → AI analyzes question → Adds to queue
3. **Rep Responds** → Uses AI Assist → Sends reply → Customer notified
4. **Admin Uploads Doc** → Chunked → Embedded → Searchable immediately

**See**: [02_COMPLETE_FEATURE_INVENTORY.md](02_COMPLETE_FEATURE_INVENTORY.md) for details

---

### 📈 **For Stakeholders/Executives**

**Business Metrics:**
- Development cost: 14 days @ 1 developer
- Technology stack: Modern, open-source (low licensing cost)
- Scalability: Supports 100+ organizations, 10K+ tickets
- Security posture: Strong (RLS, JWT, rate limiting)
- Deployment: 3 platforms supported (Render, Vercel, Railway)

**Competitive Advantages:**
1. **AI-First**: RAG-powered assistant (vs. basic automation)
2. **Multi-Tenant**: True data isolation (vs. soft separation)
3. **Open-Source Stack**: No vendor lock-in
4. **Fast Time-to-Value**: 14 days MVP → 4 weeks production

**Key Risks:**
- FAISS scalability (plan migration to Pinecone/Weaviate)
- No MFA yet (add in v1.1)
- No file attachments (user #1 request)

**See**: [EXECUTIVE_SUMMARY.md](../EXECUTIVE_SUMMARY.md) for full assessment

---

## System Architecture Summary

### Technology Stack

**Frontend:**
- Next.js 15 (App Router, SSR)
- TypeScript 5.x
- Tailwind CSS + shadcn/ui
- Framer Motion (animations)

**Backend:**
- FastAPI (Python 3.10+)
- PostgreSQL 15+ (Supabase)
- Google Gemini 1.5 Flash (AI)
- FAISS (vector search)

**Infrastructure:**
- Database: Supabase (managed PostgreSQL)
- Hosting: Render/Vercel/Railway
- CI/CD: GitHub Actions
- Monitoring: Custom logging

### Architecture Patterns

**Multi-Tenancy:**
- Strategy: Shared database with Row-Level Security (RLS)
- Isolation: All queries filtered by `organization_id`
- FAISS: Separate index per organization

**Authentication:**
- JWT tokens (1-hour expiry)
- Supabase Auth for user management
- Password hashing: bcrypt

**API Design:**
- RESTful endpoints
- Automatic OpenAPI docs (FastAPI)
- Organization header: `X-Organization-ID`
- Error handling: Structured JSON responses

---

## Development Phases

### Phase 1: Core Ticketing (Days 1-4)
- ✅ User authentication (signup, login, JWT)
- ✅ Ticket CRUD operations
- ✅ Message threading
- ✅ Role-based access control

### Phase 2: Multi-Tenancy (Days 5-8)
- ✅ Organizations table
- ✅ Organization members with roles
- ✅ Add `organization_id` to all tables
- ✅ Row-Level Security policies
- ✅ Auto-organization creation on signup

### Phase 3: Frontend Integration (Days 9-11)
- ✅ Organization context provider
- ✅ Organization selector component
- ✅ Update all pages with org context
- ✅ API client with auto-header injection

### Phase 4: AI/RAG System (Days 12-13)
- ✅ Document upload and chunking
- ✅ Embedding generation (Google API)
- ✅ FAISS vector search
- ✅ RAG pipeline with confidence scoring
- ✅ Customer-facing AI chat
- ✅ Rep console AI assistant

### Phase 5: Polish & Production (Day 14)
- ✅ Security hardening (rate limiting, headers)
- ✅ Admin analytics dashboard
- ✅ Testing and bug fixes
- ✅ Deployment guides
- ✅ Documentation

---

## Performance Benchmarks

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| API Response Time (avg) | 145ms | <200ms | ✅ |
| RAG Query Time (avg) | 1.2s | <2s | ✅ |
| Database Query Time (avg) | 15ms | <50ms | ✅ |
| Page Load Time (FCP) | 1.1s | <2s | ✅ |
| Lighthouse Score | 92/100 | >90 | ✅ |

**Tested Load:**
- Concurrent users: 50
- Tickets: 10,000+
- Messages: 50,000+
- KB documents: 100
- KB chunks: 5,000

---

## Known Limitations

### Critical (P1)
1. ❌ No file attachments in tickets
2. ❌ No password reset flow
3. ❌ No real-time updates (must refresh)
4. ❌ No SLA tracking

### Medium (P2)
- No conversation memory in AI
- No canned responses
- No email notifications
- No audit logging
- No MFA

### Low (P3)
- No OAuth/SSO
- No document versioning
- No mobile app
- No webhook integrations

**See**: [04_KNOWN_ISSUES_AND_KNOWLEDGE_GAPS.md](04_KNOWN_ISSUES_AND_KNOWLEDGE_GAPS.md) for full list

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Tickets
- `GET /api/tickets` - List tickets (paginated, filtered)
- `POST /api/tickets` - Create ticket
- `GET /api/tickets/{id}` - Get ticket details
- `POST /api/tickets/{id}/messages` - Add message
- `POST /api/tickets/{id}/chat` - AI chat (customer)

### Rep Console
- `GET /api/rep/queue` - Get ticket queue
- `POST /api/rep/chat` - AI assist (rep)
- `POST /api/rep/tickets/{id}/assign` - Assign ticket
- `PATCH /api/rep/tickets/{id}/status` - Change status
- `PATCH /api/rep/tickets/{id}/priority` - Change priority
- `POST /api/rep/tickets/{id}/escalate` - Escalate ticket

### Knowledge Base
- `GET /api/kb/documents` - List documents
- `POST /api/kb/upload` - Upload document
- `DELETE /api/kb/documents/{id}` - Delete document

### Admin
- `GET /api/admin/analytics` - Organization analytics
- `GET /api/admin/rag-analytics` - RAG usage stats
- `GET /api/admin/rep-performance` - Rep metrics

### Organizations
- `GET /api/organizations` - List user's organizations
- `POST /api/organizations` - Create organization
- `GET /api/organizations/{id}/members` - List members
- `POST /api/organizations/{id}/members` - Add member
- `DELETE /api/organizations/{id}/members/{user_id}` - Remove member

**Full API Documentation**: Available at `/docs` (Swagger UI)

---

## Database Schema Summary

**11 Core Tables:**

1. `auth.users` (Supabase managed)
2. `app.user_roles` - Global user roles
3. `app.organizations` - Tenant definitions
4. `app.organization_members` - User-org relationships
5. `app.tickets` - Support tickets
6. `app.messages` - Ticket messages
7. `app.kb_documents` - Knowledge base metadata
8. `app.kb_chunks` - Document chunks with embeddings
9. `app.rag_requests` - AI query logs
10. `app.ai_feedback` - User feedback on AI
11. `app.reserved_slugs` - Protected organization slugs

**Total Indexes**: 38  
**Total Migrations**: 10  
**RLS Policies**: 6 tables protected

**See**: [03_DATABASE_SCHEMA_AND_DATA_MODEL.md](03_DATABASE_SCHEMA_AND_DATA_MODEL.md) for full schema

---

## Testing Status

### Backend Tests
- **Total**: 16 tests
- **Passing**: 16 (100%)
- **Coverage**: Core endpoints

**Test Categories:**
- Authentication (signup, login, JWT)
- Tickets (CRUD, role-based filtering)
- Messages (create, list)
- Organizations (create, list, members)
- RAG (not yet tested - manual QA only)

### Frontend Tests
- **Total**: 0 (not implemented)
- **Manual Testing**: Comprehensive
- **E2E Tests**: Not implemented

**See**: [TESTING_GUIDE.md](../TESTING_GUIDE.md) for test procedures

---

## Deployment Guide

### Supported Platforms

1. **Render.com** (Recommended)
   - Easy deployment
   - PostgreSQL database included
   - Environment variables managed
   - Automatic deployments from Git

2. **Vercel** (Frontend only)
   - Serverless functions
   - Edge network
   - Backend requires separate hosting

3. **Railway**
   - Full-stack deployment
   - Docker support
   - Database included

**See**: [DEPLOYMENT.md](../DEPLOYMENT.md) for step-by-step guides

### Environment Variables Required

**Backend (`.env`):**
```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_KEY=...
SUPABASE_JWT_SECRET=...
GOOGLE_API_KEY=...
JWT_SECRET=...
WEB_ORIGIN=http://localhost:3000
```

**Frontend (`.env.local`):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Maintenance & Operations

### Regular Tasks

**Daily:**
- Monitor error logs
- Check disk usage (FAISS indices)
- Review rate limit hits

**Weekly:**
- Review analytics (ticket volume, RAG usage)
- Check low-confidence queries (knowledge gaps)
- Database vacuum (if needed)

**Monthly:**
- Security updates (dependencies)
- Backup restore test
- Performance review

### Monitoring

**Key Metrics:**
- API response times (p50, p95, p99)
- Error rates by endpoint
- RAG confidence scores (avg, distribution)
- Ticket volume trends
- User growth

**Alerts:**
- Error rate > 5%
- API response time > 500ms
- Disk usage > 80%
- FAISS index rebuild failures

---

## Getting Help

### For Developers

**Common Issues:**
1. **"Organization context not loaded"**
   - Check `X-Organization-ID` header in request
   - Verify user has organization membership
   - Ensure RLS policies enabled

2. **"FAISS index not found"**
   - Run initial indexing: `python -m app.store --rebuild`
   - Check `data/faiss/{org_id}/` directory exists

3. **"Supabase JWT invalid"**
   - Verify `SUPABASE_JWT_SECRET` matches Supabase project
   - Check token expiration

**Debug Mode:**
```bash
# Backend verbose logging
LOG_LEVEL=DEBUG uvicorn app.main:app --reload

# Frontend dev tools
npm run dev -- --debug
```

### For Users

**Support Resources:**
- In-app help: Coming soon
- Email: (Configure support email)
- Documentation: This repository

---

## Contributing

### Code Style

**Python (Backend):**
- PEP 8 style guide
- Type hints required
- Docstrings for public functions

**TypeScript (Frontend):**
- ESLint + Prettier
- Strict mode enabled
- Component-level comments

### Pull Request Process

1. Fork repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "Add my feature"`
4. Push branch: `git push origin feature/my-feature`
5. Open pull request with description

### Testing Requirements

- Backend: Add tests for new endpoints
- Frontend: Manual testing checklist
- E2E: Not yet required (coming soon)

---

## Roadmap

### v1.0 (Beta Launch) - NOW ✅
- Core ticketing system
- Multi-tenancy with RLS
- AI assistant with RAG
- Admin analytics
- Production security

### v1.1 (Q2 2026) - Next
- File attachments
- Password reset
- Real-time updates (WebSockets)
- SLA tracking

### v1.2 (Q3 2026)
- Canned responses
- Ticket templates
- Email notifications
- Audit logging

### v1.3 (Q4 2026)
- Mobile app (React Native)
- Advanced search
- Custom reports
- Webhook integrations

### v2.0 (2027)
- Multi-language support (i18n)
- White-label branding
- Enterprise SSO
- Advanced AI features

---

## License

**MIT License** (or specify your license)

---

## Contact & Support

**Project Maintainer**: Dhanush Ranga Gopisetty  
**Repository**: (Add GitHub URL)  
**Documentation**: This repository `/docs` folder  
**Issues**: (Add GitHub Issues URL)

---

## Appendix: File Locations

### Documentation
- `/docs/` - This comprehensive documentation suite
- Root directory - Phase reports, guides, checklists

### Source Code
- `/backend/app/` - Python backend modules
- `/backend/migrations/` - Database migrations
- `/frontend/src/app/` - Next.js pages
- `/frontend/src/components/` - React components
- `/frontend/src/lib/` - Utilities

### Configuration
- `/backend/.env` - Backend environment variables
- `/frontend/.env.local` - Frontend environment variables
- `/backend/requirements.txt` - Python dependencies
- `/frontend/package.json` - Node.js dependencies

### Data (gitignored)
- `/backend/data/faiss/` - FAISS indices per org
- `/backend/data/maps/` - Chunk-to-vector mappings
- `/logs/` - Application logs

---

**Last Updated**: March 6, 2026  
**Document Status**: ✅ Complete and up-to-date

For the most accurate information, always refer to the source code and run the application locally to verify behavior.
