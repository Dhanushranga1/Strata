# 🏗️ TicketPilot Architecture: Current vs. Production-Ready

## Current Architecture (MVP)

```
┌─────────────────────────────────────────────────────────┐
│                     USERS                                │
│                 (Single Company)                         │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                  NEXT.JS FRONTEND                        │
│              (localhost:3000 / Vercel)                   │
│  ┌─────────┐ ┌────────┐ ┌────────┐ ┌────────────────┐  │
│  │  Login  │ │Tickets │ │Rep     │ │Admin           │  │
│  │  Page   │ │Dashboard│ │Console │ │Dashboard       │  │
│  └─────────┘ └────────┘ └────────┘ └────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ API Calls (JWT Token)
                       │ No Rate Limiting ❌
                       │ CORS: Localhost only
┌──────────────────────▼──────────────────────────────────┐
│              FASTAPI BACKEND                             │
│          (localhost:8000 / Railway)                      │
│  ┌──────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │ Auth         │  │ Tickets    │  │ Admin          │  │
│  │ (Supabase JWT│  │ CRUD       │  │ Analytics      │  │
│  │  Weak Verify)│  └────────────┘  └────────────────┘  │
│  └──────────────┘                                        │
│  ┌──────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │ Knowledge    │  │ AI/RAG     │  │ Rep Queue      │  │
│  │ Base         │  │ (Gemini)   │  │ Management     │  │
│  └──────────────┘  └────────────┘  └────────────────┘  │
│                                                          │
│  Missing:                                                │
│  ❌ Rate Limiting                                        │
│  ❌ Input Validation                                     │
│  ❌ Error Handling                                       │
│  ❌ Monitoring/Logging                                   │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼─────┐ ┌──────▼──────┐ ┌────▼──────────┐
│  SUPABASE   │ │   GOOGLE    │ │   FAISS       │
│  PostgreSQL │ │   GEMINI    │ │ Vector Store  │
│             │ │   API       │ │ (Local Files) │
│ ❌ No Org   │ │             │ │               │
│    Isolation│ │ ❌ No Quota │ │ ❌ Not Synced │
│             │ │    Tracking │ │    with DB    │
└─────────────┘ └─────────────┘ └───────────────┘

Problems:
• Single tenant (all users see all data)
• No billing/subscriptions
• Security gaps (no rate limiting, weak validation)
• No monitoring (blind to errors and performance)
• No email notifications
• No real-time updates
```

---

## Production-Ready Architecture (Target)

