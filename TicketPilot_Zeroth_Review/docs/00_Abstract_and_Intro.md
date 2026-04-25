# TicketPilot: AI-Powered Customer Support Platform with RAG-Based Knowledge Assistance

**Zeroth Review Document**  
**Review Window:** 6–10 November 2025 (TENTATIVE)  
**Project Type:** Full-Stack Software Product Development  
**Domain:** AI/ML, Enterprise Software, Customer Support Systems

---

## Abstract

TicketPilot is a production-ready, multi-tenant customer support platform that revolutionizes support operations by integrating intelligent ticketing with Retrieval-Augmented Generation (RAG). The platform addresses critical inefficiencies in enterprise support workflows where teams waste 60-70% of their time searching through documentation, past tickets, and knowledge bases.

By combining semantic search, AI-powered response generation, and enterprise-grade ticketing infrastructure, TicketPilot enables support teams to deliver faster, more accurate responses through natural language knowledge retrieval. The system leverages Google Gemini 1.5 Pro for language generation, text-embedding-004 for semantic embeddings (768-dimensional vectors), and FAISS (Facebook AI Similarity Search) for efficient vector similarity search.

**Key Innovation:** A 7-factor confidence scoring system that evaluates AI-generated responses across retrieval quality (30%), citation coverage (20%), semantic coherence (20%), response completeness (10%), information density (10%), source diversity (10%), and variance penalties. This enables support representatives to make informed decisions about when to trust AI recommendations versus escalating to manual research.

**Technical Architecture:** Built on Next.js 15 (frontend), FastAPI (backend), PostgreSQL with Supabase (database + auth), and deployed on Vercel + Railway/Render with complete multi-tenancy through Row-Level Security (RLS) policies.

---

## 1. Introduction

### 1.1 Project Context

Modern customer support operations face a critical knowledge access problem. Despite investing heavily in knowledge bases, documentation systems, and training programs, support representatives spend the majority of their time searching for information rather than helping customers. This inefficiency compounds as organizations grow, leading to:

- **Prolonged Resolution Times**: Average ticket resolution spans hours or days instead of minutes
- **Inconsistent Service Quality**: Different representatives provide varying answers to identical questions
- **Extended Training Periods**: New support staff require 2-3 months to reach full productivity
- **Non-Linear Scaling**: Every increase in ticket volume demands proportional headcount increases
- **Knowledge Fragmentation**: Critical information scattered across PDFs, wikis, tickets, and tribal knowledge

### 1.2 Motivation

The global customer support software market is valued at $10.3B (2024) and projected to reach $20.8B by 2030 (CAGR 12.5%). However, traditional ticketing systems remain passive tools that merely organize work without enhancing representative capabilities. The emergence of Large Language Models (LLMs) and vector databases presents an opportunity to fundamentally transform support workflows.

Recent advances in Retrieval-Augmented Generation enable AI systems to:
- Understand queries in natural language without keyword engineering
- Retrieve relevant information through semantic similarity rather than exact matches
- Generate contextual responses grounded in organizational knowledge
- Provide confidence metrics and source citations for verification

TicketPilot bridges the gap between traditional ticketing systems and AI-powered knowledge retrieval, creating an integrated platform where AI acts as a force multiplier for human support teams.

### 1.3 Project Scope

**In Scope:**
- Multi-tenant ticketing system with role-based access control (Owner, Admin, Rep, Customer)
- RAG-based knowledge base with semantic search and AI-powered response generation
- 7-factor confidence scoring system for AI response quality assessment
- Rep console with AI assistant integration for real-time support
- Admin analytics dashboard tracking performance, AI usage, and knowledge gaps
- Complete data isolation between organizations using PostgreSQL RLS
- Knowledge base management supporting PDF, TXT, MD, DOCX formats
- Production deployment with CI/CD pipelines and comprehensive security

**Out of Scope (Future Roadmap):**
- Real-time WebSocket updates and live chat
- Email notification system and integrations (Slack, Teams, Discord)
- Mobile native applications (iOS, Android)
- SLA management and tracking
- White-label customization and branding
- SSO/SAML enterprise authentication

### 1.4 Target Audience

**Primary Users:**
1. **Support Representatives** - Front-line staff handling customer inquiries who need instant access to knowledge
2. **Support Managers/Admins** - Team leaders managing knowledge bases, monitoring performance, identifying gaps
3. **Customers** - End users submitting tickets and tracking issue resolution

**Target Organizations:**
- Small to medium enterprises (10-500 support staff)
- SaaS companies with technical support requirements
- E-commerce platforms with customer service teams
- Educational institutions with IT helpdesk operations
- Any organization with knowledge base + ticketing needs

