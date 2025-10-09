# TicketPilot MVP - Detailed Implementation Specification

## 1. Project Structure & Setup

### Directory Layout
```
ticketpilot/
├── frontend/                 # Next.js app
│   ├── app/                  # App Router pages
│   ├── components/           # Reusable components
│   ├── lib/                  # Utils, Supabase client, API client
│   └── public/               # Static assets
├── backend/                  # FastAPI service
│   ├── api/                  # Endpoint routers
│   ├── models/               # Pydantic models
│   ├── services/             # Business logic
│   ├── db/                   # Database connection & queries
│   └── data/                 # FAISS index storage
├── migrations/               # SQL migration files
└── .env                      # Environment variables
```

### Package Dependencies

**Frontend (package.json)**
- next: ^14.0.0
- react: ^18.2.0
- @supabase/supabase-js: ^2.39.0
- @supabase/auth-ui-react: ^0.4.0
- @supabase/auth-ui-shared: ^0.1.0
- axios: ^1.6.0
- react-hot-toast: ^2.4.0
- date-fns: ^3.0.0
- clsx: ^2.0.0
- tailwindcss: ^3.4.0

**Backend (requirements.txt)**
- fastapi==0.109.0
- uvicorn==0.27.0
- python-jose[cryptography]==3.3.0
- python-multipart==0.0.6
- psycopg2-binary==2.9.9
- sqlalchemy==2.0.25
- pydantic==2.5.0
- faiss-cpu==1.7.4
- google-generativeai==0.3.2
- pypdf==3.17.0
- python-docx==1.1.0
- chardet==5.2.0
- numpy==1.24.0

## 2. Database Schema (PostgreSQL)

### Complete Table Definitions

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (managed by Supabase, reference only)
-- Assume exists with: id, email, created_at

-- User roles table
CREATE TABLE user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'rep')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets table
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title VARCHAR(200) NOT NULL,
    product VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'escalated', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'rep', 'system')),
    text TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb,
    confidence DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KB sources table
CREATE TABLE kb_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    product VARCHAR(100),
    type VARCHAR(20) NOT NULL CHECK (type IN ('file', 'text')),
    location VARCHAR(500),
    file_hash VARCHAR(64),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KB chunks table  
CREATE TABLE kb_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES kb_sources(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    char_start INTEGER,
    char_end INTEGER,
    UNIQUE(source_id, chunk_index)
);

-- Indexes
CREATE INDEX idx_tickets_user_status ON tickets(user_id, status);
CREATE INDEX idx_tickets_status_updated ON tickets(status, updated_at DESC);
CREATE INDEX idx_messages_ticket_created ON messages(ticket_id, created_at);
CREATE INDEX idx_kb_chunks_source ON kb_chunks(source_id, chunk_index);
CREATE INDEX idx_kb_sources_product ON kb_sources(product);

-- Update trigger for tickets.updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

## 3. Environment Configuration

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (.env)
```
# Supabase
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase-dashboard
SUPABASE_URL=https://xxxxx.supabase.co

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/ticketpilot

# Gemini
GEMINI_API_KEY=AI...
GEMINI_MODEL=gemini-pro
GEMINI_EMBEDDING_MODEL=embedding-001

# FAISS Configuration
FAISS_INDEX_PATH=./data/faiss.index
FAISS_MAPPING_PATH=./data/faiss_mapping.json

# RAG Configuration
RAG_TOP_K=8
RAG_MIN_SIMILARITY=0.3
RAG_CHUNK_SIZE=600
RAG_CHUNK_OVERLAP=100
RAG_MAX_CONTEXT_TOKENS=4000

# File Upload
MAX_FILE_SIZE_MB=10
ALLOWED_FILE_TYPES=.pdf,.txt,.md,.docx

# CORS
FRONTEND_URL=http://localhost:3000

# Optional rep users (comma-separated emails)
REP_USER_EMAILS=
```

## 4. API Specifications - Complete Request/Response Schemas

