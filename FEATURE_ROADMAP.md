# TicketPilot Feature Roadmap

> Created: 2026-04-21 | Last updated: 2026-04-23
> Status: Phase 5 complete — **Production-ready**

---

## Overview

This document tracks all planned and shipped work across every phase.  
TypeScript and backend both compile clean as of 2026-04-23.

---

## Foundation: Email Service
**Status:** [x] Complete — 2026-04-21

- `backend/app/email.py` — Resend SDK integration, branded HTML shell
- Config: `RESEND_API_KEY`, `EMAIL_FROM` in `.env`
- Migration `0014_email_logs.sql` — audit log table
- Email functions: new ticket, AI failure, overdue, ETR reminder, rep reply, resolved

---

## Phase 1 — Quick Wins ✅
> Complete: 2026-04-21

### Feature 1 — Resolved Today Tab
- 5th lane `resolved_today` in rep console (`status='resolved' AND DATE(updated_at) = CURRENT_DATE`)
- Stats card (emerald, CheckCheck icon) in rep console header
- Backend: `QueueCounts.resolved_today` added

### Feature 2 — Show Escalation Target
- Migration `0012_escalation_target.sql`: `escalated_to uuid FK`, `escalated_at timestamptz`
- `POST /api/rep/tickets/{id}/escalate` accepts `escalated_to_user_id`
- Rep console: escalation dialog (dropdown + reason textarea), "Escalated to: [email]" badge

### Feature 3 — "Upload Documents" Rename
- `KBIngestModal.tsx` and rep console button: "Ingest" → "Upload Documents"

---

## Phase 2 — Email Features ✅
> Complete: 2026-04-21

### Feature 4 — Email on AI Failure / Ticket Raised
- `POST /api/tickets`: emails rep/admin on new ticket
- `POST /api/tickets/{id}/chat`: emails rep when AI confidence < 55% or escalation flagged

### Feature 5 — Overdue Detection + Notifications
- Migration `0015_overdue.sql`: `is_overdue boolean`, `overdue_notified_at timestamptz`
- Background scan (every 15 min): marks overdue, sends first notification
- Rep console: red "OVERDUE" badge

### Feature 6 — Configurable Repeat Overdue Emails
- Org setting `overdue_reminder_hours` (default 24h)
- Background scan: resends after interval, updates `overdue_notified_at`
- Admin settings UI: Overdue & Notification Settings card

---

## Phase 3 — Priority & Settings ✅
> Complete: 2026-04-22

### Feature 7 — Editable Attention Thresholds + Numeric Priority (P1–P7)
- Migration `0013_settings_priority.sql`: `priority_level int(1-7)` on tickets
- `attention_thresholds` JSONB in `app.organizations.settings`
- Background scan: auto-flags `needs_attention=true` based on priority_level + org thresholds
- Admin settings: 7-row threshold editor (P1–P7 with defaults)
- Rep console: P1–P7 colored badges on ticket cards

### Feature 8 — Expected Time to Resolve (ETR)
- Migration `0016_etr.sql`: `expected_resolve_at`, `etr_set_by`, `etr_set_at`, `etr_reminder_sent`
- `POST /api/rep/tickets/{id}/etr` endpoint
- Overdue gating: ticket only goes overdue after ETR passes (when set)
- Email: 1-hour-before ETR reminder to assignee
- Rep console: Set ETR dialog, ETR badge (amber < 2h, red = past)

---

## Phase 4 — User Management ✅
> Complete: 2026-04-22

### Feature 9 — Team Member Management (`/admin/users`)
- `GET /api/organizations/{org_id}/members?q=` extended with `last_sign_in_at`, email search
- New page `/admin/users`:
  - Initials avatar, email, last active, joined date
  - Inline role selector (PATCH on change) — owner demotion protected
  - Remove member with confirmation dialog — self-removal blocked
  - `@mention`-style search (debounced, strips `@` prefix)
  - Invite dialog: email + role → POST `/api/organizations/{org_id}/invites` → link/email confirmation
- Admin panel: "Team Members" quick nav card added

---

## Phase 5 — Production Hardening ✅
> Complete: 2026-04-23

**Trigger:** Pre-launch audit identified 9 critical/high gaps vs. Jira-class feature parity.

### Gap Analysis (what was found)

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | No internal notes — all messages visible to customers | 🔴 Critical | `messages` table |
| 2 | `TicketDetail` missing priority, tags, assignee, overdue, ETR fields | 🔴 Critical | `schemas.py` |
| 3 | No customer notifications (rep reply, ticket resolved) | 🔴 Critical | `tickets.py`, `email.py` |
| 4 | No ticket tags / labels | 🟠 High | DB + API |
| 5 | No resolution note or CSAT rating | 🟠 High | DB + API |
| 6 | No `resolved_at` timestamp | 🟠 High | DB |
| 7 | Admin `list_users` hardcoded `LIMIT 200`, no pagination | 🟡 Medium | `admin.py` |
| 8 | Ticket detail page bare — no metadata, no sidebar | 🔴 Critical | frontend |
| 9 | `is_internal` filter missing — reps' notes exposed to customers | 🔴 Critical | message layer |

### Fixes Shipped

#### Migration 0017 — `backend/migrations/0017_ticket_enhancements.sql`
```sql
ALTER TABLE app.messages  ADD COLUMN is_internal boolean NOT NULL DEFAULT false;
ALTER TABLE app.tickets   ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE app.tickets   ADD COLUMN resolution_note text;
ALTER TABLE app.tickets   ADD COLUMN resolved_at timestamptz;
ALTER TABLE app.tickets   ADD COLUMN customer_rating smallint CHECK (1-5);
-- GIN index on tags, partial index on resolved_at
```
**Applied:** 2026-04-23 ✅