```
┌──────────────────────────────────────────────────────────────────┐
│                        USERS (Multiple Companies)                 │
│   Company A        Company B        Company C                     │
│   ├─ Admins        ├─ Admins        ├─ Admins                    │
│   ├─ Reps          ├─ Reps          ├─ Reps                      │
│   └─ Customers     └─ Customers     └─ Customers                 │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                    NEXT.JS FRONTEND                               │
│                   (app.yourcompany.com)                           │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────────────────┐ │
│  │ Org Selector│ │ Onboarding   │ │ Billing Portal            │ │
│  │ (Dropdown)  │ │ Wizard       │ │ (Stripe Customer Portal)  │ │
│  └─────────────┘ └──────────────┘ └───────────────────────────┘ │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────────────────┐ │
│  │ Real-time   │ │ Notifications│ │ File Attachments          │ │
│  │ Updates     │ │ Center       │ │ (S3 Upload)               │ │
│  │ (WebSocket) │ │ (Unread Count│ └───────────────────────────┘ │
│  └─────────────┘ └──────────────┘                               │
│                                                                   │
│  ✅ Modern UI  ✅ Mobile Responsive  ✅ Accessible (WCAG 2.1 AA)│
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTPS/TLS
                           │ CDN (Cloudflare/Vercel)
                           │ Rate Limited (Per-User + Per-IP)
┌──────────────────────────▼───────────────────────────────────────┐
│                 LOAD BALANCER / API GATEWAY                       │
│  ✅ Rate Limiting (Redis)   ✅ DDoS Protection                   │
│  ✅ CORS Whitelist          ✅ Security Headers                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼───────┐  ┌───────▼───────┐  ┌──────▼──────┐
│  FASTAPI      │  │  FASTAPI      │  │  FASTAPI    │
│  Instance 1   │  │  Instance 2   │  │  Instance N │
│  (Auto-Scale) │  │  (Auto-Scale) │  │  (Scale=0-10│
└───────┬───────┘  └───────┬───────┘  └──────┬──────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│              FASTAPI BACKEND (Enhanced)                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Auth Middleware  │  │ Org Middleware   │  │ Rate Limiter   │ │
│  │ ✅ JWT Verify    │  │ ✅ Org Isolation │  │ ✅ Redis-based │ │
│  │ ✅ Session Mgmt  │  │ ✅ Permissions   │  └────────────────┘ │
│  └──────────────────┘  └──────────────────┘                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Input Validation │  │ Error Handling   │  │ Structured     │ │
│  │ ✅ Sanitization  │  │ ✅ Graceful      │  │ Logging        │ │
│  │ ✅ Max Lengths   │  │ ✅ User-Friendly │  │ ✅ JSON Format │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                   │
│  Core Modules:                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Organizations    │  │ Tickets (Multi-  │  │ Billing/Stripe │ │
│  │ - CRUD           │  │  Tenant)         │  │ - Subscriptions│ │
│  │ - Member Mgmt    │  │ - Org-Scoped     │  │ - Usage Track  │ │
│  │ - Invitations    │  │ - Assignments    │  │ - Webhooks     │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Knowledge Base   │  │ AI/RAG           │  │ Notifications  │ │
│  │ - Org-Scoped     │  │ - Org KB Only    │  │ - Email (Send- │ │
│  │ - Vector Store   │  │ - Usage Limits   │  │   Grid)        │ │
│  │ - File Storage   │  │ - Confidence     │  │ - In-App       │ │
│  │   (S3)           │  │   Thresholds     │  │ - Real-time    │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
└──────────────────────────┬───────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────────┐
        │                  │                      │
┌───────▼───────┐  ┌───────▼──────┐  ┌──────────▼─────────┐
│  SUPABASE     │  │   GOOGLE     │  │   AWS S3           │
│  PostgreSQL   │  │   GEMINI     │  │   File Storage     │
│  (Production) │  │   API        │  │                    │
│               │  │              │  │  ✅ Encrypted      │
│ ✅ org_id in  │  │ ✅ Quota     │  │  ✅ CDN (CloudFront│
│    all tables │  │    Tracking  │  │  ✅ Virus Scanning │
│ ✅ Row-Level  │  │ ✅ Fallback  │  └────────────────────┘
│    Security   │  │    Provider  │
│ ✅ Backups    │  └──────────────┘
│    (Daily)    │
│ ✅ Connection │
│    Pooling    │
└───────┬───────┘
        │
┌───────▼──────────────────────────────────────────────────┐
│           FAISS VECTOR STORE (Per-Org)                    │
│  org_abc_kb.index    org_def_kb.index    org_xyz_kb.index│
│  ✅ Isolated by org  ✅ Synced with DB   ✅ Cached       │
└───────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│               MONITORING & OBSERVABILITY                  │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Sentry  │  │ Datadog/ │  │ Papertrail│  │ PostHog  │ │
│  │ (Errors)│  │ New Relic│  │ (Logs)    │  │ (Analy-  │ │
│  │         │  │ (APM)    │  │           │  │  tics)   │ │
│  └─────────┘  └──────────┘  └──────────┘  └──────────┘ │
│                                                          │
│  ✅ Real-time Error Tracking                            │
│  ✅ Performance Monitoring (P50, P95, P99)              │
│  ✅ Uptime Monitoring                                   │
│  ✅ Alert Rules (Error rate >1%, Latency >1s)          │
│  ✅ On-Call Rotation (PagerDuty)                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                   CI/CD PIPELINE                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  GitHub  │→ │  Build & │→ │  Deploy  │→ │ Smoke   │ │
│  │  Actions │  │  Test    │  │ Staging  │  │ Tests   │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                      ↓                   │
│                            Manual Approval               │
│                                      ↓                   │
│                             ┌──────────────┐            │
│                             │ Deploy Prod  │            │
│                             │ (Blue/Green) │            │
│                             └──────────────┘            │
│  ✅ Automated Testing                                   │
│  ✅ Staging Environment                                 │
│  ✅ Rollback Capability                                 │
│  ✅ Zero-Downtime Deploys                               │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                    INTEGRATIONS                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Slack   │  │ SendGrid │  │  Stripe  │  │ Zapier  │ │
│  │ Notific- │  │  Email   │  │ Billing  │  │ Webhooks│ │
│  │  ations  │  │ Service  │  │ Service  │  │         │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└──────────────────────────────────────────────────────────┘

Key Improvements:
✅ Multi-tenant architecture (org_id everywhere)
✅ Scalable (auto-scaling, load balancing)
✅ Secure (rate limiting, input validation, HTTPS)
✅ Observable (monitoring, logging, alerting)
✅ Reliable (error handling, backups, HA database)
✅ Revenue-ready (Stripe integration, billing portal)
✅ Feature-complete (notifications, real-time, files)
```

---

## Data Model Comparison

### Current (MVP)
```sql
-- No organization concept
-- All data is shared

user_roles
  id
  email
  role (customer, rep, admin)

tickets
  id
  title
  description
  status
  priority
  customer_id
  rep_id
  -- ❌ No organization_id

documents
  id
  filename
  content
  uploaded_by
  -- ❌ No organization_id

chunks
  id
  document_id
  content
  embedding_index
  -- ❌ No organization_id
```