### Authentication Middleware
Every protected endpoint validates JWT from Authorization header:
- Extract token from `Authorization: Bearer <token>`
- Decode using SUPABASE_JWT_SECRET
- Extract user_id from `sub` claim
- Check user_roles table for role, default to 'customer'

### GET /api/health
**No auth required**

Response 200:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00Z",
  "services": {
    "database": "connected",
    "faiss": "loaded",
    "gemini": "ready"
  }
}
```

### POST /api/kb/ingest
**Auth: Rep role required**

Request (multipart/form-data OR JSON):
```json
{
  "text": "Optional raw text content to ingest",
  "product": "Optional product category",
  "title": "Optional title for the source"
}
```
OR multipart with fields:
- file: Binary file data (pdf/txt/md/docx)
- product: Optional string
- title: Optional string

Response 200:
```json
{
  "source_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Customer FAQ Document",
  "chunks_count": 12,
  "product": "billing",
  "message": "Successfully ingested 12 chunks"
}
```

Response 409 (duplicate):
```json
{
  "error": "duplicate_content",
  "existing_source_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "This content has already been ingested"
}
```

### POST /api/tickets
**Auth: Required**

Request:
```json
{
  "title": "Cannot reset password",
  "product": "authentication",
  "description": "I clicked forgot password but never received the email",
  "initial_file_url": "Optional URL to attached file"
}
```

Response 201:
```json
{
  "ticket_id": "650e8400-e29b-41d4-a716-446655440000",
  "status": "open",
  "created_at": "2024-01-15T10:00:00Z"
}
```

### GET /api/tickets
**Auth: Required**

Query params:
- `role=rep`: Shows all open/escalated tickets (rep only)
- `status=open,escalated`: Filter by status
- `limit=50`: Max results (default 50)
- `offset=0`: Pagination offset

Response 200:
```json
{
  "tickets": [
    {
      "id": "650e8400-e29b-41d4-a716-446655440000",
      "title": "Cannot reset password",
      "product": "authentication",
      "status": "escalated",
      "user_email": "customer@example.com",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "last_message_preview": "I clicked forgot password but...",
      "message_count": 3
    }
  ],
  "total": 25,
  "limit": 50,
  "offset": 0
}
```

### GET /api/tickets/{ticket_id}
**Auth: Required (customer sees own, rep sees all)**

Response 200:
```json
{
  "ticket": {
    "id": "650e8400-e29b-41d4-a716-446655440000",
    "title": "Cannot reset password",
    "product": "authentication", 
    "status": "open",
    "user_id": "750e8400-e29b-41d4-a716-446655440000",
    "user_email": "customer@example.com",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  },
  "messages": [
    {
      "id": "850e8400-e29b-41d4-a716-446655440000",
      "role": "user",
      "text": "I clicked forgot password but never received the email",
      "created_at": "2024-01-15T10:00:00Z"
    },
    {
      "id": "950e8400-e29b-41d4-a716-446655440000",
      "role": "assistant",
      "text": "I understand you're having trouble with the password reset email. Here are the most common solutions:\n\n1. Check your spam/junk folder...",
      "citations": [
        {
          "source_id": "550e8400-e29b-41d4-a716-446655440000",
          "source_title": "Password Reset Guide",
          "chunk_id": "150e8400-e29b-41d4-a716-446655440000",
          "chunk_index": 3,
          "snippet": "...reset emails may be filtered..."
        }
      ],
      "confidence": 0.92,
      "created_at": "2024-01-15T10:00:05Z"
    }
  ]
}
```

### POST /api/chat
**Auth: Required**

Request:
```json
{
  "ticket_id": "650e8400-e29b-41d4-a716-446655440000",
  "user_message": "What if I don't have access to that email anymore?"
}
```

Response 200:
```json
{
  "message_id": "a50e8400-e29b-41d4-a716-446655440000",
  "ai_message": "If you no longer have access to your registered email address, you'll need to verify your identity through our support team. Here's what you can do:\n\n1. Click the 'Escalate' button to connect with a human representative\n2. Prepare any account information you remember (username, approximate signup date, etc.)\n3. Our support team can help verify your identity and update your email address",
  "citations": [
    {
      "source_id": "550e8400-e29b-41d4-a716-446655440000",
      "source_title": "Account Recovery Procedures",
      "chunk_id": "250e8400-e29b-41d4-a716-446655440000",
      "chunk_index": 7,
      "snippet": "...verify identity through support..."
    }
  ],
  "confidence": 0.45,
  "escalate_recommended": true,
  "processing_time_ms": 1250
}
```

### POST /api/tickets/{ticket_id}/escalate
**Auth: Required**

Request: Empty body or optional:
```json
{
  "reason": "Customer needs human assistance"
}
```

Response 200:
```json
{
  "ticket_id": "650e8400-e29b-41d4-a716-446655440000",
  "status": "escalated",
  "message": "Ticket has been escalated to the support team",
  "escalated_at": "2024-01-15T10:30:00Z"
}
```

### POST /api/tickets/{ticket_id}/messages (Rep only)
**Auth: Rep role required**

Request:
```json
{
  "text": "Hi, I can help you recover your account. Let me send you a verification link to your phone number on file.",
  "role": "rep"
}
```

Response 201:
```json
{
  "message_id": "b50e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-01-15T10:35:00Z"
}
```

### PATCH /api/tickets/{ticket_id} (Rep only)
**Auth: Rep role required**

Request:
```json
{
  "status": "closed"
}
```

Response 200:
```json
{
  "ticket_id": "650e8400-e29b-41d4-a716-446655440000",
  "status": "closed",
  "updated_at": "2024-01-15T10:40:00Z"
}
```

## 5. Frontend Implementation Details

### Component Structure

#### Layout Components

**app/layout.tsx**
- Supabase session provider wrapper
- Toast notification container
- Global error boundary
- Meta tags and fonts

**app/(auth)/layout.tsx**
- Redirect if already logged in
- Clean layout for auth pages

**app/(protected)/layout.tsx**  
- Auth guard: redirect to /login if no session
- Navigation header with user email and logout button
- Role-based navigation items

#### Page Components

**app/login/page.tsx**
- Use @supabase/auth-ui-react Auth component
- Configure for email/password only
- onSuccess: Check user_roles table, redirect to /tickets or /rep
- Show loading state during auth
- Display error toasts for failures

**app/tickets/page.tsx**
State:
- tickets: Array of ticket summaries
- isLoading: Boolean
- showNewTicketModal: Boolean

UI Elements:
- Header: "My Tickets" + "New Ticket" button
- Ticket list: Card for each ticket showing:
  - Title (truncated to 100 chars)
  - Status badge (color-coded: open=blue, escalated=orange, closed=gray)
  - Product tag if present
  - Last updated time (relative, e.g., "2 hours ago")
  - Message count indicator
- Empty state: Icon + "No tickets yet" + "Create your first ticket" CTA
- New Ticket Modal:
  - Title input (required, max 200 chars)
  - Product dropdown (optional, predefined list)
  - Description textarea (required, min 10 chars, max 2000 chars)
  - File attachment (optional, show size/type restrictions)
  - Submit button with loading state

**app/tickets/[id]/page.tsx**
State:
- ticket: Full ticket object
- messages: Array of messages
- newMessage: Current input text
- isSending: Boolean
- isEscalating: Boolean

UI Structure:
- Header section:
  - Back to tickets link
  - Ticket title (h1)
  - Status badge
  - Product tag
  - Created date
  - Escalate button (show when status='open', disable if isSending)
- Messages section:
  - Scrollable container (auto-scroll to bottom on new message)
  - Message bubbles:
    - User messages: Right-aligned, blue background
    - AI messages: Left-aligned, gray background, "AI" label
    - Rep messages: Left-aligned, green background, "Support" label
    - System messages: Center-aligned, italic, light gray
  - For AI messages with citations:
    - Citations section below message
    - Each citation clickable showing: Source title + "Section X"
    - Hover shows snippet preview
  - Confidence indicator for AI messages (if < 0.5, show warning color)
- Input section:
  - Textarea (disabled if status='closed')
  - Character count (max 1000)
  - Send button (disabled if empty or isSending)
  - "Thinking..." indicator when awaiting AI response

**app/rep/page.tsx**
State:
- openTickets: Array
- escalatedTickets: Array  
- selectedTicket: Currently viewing ticket
- showIngestModal: Boolean
- isRefreshing: Boolean

UI Layout:
- Top bar:
  - "Support Queue" title
  - Refresh button
  - "Add Source" button (opens ingest modal)
- Two-column layout:
  - Left: "Open Tickets" (recently active)
  - Right: "Needs Attention" (escalated)
- Ticket cards in each column:
  - Customer email
  - Title
  - Time since last update
  - Message count
  - Click to open in sidebar/modal
- Ingest Modal:
  - Tab selector: "Upload File" / "Paste Text"
  - File tab:
    - Drag-drop zone or file picker
    - Show allowed types and size limit
    - Product dropdown (optional)
    - Title input (optional, auto-fill from filename)
  - Text tab:
    - Large textarea for content
    - Title input (required)
    - Product dropdown (optional)
  - Submit with progress indicator
  - Success: Show "X chunks created"

### API Client (lib/api.ts)

Create axios instance with:
- Base URL from env
- Auth interceptor to add Bearer token
- Error interceptor for 401 handling
- Request/response logging in dev mode

Methods:
- createTicket(data): POST /api/tickets
- getTickets(params): GET /api/tickets
- getTicket(id): GET /api/tickets/{id}
- sendMessage(ticketId, message): POST /api/chat
- escalateTicket(id): POST /api/tickets/{id}/escalate
- ingestSource(formData): POST /api/kb/ingest
- addRepMessage(ticketId, text): POST /api/tickets/{id}/messages
- updateTicket(id, data): PATCH /api/tickets/{id}

## 6. Backend Implementation Details

### FastAPI App Structure

**main.py**
- FastAPI app initialization
- CORS middleware configuration
- JWT auth dependency
- Exception handlers
- Router includes
- Startup event: Load FAISS index

**models/schemas.py**
Pydantic models for:
- TicketCreate, TicketResponse
- MessageCreate, MessageResponse  
- ChatRequest, ChatResponse
- IngestRequest, IngestResponse
- Citation model with source details

**db/database.py**
- SQLAlchemy engine creation
- Session dependency
- Connection pool configuration (max_overflow=10, pool_size=5)

**services/auth.py**
- decode_token(token): Validate JWT, extract user_id
- get_current_user dependency
- get_rep_user dependency (checks role)
- Role checking from user_roles table or REP_USER_EMAILS env

**services/embeddings.py**
- Initialize Gemini client
- embed_text(text): Returns numpy array
- embed_batch(texts): Batch processing with retry logic
- Error handling for rate limits

**services/rag.py**
Class RAGService:
- __init__: Load/create FAISS index
- add_documents(chunks, source_id): Embed and add to index
- search(query, k=8): Return similar chunks with scores
- save_index(): Persist to disk
- load_index(): Load from disk or create new
- Mapping management (faiss_id to chunk_id)

**services/llm.py**
- Initialize Gemini generative model
- generate_answer(context, query): Create prompt, call API
- extract_citations(response, chunks): Parse citations from response
- calculate_confidence(similarity_scores, has_citations): Confidence logic
- PII scrubbing before API calls (regex for emails, phones, SSN)

**services/document_processor.py**
- process_file(file): Extract text based on file type
- process_pdf(file): Using pypdf
- process_docx(file): Using python-docx
- process_text(file): Handle encodings with chardet
- chunk_text(text, size=600, overlap=100): Create overlapping chunks
- calculate_hash(content): SHA-256 for deduplication

### FAISS Index Management

**Index Structure:**
- Dimension: 768 (Gemini embedding size)
- Index type: IndexFlatL2 (exact search for MVP)
- Stored on disk at FAISS_INDEX_PATH

**Mapping File (JSON):**
```json
{
  "version": "1.0",
  "mappings": {
    "0": "chunk_uuid_1",
    "1": "chunk_uuid_2"
  },
  "metadata": {
    "total_vectors": 156,
    "last_updated": "2024-01-15T10:00:00Z"
  }
}
```

### Chunking Strategy

- Clean text: Remove extra whitespace, normalize unicode
- Split by sentence boundaries when possible
- Target chunk size: 600 characters
- Overlap: 100 characters
- Preserve chunk order with chunk_index
- Store character positions (char_start, char_end) for reference

### RAG Prompt Template

```
You are a helpful support AI assistant. Answer the user's question based on the provided context.

