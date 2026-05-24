# Crayon Data Interview Brief - TicketPilot

## 1) 30-Second Pitch (80 words)

TicketPilot is a multi-tenant AI support platform using RAG to deliver context-aware ticket responses. FastAPI backend connects PostgreSQL (Row-Level Security for tenant isolation) with FAISS semantic search and LLM generation. Support reps query in natural language; the system retrieves relevant knowledge, generates cited responses, and maintains 99% uptime via GitHub Actions CI/CD. Key innovation: database-level security through RLS policies ensures zero cross-tenant leakage, while FAISS enables sub-second semantic retrieval across thousands of documents.

---

## 2) RAG Pipeline (6 Bullets)

- **Ingestion**: Upload PDF/TXT/MD/DOCX → parse text → split by document sections
- **Chunking + Embeddings**: Split into 512-token chunks with 50-token overlap → generate vector embeddings via LLM API
- **Indexing**: Store embeddings in FAISS IndexFlatL2 with metadata mapping to source documents
- **Retrieval**: Query → embed → FAISS similarity search (top-k=5) → return document chunks with scores
- **Reranking**: Cross-encoder scoring on top-5 results → re-order by relevance → select top-3
- **Generation**: Pass top-3 chunks as context to LLM → generate response + extract citations → return with confidence score

---

## 3) Why FAISS Over Other Vector DBs (2 Lines)

FAISS offers in-memory speed (sub-millisecond search), mature Facebook-backed library, and works without external infrastructure—perfect for MVP with <10K documents. For production scale (>100K docs), would migrate to Pinecone/Weaviate for distributed indexing and persistence.

---

## 4) PostgreSQL RLS for Multi-Tenancy (2 Lines)

RLS policies auto-filter queries using `current_setting('app.org_id')` and user role, enforcing tenant isolation at database layer. Even if application bugs exist, database prevents cross-tenant access—defense-in-depth without application-level filtering overhead.

---

## 5) FastAPI + Retrieval + Inference Flow (5 Bullets)

- **Request**: POST `/api/tickets/{id}/ask` with query → FastAPI receives JSON payload
- **Auth**: JWT middleware extracts user_id, org_id, role → sets session variables for RLS
- **Retrieval**: Query → embed → FAISS search → retrieve top-k chunks → filter by org_id
- **LLM**: Construct prompt with context chunks → call LLM API → parse response + citations
- **Response**: Return JSON with answer, citations, confidence score, response_time (<200ms avg)

---

## 6) Top 10 GenAI + Backend Interview Q&A

**Q1: What is RAG and why use it?**
Retrieval-Augmented Generation grounds LLM responses in factual knowledge, reducing hallucinations. Retrieves relevant context before generation instead of relying on model's parametric memory.

**Q2: How do you handle LLM hallucinations?**
Use RAG with citations (traceability), implement confidence scoring, set temperature=0.2 for deterministic outputs, and enable human-in-loop for low-confidence responses.

**Q3: Explain vector embeddings in simple terms.**
Text converted to high-dimensional arrays (e.g., 768 floats) capturing semantic meaning. Similar meanings → similar vectors, enabling semantic search via cosine similarity or L2 distance.

**Q4: Why chunk documents before embedding?**
Embedding models have token limits (512-1024), chunking preserves context granularity, enables precise retrieval, and improves relevance vs. embedding entire documents.

**Q5: How does FAISS similarity search work?**
Query vector → compute L2/cosine distance to all indexed vectors → return k-nearest neighbors. IndexFlatL2 uses brute-force (accurate, slower); IndexIVFFlat uses clustering (faster, approximate).

**Q6: What's the difference between RLS and application-level filtering?**
RLS enforces at database layer (automatic, secure even with bugs); application filtering requires manual WHERE clauses (error-prone, bypassable via SQL injection or logic flaws).

**Q7: How do you secure a multi-tenant FastAPI app?**
JWT authentication, org_id extraction, RLS enforcement, rate limiting per tenant, input validation, parameterized queries, HTTPS only, and audit logging of data access.

**Q8: Explain async/await in FastAPI.**
Non-blocking I/O: async functions yield control during I/O waits (DB queries, API calls), letting server handle other requests concurrently. Improves throughput without multithreading overhead.

**Q9: How would you scale FAISS for 1M+ documents?**
Migrate to distributed vector DB (Pinecone, Weaviate), use approximate indexes (HNSW, IVF), implement sharding by org_id, add caching for frequent queries, and use GPU acceleration.

**Q10: What's your CI/CD pipeline strategy?**
GitHub Actions: run tests on PR → lint + type-check → deploy to staging → manual approval → production deployment with blue-green strategy and automatic rollback on errors.

---

## 7) Scalability Bottlenecks + Solutions

**Bottleneck 1**: FAISS in-memory index grows with document volume → **Solution**: Shard by org_id, use IndexIVFFlat for approximate search, migrate to Pinecone for distributed storage.

**Bottleneck 2**: LLM API latency (500ms-2s per request) → **Solution**: Implement semantic caching (cache embeddings + responses), batch requests, use streaming responses for better UX.

**Bottleneck 3**: PostgreSQL connection pool exhaustion under high load → **Solution**: Implement connection pooling (PgBouncer), use read replicas for analytics queries, cache frequent DB lookups in Redis.

---

## 8) Security Risks + Mitigations

**Risk 1**: Prompt injection attacks (user input manipulates LLM behavior) → **Mitigation**: Sanitize inputs, use delimiters separating context from query, implement output filtering, and validate citations.

**Risk 2**: Cross-tenant data leakage via broken RLS → **Mitigation**: Automated tests for RLS policies, mandatory org_id in all queries, audit logs tracking data access, and security reviews pre-deployment.

**Risk 3**: API key exposure or JWT token theft → **Mitigation**: Rotate keys monthly, store in secrets manager (not env vars), implement token expiry (15min), use refresh tokens, and enable rate limiting.

---

## A) 1-Hour Prep Plan

- **20 min: RAG + embeddings** → Review vector similarity metrics (L2, cosine), chunking strategies, FAISS index types (Flat, IVF, HNSW), reranking with cross-encoders, and citation extraction.
- **20 min: backend + DB (FastAPI, RLS, CI/CD)** → Async/await patterns, JWT auth flow, RLS policy syntax (USING/WITH CHECK), connection pooling, GitHub Actions workflow structure, and deployment strategies.
- **20 min: rapid-fire interview Q&A** → Memorize answers to top 10 questions, practice 30-sec pitch without notes, prepare scaling/security trade-offs, and rehearse "biggest challenge" stories.

---

## B) Enterprise-Grade Upgrade List

- **Distributed Vector Store**: Migrate FAISS to Pinecone/Weaviate with sharding, replication, and persistent storage for 100M+ document scale with multi-region deployments.
- **Observability Stack**: Implement OpenTelemetry tracing, Prometheus metrics (latency, token usage, error rates), Grafana dashboards, and PagerDuty alerting for 99.9% SLA.
- **Advanced Security**: Add SOC2 compliance (audit logs, encryption at rest/transit), SSO/SAML integration, field-level encryption for PII, and automated security scanning in CI/CD.
- **Performance Optimization**: Deploy Redis for semantic cache (70% hit rate), implement GraphQL for flexible queries, use CDN for static assets, and GPU-accelerated embeddings for 10x speed.
- **Cost Intelligence**: Track per-tenant LLM token usage, implement tiered pricing (Basic/Pro/Enterprise), auto-scaling with cost alerts, and model switching (GPT-4 → GPT-3.5) based on query complexity.