### Production-Ready (Target)
```sql
-- Multi-tenant with organization isolation

organizations
  id
  name
  slug (unique)
  domain (optional)
  stripe_customer_id
  subscription_status
  plan_id
  trial_ends_at
  settings (JSONB)
  created_at

organization_members
  organization_id (FK)
  user_id (FK)
  role (owner, admin, rep, member)
  joined_at
  -- Composite PK

user_roles
  id
  email
  role (for app-level permissions)

tickets
  id
  organization_id (FK) -- ✅ Added
  title
  description
  status
  priority
  customer_id
  rep_id
  created_at
  updated_at
  -- Index on (organization_id, created_at)

documents
  id
  organization_id (FK) -- ✅ Added
  filename
  content
  storage_url (S3)
  uploaded_by
  uploaded_at
  -- Index on (organization_id, uploaded_at)

chunks
  id
  organization_id (FK) -- ✅ Added
  document_id (FK)
  content
  embedding_index
  -- Index on (organization_id, document_id)

usage_tracking
  organization_id (FK)
  metric (tickets_created, ai_queries, etc.)
  count
  period_start
  period_end
  -- For billing and analytics
```

---

## API Endpoint Comparison

### Current (MVP)
```
28 endpoints, all single-tenant

Auth:
  GET  /api/me

Tickets:
  POST   /tickets
  GET    /tickets
  GET    /tickets/:id
  POST   /tickets/:id/messages
  POST   /tickets/:id/chat

Knowledge Base:
  POST   /kb/ingest
  GET    /kb/documents
  GET    /kb/stats
  GET    /kb/search

Rep Console:
  GET    /rep/queue
  GET    /rep/counts
  POST   /rep/tickets/:id/escalate
  POST   /rep/tickets/:id/status
  POST   /rep/tickets/:id/assign

Admin:
  GET    /admin/users
  POST   /admin/users/:id/role
  GET    /admin/analytics/summary

❌ No rate limiting
❌ No request logging
❌ No error handling standards
```

### Production-Ready (Target)
```
45+ endpoints, multi-tenant

Auth:
  GET    /api/me
  POST   /api/auth/refresh

Organizations:
  POST   /organizations                    -- ✅ New
  GET    /organizations                    -- ✅ New
  GET    /organizations/:id                -- ✅ New
  PATCH  /organizations/:id                -- ✅ New
  POST   /organizations/:id/members        -- ✅ New
  GET    /organizations/:id/members        -- ✅ New
  DELETE /organizations/:id/members/:uid   -- ✅ New

Tickets (all org-scoped):
  POST   /tickets
  GET    /tickets
  GET    /tickets/:id
  POST   /tickets/:id/messages
  POST   /tickets/:id/chat
  POST   /tickets/:id/attachments         -- ✅ New
  GET    /tickets/:id/attachments         -- ✅ New

Knowledge Base (org-scoped):
  POST   /kb/ingest
  GET    /kb/documents
  GET    /kb/stats
  GET    /kb/search
  DELETE /kb/documents/:id                -- ✅ New

Rep Console (org-scoped):
  GET    /rep/queue
  GET    /rep/counts
  POST   /rep/tickets/:id/escalate
  POST   /rep/tickets/:id/status
  POST   /rep/tickets/:id/assign
  POST   /rep/tickets/:id/acknowledge
  POST   /rep/tickets/:id/priority

Admin (org-scoped + app-level):
  GET    /admin/users
  POST   /admin/users/:id/role
  GET    /admin/analytics/summary
  GET    /admin/analytics/by-category
  GET    /admin/analytics/rep-performance
  GET    /admin/analytics/rag

Billing:
  POST   /billing/checkout                -- ✅ New
  POST   /billing/portal                  -- ✅ New
  GET    /billing/subscription            -- ✅ New
  POST   /billing/webhook                 -- ✅ New
  GET    /billing/usage                   -- ✅ New

Notifications:
  GET    /notifications                   -- ✅ New
  PATCH  /notifications/:id/read          -- ✅ New
  POST   /notifications/preferences       -- ✅ New

✅ Rate limiting (100 req/min per user)
✅ Request logging (method, path, status, duration)
✅ Structured error responses
✅ API documentation (OpenAPI/Swagger)
```

---

## Security Comparison

### Current (MVP)
```
❌ No rate limiting
   → API can be abused with unlimited requests

❌ Weak JWT verification
   → Not checking signature in development mode
   → Could be exploited

❌ Minimal input validation
   → No max length checks
   → XSS and SQL injection risks

❌ No CSRF protection
   → Vulnerable to cross-site request forgery

❌ Missing security headers
   → No CSP, X-Frame-Options, etc.

❌ CORS too permissive
   → Allows localhost and multiple origins

⚠️  HTTPS not enforced
   → Depends on deployment configuration
```