Context from knowledge base:
{context}

User's question: {query}

Instructions:
- Answer based only on the provided context
- Be concise and helpful
- If the context doesn't contain enough information, say so and suggest escalating to human support
- Maintain a professional and friendly tone

Answer:
```

## 7. Detailed Implementation Order

### Phase 1: Foundation (Day 1)

1. **Database Setup**
   - Run all CREATE TABLE statements
   - Add test data: 2 users (1 customer, 1 rep)
   - Verify connections from both services

2. **FastAPI Skeleton**
   - Install dependencies
   - Create main.py with /health endpoint
   - Add CORS for frontend URL
   - Test with curl/Postman

3. **Next.js Setup**
   - Create app with App Router
   - Install Supabase client libs
   - Configure Tailwind CSS
   - Create layout components

4. **Supabase Auth Integration**
   - Frontend: Auth UI component on /login
   - Frontend: Session provider in root layout
   - Backend: JWT validation middleware
   - Test login flow end-to-end

### Phase 2: Knowledge Base (Day 2)

5. **Document Processing**
   - Implement file type handlers
   - Add text chunking logic
   - Create deduplication via hash

6. **FAISS Integration**
   - Initialize index on startup
   - Implement add and search methods
   - Create persistence methods
   - Test with sample documents

7. **Ingest Endpoint**
   - POST /api/kb/ingest implementation
   - File validation and size checks
   - Store in kb_sources and kb_chunks
   - Update FAISS index
   - Test with various file types

### Phase 3: Ticket System (Day 3)

8. **Ticket CRUD**
   - POST /api/tickets - create with initial message
   - GET /api/tickets - list with filters
   - GET /api/tickets/{id} - full details
   - Frontend ticket list page
   - Frontend ticket creation modal

9. **Message System**
   - Store messages with proper roles
   - Include citations in message schema
   - Order by created_at
   - Frontend message display

### Phase 4: AI Integration (Day 4)

10. **Gemini Integration**
    - Embeddings service
    - Generation service with prompt template
    - Citation extraction logic
    - Confidence calculation

11. **Chat Endpoint**
    - POST /api/chat implementation
    - RAG retrieval pipeline
    - Response generation with citations
    - Save AI messages to database
    - Frontend chat interface updates

### Phase 5: Escalation & Rep Tools (Day 5)

12. **Escalation System**
    - POST /api/tickets/{id}/escalate
    - Status management
    - System messages for escalation
    - Frontend escalate button and flow

13. **Rep Interface**
    - /rep page with queue views
    - Rep message endpoint
    - Ticket closing functionality
    - Ingest modal on rep page

### Phase 6: Polish & Testing (Day 6)

14. **Error Handling**
    - Comprehensive error responses
    - Frontend error toasts
    - Loading states everywhere
    - Empty states for lists

15. **Testing & Fixes**
    - Run full test plan
    - Fix critical bugs only
    - Verify FAISS persistence
    - Test role-based access

## 8. Critical Implementation Notes

### Authentication Flow
1. User enters email/password on /login
2. Supabase handles authentication
3. Frontend receives session with JWT
4. All API calls include Authorization: Bearer {token}
5. Backend validates token on each request
6. User role determined from user_roles table

### RAG Pipeline Details
1. User message arrives at /api/chat
2. Embed query using Gemini embeddings API
3. Search FAISS for top-K similar chunks
4. Filter chunks below similarity threshold
5. Fetch full chunk text from PostgreSQL
6. Build context (max 4000 tokens)
7. Call Gemini with prompt template
8. Extract citations from response
9. Calculate confidence score
10. Save message with citations to database
11. Return response to frontend

### File Processing Pipeline
1. Validate file type and size
2. Extract text based on file type
3. Calculate SHA-256 hash
4. Check for duplicate in kb_sources
5. If duplicate, return existing source_id
6. Clean and normalize text
7. Split into chunks with overlap
8. Generate embeddings for each chunk
9. Add to FAISS index with mappings
10. Save source and chunks to database
11. Persist FAISS index to disk

### State Management Rules
- Tickets start as 'open'
- Only transition to 'escalated' via escalation endpoint
- Only reps can transition to 'closed'
- Closed tickets accept no new messages
- Updated_at changes trigger database trigger

### Error Handling Patterns
- All endpoints return consistent error format
- 400: Validation errors with field details
- 401: Missing or invalid authentication
- 403: Insufficient permissions
- 404: Resource not found
- 409: Conflict (duplicates, invalid state transitions)
- 500: Server errors (log full details, return generic message)

### Performance Considerations
- FAISS index loaded once at startup
- Database connection pooling enabled
- Chunk embeddings computed in batches
- Frontend uses optimistic updates
- Messages paginated if > 100 per ticket
- Ticket list limited to 50 per request

## 9. Validation Rules

### Input Validation

**Ticket Creation:**
- Title: Required, 1-200 characters
- Product: Optional, must be from predefined list if provided
- Description: Required, 10-2000 characters

**Messages:**
- Text: Required, 1-1000 characters
- No HTML tags allowed
- URLs automatically linked in frontend display

**File Upload:**
- Max size: 10MB
- Allowed types: .pdf, .txt, .md, .docx
- Filename sanitization required

### Business Logic Validation
- Customer can only see own tickets
- Cannot message closed tickets
- Cannot escalate already escalated/closed tickets
- Rep role required for ingestion
- Duplicate escalation attempts rejected

## 10. Testing Checklist

### Unit Tests (Optional for MVP)
- Document processor for each file type
- Chunking with various text sizes
- Citation extraction from LLM response
- Confidence calculation logic
- PII scrubbing patterns

### Integration Tests (Manual)

**Auth Flow:**
- [ ] Register new user → auto-assigned customer role
- [ ] Login with correct credentials → redirect to /tickets
- [ ] Login with rep account → redirect to /rep
- [ ] Invalid token → 401 on API calls
- [ ] Expired session → redirect to login

**Ingestion:**
- [ ] Upload PDF → chunks created and searchable
- [ ] Upload same file twice → duplicate detected
- [ ] Upload 15MB file → rejected with error
- [ ] Paste text → chunks created successfully
- [ ] Upload without rep role → 403 forbidden

**Ticket Flow:**
- [ ] Create ticket → appears in list
- [ ] Send message → AI responds with citations
- [ ] No relevant context → escalate_recommended=true
- [ ] Click escalate → status changes, appears in rep queue
- [ ] Rep responds → customer sees message
- [ ] Rep closes → no new messages accepted

**RAG Quality:**
- [ ] Query matching ingested content → relevant chunks returned
- [ ] Query with no matches → low confidence response
- [ ] Citations link to correct sources
- [ ] Multiple relevant chunks → all cited appropriately

**Edge Cases:**
- [ ] FAISS index missing → recreated on startup
- [ ] Gemini API error → user-friendly error message
- [ ] Database connection lost → 500 error with retry suggestion
- [ ] Concurrent updates to same ticket → last write wins
- [ ] Special characters in messages → properly escaped

This detailed specification should provide your AI code agent with everything needed to build the TicketPilot MVP without requiring clarification. The implementation follows a clear progression from foundation to features, with all schemas, validations, and edge cases defined.
