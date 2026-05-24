# Phase 5: Rep Console & Escalation - Implementation Complete

## Overview
Phase 5 successfully implements a comprehensive Rep Console with queue management and escalation workflows for TicketPilot. This phase builds on Phase 4's AI chat capabilities by adding auto-flagging when AI suggests escalation.

## Features Implemented

### ✅ Backend Implementation
- **Database Migration**: Extended tickets table with `escalated` status, `needs_attention` boolean, `priority` field
- **Rep API Module**: Complete `/api/rep` endpoints with role-based access control
- **Queue Management**: Four distinct queues (Needs Attention, Open/Active, Escalated, All)
- **Ticket Actions**: Escalate, status changes, assignment, acknowledgment, priority setting
- **Phase 4 Integration**: Auto-flagging when AI suggests escalation

### ✅ Frontend Implementation
- **Rep Console**: Protected `/rep` page with role-based access
- **Queue Interface**: Lane tabs, search, filtering, pagination
- **Inline Actions**: Ticket management directly from queue view
- **KB Ingest Modal**: Knowledge base content upload interface

### ✅ Database Schema
```sql
-- New status: 'escalated'
ALTER TABLE app.tickets ADD CONSTRAINT app_tickets_status_check 
  CHECK (status IN ('open','in_progress','resolved','closed','escalated'));

-- Triage fields
ALTER TABLE app.tickets 
  ADD COLUMN needs_attention BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal' 
    CHECK (priority IN ('low','normal','high'));

-- Performance indexes
CREATE INDEX idx_tickets_needs_attention ON app.tickets(needs_attention);
CREATE INDEX idx_tickets_assignee ON app.tickets(assignee_id);
```

## API Endpoints

### Rep Console Endpoints (role: rep/admin only)

#### GET `/api/rep/queue`
Queue management with filtering and pagination
```bash
curl "http://localhost:8000/api/rep/queue?lane=needs_attention&limit=10" \
  -H "Authorization: Bearer $TOKEN_REP"
```

**Parameters:**
- `lane`: `needs_attention|open|escalated|all` (default: needs_attention)
- `q`: Search in ticket title (optional)
- `mine`: Filter by assigned to caller (optional)
- `offset`: Pagination offset (default: 0)
- `limit`: Items per page (default: 20, max: 100)

#### GET `/api/rep/counts`
Queue counts for dashboard
```bash
curl "http://localhost:8000/api/rep/counts" \
  -H "Authorization: Bearer $TOKEN_REP"
```

#### POST `/api/rep/tickets/{ticket_id}/escalate`
Escalate ticket to escalated status
```bash
curl -X POST "http://localhost:8000/api/rep/tickets/{id}/escalate" \
  -H "Authorization: Bearer $TOKEN_REP" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Policy exception; needs senior review"}'
```

#### POST `/api/rep/tickets/{ticket_id}/status`
Change ticket status with validation
```bash
curl -X POST "http://localhost:8000/api/rep/tickets/{id}/status" \
  -H "Authorization: Bearer $TOKEN_REP" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved"}'
```

#### POST `/api/rep/tickets/{ticket_id}/assign`
Assign ticket to rep
```bash
curl -X POST "http://localhost:8000/api/rep/tickets/{id}/assign" \
  -H "Authorization: Bearer $TOKEN_REP" \
  -H "Content-Type: application/json" \
  -d '{"assignee_id":null}'  # null = assign to caller
```

#### POST `/api/rep/tickets/{ticket_id}/acknowledge`
Acknowledge flagged attention
```bash
curl -X POST "http://localhost:8000/api/rep/tickets/{id}/acknowledge" \
  -H "Authorization: Bearer $TOKEN_REP" \
  -H "Content-Type: application/json" \
  -d '{"note":"Reviewed and triaged"}'
```

#### POST `/api/rep/tickets/{ticket_id}/priority`
Set ticket priority
```bash
curl -X POST "http://localhost:8000/api/rep/tickets/{id}/priority" \
  -H "Authorization: Bearer $TOKEN_REP" \
  -H "Content-Type: application/json" \
  -d '{"priority":"high"}'
```

## Status Transition Matrix

| From \ To     | open | in_progress | resolved | closed | escalated |
|---------------|------|-------------|----------|--------|-----------|
| **open**      | ✓    | ✓           | ✓        | ✓      | ✓         |
| **in_progress** | ✓  | ✓           | ✓        | ✓      | ✓         |
| **resolved**  | ✓    | ✓           | ✓        | ✓      | ✓         |
| **closed**    | ✓    | ✗           | ✗        | ✓      | ✗         |
| **escalated** | ✓    | ✓           | ✓        | ✓      | ✓         |

