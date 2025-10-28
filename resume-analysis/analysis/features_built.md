# Complete Feature Inventory

## Core Features

### Feature 1: User Authentication & Authorization
**Description:** Complete authentication system with role-based access control (RBAC) supporting customer and representative roles.
**Complexity:** Medium
**Technologies:** Supabase Auth, JWT, FastAPI dependency injection, PostgreSQL
**Files:**
- `backend/app/auth.py` - JWT validation and user context
- `backend/app/roles.py` - Role management and verification
- `backend/migrations/0001_user_roles.sql` - User roles table
- `frontend/src/lib/supabaseClient.ts` - Supabase client configuration
- `frontend/src/components/AuthGate.tsx` - Route protection

**Key Components:**
- JWT token validation middleware
- Supabase Auth integration
- Role-based route protection
- Session management (24-hour expiration)

**Notable Implementation Details:**
- Uses FastAPI dependency injection for auth across all endpoints
- Automatic role detection with fallback to environment variables
- Secure JWT validation using Supabase JWT secret
- Client-side route protection with AuthGate component

---

### Feature 2: Knowledge Base Ingestion & Processing
**Description:** Document ingestion system supporting multiple file formats with intelligent chunking and vector embedding.
**Complexity:** High
**Technologies:** Google Gemini Embeddings, FAISS, pypdf, python-docx, PostgreSQL
**Files:**
- `backend/app/kb.py` - Knowledge base API endpoints
- `backend/app/chunker.py` - Text chunking logic (600 chars, 100 overlap)
- `backend/app/embeddings.py` - Google Gemini embedding generation
- `backend/app/store.py` - FAISS vector store operations
- `backend/app/utils.py` - File parsing utilities (PDF, DOCX, TXT, MD)
- `backend/migrations/0002_kb.sql` - KB tables schema

**Key Components:**
- Multi-format document parsing (PDF, DOCX, TXT, MD)
- Fixed-size chunking with overlap for context preservation
- Batch embedding generation with error handling
- FAISS index persistence and loading
- Chunk-to-vector mapping with JSON storage
- Duplicate detection via file hashing

**Notable Implementation Details:**
- Implements retry logic (3 attempts) for embedding API failures
- Uses atomic operations with backups for index saves
- Comprehensive input validation preventing empty/invalid chunks
- Fallback to zero vectors for failed embeddings to maintain batch integrity
- Supports both file upload and raw text ingestion

---

### Feature 3: Ticket Management System
**Description:** Complete ticketing workflow with creation, viewing, status management, and conversation history.
**Complexity:** Medium
**Technologies:** FastAPI, PostgreSQL, asyncpg, TypeScript, React
**Files:**
- `backend/app/tickets.py` - Ticket CRUD operations
- `backend/app/schemas.py` - Pydantic models for validation
- `frontend/src/app/(protected)/tickets/page.tsx` - Ticket list view
- `frontend/src/app/(protected)/tickets/[id]/page.tsx` - Ticket detail view
- Database tables: `tickets`, `messages`

**Key Components:**
- RESTful ticket CRUD endpoints
- Message threading and conversation history
- Status management (open, escalated, closed)
- User-specific ticket filtering
- Real-time message ordering

**Notable Implementation Details:**
- Implements soft delete patterns for data retention
- Uses JSONB columns for flexible metadata storage
- Automatic timestamp updates on changes
- Role-based ticket visibility (customers see own, reps see all)

---

### Feature 4: AI-Powered Chat with RAG
**Description:** Advanced Retrieval-Augmented Generation system with multi-factor confidence scoring and intelligent response generation.
**Complexity:** Very High
**Technologies:** Google Gemini 1.5 Pro, FAISS, Custom RAG pipeline, Pydantic validation
**Files:**
- `backend/app/rag.py` - RAG retrieval and confidence scoring
- `backend/app/ai.py` - Structured Gemini generation
- `backend/app/tickets.py` - Chat endpoint integration
- `backend/app/embeddings.py` - Query embedding
- `backend/app/store.py` - Vector search

