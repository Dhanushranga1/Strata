# 04 - Known Issues & Knowledge Gaps

**Document Version:** 1.0  
**Last Updated:** March 6, 2026  
**Criticality Assessment**: Production Blockers → Future Enhancements

---

## Executive Summary

This document catalogs ALL known issues, limitations, and knowledge gaps in TicketPilot. Issues are categorized by severity and organized by functional area.

**Overall System Health**: ✅ **Production-Ready**
- **P0 Critical Blockers**: 0
- **P1 High Priority**: 4
- **P2 Medium Priority**: 12
- **P3 Low Priority**: 18

**Total Known Issues**: 34

---

## Severity Definitions

| Priority | Description | Timeline | Impact |
|----------|-------------|----------|--------|
| **P0** | Production blocker - Cannot launch | Immediate (hours) | System unusable |
| **P1** | High priority - MVP incomplete | 1-2 weeks | Major feature gap |
| **P2** | Medium priority - Quality of life | 1-3 months | User inconvenience |
| **P3** | Low priority - Nice to have | 3-12 months | Minor enhancement |

---

## P0 - Critical Blockers (MUST FIX BEFORE LAUNCH)

### ✅ NONE! All P0 issues resolved! 🎉

**Previously Critical (Now Resolved):**
1. ~~Auto-create organization on signup~~ → ✅ Fixed (DAY2_AUTO_ORG_COMPLETE.md)
2. ~~Row-Level Security not enabled~~ → ✅ Fixed (migration 0010)
3. ~~Missing 'escalated' status~~ → ✅ Fixed (fix-escalated-status.sql)
4. ~~Organization management UI~~ → ✅ Implemented (organizations/page.tsx)

---

## P1 - High Priority (Post-MVP v1.1)

### 1. No File Attachments in Tickets ⚠️

**Category**: Ticketing  
**Severity**: P1  
**Impact**: Users cannot share screenshots, logs, documents with tickets

**Current State:**
- Tickets are text-only (title + description)
- Messages are text-only
- No file upload UI exists

**Missing Implementation:**
- File upload component (drag-and-drop)
- Backend file storage (S3, Supabase Storage, or local)
- File type validation (images, PDFs, logs)
- File size limits (e.g., 10MB per file)
- File preview in ticket detail
- Multiple attachments per message
- File deletion capability

**Technical Considerations:**
- Storage: Supabase Storage (recommended) or AWS S3
- File metadata: New `app.ticket_attachments` table
- Security: Virus scanning, malware detection
- Bandwidth: Large files impact performance

**Estimated Effort**: 3-5 days  
**Workaround**: Users share files via external links (Google Drive, Dropbox)

**Implementation Plan:**
```sql
-- New table needed
CREATE TABLE app.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES app.tickets(id) ON DELETE CASCADE,
  message_id uuid REFERENCES app.messages(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

---

### 2. No Password Reset Functionality 🔐

**Category**: Authentication  
**Severity**: P1  
**Impact**: Users locked out of accounts cannot recover

**Current State:**
- No "Forgot Password" link on login page
- No password reset flow
- No email-based token generation
- Users must contact admin to reset password

**Missing Implementation:**
- "Forgot Password" link/button
- Email input form
- Backend endpoint: `/api/auth/forgot-password`
- Email sending with reset token
- Password reset page: `/reset-password?token=...`
- Token validation (expires in 1 hour)
- New password form with validation

**Technical Considerations:**
- Email service: Supabase Auth has built-in support
- Token storage: Use Supabase Auth magic links
- Security: Rate limit reset requests (5 per hour per IP)

**Estimated Effort**: 2-3 days  
**Workaround**: Admin manually resets password in database

**Implementation Plan:**
```typescript
// Backend
@router.post("/auth/forgot-password")
async def forgot_password(email: str):
  // Send email with magic link using Supabase Auth
  
@router.post("/auth/reset-password")
async def reset_password(token: str, new_password: str):
  // Validate token and update password
