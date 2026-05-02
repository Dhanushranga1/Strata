# Logical Flow Review and Test Plan

Date: 2026-05-01
Owner: TBD
Status: Draft plan

## Purpose
Validate end-to-end logical flows across customer, rep, and admin journeys, identify missed flows, and produce a refinement backlog.

## Inputs Reviewed
- README.md
- COMPREHENSIVE_TEST_PLAN.md
- TESTING_GUIDE.md
- DEMO_FLOW_TEST.md
- FEATURE_ROADMAP.md
- PHASE2_MULTI_TENANCY_COMPLETE.md
- PHASE3_FRONTEND_INTEGRATION.md
- SECURITY_GUIDE.md

## Scope
- Frontend (Next.js app)
- Backend API (FastAPI)
- Auth and RLS (Supabase)
- Knowledge Base + RAG
- Email notifications
- Background jobs (overdue/ETR scans)
- Audit logging

## Test Data Setup
- Users:
  - customer_a (Org A)
  - rep_a (Org A)
  - admin_a (Org A owner)
  - customer_b (Org B)
  - rep_b (Org B)
- Orgs:
  - Org A (default)
  - Org B
- Tickets:
  - New, In Progress, Escalated, Resolved, Overdue
  - Tagged and untagged
  - With and without internal notes
- KB docs:
  - At least 2 docs per org

## End-to-End Flows to Validate
### 1) Auth and Onboarding
- Sign up, login, logout, token refresh/expiry
- Email verification (if enabled)
- Password reset flow
- Invite acceptance flow
- Role request and approval (if enabled)

### 2) Organization Management
- Create org, update org settings
- Switch orgs (sidebar selector), persistence on refresh
- Invite member, accept invite, remove member
- Role changes and immediate permission enforcement
- Last-owner protection (cannot remove/demote final owner)

### 3) Ticket Lifecycle
- Create ticket (customer) and verify visibility to reps
- Status changes: open -> in_progress -> resolved/closed
- Assign to rep and reassign
- Escalate to specific user with reason
- Set priority (P1-P7) and verify attention flags
- Set ETR and confirm overdue gating and reminders
- Add public reply vs internal note (internal hidden from customer)
- Add tags and edit tags
- Resolution note and resolved_at
- CSAT rating after resolution and single-submit guard

### 4) Rep Console
- Queue lanes, counts, sorting, filtering
- Acknowledge attention and clear needs_attention
- Resolved today lane
- AI assist response, confidence, citations
- AI failure behavior (email + safe fallback)

### 5) Customer Portal
- View own tickets only
- Message thread rendering, timestamps, status badges
- Internal notes never visible
- View resolution note and submit CSAT

### 6) Admin
- Analytics summary, by-category, rep performance
- User list pagination, role change, remove user
- Org settings (thresholds, overdue reminder hours)

### 7) Knowledge Base and RAG
- Ingest docs, duplicates, indexing status
- Search returns org-specific results only
- Chat uses org-scoped KB
- Error handling when KB is empty

### 8) Email and Notifications
- New ticket email
- AI failure or escalation email
- Overdue notification and repeat reminder
- ETR reminder
- Rep reply email to customer
- Ticket resolved email to customer

### 9) Audit Log
- Validate event coverage for: ticket create, assign, status change, escalate, resolve, member add/remove, role change, KB ingest
- Actor, org, IP, user agent, timestamp, and metadata captured
- Search/filter and retention behavior

### 10) Security and Reliability
- Org header missing -> 400
- Org header for non-member -> 403
- RLS enforcement for direct DB access
- Rate limit responses and UI behavior on 429
- CORS validation in prod

## Potential Missing Logical Flows (To Validate)
- Invite acceptance when user already belongs to the org
- Switching org while deep-linked on ticket detail from different org
- Mid-session role downgrade (e.g., admin -> member) and access revocation
- Removing current user from org they are viewing
- Overdue scanning when ETR not set vs set
- AI response failure or timeout in the rep console
- Tag editing and search consistency across list/detail views
- CSAT double-submit and rating after re-open/close
- Email failures (Resend outage) and retry behavior
- Audit log coverage for internal notes vs public replies

## Execution Plan
1. Smoke pass per persona (customer, rep, admin)
2. Full E2E lifecycle per org (Org A and Org B)
3. Edge case and failure injection (auth expiry, invalid org, AI failure)
4. Cross-org isolation checks for tickets, messages, KB
5. Regression suite for critical pages and API endpoints

## Deliverables
- Findings list with severity and reproduction steps
- Refinement backlog (bug fixes + UX gaps)
- Updated automation targets (scripts or Playwright scenarios)

## Success Criteria
- No cross-org data exposure
- All ticket lifecycle states consistent across UI and API
- All email and audit log events fire as expected
- No critical flow breaks for customer, rep, admin personas