**Key Components:**
- **Retrieval Pipeline:**
  - Query embedding generation
  - FAISS K-nearest neighbor search (K=8)
  - MMR re-ranking (λ=0.7 for relevance/diversity balance)
  - Semantic coherence scoring
  
- **Confidence Calculation (7 factors):**
  - Retrieval quality (30% weight)
  - Citation coverage (20%)
  - Semantic coherence (20%)
  - Response completeness (10%)
  - Information density (10%)
  - Source diversity (10%)
  - Variance bonus/penalties
  
- **Response Generation:**
  - Structured JSON output with Pydantic validation
  - Citation extraction and validation
  - Uncertainty phrase detection
  - Retry logic with fallback strategies

**Notable Implementation Details:**
- Implements MMR algorithm for diversity vs relevance optimization
- Uses embedding-based semantic similarity for coherence scoring
- Comprehensive confidence threshold (0.3) for escalation decisions
- Structured response validation with graceful degradation to basic generation
- Natural language uncertainty detection (e.g., "I'm not sure", "might be")
- Context window management (max 4000 tokens)

---

### Feature 5: Automatic Escalation System
**Description:** Intelligent escalation logic based on multi-signal analysis determining when human intervention is needed.
**Complexity:** Medium-High
**Technologies:** Custom confidence algorithms, PostgreSQL triggers
**Files:**
- `backend/app/rag.py` - `should_escalate()` function
- `backend/app/tickets.py` - Escalation endpoint
- `frontend/src/app/(protected)/tickets/[id]/page.tsx` - Escalation UI

**Key Components:**
- Multi-signal escalation triggers:
  - Low confidence score (<0.3)
  - No citations found
  - Low semantic coherence
  - Uncertainty phrases detected
  - Conversation length threshold
- Status transition management
- System message generation
- Representative notification hooks (prepared)

**Notable Implementation Details:**
- Combines multiple signals for escalation decision
- Prevents redundant escalation (checks current status)
- Generates detailed escalation reasoning for representatives
- Immutable once escalated (no de-escalation)

---

### Feature 6: Representative Console & Queue Management
**Description:** Specialized interface for support representatives with ticket queues, AI assistant tools, and knowledge base management.
**Complexity:** Medium
**Technologies:** React, Next.js, FastAPI, PostgreSQL
**Files:**
- `backend/app/rep.py` - Representative-specific endpoints
- `frontend/src/app/(protected)/rep/page.tsx` - Rep dashboard
- `frontend/src/components/rep/` - Rep-specific components

**Key Components:**
- Split queue view (Open vs Escalated tickets)
- Knowledge base ingestion interface
- AI assistant for representatives ("Get AI Suggestion")
- Ticket assignment (prepared for future)
- Bulk actions (prepared)
- Response templates

**Notable Implementation Details:**
- Role-based access control restricting to representatives
- Real-time ticket count badges
- Inline AI suggestion without changing customer conversation
- Drag-and-drop file upload for knowledge base
- Visual distinction between customer AI and rep AI assistant

---

### Feature 7: Admin Analytics Dashboard
**Description:** Comprehensive analytics and monitoring interface for system administrators with RAG performance metrics.
**Complexity:** Medium-High
**Technologies:** React, Recharts/Chart.js, FastAPI, PostgreSQL analytics queries
**Files:**
- `backend/app/admin.py` - Admin analytics endpoints
- `frontend/src/app/(protected)/admin/analytics/page.tsx` - Analytics UI
- `frontend/src/lib/chartTheme.ts` - Chart theming
- `backend/app/observability.py` - Metrics collection

**Key Components:**
- **Performance Metrics:**
  - Average response latency
  - Confidence score distribution
  - Escalation rate tracking
  - Citation coverage analysis
  
- **System Health:**
  - Knowledge base statistics
  - Ticket volume trends
  - Representative workload
  - AI operation success rates
  