**Rules:**
- From `closed`: Only reopen to `open` allowed
- Setting `resolved`/`closed` clears `needs_attention`
- `escalated` status sets `needs_attention=true`

## Queue Logic

### Needs Attention Lane
```sql
WHERE needs_attention = true AND status != 'closed'
```
- AI-flagged tickets (Phase 4 integration)
- Manually escalated tickets
- System-flagged tickets

### Open/Active Lane  
```sql
WHERE status IN ('open', 'in_progress', 'resolved') AND needs_attention = false
```
- Normal workflow tickets
- Not requiring immediate attention

### Escalated Lane
```sql
WHERE status = 'escalated'
```
- All escalated tickets regardless of attention flag

### All Lane
No additional filters - shows all tickets visible to reps

## Phase 4 Integration

When AI chat responds with `suggest_escalation=true`:
1. Check ticket status != 'closed'
2. Set `needs_attention=true`
3. Insert system message: `"[system] AI suggested escalation (confidence X.XX)"`
4. Ticket appears in Needs Attention queue

## System Messages

All rep actions generate audit trail messages:
- **Escalate**: `"[system] Ticket escalated • Reason: <text>"`
- **Status Change**: `"[system] Status changed to <status>"`
- **Assignment**: `"[system] Assigned to <user>"`
- **Acknowledge**: `"[system] Attention acknowledged • Note: <text>"`
- **Priority**: `"[system] Priority set to <priority>"`

## Security & Access Control

- All `/api/rep/*` endpoints require `role ∈ {rep, admin}`
- Customer users receive `403 Forbidden`
- Server-side validation for all state transitions
- Role enforcement via `require_rep()` helper function

## Frontend Features

### Rep Console (`/rep`)
- **Route Protection**: Role-based access control
- **Queue Interface**: Tabbed lanes with real-time counts
- **Search & Filter**: Title search, "mine only" toggle
- **Pagination**: Configurable page size
- **Inline Actions**: Direct ticket management from queue view

### Ticket Cards Display
- Title with link to detailed view
- Status and priority badges
- Assignment status (assigned/unassigned)
- Message count and last activity time
- Attention flag indicator
- Quick action buttons

### KB Ingest Modal
- File upload support (.txt, .md, .pdf, .doc, .docx)
- Direct text paste functionality
- Success feedback with chunk/vector counts
- Reuses Phase 2 ingestion API

## Error Handling

- `401`: Authentication required
- `403`: Insufficient permissions (not rep/admin)
- `404`: Ticket not found
- `409`: Invalid operation (e.g., escalate closed ticket)
- `422`: Validation errors (invalid status, priority, etc.)

## Setup Instructions

### 1. Database Migration
```bash
cd backend
psql $DATABASE_URL -f migrations/0005_rep_console.sql
```

### 2. Grant Rep Role
```sql
INSERT INTO app.user_roles (user_id, role) 
VALUES ('<user-uuid>', 'rep')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
```

### 3. Start Services
```bash
# Backend
cd backend
PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# Frontend  
cd frontend
npm run dev
```

### 4. Access Rep Console
- Navigate to `/rep` as a user with rep/admin role
- Customer users will see 403 or be redirected

## Testing

### Test Rep Access
```bash
# Get user token (rep role required)
TOKEN_REP="your-rep-jwt-token"

# Test queue access
curl "http://localhost:8000/api/rep/counts" \
  -H "Authorization: Bearer $TOKEN_REP"
```

### Test Escalation Workflow
1. Create ticket as customer
2. Use Phase 4 AI chat until AI suggests escalation
3. Verify ticket appears in Needs Attention queue
4. Escalate ticket via rep console
5. Verify status change and system messages

## Files Modified/Created

### Backend
- `migrations/0005_rep_console.sql` - Database schema extensions
- `app/schemas.py` - Added 8 new Pydantic models for rep operations
- `app/rep.py` - Complete rep API module with 7 endpoints
- `app/tickets.py` - Enhanced with Phase 4 auto-flagging integration
- `app/main.py` - Added rep router import

### Frontend
- `app/(protected)/rep/page.tsx` - Complete rep console interface

## Success Criteria ✅

1. ✅ Rep console accessible to rep/admin only
2. ✅ Queue management with proper filtering and pagination
3. ✅ All ticket actions working with proper validation
4. ✅ Phase 4 auto-flagging integration functional
5. ✅ System messages for audit trail
6. ✅ Role-based access control enforced
7. ✅ Database migration applied successfully
8. ✅ Frontend interface complete with all required features

## Phase 5 Implementation Status: **COMPLETE** ✅

All specified features have been implemented according to the detailed requirements. The rep console provides a complete ticket management interface with proper security, validation, and integration with existing phases.