```

---

### 3. No Real-Time Updates (Must Refresh) 🔄

**Category**: UX/Performance  
**Severity**: P1  
**Impact**: Users miss new messages, status changes without manual refresh

**Current State:**
- All data fetched on page load
- No WebSocket connections
- No polling for updates
- Users must refresh to see:
  - New messages in tickets
  - Status changes by other reps
  - New tickets in queue
  - Assignment changes

**Missing Implementation:**
- WebSocket server (Socket.io or native WebSockets)
- Client-side connection management
- Event subscriptions per page:
  - Ticket detail: Listen for new messages
  - Rep console: Listen for ticket updates
  - Dashboard: Listen for metric updates
- Reconnection logic on disconnect
- Typing indicators (bonus)
- "New message" notifications/badges

**Technical Considerations:**
- Backend: Add WebSocket endpoint in FastAPI
- Frontend: Use Socket.io or native WebSocket API
- Scale: WebSocket servers are stateful (sticky sessions needed)
- Alternative: Supabase Realtime (easiest, built-in)

**Estimated Effort**: 5-7 days  
**Workaround**: Users manually refresh pages

**Recommended Solution**: Use Supabase Realtime
```typescript
// Frontend
const ticketChannel = supabase
  .channel(`ticket:${ticketId}`)
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'app', table: 'messages', filter: `ticket_id=eq.${ticketId}` },
    (payload) => {
      // Add new message to UI
    }
  )
  .subscribe()
```

---

### 4. No SLA (Service Level Agreement) Tracking ⏱️

**Category**: Rep Console  
**Severity**: P1  
**Impact**: No visibility into response time goals, missed deadlines

**Current State:**
- No SLA rules defined
- No time-based alerts
- No SLA breach tracking
- No automatic escalation on SLA breach

**Missing Implementation:**
- SLA configuration per priority:
  - High priority: 1 hour first response, 4 hour resolution
  - Normal priority: 4 hour first response, 24 hour resolution
  - Low priority: 24 hour first response, 72 hour resolution
- SLA timer display in rep console
- Visual alerts when SLA about to breach (< 15 mins remaining)
- Automatic escalation on SLA breach
- SLA performance metrics in admin dashboard

**Technical Considerations:**
- Database: Add `sla_first_response_deadline`, `sla_resolution_deadline` to tickets
- Backend: Calculate deadlines on ticket creation based on priority
- Frontend: Display countdown timer, color-coded (green/yellow/red)
- Background job: Check for SLA breaches every minute

**Estimated Effort**: 4-6 days  
**Workaround**: Reps manually track response times

**Implementation Plan:**
```sql
-- Add to app.tickets
ALTER TABLE app.tickets ADD COLUMN sla_first_response_deadline timestamptz;
ALTER TABLE app.tickets ADD COLUMN sla_resolution_deadline timestamptz;
ALTER TABLE app.tickets ADD COLUMN sla_first_response_met boolean;
ALTER TABLE app.tickets ADD COLUMN sla_resolution_met boolean;
```

---

## P2 - Medium Priority (v1.2-1.3)

### 5. No Conversation Memory in AI Chat 🤖

**Category**: AI/RAG  
**Severity**: P2  
**Impact**: AI cannot reference previous questions in conversation

**Current State:**
- Each AI query is independent
- No conversation history passed to AI
- User must repeat context in each question

**Example Problem:**
```
User: "What's the refund policy?"
AI: "30-day money-back guarantee..."