- **Visualizations:**
  - Time-series charts (latency, confidence)
  - Distribution histograms
  - Status breakdown pie charts
  - Heatmaps for activity patterns

**Notable Implementation Details:**
- Time-windowed analysis (1 hour to 1 week)
- Real-time metrics using database aggregations
- Automated health assessment with recommendations
- Custom dark theme for charts matching "Midnight Prism" design
- Exportable reports (prepared)

---

### Feature 8: RAG Observability & Monitoring
**Description:** Comprehensive tracking and logging of all RAG operations with detailed metrics for debugging and optimization.
**Complexity:** Medium-High
**Technologies:** Custom Python dataclasses, PostgreSQL JSONB, asyncpg
**Files:**
- `backend/app/observability.py` - RAGMetrics and RAGObserver classes
- `backend/migrations/` - ai_runs table schema
- `backend/app/admin.py` - Analytics retrieval

**Key Components:**
- **RAGMetrics DataClass:**
  - Operation timing breakdown
  - Retrieval metrics (K, similarities)
  - Confidence component breakdown
  - Citation tracking
  - Error logging
  
- **RAGObserver:**
  - Start/end operation tracking
  - Component-specific metrics recording
  - Database persistence
  - Real-time monitoring hooks
  
- **Analytics Functions:**
  - System performance analysis
  - Confidence calibration data
  - Error pattern detection
  - Optimization recommendations

**Notable Implementation Details:**
- Uses dataclasses for type-safe metric storage
- JSONB columns for flexible metadata
- Async database operations for non-blocking logging
- Comprehensive timing breakdown (retrieval, generation, total)
- Links operations to tickets for traceability

---

### Feature 9: Document Processing Pipeline
**Description:** Robust document parsing and text extraction supporting multiple file formats with encoding detection.
**Complexity:** Medium
**Technologies:** pypdf, python-docx, chardet, Python
**Files:**
- `backend/app/utils.py` - File parsing functions
- `backend/app/kb.py` - Integration with ingestion

**Key Components:**
- **Format Support:**
  - PDF extraction with metadata
  - DOCX paragraph and table extraction
  - Plain text with encoding detection
  - Markdown preservation
  
- **Processing Features:**
  - Automatic encoding detection
  - Text cleaning and normalization
  - Metadata extraction
  - Error handling per format

**Notable Implementation Details:**
- Uses chardet for robust encoding detection
- Handles corrupted/malformed files gracefully
- Extracts text from tables in DOCX
- Preserves document structure where possible
- File size limits enforced (10MB default)

---

### Feature 10: Citation Extraction & Validation
**Description:** Automatic extraction and validation of source citations from AI responses with chunk-level tracking.
**Complexity:** Medium
**Technologies:** Pydantic models, PostgreSQL, structured LLM outputs
**Files:**
- `backend/app/ai.py` - Citation extraction from structured responses
- `backend/app/schemas.py` - Citation models
- `backend/app/rag.py` - Citation validation
- `frontend/src/app/(protected)/tickets/[id]/page.tsx` - Citation display

**Key Components:**
- Structured citation format validation
- Chunk ID tracking to source documents
- Source title and snippet inclusion
- Clickable citation links in UI
- Citation coverage scoring

**Notable Implementation Details:**
- Uses Pydantic models for strict validation
- Validates citations against retrieved chunks
- Calculates citation coverage for confidence
- Renders citations as expandable accordions in UI
- Tracks which chunks were actually used in response

---

### Feature 11: Error Handling & Resilience
**Description:** Comprehensive error handling with retry logic, graceful degradation, and detailed logging throughout the system.
**Complexity:** High
**Technologies:** Python custom exceptions, asyncio, logging, try-except patterns
**Files:**
- `backend/app/embeddings.py` - EmbeddingError handling
- `backend/app/store.py` - VectorStoreError handling
- `backend/app/ai.py` - Structured generation fallbacks
- All backend files - Comprehensive error handling

