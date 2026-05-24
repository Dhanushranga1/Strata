# 🤖 AI Agent Master Prompt: TicketPilot Production-Ready Implementation

## Mission Brief

Transform the TicketPilot MVP into a production-ready, multi-tenant SaaS application suitable for portfolio/resume presentation. Focus on demonstrating software engineering best practices: error handling, data isolation, input validation, proper user flows, and professional architecture.

**Duration:** 3-4 weeks  
**Environment:** Local development (localhost)  
**End Goal:** Demo-ready application showing senior-level engineering practices

---

## Core Implementation Strategy

### Phase Division
- **Phase 1 (Week 1):** Foundation - Error handling, logging, validation framework
- **Phase 2 (Week 2):** Multi-Tenancy - Database changes, organization management
- **Phase 3 (Week 3):** User Flows - Complete all persona workflows
- **Phase 4 (Week 4):** Testing, Polish, Documentation

### Resume-Worthy Features to Highlight
1. Multi-tenant architecture with complete data isolation
2. Comprehensive error handling and logging system
3. Input validation and security hardening
4. Role-based access control (RBAC) within organizations
5. Professional user experience with loading states and error feedback
6. Clean API design with proper REST conventions
7. Database migrations and schema evolution

---

## 📋 PHASE 1: Foundation Layer (Week 1)

### Task 1.1: Error Handling System

**What to Build:**
Create a centralized error handling system that catches all exceptions and returns user-friendly messages while logging technical details.

**Files to Create:**
- Backend error handling module with custom exception classes
- Global exception handlers for the FastAPI application
- Frontend error handling utilities and hooks

**Logic and Checks:**

1. **Backend Error Classes:**
   - Create base exception class that all custom errors inherit from
   - Include fields: message (user-facing), status_code, details (technical)
   - Create specific exceptions: ValidationError (400), NotFoundError (404), UnauthorizedError (403), ForbiddenError (403), ConflictError (409)
   - Each exception should automatically log itself when raised

2. **Global Exception Handler:**
   - Catch all exceptions at the FastAPI app level
   - For custom exceptions: return the user-friendly message
   - For unexpected exceptions: log full stack trace, return generic "something went wrong"
   - Never expose technical details (stack traces, database errors) to users
   - Always include request context in logs (user_id, path, method, timestamp)

3. **Frontend Error Handling:**
   - Create axios interceptor to handle all API errors globally
   - Map HTTP status codes to user actions (401 → redirect to login, 403 → show "no permission", etc.)
   - Create error toast/notification system
   - Create error hook that components can use consistently

**Validation Checklist:**
- [ ] Can handle unexpected database errors without crashing
- [ ] Returns appropriate HTTP status codes for different error types
- [ ] User never sees stack traces or technical error messages
- [ ] All errors are logged with sufficient context for debugging
- [ ] Frontend shows user-friendly error messages in UI
- [ ] Errors include actionable information ("what went wrong" and "what to do")

---

### Task 1.2: Logging System

**What to Build:**
Structured logging system that captures all important events, API calls, and errors for debugging and monitoring.

**Logic and Checks:**

1. **Log Structure:**
   - Use JSON format for all logs (easy to parse/search)
   - Required fields in every log: timestamp, level, module, message
   - Optional context fields: user_id, org_id, request_id, duration_ms
   - Create separate log streams: general app logs, API request logs, error logs

2. **What to Log:**
   - Every API request: method, path, status code, duration, user_id, org_id
   - Authentication events: login success/failure, token refresh, logout
   - Data mutations: ticket created, status changed, member added, etc.
   - Errors: all exceptions with full context
   - Performance: slow queries (>1s), slow API calls (>2s)
   - Security events: failed permission checks, rate limit hits

3. **Log Levels:**
   - DEBUG: Detailed technical info (only in development)
   - INFO: Normal operations (requests, actions completed)
   - WARNING: Unexpected but handled (e.g., rate limit approaching)
   - ERROR: Exceptions and failures

4. **Log Storage:**
   - Console output for development (formatted for readability)
   - File output for production-simulation (logs/ directory)
   - Rotate log files daily, keep 7 days of history
   - Create separate files: app.log, api.log, error.log

**Validation Checklist:**
- [ ] Every API call is logged with timing information
- [ ] Can trace a user's complete journey through logs
- [ ] Errors include enough context to reproduce the issue
- [ ] Log files don't grow infinitely (rotation works)
- [ ] No sensitive data (passwords, tokens) in logs
- [ ] Performance impact is negligible (<5ms per request)
- [ ] Logs are searchable by user_id, org_id, timestamp

---

### Task 1.3: Input Validation Layer

**What to Build:**
Comprehensive validation system that sanitizes and validates all user inputs before processing.

**Logic and Checks:**

1. **String Validation:**
   - Always trim whitespace from start/end
   - Enforce minimum and maximum lengths
   - Check for empty strings when required
   - Remove or escape dangerous characters
   - Field-specific rules (title: 3-200 chars, description: 10-10000 chars)

2. **Email Validation:**
   - Check format with regex pattern
   - Convert to lowercase
   - Verify domain structure (basic)
   - Reject common typos if possible

3. **Slug Validation:**
   - Only allow lowercase alphanumeric and hyphens
   - No spaces, special characters, or uppercase
   - Must be 3-50 characters
   - Cannot start or end with hyphen
   - Must be unique (check database)

4. **HTML Sanitization:**
   - Remove all `<script>` tags
   - Remove event handlers (onclick, onload, etc.)
   - Remove javascript: URLs
   - Allow safe HTML tags if needed (p, b, i, a with href)
   - Escape HTML entities for user-generated content