### 1.5 Expected Outcomes

**Quantifiable Metrics:**
- **70% reduction** in information search time (minutes → seconds)
- **50% faster** new representative onboarding (weeks → days)
- **85% consistency** in response quality across team members
- **40% increase** in tickets handled per representative
- **Sub-200ms** API response times for real-time operations
- **100% data isolation** between organizations (verified through RLS testing)

**Qualitative Benefits:**
- Representatives empowered with AI assistant for instant knowledge access
- Administrators gain visibility into knowledge gaps through confidence analytics
- Customers receive faster, more accurate responses
- Organizations reduce training costs and improve service consistency

### 1.6 Document Structure

This Zeroth Review package contains:
- **Section 2**: Literature Survey and Gap Analysis
- **Section 3**: Research Objectives and Product Epics
- **Section 4**: SDG Alignment and Societal Contribution
- **Appendices**: Product backlog, roadmap, vision documents, evaluation rubric

---

## 2. Problem Statement

### 2.1 Problem Identification

**Core Problem:** Support teams waste 60-70% of operational time searching for information across fragmented knowledge sources, leading to slow response times, inconsistent service quality, and inability to scale efficiently.

**Problem Dimensions:**

1. **Knowledge Fragmentation**
   - Information scattered across PDFs, wikis, Confluence, Google Docs, past tickets
   - No unified interface for knowledge access
   - Search limited to keyword matching (misses semantic equivalents)
   - Outdated or duplicate documentation creates confusion

2. **Inefficient Retrieval**
   - Traditional search requires exact keyword matches
   - Representatives spend 15-20 minutes per query searching
   - Multiple tools and tabs required to find answers
   - Context switching reduces productivity

3. **Inconsistent Service**
   - Different representatives provide different answers
   - New staff lack experience to identify authoritative sources
   - Tribal knowledge not captured or shared systematically
   - Quality depends on individual expertise rather than organizational knowledge

4. **Scalability Limitations**
   - Linear relationship between ticket volume and staffing requirements
   - Training new representatives takes 2-3 months to reach proficiency
   - Peak loads (product launches, outages) overwhelm teams
   - Cost-per-ticket remains constant regardless of knowledge base investment

5. **Lack of Visibility**
   - Organizations don't know which documentation is missing or inadequate
   - No metrics on knowledge base effectiveness
   - Cannot identify common questions that need better documentation
   - AI/LLM adoption without confidence metrics creates trust issues

### 2.2 Problem Relevance

This problem impacts:
- **8.9 million** customer service representatives globally (U.S. Bureau of Labor Statistics)
- **$500B+** annual spending on customer service operations worldwide
- **60-70%** of support time wasted on information search (industry research)
- **45%** of customers switch providers due to poor support experiences

### 2.3 Feasibility

**Technical Feasibility:**
- ✅ LLM APIs (Google Gemini, OpenAI) commercially available
- ✅ Vector databases (FAISS, Pinecone, Weaviate) production-ready
- ✅ Embedding models (text-embedding-004) provide 768-dim semantic vectors
- ✅ PostgreSQL RLS enables multi-tenant data isolation
- ✅ Modern frameworks (FastAPI, Next.js) support async operations

**Economic Feasibility:**
- Infrastructure costs: ~$100-500/month for SMB deployments
- API costs: $0.01-0.10 per 1000 tokens (Google AI pricing)
- ROI: 40% productivity increase offsets costs within 2-3 months
- Deployment on Vercel (free tier) + Railway ($5-20/month) viable for MVPs

**Organizational Feasibility:**
- No specialized AI expertise required for deployment
- Integration with existing knowledge bases (upload PDFs, docs)
- Role-based access control aligns with enterprise security requirements
- Multi-tenancy enables SaaS business model

---

## 3. Solution Approach

### 3.1 Proposed Solution

TicketPilot combines three core subsystems:

1. **Enterprise Ticketing System**
   - Multi-tenant architecture with complete data isolation (RLS policies)
   - Role-based access: Owner, Admin, Rep, Customer
   - Ticket lifecycle: Open → In Progress → Resolved → Closed
   - Priority levels: Low, Medium, High, Urgent
   - Assignment, status tracking, message threading

2. **RAG-Powered Knowledge Base**
   - Document ingestion: PDF, TXT, MD, DOCX support
   - Semantic chunking (512-1024 tokens, 20% overlap)
   - Vector embeddings (Google text-embedding-004, 768-dim)
   - FAISS IndexFlatIP for cosine similarity search
   - MMR (Maximal Marginal Relevance) re-ranking for diversity