**Key Components:**
- **Custom Exception Hierarchy:**
  - EmbeddingError
  - VectorStoreError
  - RAGError (conceptual)
  
- **Retry Patterns:**
  - Exponential backoff (3 attempts)
  - Timeout handling
  - Rate limit backoff
  
- **Graceful Degradation:**
  - Fallback to basic generation if structured fails
  - Zero vectors for failed embeddings
  - Default responses for system failures
  
- **Comprehensive Logging:**
  - Operation tracking
  - Error details with stack traces
  - Success/failure metrics

**Notable Implementation Details:**
- Three-level fallback strategy for critical operations
- Atomic operations with backup creation before destructive changes
- Input validation preventing bad data from entering system
- Continue-on-error for batch operations
- Detailed error messages for debugging

---

### Feature 12: UI/UX "Midnight Prism" Design System
**Description:** Complete dark theme design system with accessibility, animations, and cohesive visual language.
**Complexity:** Medium
**Technologies:** Tailwind CSS, Framer Motion, CSS variables, Radix UI
**Files:**
- `frontend/src/app/globals.css` - Color tokens and utilities
- `frontend/tailwind.config.ts` - Theme configuration
- `frontend/src/ui/motion/` - Animation system
- `frontend/src/lib/chartTheme.ts` - Chart theming
- All frontend page components - PageShell wrappers

**Key Components:**
- **Color System:**
  - Dark theme (zinc-950/900/800 neutrals)
  - Brand colors (indigo primary, violet secondary)
  - Semantic colors (success, warning, danger, info)
  - CSS variables with RGB values
  
- **Motion System:**
  - LazyMotion for bundle optimization
  - reducedMotion="user" for accessibility
  - Page fade transitions
  - Card scale-in animations
  - List stagger effects (50ms delay)
  
- **Component Patterns:**
  - Badge system (solid backgrounds for counts)
  - Lozenge system (transparent for statuses)
  - Focus ring utilities
  - Surface helpers

**Notable Implementation Details:**
- 16:1 contrast ratios for text (WCAG AAA)
- Respects prefers-reduced-motion user settings
- SSR-safe motion components with 'use client'
- Backward compatible with legacy color tokens
- Consistent animations (200ms, [0.2, 0.8, 0.2, 1] easing)
- 90+ Lighthouse performance score

---

## API Endpoints

### Authentication
| Method | Path | Purpose | Auth Required | Handler |
|--------|------|---------|---------------|---------|
| POST | `/api/auth/verify` | Verify JWT token | No | `auth.py:verify_token()` |

### Tickets
| Method | Path | Purpose | Auth Required | Handler |
|--------|------|---------|---------------|---------|
| GET | `/api/tickets` | List user tickets | Yes | `tickets.py:get_tickets()` |
| POST | `/api/tickets` | Create new ticket | Yes | `tickets.py:create_ticket()` |
| GET | `/api/tickets/{id}` | Get ticket details | Yes | `tickets.py:get_ticket()` |
| POST | `/api/tickets/{id}/messages` | Add message to ticket | Yes | `tickets.py:add_message()` |
| POST | `/api/chat` | Send message & get AI response | Yes | `tickets.py:chat()` |
| POST | `/api/tickets/{id}/escalate` | Escalate ticket | Yes | `tickets.py:escalate_ticket()` |
| PATCH | `/api/tickets/{id}/status` | Update ticket status | Yes (Rep) | `tickets.py:update_status()` |