5. **Enum Validation:**
   - Check value is in allowed list
   - Reject invalid values with clear error message
   - Case-insensitive comparison, normalize to lowercase

6. **UUID Validation:**
   - Check format matches UUID pattern
   - Verify resource exists in database
   - Verify user has permission to access resource

**Validation Points:**
- Backend: Validate in Pydantic schemas before any processing
- Frontend: Validate on form submission before API call
- Frontend: Real-time validation feedback for better UX
- Database: Constraints and checks as last line of defense

**Validation Checklist:**
- [ ] All user inputs pass through validation before database
- [ ] Validation errors show which field and why it failed
- [ ] XSS attacks prevented (HTML/JS sanitized)
- [ ] SQL injection prevented (parameterized queries, ORM)
- [ ] Max length limits prevent database overflow
- [ ] Frontend validation matches backend validation
- [ ] Clear error messages tell user how to fix input

---

### Task 1.4: Request Logging Middleware

**What to Build:**
Middleware that automatically logs every API request and response with timing information.

**Logic and Checks:**

1. **Request Start:**
   - Record timestamp when request arrives
   - Log: method, path, user_id (if authenticated), org_id (if in context)
   - Assign unique request_id for tracing

2. **Request Processing:**
   - Pass request to handler
   - Catch any exceptions and log them
   - Time the entire request-response cycle

3. **Request End:**
   - Record timestamp when response ready
   - Calculate duration (end - start)
   - Log: status code, duration_ms, response_size (optional)

4. **Special Cases:**
   - Slow requests (>2 seconds): Log at WARNING level
   - Errors (4xx, 5xx): Log at ERROR level with details
   - Health checks: Don't log (too noisy) or log at DEBUG only

**Validation Checklist:**
- [ ] Every API call appears in logs with timing
- [ ] Can identify slow endpoints from logs
- [ ] Can trace a single request's full lifecycle with request_id
- [ ] Middleware doesn't interfere with actual request handling
- [ ] Performance overhead is minimal

---

## 📋 PHASE 2: Multi-Tenancy Implementation (Week 2)

### Task 2.1: Database Schema Migration

**What to Build:**
Transform single-tenant database into multi-tenant with complete data isolation.

**Migration Steps:**

1. **Create Organizations Table:**
   - Fields: id (UUID, primary key), name, slug (unique), domain (optional), settings (JSONB), created_at, updated_at
   - Slug must be unique across all organizations
   - Settings stores org-specific configuration as JSON

2. **Create Organization Members Junction Table:**
   - Links users to organizations with roles
   - Fields: organization_id, user_id, role, joined_at
   - Composite primary key (organization_id, user_id)
   - Roles: 'owner' (created org), 'admin' (manage members), 'rep' (handle tickets), 'member' (basic access)
   - One user can be in multiple organizations with different roles

3. **Add organization_id to ALL Existing Tables:**
   - Tables to update: tickets, messages, documents, chunks, any other user data
   - Add as foreign key referencing organizations(id)
   - Create indexes on organization_id for query performance
   - Initially nullable, then migrate data, then make NOT NULL

4. **Migrate Existing Data:**
   - Create a "Default Organization" for existing data
   - Update all existing records to point to default org
   - Assign all existing users as members of default org
   - Verify no records left without organization_id

5. **Make organization_id Required:**
   - After migration, set NOT NULL constraint
   - Add indexes on (organization_id, other_frequently_queried_fields)

6. **Add Row-Level Security (RLS):**
   - Enable RLS on all multi-tenant tables
   - Create policies: users can only SELECT/UPDATE/DELETE records where organization_id matches their membership
   - Exceptions: service role can bypass RLS for admin operations

**Validation Checklist:**
- [ ] Organizations table created successfully
- [ ] All existing tables have organization_id column
- [ ] All existing data migrated to default organization
- [ ] Foreign key constraints working (cascade deletes)
- [ ] Indexes created for performance
- [ ] RLS policies prevent cross-org data access
- [ ] Can create new organizations via SQL/API
- [ ] Rollback script exists in case of migration failure

---

### Task 2.2: Organization Management API

**What to Build:**
Complete REST API for managing organizations and their members.

**Endpoints and Logic:**

1. **POST /api/organizations (Create Organization):**
   - Input: name (required, 3-100 chars), slug (optional, auto-generate from name if not provided)
   - Validation: slug must be unique, valid format (lowercase, alphanumeric, hyphens)
   - Logic: Create organization, add creator as 'owner', return organization details
   - Checks: User not already owner of too many orgs (limit to 5 for MVP)