#### Backend: `backend/app/schemas.py`
- `TicketSummary` → added `priority`, `priority_level`, `needs_attention`, `is_overdue`, `tags`, `assignee_id`, `assignee_email`, `customer_email`
- `TicketDetail` → added `escalated_to_email`, `escalated_at`, `expected_resolve_at`, `resolved_at`, `resolution_note`, `customer_rating`, `updated_at`
- `MessageCreate` → added `is_internal: bool = False`
- `MessageOut` → added `is_internal`, `meta`
- New schemas: `TagsRequest`, `ResolutionRequest`, `RatingRequest`

#### Backend: `backend/app/tickets.py`
- `create_ticket` → returns all `TicketDetail` fields including `tags`; accepts `tags` in payload
- `list_tickets` → query uses `t.` aliases + LEFT JOINs `auth.users` for assignee/customer email; returns full `TicketSummary`
- `get_ticket` → full JOIN query (assignee, customer, escalation target emails); internal notes filtered from customer view (`is_internal = false` for non-reps)
- `get_messages` → includes `is_internal`, `meta`; filters internal for customers
- `post_message` → accepts `is_internal` (only honoured for reps); fires `send_rep_reply_email` when rep posts public reply
- **New** `PATCH /api/tickets/{id}/tags` — normalises, deduplicates, saves tags
- **New** `POST /api/tickets/{id}/resolve` — sets status + `resolution_note` + `resolved_at`; fires `send_ticket_resolved_email`
- **New** `POST /api/tickets/{id}/rating` — customer-only CSAT 1-5 (ticket must be resolved/closed)

#### Backend: `backend/app/email.py`
- **New** `send_rep_reply_email(to, ticket_id, title, preview)` — notifies customer when rep replies
- **New** `send_ticket_resolved_email(to, ticket_id, title, resolution_note)` — notifies customer on resolution

#### Backend: `backend/app/admin.py`
- `list_users` → replaced hardcoded `LIMIT 200` with `offset`/`limit` query params (max 200)

#### Frontend: `frontend/src/app/(protected)/tickets/[id]/page.tsx`
Complete rewrite. Old page: bare message thread with no metadata.  
New page: Jira-style two-column layout.

**Left column — conversation thread:**
- Internal notes: amber highlight + `🔒 Internal note` badge; invisible to customers
- Rep toggle button: "Public" ↔ "Internal" (amber styling when internal active)
- Message bubbles: colour-coded by sender role (customer / rep / AI / system)
- AI: confidence badge, suggest-escalation warning, thumbs feedback, collapsible citations
- System messages: collapsible with eye-toggle
- AI chat panel (purple)
- Message composer with `is_internal` flag + character count
- **Resolve dialog**: free-text resolution note → `POST /resolve` → customer email

**Right column — details sidebar:**
- Status, priority, P-level badge, assignee, ETR, resolved_at, CSAT stars, created date, escalation target
- Rep actions card: "Resolve ticket" button → resolve dialog; "Rep Console" back-link

**CSAT:** shown to ticket owner after resolution; 1-5 star picker; `POST /rating` on click

**Next.js 15 compatibility:** `use(params)` to unwrap async `params` Promise (React 19 pattern)

---

## Migrations Index

| File | Purpose | Applied |
|------|---------|---------|
| `0012_escalation_target.sql` | `escalated_to`, `escalated_at` on tickets | ✅ |
| `0013_settings_priority.sql` | `priority_level` on tickets, `attention_thresholds` in org settings | ✅ |
| `0014_email_logs.sql` | Email send audit log | ✅ |
| `0015_overdue.sql` | `is_overdue`, `overdue_notified_at` on tickets | ✅ |
| `0016_etr.sql` | `expected_resolve_at`, `etr_set_by`, `etr_set_at`, `etr_reminder_sent` | ✅ |
| `0017_ticket_enhancements.sql` | `is_internal`, `tags`, `resolution_note`, `resolved_at`, `customer_rating` | ✅ |

---

## Post-Launch Backlog (v1.1+)

These items were identified in the audit but are **not blocking launch** for an internal-team deployment:

| Item | Effort | Priority |
|------|--------|----------|
| File attachments (Supabase Storage) | Medium | High |
| Audit log table + triggers | Medium | High |
| Customer portal (public ticket submission) | Large | High |
| SLA policy templates (Gold/Silver/Bronze) | Large | Medium |
| Auto-assignment rules (round-robin, by load) | Medium | Medium |
| Auto-close rules (resolved > N days → close) | Small | Medium |
| Webhooks / Slack integration | Medium | Medium |
| Ticket export (CSV/PDF) | Small | Low |
| Advanced report builder | Large | Low |
| Email-to-ticket inbound parsing | Large | Low |
| `@mention` within ticket threads | Medium | Low |

---

## Milestone Log

| Milestone | Date | Notes |
|-----------|------|-------|
| Plan documented | 2026-04-21 | All 9 features scoped |
| Phase 1 complete | 2026-04-21 | Resolved today tab, escalation target, rename. Migration 0012 applied. |
| Email foundation complete | 2026-04-21 | Resend integrated, email_logs migration applied |
| Phase 2 complete | 2026-04-21 | Email triggers, overdue scan, configurable reminders. Migrations 0014–0015 applied. |
| Phase 3 complete | 2026-04-22 | P1–P7 priority system, attention thresholds, ETR. Migrations 0013, 0016 applied. |
| Phase 4 complete | 2026-04-22 | `/admin/users` — member table, inline role, invite dialog, @search |
| Phase 5 complete | 2026-04-23 | Production hardening audit — 9 critical gaps closed. Migration 0017 applied. TypeScript + backend clean. |
| **Ready for launch** | **2026-04-23** | **All critical/high gaps resolved. Post-launch backlog documented.** |