User: "How do I request it?"
AI: [Doesn't know what "it" refers to]
```

**Missing Implementation:**
- Store conversation history per ticket
- Pass last N messages to AI as context
- Conversation summarization (for long threads)
- Session management (reset after 1 hour)

**Estimated Effort**: 3-4 days  
**Workaround**: Users rephrase questions with full context

---

### 6. No Canned Responses 📝

**Category**: Rep Console  
**Severity**: P2  
**Impact**: Reps type same responses repeatedly

**Current State:**
- No template/snippet library
- Reps must type or copy-paste common responses

**Missing Implementation:**
- Canned response library
- Create/edit/delete templates
- Insert template with keyboard shortcut
- Variables in templates: `{{customer_name}}`, `{{ticket_id}}`
- Category organization (greeting, closing, FAQ, etc.)

**Estimated Effort**: 3-4 days  
**Workaround**: Reps use external text expander tools

---

### 7. No Ticket Templates 📋

**Category**: Ticketing  
**Severity**: P2  
**Impact**: Users create poorly-formatted tickets

**Current State:**
- Free-form title + description
- No guidance on what information to provide

**Missing Implementation:**
- Template library (Bug Report, Feature Request, Question, etc.)
- Pre-filled fields in templates
- Required vs. optional fields
- Template selection on ticket creation

**Estimated Effort**: 2-3 days  
**Workaround**: Users manually follow guidelines

---

### 8. Limited Analytics Export 📊

**Category**: Admin Dashboard  
**Severity**: P2  
**Impact**: Cannot share reports with stakeholders

**Current State:**
- Charts/data visible only in web UI
- No export to PDF, Excel, CSV
- No scheduled reports

**Missing Implementation:**
- Export dashboard to PDF
- Export raw data to CSV/Excel
- Email scheduled reports (daily/weekly/monthly)
- Custom date range selection

**Estimated Effort**: 3-4 days  
**Workaround**: Screenshot dashboards, manual data export

---

### 9. No Audit Logging for Admin Actions 📜

**Category**: Security/Compliance  
**Severity**: P2  
**Impact**: Cannot track who did what (compliance risk)

**Current State:**
- RAG requests logged
- System messages for ticket actions
- No logs for:
  - User role changes
  - Organization settings changes
  - Knowledge base deletions
  - Member invitations/removals

**Missing Implementation:**
- `app.audit_log` table
- Log all admin actions with:
  - Actor (who did it)
  - Action (what they did)
  - Resource (what was affected)
  - Timestamp
  - IP address
  - User agent
- Audit log viewer for admins
- Audit log export
- Retention policy (keep for 1 year)

**Estimated Effort**: 4-5 days  
**Workaround**: None (compliance gap)

---

### 10. No Multi-Factor Authentication (MFA) 🔐

**Category**: Security  
**Severity**: P2  
**Impact**: Accounts vulnerable to password compromise

**Current State:**
- Password-only authentication
- No second factor

**Missing Implementation:**
- TOTP (Time-based One-Time Password) via authenticator apps
- QR code generation for setup
- Backup codes (10 codes, single-use)
- MFA enforcement option (per organization)
- SMS-based MFA (optional, less secure)

**Technical Considerations:**
- Library: `pyotp` (Python) for TOTP generation
- Storage: `app.user_mfa` table
- UX: Optional during beta, required for enterprises

**Estimated Effort**: 5-6 days  
**Workaround**: Use strong passwords + password manager

---

### 11. No Bulk Operations in Ticket List 📦

**Category**: Rep Console  
**Severity**: P2  
**Impact**: Cannot process multiple tickets at once

**Current State:**
- Must open each ticket individually
- No multi-select

**Missing Implementation:**
- Checkbox selection in ticket list
- Bulk actions:
  - Assign to rep
  - Change status
  - Change priority
  - Close tickets
  - Export selected
- "Select all" option

**Estimated Effort**: 2-3 days  
**Workaround**: Process tickets one at a time

---

### 12. No Ticket Tagging/Categorization 🏷️

**Category**: Ticketing  
**Severity**: P2  
**Impact**: Cannot organize tickets by topic

**Current State:**
- Only status and priority for categorization
- No custom labels

**Missing Implementation:**
- Tag system (e.g., "billing", "technical", "sales")
- Create custom tags per organization
- Multi-tag support per ticket
- Filter/search by tags
- Tag analytics (most common tags)

**Estimated Effort**: 3-4 days  
**Workaround**: Use title prefixes like "[BILLING] Issue with..."

---

### 13. No Advanced Search 🔍

**Category**: Ticketing  
**Severity**: P2  
**Impact**: Hard to find specific tickets

**Current State:**
- Basic search by title/description (ILIKE)
- No filters beyond status
- No date range search
- No search by assignee, priority, tags

**Missing Implementation:**
- Advanced search form:
  - Date range (created between...)
  - Assigned to (dropdown)
  - Priority (dropdown)
  - Status (multi-select)
  - Tags (if implemented)
  - Message content search
- Search saved filters
- Full-text search (PostgreSQL tsvector)

**Estimated Effort**: 4-5 days  
**Workaround**: Use basic search + manual filtering

---

### 14. No Email Notifications 📧

**Category**: Communication  
**Severity**: P2  
**Impact**: Users must check app for updates

**Current State:**
- No email sent on:
  - New ticket reply
  - Ticket assigned to rep
  - Ticket status change
  - Password reset (if implemented)

**Missing Implementation:**
- Email service integration (SendGrid, Mailgun, or Supabase)
- Email templates:
  - New message notification
  - Assignment notification
  - Status change notification
  - Weekly digest (optional)
- Email preferences per user (opt-in/opt-out)
- Unsubscribe link

**Technical Considerations:**
- Email service cost (SendGrid: 100/day free)
- SMTP configuration
- Email deliverability (SPF, DKIM, DMARC)

**Estimated Effort**: 5-6 days  
**Workaround**: Users check app regularly

---

### 15. No Mobile App 📱

**Category**: Platform  
**Severity**: P2  
**Impact**: Mobile experience is web-only

**Current State:**
- Responsive web design works on mobile
- No native iOS/Android app
- No push notifications

**Missing Implementation:**
- React Native app (or Flutter)
- Push notifications
- Offline support
- Camera integration for attachments

**Estimated Effort**: 8-12 weeks  
**Workaround**: Use mobile web browser

---

### 16. No Keyboard Shortcuts ⌨️

**Category**: UX  
**Severity**: P2  
**Impact**: Power users slower without shortcuts

**Current State:**
- All actions require mouse clicks
- No keyboard navigation

**Missing Implementation:**
- Global shortcuts:
  - `Cmd/Ctrl + K`: Search tickets
  - `N`: New ticket
  - `?`: Help menu
  - `/`: Focus search
- Rep console shortcuts:
  - `A`: Assign to me
  - `S`: Change status
  - `P`: Change priority
  - `J/K`: Navigate ticket list

**Estimated Effort**: 2-3 days  
**Workaround**: Use mouse

---

## P3 - Low Priority (Future Enhancements)

### 17. No OAuth/SSO Login 🔑

**Category**: Authentication  
**Severity**: P3  
**Impact**: Users want "Sign in with Google/GitHub"

**Missing**: Google OAuth, GitHub OAuth, Microsoft SSO, SAML

**Estimated Effort**: 4-5 days per provider  
**Workaround**: Use email/password

---

### 18. No Document Versioning 📄

**Category**: Knowledge Base  
**Severity**: P3  
**Impact**: Cannot update documents, must delete + re-upload

**Missing**: Version history, rollback, change tracking

**Estimated Effort**: 5-6 days  
**Workaround**: Delete old, upload new (loses analytics)

---

### 19. No Document Preview 👁️

**Category**: Knowledge Base  
**Severity**: P3  
**Impact**: Cannot view document content in browser

**Missing**: PDF viewer, text viewer, markdown renderer

**Estimated Effort**: 3-4 days  
**Workaround**: Download and open locally

---

### 20. No Custom Roles/Permissions 🎭

**Category**: Access Control  
**Severity**: P3  
**Impact**: Only 4 fixed roles (Owner, Admin, Rep, Customer)

**Missing**: Custom role creation, granular permissions

**Estimated Effort**: 8-10 days  
**Workaround**: Use existing roles

---

### 21. No API Rate Limit Dashboard 🚦

**Category**: Admin Dashboard  
**Severity**: P3  
**Impact**: Cannot see rate limit hits

**Missing**: Rate limit stats, IP blocking, allowlist

**Estimated Effort**: 3-4 days  
**Workaround**: Check server logs

---

### 22. No Webhooks ⚡

**Category**: Integrations  
**Severity**: P3  
**Impact**: Cannot integrate with external systems

**Missing**: Webhook configuration, payload delivery, retry logic

**Estimated Effort**: 5-6 days  
**Workaround**: Poll API endpoints

---

### 23-34. Additional P3 Issues

(Abbreviated list for brevity)

23. No light mode theme
24. No internationalization (i18n)
25. No accessibility audit (WCAG compliance)
26. No PWA (Progressive Web App) support
27. No offline mode
28. No data export (full organization backup)
29. No GDPR data deletion tools
30. No custom domain support
31. No white-label branding
32. No API documentation (Swagger UI exists)
33. No GraphQL API
34. No analytics dashboard for customers

---

## Knowledge Gaps (Development Debt)

### Technical Debt

1. **No TypeScript on Backend**
   - Backend is Python (dynamically typed)
   - No compile-time type checking
   - **Risk**: Runtime errors, harder refactoring
   - **Solution**: Consider Pydantic v2 strict mode

2. **No End-to-End Tests**
   - Only backend unit tests + manual testing
   - No Playwright/Cypress tests
   - **Risk**: Regressions in UI flows
   - **Solution**: Add E2E test suite (3-5 days)

3. **No Performance Monitoring**
   - No APM tool (Sentry, DataDog, New Relic)
   - No query performance tracking
   - **Risk**: Slow queries go unnoticed
   - **Solution**: Integrate APM tool (1-2 days)

4. **No Database Backups Tested**
   - Supabase auto-backups exist
   - Never tested restore procedure
   - **Risk**: Backup might be corrupted/incomplete
   - **Solution**: Test restore monthly

5. **No Load Testing**
   - Never tested with 100+ concurrent users
   - Unknown breaking point
   - **Risk**: Production outage under load
   - **Solution**: Run load tests with k6/Locust (2-3 days)

6. **FAISS Single Point of Failure**
   - FAISS index loaded in memory (single server)
   - No replication
   - **Risk**: Server restart = FAISS rebuild
   - **Solution**: Move to managed vector DB (Pinecone, Weaviate)

7. **No CI/CD Pipeline Fully Configured**
   - GitHub Actions files exist
   - Never run in production
   - **Risk**: Manual deployment errors
   - **Solution**: Complete CI/CD setup (1-2 days)

---

### Documentation Gaps

1. **No API Documentation for Developers**
   - Swagger UI exists at `/docs`
   - No external API usage guide
   - **Impact**: Third-party integrations difficult

2. **No Runbook for Ops Team**
   - No incident response procedures
   - No troubleshooting guide
   - **Impact**: Slow incident resolution

3. **No Onboarding Guide for New Developers**
   - No "Getting Started" for contributors
   - **Impact**: High learning curve

4. **No Security Incident Response Plan**
   - No procedures for data breaches, DDoS attacks
   - **Impact**: Chaotic incident handling

---

### Business/Product Gaps

1. **No Pricing Model Defined**
   - Free tier limits unclear
   - Paid tier features not specified
   - **Impact**: Cannot monetize

2. **No User Onboarding Flow**
   - Users see empty dashboard after signup
   - No tutorial, no sample data
   - **Impact**: High churn rate

3. **No Customer Success Metrics**
   - No NPS (Net Promoter Score)
   - No in-app surveys
   - **Impact**: Blind to user satisfaction

4. **No Competitor Analysis**
   - Unknown how TicketPilot compares to Zendesk, Freshdesk
   - **Impact**: Weak positioning

---

## Mitigation Strategies

### For P1 Issues (High Priority)

**Immediate Actions:**
1. **File Attachments**: Start development in parallel with beta launch
2. **Password Reset**: Use Supabase built-in magic links (quick win)
3. **Real-Time Updates**: Implement Supabase Realtime (2-day task)
4. **SLA Tracking**: Defer to v1.1 (not critical for beta)

### For P2 Issues (Medium Priority)

**Phased Approach:**
- **Phase 1 (v1.1)**: Focus on user-requested features (attachments, real-time)
- **Phase 2 (v1.2)**: UX improvements (canned responses, templates)
- **Phase 3 (v1.3)**: Analytics and compliance (audit logs, export)

### For P3 Issues (Low Priority)

**Feature Request Backlog:**
- Gather user feedback during beta
- Prioritize based on demand
- Implement top 3 requested features per quarter

### For Technical Debt

**Continuous Improvement:**
- Allocate 20% of sprint capacity to debt reduction
- Rotate tasks: one dev focuses on tests, another on docs
- Monthly security reviews

---

## Risk Assessment

| Category | Risk Level | Mitigation |
|----------|-----------|------------|
| **Security** | 🟡 Medium | No MFA, no audit logs (add in v1.1) |
| **Performance** | 🟢 Low | Adequate for beta, monitor with APM |
| **Scalability** | 🟡 Medium | FAISS limited by RAM (plan migration) |
| **Reliability** | 🟢 Low | No major bugs, database is stable |
| **UX** | 🟡 Medium | No real-time, no attachments (fix v1.1) |
| **Compliance** | 🟡 Medium | No audit logs, no GDPR tools (add later) |

**Overall Risk**: 🟢 **LOW** (safe to launch beta)

---

## Conclusion

TicketPilot has **0 critical blockers** and is **production-ready for beta launch**. The 34 known issues are manageable and follow a clear priority roadmap.

**Strengths:**
- ✅ Core functionality complete (ticketing, AI, multi-tenancy)
- ✅ Security fundamentals in place (JWT, RLS, rate limiting)
- ✅ No data corruption risks
- ✅ Clear upgrade path for missing features

**Recommended Beta Launch Strategy:**
1. Launch with current feature set
2. Gather user feedback (most requested: attachments, real-time)
3. Implement top 2-3 P1 issues in v1.1 (2-3 weeks)
4. Iterate based on usage data

**Timeline:**
- **Beta Launch**: Today (after final testing)
- **v1.1 (P1 fixes)**: 3-4 weeks
- **v1.2 (P2 features)**: 8-12 weeks
- **v1.3 (P3 enhancements)**: 16-24 weeks

No blockers prevent immediate deployment. 🚀