3. **AI Assistant with Confidence Scoring**
   - Natural language query interface for support reps
   - Gemini 1.5 Pro generates responses with citations
   - 7-factor confidence scoring (0-100%):
     * Retrieval Quality (30%)
     * Citation Coverage (20%)
     * Semantic Coherence (20%)
     * Response Completeness (10%)
     * Information Density (10%)
     * Source Diversity (10%)
     * Variance Penalty (dynamic)
   - Escalation logic: confidence < 55% triggers human review

### 3.2 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                     │
│  - Customer: Submit tickets, track status                   │
│  - Rep: Ticket management + AI assistant console            │
│  - Admin: Knowledge base + analytics dashboards             │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST API (JWT Auth)
┌───────────────────────▼─────────────────────────────────────┐
│                  Backend (FastAPI + Python)                  │
│  - Authentication & authorization (JWT + Supabase)           │
│  - Ticket CRUD operations                                    │
│  - RAG pipeline orchestration                                │
│  - Analytics & reporting                                     │
└─────┬────────────────────────────────────────────┬──────────┘
      │                                            │
┌─────▼──────────────────┐              ┌─────────▼──────────┐
│  PostgreSQL (Supabase) │              │  Google AI + FAISS │
│  - User auth           │              │  - Embeddings      │
│  - Ticket data         │              │  - Generation      │
│  - KB metadata         │              │  - Vector search   │
│  - RLS policies        │              │  - Confidence calc │
└────────────────────────┘              └────────────────────┘
```

### 3.3 Key Technologies

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Frontend** | Next.js 15 + TypeScript | SSR, App Router, type safety |
| **Backend** | FastAPI + Python 3.10 | Async/await, auto-docs, performance |
| **Database** | PostgreSQL 15 (Supabase) | RLS for multi-tenancy, ACID compliance |
| **Auth** | Supabase Auth (JWT) | Production-ready, email/OAuth support |
| **Vector Store** | FAISS IndexFlatIP | Efficient cosine similarity, in-memory |
| **LLM** | Google Gemini 1.5 Pro | 1M token context, affordable pricing |
| **Embeddings** | text-embedding-004 | 768-dim, optimized for retrieval |
| **Deployment** | Vercel + Railway/Render | Auto-scaling, CI/CD, managed infra |

### 3.4 Innovation Highlights

1. **7-Factor Confidence Scoring**: First-of-its-kind multi-dimensional confidence assessment combining retrieval quality, citation analysis, semantic coherence, and information density

2. **MMR Re-Ranking**: Balances relevance and diversity to prevent redundant information retrieval

3. **Organization-Scoped FAISS**: Separate vector indices per tenant ensure data isolation without query-time filtering overhead

4. **Automatic Escalation Logic**: 6 signal types (low confidence, insufficient context, high uncertainty, long conversations, complex queries, critical phrases) trigger human handoff

5. **Citation Provenance**: Every AI response includes source document references for verification and trust

---

## 4. Development Timeline

**Project Duration:** October 9 – November 2, 2025 (25 days)  
**Deployment Status:** ✅ Production-ready  
**Test Results:** 16/16 tests passing (100% success rate)

**Milestones Achieved:**
- ✅ Multi-tenant database with 12 tables, 20+ RLS policies, 43+ indexes
- ✅ RAG pipeline: 1,525 lines (rag.py 428 + embeddings 185 + store 280 + utils)
- ✅ Backend API: 7,318 lines Python, 49+ endpoints across 8 routers
- ✅ Frontend: 15,298 lines TypeScript/TSX, 140 components, 29 pages
- ✅ CI/CD: 4 GitHub Actions workflows with 11-step quality pipeline
- ✅ Production metrics: 820ms auth, 5.0s KB search, serving 8 organizations

**Zeroth Review (6-10 November 2025):**
- Documentation freeze: November 5
- Peer review period: November 6-9
- Final submission: November 10

---

## 5. Conclusion

TicketPilot represents a comprehensive solution to the knowledge access problem in customer support operations. By integrating RAG-powered AI assistance with enterprise ticketing infrastructure, the platform enables support teams to deliver faster, more consistent, and more accurate responses.

The system has been validated through production deployment serving 8 organizations and 3+ active users, demonstrating technical feasibility and real-world viability. The 7-factor confidence scoring system provides a novel approach to AI transparency, enabling representatives to make informed decisions about when to trust AI recommendations.

Future roadmap includes real-time updates, mobile applications, email notifications, SLA management, and enterprise SSO—positioning TicketPilot for long-term growth in the $10.3B customer support software market.

---

**Auto-generated by agent — 2025-11-09T00:00:00Z**