### Knowledge Base
| Method | Path | Purpose | Auth Required | Handler |
|--------|------|---------|---------------|---------|
| POST | `/api/kb/ingest` | Ingest document/text | Yes (Rep) | `kb.py:ingest()` |
| GET | `/api/kb/search` | Search knowledge base | Yes (Rep) | `kb.py:search()` |
| GET | `/api/kb/stats` | Get KB statistics | Yes (Rep) | `kb.py:stats()` |
| GET | `/api/kb/sources` | List all sources | Yes (Rep) | `kb.py:list_sources()` |
| GET | `/api/kb/sources/{id}` | Get source details | Yes (Rep) | `kb.py:get_source()` |
| DELETE | `/api/kb/sources/{id}` | Delete source | Yes (Rep) | `kb.py:delete_source()` |

### Representative
| Method | Path | Purpose | Auth Required | Handler |
|--------|------|---------|---------------|---------|
| GET | `/api/rep/queue` | Get ticket queues | Yes (Rep) | `rep.py:get_queue()` |
| POST | `/api/rep/ai-suggest` | Get AI suggestion | Yes (Rep) | `rep.py:ai_suggest()` |
| POST | `/api/rep/respond` | Rep response to ticket | Yes (Rep) | `rep.py:respond()` |

### Admin
| Method | Path | Purpose | Auth Required | Handler |
|--------|------|---------|---------------|---------|
| GET | `/api/admin/analytics/rag` | RAG performance metrics | Yes (Admin) | `admin.py:rag_analytics()` |
| GET | `/api/admin/analytics/tickets` | Ticket statistics | Yes (Admin) | `admin.py:ticket_analytics()` |
| GET | `/api/admin/system-health` | System health check | Yes (Admin) | `admin.py:system_health()` |
| GET | `/api/admin/users` | User management | Yes (Admin) | `admin.py:list_users()` |

### Health & Feedback
| Method | Path | Purpose | Auth Required | Handler |
|--------|------|---------|---------------|---------|
| GET | `/api/health` | Health check | No | `main.py:health()` |
| POST | `/api/feedback` | Submit feedback | Yes | `feedback.py:submit_feedback()` |

---

## Database Schema

| Table | Rows (est.) | Key Columns | Purpose | Indexes |
|-------|-------------|-------------|---------|---------|
| `auth.users` | 10,000+ | id, email, encrypted_password | User accounts (Supabase managed) | id (PK), email (unique) |
| `app.user_roles` | 10,000+ | user_id, role | Role assignments (customer/rep) | user_id (PK, FK) |
| `app.tickets` | 25,000+ | id, user_id, title, status, created_at | Support tickets | id (PK), user_id (FK), status |
| `app.messages` | 100,000+ | id, ticket_id, role, text, citations, created_at | Ticket messages | id (PK), ticket_id (FK), created_at |
| `app.kb_sources` | 500+ | id, title, product, type, file_hash | Knowledge base sources | id (PK), file_hash (unique) |
| `app.kb_chunks` | 15,000+ | id, source_id, chunk_index, text | Text chunks for RAG | id (PK), source_id (FK), chunk_index |
| `app.ai_runs` | 50,000+ | id, ticket_id, operation_type, metrics, created_at | RAG operation logs | id (PK), ticket_id (FK), created_at |
| `app.feedback` | 10,000+ | id, message_id, rating, comment | User feedback | id (PK), message_id (FK) |

---

## External Integrations

### 1. **Google AI (Gemini API)** - AI/ML Capabilities
**Purpose:** Text embeddings and generation for RAG system
**Files:** 
- `backend/app/embeddings.py`
- `backend/app/ai.py`
**API Calls:**
- `models/embedding-001` - Generate embeddings
- `models/gemini-1.5-pro` - Structured text generation
**Rate Limits:** Handled with retry logic and backoff
**Error Handling:** 3-attempt retry with fallback strategies

### 2. **Supabase** - Backend-as-a-Service
**Purpose:** Authentication, database, and storage
**Files:**
- `frontend/src/lib/supabaseClient.ts`
- `backend/app/auth.py`
- All backend database operations
**Services Used:**
- Supabase Auth (JWT-based authentication)
- PostgreSQL database (managed)
- Storage (prepared for file uploads)
**Features:** Row-level security, automatic timestamps, connection pooling