### Production-Ready (Target)
```
✅ Rate limiting (Redis-based)
   → Per-user: 100 req/min
   → Per-IP: 1000 req/min
   → Returns 429 with Retry-After header

✅ Strong JWT verification
   → Signature verification enabled
   → Token expiry checked
   → Refresh token rotation

✅ Comprehensive input validation
   → Max lengths enforced
   → Email/URL format validation
   → HTML sanitization
   → SQL parameterized queries

✅ CSRF protection
   → CSRF tokens for state-changing operations
   → SameSite cookie attribute

✅ Security headers
   → CSP: script-src 'self'
   → X-Frame-Options: DENY
   → X-Content-Type-Options: nosniff
   → Strict-Transport-Security

✅ CORS whitelist
   → Only production domains allowed
   → Credentials properly configured

✅ HTTPS enforced
   → TLS 1.3
   → HSTS headers
   → Automatic redirect from HTTP
```

---

## Monitoring Comparison

### Current (MVP)
```
❌ No error tracking
   → Errors happen silently
   → No way to know about issues

❌ No performance monitoring
   → Don't know API latency
   → Can't detect slow endpoints

❌ No logging infrastructure
   → print() statements
   → No log aggregation
   → Hard to debug production issues

❌ No uptime monitoring
   → Don't know when site is down
   → Users report issues before we know

❌ No usage analytics
   → Don't know who's using what
   → Can't make data-driven decisions
```

### Production-Ready (Target)
```
✅ Error tracking (Sentry)
   → Real-time error notifications
   → Stack traces with context
   → Error grouping and deduplication
   → Alerts when error rate >1%

✅ Performance monitoring (APM)
   → Track P50, P95, P99 latencies
   → Slow query detection
   → N+1 query detection
   → Alerts when P95 >1s

✅ Structured logging
   → JSON format
   → Log levels (DEBUG, INFO, ERROR)
   → Request logging (method, path, status, duration)
   → Log aggregation (Papertrail/Logtail)
   → 30-day retention

✅ Uptime monitoring
   → Ping production every 1 minute
   → Alert when down >5 minutes
   → Status page (status.yourapp.com)
   → Historical uptime data

✅ Usage analytics (PostHog)
   → User journeys
   → Feature adoption
   → Conversion funnels
   → Retention cohorts
   → A/B testing
```

---

## Cost Comparison

### Current (MVP) - Development
```
Hosting:
  • Vercel:     $0 (hobby tier)
  • Railway:    $5 (starter)
  • Supabase:   $0 (free tier)
  ---
  Total:        $5/month
```

### Production-Ready - Scale
```
Hosting:
  • Vercel:     $20 (pro)
  • Railway:    $50 (3 instances)
  • Supabase:   $25 (pro)
  • AWS S3:     $10 (1TB storage)

Monitoring:
  • Sentry:     $26 (team)
  • Datadog:    $0-100 (depends on usage)
  • Papertrail: $7 (1GB logs)

Communication:
  • SendGrid:   $15 (essentials)

Payments:
  • Stripe:     2.9% + 30¢ per transaction

Other:
  • Domain:     $12/year
  • SSL:        $0 (Let's Encrypt)
  ---
  Total:        $150-200/month

Break-even:
  • At $50/customer: 4 customers
  • At $100/customer: 2 customers
```

---

## Timeline Summary

```
Current State:           Production-Ready:
    MVP                   
     │                        │
     │  Phase 1              │
     │  (2-3 weeks)          │
     ├─ Security            │
     ├─ Monitoring          │
     └─ Testing            │
     │                      │
     │  Phase 2              │
     │  (4-6 weeks)          │
     ├─ Multi-Tenancy       │
     ├─ Org Management      │
     └─ Data Isolation     │
     │                      │
     │  Phase 3              │
     │  (3-4 weeks)          │
     ├─ Stripe              │
     ├─ Billing             │
     └─ Usage Limits       │
     │                      │
     ▼                      ▼
  
  9-13 weeks total
  (with 1 developer)
  
  5-7 weeks
  (with 2 developers)
```

---

## 🎯 Bottom Line

**You have a great MVP.** The core features work, the AI is impressive, the UI is modern.

**You're 40% to production.** You need multi-tenancy, billing, security, and monitoring.

**Timeline: 9-13 weeks.** With focused effort, you can launch a production-ready SaaS in 2-3 months.

**Recommendation: Pilot first.** Get 1-2 customers using the MVP (free), validate the market, then build for scale.

**You're closer than you think. Time to execute! 🚀**