2. **GET /api/organizations (List User's Organizations):**
   - Returns all organizations user is member of
   - Include user's role in each organization
   - Include member count in each organization
   - Sort by joined_at descending (most recent first)

3. **GET /api/organizations/{org_id} (Get Organization Details):**
   - Permission: Must be member of organization
   - Returns: full organization details, settings, member count, user's role
   - Includes: created_at, current plan (if billing added), usage stats (basic)

4. **PATCH /api/organizations/{org_id} (Update Organization):**
   - Permission: Must be 'admin' or 'owner'
   - Can update: name, settings
   - Cannot update: slug (immutable for stability), id
   - Validation: Same as create

5. **GET /api/organizations/{org_id}/members (List Members):**
   - Permission: Must be member
   - Returns: list of members with email, role, joined_at
   - Sort by role (owners first), then joined_at

6. **POST /api/organizations/{org_id}/members (Add Member):**
   - Permission: Must be 'admin' or 'owner'
   - Input: email (required), role (default: 'member')
   - Logic: Add user to organization with specified role
   - Checks: Email exists in system (for MVP, can invite non-users in future), not already a member, valid role

7. **DELETE /api/organizations/{org_id}/members/{user_id} (Remove Member):**
   - Permission: Must be 'admin' or 'owner'
   - Logic: Remove user from organization
   - Checks: Cannot remove last owner, cannot remove yourself if you're last owner, user exists in org

8. **PATCH /api/organizations/{org_id}/members/{user_id} (Update Member Role):**
   - Permission: Must be 'owner' (only owners can change roles)
   - Input: role
   - Checks: Cannot demote last owner, valid role, user exists in org

**Business Logic Checks:**

- **Organization Creation:**
  - Slug auto-generation: remove special chars, replace spaces with hyphens, lowercase, append random string if collision
  - Creator automatically becomes 'owner'
  - Can have multiple owners (unlike some systems)

- **Role Hierarchy:**
  - owner: Can do everything including delete org
  - admin: Can manage members and settings
  - rep: Can handle tickets, access rep console
  - member: Can create tickets, view own tickets

- **Role Change Rules:**
  - Must always have at least one owner
  - Only owners can promote to owner
  - Owners can demote other owners (but not last one)
  - Admins can change rep/member roles only

- **Deletion Rules:**
  - Cannot delete organization with active subscriptions (future)
  - Cannot remove last owner
  - Deleting organization cascades to all related data (tickets, messages, etc.)
  - Soft delete recommended (mark as deleted, keep data for 30 days)

**Validation Checklist:**
- [ ] Can create organization with valid data
- [ ] Slug generation works correctly
- [ ] Duplicate slug rejected
- [ ] User becomes owner of created org
- [ ] Can list all user's organizations
- [ ] Can add members to organization
- [ ] Cannot add duplicate members
- [ ] Can update member roles with proper permissions
- [ ] Cannot remove last owner
- [ ] Role hierarchy enforced correctly

---

### Task 2.3: Organization Context Middleware

**What to Build:**
Middleware that extracts and validates organization context for every request.

**Logic Flow:**

1. **Extract Organization Identifier:**
   - Check for `X-Organization-ID` header (primary method)
   - Check for `org_id` query parameter (fallback)
   - Check for `organization_id` in request body (for POST/PATCH)
   - If none provided, use user's default/primary organization

2. **Validate Organization Access:**
   - Verify organization exists in database
   - Verify current user is member of this organization
   - Retrieve user's role in this organization
   - Reject request if user not member (403 Forbidden)

3. **Attach Context to Request:**
   - Store in request.state: org_id, user_role_in_org
   - This makes it available to all route handlers
   - Include in logs for tracing

4. **Skip for Certain Routes:**
   - Authentication routes (/api/auth/*)
   - Organization creation route (POST /api/organizations)
   - Health check routes
   - Public routes (if any)

5. **Handle Edge Cases:**
   - User with no organizations: guide to create one
   - Invalid organization ID: clear error message
   - User removed from organization mid-session: handle gracefully

**Validation Checklist:**
- [ ] Middleware applied to all protected routes
- [ ] Organization context available in all handlers
- [ ] User cannot access other organization's data
- [ ] Proper error messages when org not found or no access
- [ ] Performance: single database query to verify membership
- [ ] Frontend knows to send organization ID in header
- [ ] Switching organizations works seamlessly

---

### Task 2.4: Update All API Endpoints for Multi-Tenancy

**What to Change:**
Every endpoint that deals with organization-specific data must be updated.

**Systematic Changes Required:**

1. **Add Organization Filter to ALL Queries:**
   - Before: `SELECT * FROM tickets WHERE customer_id = ?`
   - After: `SELECT * FROM tickets WHERE organization_id = ? AND customer_id = ?`
   - This applies to: tickets, messages, documents, chunks, analytics, everything

2. **Add Organization ID to All Creates:**
   - When creating tickets: include organization_id from request.state
   - When creating documents: include organization_id
   - When creating messages: include organization_id
   - Never trust client to send organization_id, always use middleware context

3. **Verify Ownership Before Updates/Deletes:**
   - Before updating: verify resource belongs to user's current org
   - Before deleting: verify resource belongs to user's current org
   - Return 404 (not 403) if resource not found in current org (security)

4. **Update Permission Checks:**
   - Check user's role in CURRENT organization (not global role)
   - Admin in Org A cannot admin Org B
   - Use request.state.user_role_in_org for checks

5. **Update Response Data:**
   - Remove organization_id from API responses (clients already know it)
   - Or include it for verification purposes
   - Ensure no data leakage from other orgs

**Specific Endpoint Updates:**

**Tickets API:**
- List tickets: filter by organization_id
- Get ticket: verify belongs to current org
- Create ticket: auto-assign organization_id
- Update ticket: verify belongs to current org
- Add message: verify ticket belongs to current org
- Assign rep: verify rep is member of current org

**Knowledge Base API:**
- List documents: filter by organization_id
- Upload document: assign to current organization
- Search knowledge: search only current org's documents
- RAG queries: use only current org's vector embeddings

**Rep Console API:**
- Queue: show only tickets from current org
- Assign: can only assign to reps in current org
- Stats: calculate only for current org

**Admin API:**
- Analytics: scope to current org
- User management: only show/manage users in current org
- Settings: org-specific settings only

**Validation Checklist:**
- [ ] All database queries include organization_id filter
- [ ] Cannot access other organization's data through any endpoint
- [ ] Creating resources automatically uses current org context
- [ ] Permission checks use org-specific roles
- [ ] Rep assignment only allows reps from same org
- [ ] Knowledge base search isolated by organization
- [ ] Analytics show only current org's data

---

### Task 2.5: Update Authentication Flow

**What to Change:**
Authentication needs to be aware of organizations and default org selection.

**Logic Updates:**

1. **Login Response:**
   - After successful login, fetch user's organizations
   - Include organizations list in response: [{ id, name, slug, role }]
   - Mark one as "default" (most recently accessed, or first joined)
   - Frontend stores this list locally

2. **Token Payload:**
   - JWT token should include user_id, email, but NOT organization_id
   - Organization context comes from request header, not token
   - This allows switching orgs without re-authenticating

3. **Refresh Token:**
   - When refreshing token, also refresh organizations list
   - User might have been added to new orgs or removed from others

4. **First-Time User Experience:**
   - If user has no organizations after signup, prompt to create one
   - Cannot use app without being in at least one organization
   - Or auto-create personal organization for user

**Validation Checklist:**
- [ ] Login returns list of user's organizations
- [ ] Frontend stores organization list
- [ ] Can switch between organizations without re-login
- [ ] Organization membership updates reflected on token refresh
- [ ] New users guided to create organization

---

## 📋 PHASE 3: User Flows & Frontend (Week 3)

### Task 3.1: Organization Selector Component

**What to Build:**
UI component that lets users switch between organizations.

**Design Requirements:**

1. **Placement:**
   - In app header/navbar (always visible)
   - Shows current organization name
   - Dropdown to switch organizations

2. **Functionality:**
   - Lists all organizations user is member of
   - Shows user's role in each org
   - Clicking switches context to that org
   - "Create New Organization" option at bottom

3. **State Management:**
   - Store current organization in global state (React Context or Zustand)
   - Store organization ID in localStorage for persistence
   - On organization change: update localStorage, update global state, refresh current page data

4. **Visual Feedback:**
   - Show loading spinner while switching
   - Show checkmark next to current organization
   - Show role badge next to each organization name

**Validation Checklist:**
- [ ] Dropdown shows all user's organizations
- [ ] Current organization clearly indicated
- [ ] Switching organization refreshes data correctly
- [ ] Selection persists across page refreshes
- [ ] New organizations appear in list immediately after creation
- [ ] Visually clear and easy to use

---

### Task 3.2: Signup Flow with Organization Creation

**What to Build:**
Enhanced signup flow that creates organization for new users.

**Flow Steps:**

1. **Step 1: Account Creation**
   - Email, password, name
   - Standard validation
   - Create user account

2. **Step 2: Organization Setup (Immediately After Signup)**
   - "Let's set up your workspace"
   - Input: Organization name (required)
   - Auto-generate slug from name, show preview
   - Allow manual slug edit
   - Button: "Create Workspace"

3. **Step 3: Confirmation**
   - "Welcome to [Org Name]!"
   - Brief onboarding: "Here's how to create your first ticket"
   - Button: "Go to Dashboard"

4. **Alternative Flow (Join Existing Org):**
   - Some users might have invite links (future feature)
   - "Have an invite code?" option
   - Enter code, join existing organization instead

**Logic Checks:**
- Organization name required (3-100 chars)
- Slug must be unique (check in real-time)
- User becomes owner of created organization
- Cannot skip organization creation
- Redirect to dashboard after completion

**Validation Checklist:**
- [ ] Cannot sign up without creating organization
- [ ] Organization name validation works
- [ ] Slug uniqueness validated in real-time
- [ ] User becomes owner automatically
- [ ] Smooth flow from signup to usable app
- [ ] Clear instructions at each step

---

### Task 3.3: Organization Settings Page

**What to Build:**
Admin page for managing organization and members.

**Sections:**

1. **General Settings:**
   - Organization name (editable by admin/owner)
   - Slug (display only, cannot change)
   - Domain (optional, for future features)
   - Created date
   - Save button

2. **Members Management:**
   - Table showing: Member email, Role, Joined date
   - Actions: Change role (dropdown), Remove member
   - "Add Member" button → modal with email input and role selector
   - Owner badge for owners
   - Cannot remove yourself if you're last owner

3. **Permissions Gating:**
   - Only show "General Settings" to admins/owners
   - All members can see members list
   - Only admins/owners can add/remove members
   - Only owners can change roles to/from owner

4. **Danger Zone (Owners Only):**
   - Delete Organization button
   - Requires confirmation modal
   - Warns about data loss

**UI/UX Considerations:**
- Inline editing where possible (name)
- Confirmation dialogs for destructive actions (remove member, delete org)
- Success/error toasts for all actions
- Optimistic updates where safe
- Loading states for all async operations

**Validation Checklist:**
- [ ] Only authorized roles can access each section
- [ ] Member list accurate and updated
- [ ] Can add members with proper validation
- [ ] Can remove members (except last owner)
- [ ] Can change roles with proper rules
- [ ] Cannot break organization (remove last owner, etc.)
- [ ] Clear feedback for all actions

---

### Task 3.4: Update All Frontend Forms with Loading and Error States

**What to Improve:**
Every form in the application needs proper UX patterns.

**Standard Form Pattern:**

1. **Before Submit:**
   - All fields enabled
   - Submit button enabled
   - No error messages

2. **During Submit (Loading):**
   - Disable all input fields
   - Disable submit button
   - Show loading spinner on button
   - Button text changes: "Create Ticket" → "Creating..."

3. **On Success:**
   - Show success toast: "Ticket created successfully!"
   - Clear form OR navigate to new resource
   - Re-enable form

4. **On Error:**
   - Re-enable form
   - Show error message (toast or inline)
   - Highlight invalid fields if validation error
   - Keep user's input (don't clear form)
   - Give actionable next step

**Forms to Update:**
- Create ticket form
- Add message form
- Create organization form
- Add member form
- Update profile form
- Upload document form
- Any other forms in the app

**Validation Patterns:**
- Real-time validation for emails, slugs
- Character count for text fields
- Disable submit if required fields empty
- Show validation errors inline
- Match frontend validation with backend rules

**Validation Checklist:**
- [ ] All forms have loading states
- [ ] Cannot double-submit (button disabled)
- [ ] Errors shown clearly with actionable messages
- [ ] Success feedback always provided
- [ ] Form data preserved on error
- [ ] Loading spinners consistent across app
- [ ] Keyboard accessibility (Enter to submit, Escape to cancel)

---

### Task 3.5: Complete User Flows for All Personas

**What to Test:**
Ensure complete, logical flows for each user type.

**Customer Flow:**

1. **Signup Journey:**
   - Sign up → Create organization → See dashboard
   - Dashboard shows "Create your first ticket" if empty
   - Create ticket form is easy to find and use

2. **Create Ticket Flow:**
   - Fill form with title, description, priority
   - See validation feedback
   - Submit → See success message
   - Redirect to ticket detail page
   - Can see ticket status and add messages

3. **Ticket Interaction Flow:**
   - View all own tickets in dashboard
   - Click ticket to see detail and conversation
   - Add message to ticket
   - Receive updates when rep responds
   - Can see ticket progress (status changes)

**Rep Flow:**

1. **Login and Queue Access:**
   - Log in → See rep console
   - Queue shows unassigned tickets from current org
   - Can filter by priority, category, age

2. **Handle Ticket Flow:**
   - Click ticket to view details
   - See customer's issue and AI-suggested response
   - Can assign to self or other rep
   - Add message to customer
   - Change ticket status (in_progress, resolved)
   - Use internal notes (not visible to customer)

3. **Use Knowledge Base Flow:**
   - Can search knowledge base while viewing ticket
   - See relevant documents
   - Copy snippets to use in response
   - Mark ticket as resolved when done

**Admin Flow:**

1. **Organization Management:**
   - Access org settings
   - See all members and their roles
   - Add new reps or admins
   - Remove inactive members
   - View analytics dashboard

2. **Knowledge Base Management:**
   - Upload new documents
   - See all documents
   - Delete outdated documents
   - See which documents used most (analytics)

3. **Analytics Access:**
   - View ticket volume trends
   - See rep performance
   - See AI usage stats
   - See response time metrics

**Owner Flow:**
- Everything admin can do, plus:
- Promote members to admin or owner
- Delete organization (with safeguards)
- Change organization settings

**Validation Checklist:**
- [ ] Each persona can complete their primary tasks
- [ ] No dead ends (every page has logical next action)
- [ ] Permissions properly enforced (rep can't access admin features)
- [ ] Navigation is intuitive and clear
- [ ] Can complete common tasks in <3 clicks
- [ ] Error states don't trap users (can always go back/retry)

---

## 📋 PHASE 4: Testing, Polish, Documentation (Week 4)

### Task 4.1: Manual Testing Scenarios

**What to Test:**
Systematically test all critical paths and edge cases.

**Data Isolation Testing:**

1. **Setup:**
   - Create 3 test organizations: Org A, Org B, Org C
   - Create test users: User1 (member of A), User2 (member of B), User3 (member of A and B)
   - Create tickets in each organization

2. **Test Cases:**
   - Log in as User1 → Switch to Org A → Verify can only see Org A tickets
   - Log in as User2 → Verify cannot see Org A tickets
   - Log in as User3 → Switch between Org A and Org B → Verify data changes correctly
   - Try to access Org B ticket directly (via URL) while in Org A context → Should fail with 404
   - Try to manipulate org_id in API request → Should fail (middleware overrides)

3. **Expected Results:**
   - Complete data isolation between organizations
   - No way to access other org's data through UI or API
   - Switching organizations works smoothly

**Role-Based Access Testing:**

1. **Setup:**
   - Create users with different roles in same org: Owner, Admin, Rep, Member

2. **Test Cases:**
   - Log in as Member → Try to access org settings → Should fail
   - Log in as Rep → Try to access rep console → Should work
   - Log in as Rep → Try to add member → Should fail
   - Log in as Admin → Try to add member → Should work
   - Log in as Admin → Try to promote to owner → Should fail
   - Log in as Owner → Try to promote to owner → Should work
   - Try to remove last owner → Should fail

3. **Expected Results:**
   - Each role can only access permitted features
   - Clear error messages when access denied
   - No way to bypass role restrictions

**Error Handling Testing:**

1. **Test Cases:**
   - Submit form with invalid email → See validation error
   - Submit form with empty required field → See validation error
   - Try to create ticket with 10,000 character title → See length error
   - Disconnect internet and try to submit form → See network error
   - Submit form twice rapidly (double submit) → Second request ignored
   - Enter SQL injection in form field → Harmless, properly escaped
   - Enter XSS payload in form field → Sanitized, not executed

2. **Expected Results:**
   - All validation errors shown clearly
   - No crashes or 500 errors
   - User can correct and resubmit
   - Security vulnerabilities prevented

**User Flow Testing:**

1. **Complete Journeys:**
   - New user signup → Create org → Create first ticket → View ticket
   - Rep login → View queue → Claim ticket → Respond → Resolve ticket
   - Admin login → Add new rep → Rep receives access → Can handle tickets
   - Owner login → Change org name → Remove member → Member loses access

2. **Expected Results:**
   - Every flow completes without errors
   - Logical progression at each step
   - Clear feedback after each action

**Validation Checklist:**
- [ ] Data isolation between orgs verified
- [ ] Role permissions working correctly
- [ ] Cannot bypass security through any method
- [ ] All forms validate input properly
- [ ] Error messages helpful and actionable
- [ ] Can complete all user journeys successfully
- [ ] No crashes or unexpected errors

---

### Task 4.2: Database Integrity Checks

**What to Verify:**
Ensure database is in consistent, correct state.

**Checks to Run:**

1. **Foreign Key Integrity:**
   - All organization_id values reference existing organizations
   - All user_id values in organization_members reference real users
   - All ticket customer_id and rep_id values reference real users
   - No orphaned records

2. **Required Fields:**
   - No NULL values in organization_id columns (after migration)
   - No tickets without customer_id
   - No messages without ticket_id
   - No documents without organization_id

3. **Business Logic Integrity:**
   - Every organization has at least one owner
   - No user is member of org with multiple roles (should be impossible)
   - Slugs are unique across all organizations
   - All timestamps are valid (not future dates)

4. **Data Consistency:**
   - Ticket message count matches actual messages
   - Document chunk count matches actual chunks
   - Organization member count is accurate

**SQL Queries to Run:**
```sql
-- Find tickets without organization
SELECT COUNT(*) FROM tickets WHERE organization_id IS NULL;
-- Should be 0

-- Find organizations without owners
SELECT o.id, o.name 
FROM organizations o 
WHERE NOT EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = o.id AND om.role = 'owner'
);
-- Should be empty

-- Find orphaned tickets (customer not in same org)
SELECT t.id 
FROM tickets t
LEFT JOIN organization_members om ON t.organization_id = om.organization_id AND t.customer_id = om.user_id
WHERE om.user_id IS NULL;
-- Should be empty
```

**Validation Checklist:**
- [ ] No NULL organization_id values in production tables
- [ ] All foreign keys valid
- [ ] Every organization has at least one owner
- [ ] No duplicate memberships
- [ ] Counts and aggregates accurate
- [ ] No orphaned records

---

### Task 4.3: Performance Check

**What to Measure:**
Ensure application performs reasonably well even with moderate data.

**Load Test Data:**
- 10 organizations
- 50 users across organizations
- 500 tickets total
- 2000 messages total
- 100 knowledge base documents

**Performance Benchmarks:**

1. **API Response Times (Localhost):**
   - GET ticket list: <300ms
   - GET single ticket: <200ms
   - POST create ticket: <500ms
   - GET rep queue: <500ms
   - AI query (RAG): <3000ms
   - Dashboard analytics: <1000ms

2. **Database Queries:**
   - No N+1 queries (check logs)
   - All queries have proper indexes
   - Complex queries (analytics) use aggregates efficiently

3. **Frontend Performance:**
   - Initial page load: <2 seconds
   - Navigation between pages: <500ms
   - Form submission feedback: <100ms (optimistic UI)
   - Large lists virtualized (if >100 items)

**Optimization Strategies:**
- Add indexes on frequently queried fields: (organization_id, status), (organization_id, created_at)
- Use database connection pooling
- Cache expensive computations (analytics)
- Paginate large lists (tickets, messages)
- Lazy load non-critical data

**Validation Checklist:**
- [ ] All API calls return within acceptable time
- [ ] No slow queries (>1 second) in logs
- [ ] Database properly indexed
- [ ] Frontend feels responsive
- [ ] Large lists don't freeze UI
- [ ] AI queries show loading state (they're slow)

---

### Task 4.4: Code Quality and Documentation

**What to Clean Up:**
Prepare code for portfolio/resume review.

**Code Organization:**
- Consistent file and folder structure
- Related code grouped together
- Clear module boundaries
- No duplicate code (DRY principle)

**Code Style:**
- Consistent naming conventions (camelCase for JS, snake_case for Python)
- Descriptive variable names (no single letters except loops)
- Functions are small and focused (<50 lines)
- Comments explain "why" not "what"
- Remove commented-out code
- Remove console.log and print statements (use logger)

**Type Safety:**
- TypeScript interfaces for all data types
- Pydantic models for all API schemas
- No `any` types in TypeScript
- Proper type hints in Python functions

**Error Handling:**
- Try-catch around all async operations
- Never silently catch errors
- All errors logged with context
- User-friendly error messages everywhere

**Security Checklist:**
- No secrets in code (use environment variables)
- No sensitive data in logs
- Input validation on all user inputs
- SQL injection prevented (parameterized queries)
- XSS prevented (sanitized HTML)
- CORS properly configured
- Authentication required for all protected routes

**Documentation to Write:**

1. **README.md (Root):**
   - Project description and features
   - Tech stack
   - Setup instructions (local development)
   - Environment variables needed
   - How to run migrations
   - How to run tests
   - Architecture overview

2. **API Documentation:**
   - All endpoints documented with: method, path, purpose, auth required, request body, response format, error codes
   - Can use FastAPI's auto-generated docs or write manually
   - Examples for each endpoint

3. **User Guide (Brief):**
   - How to create organization
   - How to create ticket
   - How to use rep console
   - How to manage members

4. **Architecture Document:**
   - High-level system design
   - Database schema diagram
   - Multi-tenancy explanation
   - Authentication flow
   - Organization context flow

**Validation Checklist:**
- [ ] Code is clean and well-organized
- [ ] Consistent style throughout
- [ ] No security vulnerabilities
- [ ] Comprehensive README with setup instructions
- [ ] API endpoints documented
- [ ] Architecture clearly explained
- [ ] Can set up project from scratch using README

---

### Task 4.5: Resume-Ready Presentation

**What to Prepare:**
Package the project for maximum resume impact.

**GitHub Repository:**
- Clean, professional README with screenshots
- Clear project description highlighting features:
  - "Multi-tenant SaaS architecture with complete data isolation"
  - "Role-based access control (RBAC) with 4 permission levels"
  - "AI-powered ticket responses using RAG with vector embeddings"
  - "Production-ready error handling and logging system"
  - "Comprehensive input validation and security hardening"
- Tech stack prominently displayed
- Demo video or GIF showing key features
- Architecture diagram
- Setup instructions that actually work
- License file

**Demo Preparation:**
- Create seed data script for instant demo
- 3 test organizations with realistic data
- Different user types (customer, rep, admin, owner)
- Sample tickets showing full conversation flow
- Knowledge base with sample documents

**Key Features to Highlight:**

1. **Multi-Tenancy:**
   - "Implemented complete data isolation for multi-tenant SaaS"
   - Show organization switcher
   - Demonstrate user can't access other org's data

2. **Security:**
   - "Comprehensive input validation preventing XSS and SQL injection"
   - "Row-level security policies enforcing organization boundaries"
   - Show validation examples

3. **User Experience:**
   - "Professional UX with loading states and error handling"
   - Show smooth forms with validation feedback
   - Demonstrate error recovery

4. **Architecture:**
   - "Clean architecture with separation of concerns"
   - "Middleware-based request processing pipeline"
   - Show code organization

5. **AI Features:**
   - "RAG-based AI assistant with vector search"
   - "Context-aware responses from knowledge base"
   - Demonstrate AI query with relevant response

**Interview Talking Points:**
- "Built multi-tenant SaaS from scratch with 40 API endpoints"
- "Designed and implemented database migration strategy for existing data"
- "Created middleware pipeline for authentication, authorization, and logging"
- "Implemented comprehensive error handling catching 100% of exceptions"
- "Used TypeScript and Pydantic for end-to-end type safety"
- "Achieved <500ms API response times with proper indexing"

**Validation Checklist:**
- [ ] GitHub README is comprehensive and professional
- [ ] Screenshots show polished UI
- [ ] Can demo all major features in 5 minutes
- [ ] Demo data pre-loaded and realistic
- [ ] Architecture clearly explained
- [ ] Can articulate technical decisions made
- [ ] Project looks like senior engineer built it

---

## 🎯 AI Agent Action Plan Tracking

### Action Plan Template

**The AI agent should maintain this checklist and update after completing each task:**

```markdown
## Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Task 1.1: Error Handling System
  - [ ] Created error classes
  - [ ] Added global exception handlers
  - [ ] Tested error responses
  - Status: Not Started | In Progress | Completed
  - Blocker: None
  
- [ ] Task 1.2: Logging System
  - [ ] Set up JSON logging
  - [ ] Created log files
  - [ ] Added request logging middleware
  - Status: Not Started
  - Blocker: None

[Continue for all tasks...]

### Phase 2: Multi-Tenancy (Week 2)
- [ ] Task 2.1: Database Migration
  - [ ] Created organizations table
  - [ ] Added organization_id to all tables
  - [ ] Migrated existing data
  - [ ] Verified data integrity
  - Status: Not Started
  - Blocker: None

[Continue...]

### Current Sprint (This Week):
Focus: [Phase Name]
Tasks: 
1. [Task 1]
2. [Task 2]
3. [Task 3]

### Completed This Session:
- [x] Task description
- [x] Task description

### Blockers:
- Blocker 1: Description and plan to resolve
- Blocker 2: Description and plan to resolve

### Next Session Goals:
1. Complete [Task]
2. Start [Task]
3. Test [Feature]

### Questions for Human:
1. Question about requirement
2. Question about design decision
```

---

## 🚨 Critical Logic Checks

**The AI agent must verify these logical constraints throughout implementation:**

### Data Integrity Checks

1. **Organization Ownership:**
   - Every organization MUST have at least one owner
   - Cannot delete last owner
   - Cannot change last owner's role
   - Organization creation automatically makes creator owner

2. **Organization Membership:**
   - User can be member of multiple organizations
   - User has one role per organization (not multiple)
   - User cannot be member of same org twice
   - Removing user from org cascades to their ticket assignments

3. **Data Isolation:**
   - ALL queries MUST filter by organization_id
   - NEVER allow cross-organization data access
   - User cannot see/modify data from orgs they're not in
   - API must use middleware context, not client-provided org_id

4. **Ticket Constraints:**
   - Ticket must belong to an organization
   - Customer must be member of ticket's organization
   - Rep (if assigned) must be member of ticket's organization
   - Messages can only be added by ticket participants or admins

5. **Knowledge Base Constraints:**
   - Documents belong to exactly one organization
   - Chunks inherit organization from parent document
   - RAG queries only search current organization's documents
   - Cannot upload document without organization context

### Permission Checks

1. **Role Hierarchy (in descending power):**
   - owner: Full access, can delete org, promote to owner
   - admin: Manage members (except owners), manage settings
   - rep: Handle tickets, access rep console
   - member: Create tickets, view own tickets

2. **Permission Rules:**
   - Only owners can promote to owner
   - Only owners can demote owners
   - Admins can manage reps and members only
   - Reps cannot access admin features
   - Members cannot access rep console

3. **Resource Access:**
   - Can only access resources in current organization
   - Tickets: owner sees all, rep sees assigned/unassigned, customer sees own
   - Analytics: admin/owner only
   - Settings: admin/owner only
   - Members: all can see, admin/owner can manage

### Validation Rules

1. **String Fields:**
   - Ticket title: 3-200 characters, no HTML
   - Ticket description: 10-10,000 characters, sanitized HTML allowed
   - Organization name: 3-100 characters
   - Message content: 1-5,000 characters
   - Always trim whitespace

2. **Format Validation:**
   - Email: valid format, lowercase
   - Slug: lowercase alphanumeric + hyphens, 3-50 chars, unique
   - UUID: valid UUID format
   - Enum: must be in allowed values

3. **Business Rules:**
   - Cannot create ticket in org you're not member of
   - Cannot assign ticket to rep not in same org
   - Cannot upload document >10MB
   - Rate limit: 100 requests per minute per user

### Error Handling Rules

1. **Never expose:**
   - Stack traces to users
   - Database errors
   - Internal paths
   - Debug information

2. **Always provide:**
   - Clear error message
   - What went wrong
   - How to fix (if possible)
   - HTTP status code

3. **Always log:**
   - Request context (user, org, path)
   - Error type and message
   - Stack trace (backend only)
   - Timestamp

### Security Checks

1. **Input Validation:**
   - Validate ALL user inputs
   - Sanitize HTML content
   - Reject malformed data
   - Use parameterized queries

2. **Authentication:**
   - Verify JWT signature
   - Check token expiration
   - Reject invalid tokens
   - Require auth for protected routes

3. **Authorization:**
   - Verify organization membership
   - Check role permissions
   - Verify resource ownership
   - Fail closed (deny by default)

---

## 📊 Success Metrics

**After completion, the project should achieve:**

### Technical Metrics
- [ ] 100% of API endpoints have error handling
- [ ] 100% of database queries filter by organization
- [ ] 0 cross-organization data leaks in testing
- [ ] API response times <500ms (excluding AI)
- [ ] All forms have validation and loading states
- [ ] TypeScript with no `any` types
- [ ] Python with full type hints

### Functional Metrics
- [ ] Can create 10+ organizations and switch between them
- [ ] Can have 50+ users across organizations
- [ ] Can handle 500+ tickets with good performance
- [ ] All user flows work end-to-end
- [ ] Roles and permissions enforced correctly
- [ ] Data isolation verified through testing

### Resume Metrics (What to Claim)
- [ ] "Multi-tenant SaaS architecture serving unlimited organizations"
- [ ] "Implemented RBAC with 4 permission levels and role hierarchy"
- [ ] "Designed and executed zero-downtime database migration"
- [ ] "Built comprehensive error handling system with structured logging"
- [ ] "Achieved <500ms P95 API latency through query optimization"
- [ ] "Created AI-powered features using RAG with vector embeddings"
- [ ] "Developed 40+ REST API endpoints with OpenAPI documentation"

### Portfolio Metrics
- [ ] GitHub repository looks professional
- [ ] Can demo project in under 5 minutes
- [ ] README clearly explains architecture
- [ ] Screenshots show polished UI
- [ ] Can answer technical questions about any component
- [ ] Code quality suitable for review by senior engineers

---

## 🎬 Final Deliverable Checklist

**Before considering the project complete:**

### Code Quality
- [ ] No commented-out code
- [ ] No debug console.log or print statements
- [ ] Consistent code style throughout
- [ ] No duplicate code
- [ ] All functions <50 lines
- [ ] Descriptive variable names
- [ ] Type safety everywhere

### Functionality
- [ ] All user flows working
- [ ] All forms validated
- [ ] All error cases handled
- [ ] Loading states everywhere
- [ ] Data isolation verified
- [ ] Permissions enforced

### Documentation
- [ ] Comprehensive README
- [ ] API documentation complete
- [ ] Architecture explained
- [ ] Setup instructions work
- [ ] Demo data script included
- [ ] Comments on complex logic

### Testing
- [ ] Manual testing completed
- [ ] Multi-tenancy verified
- [ ] Security tested
- [ ] Performance acceptable
- [ ] No crashes or 500 errors
- [ ] Edge cases handled

### Presentation
- [ ] GitHub repository polished
- [ ] Screenshots added
- [ ] Demo prepared
- [ ] Can explain all features
- [ ] Interview talking points ready
- [ ] Resume bullets written

---

## 🚀 Final Notes for AI Agent

**Priorities:**
1. **Data Isolation First:** Multi-tenancy MUST work perfectly. This is the #1 thing that can go wrong.
2. **Error Handling Second:** Never crash. Always show user-friendly errors.
3. **User Experience Third:** Loading states and validation make it feel professional.
4. **Polish Last:** Code quality and documentation for resume presentation.

**When Stuck:**
- Start with the database (get multi-tenancy schema right first)
- Then backend (enforce data isolation in every query)
- Then frontend (make it work, then make it pretty)
- Document as you go (don't leave for end)

**Quality Over Features:**
- Better to have 80% features working perfectly than 100% features working poorly
- Focus on the core flows: create org, create ticket, handle ticket, manage members
- Everything else is secondary

**Remember:**
This is for a fresher resume. The goal is to demonstrate:
- Understanding of production engineering
- Ability to handle complexity (multi-tenancy)
- Security awareness (validation, permissions)
- Professional practices (error handling, logging)
- Clean code and documentation

**You've got this! Build something you're proud to show.**