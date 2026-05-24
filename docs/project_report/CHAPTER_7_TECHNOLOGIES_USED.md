# TicketPilot Project Report - Chapter 7

This document describes the core technologies used in TicketPilot and explains why they were chosen. It expands beyond the requested list to cover the supporting stack.

---

## 7.1 Retrieval-Augmented Generation (RAG)

RAG is the central AI methodology in TicketPilot. Instead of relying only on a language model, RAG retrieves relevant knowledge base content and supplies it to the model so responses are grounded in verified sources.

Key benefits:
- Reduces hallucination by grounding responses in real documents.
- Enables transparent answers with citations.
- Supports organization-specific knowledge without training a custom model.

Implementation highlights:
- Ticket content and user queries are embedded into vector space.
- Relevant chunks are retrieved via FAISS.
- Retrieved chunks are injected into the prompt for response generation.
- Confidence scoring and citations are returned to the rep.

---

## 7.2 FAISS Vector Database

FAISS (Facebook AI Similarity Search) is used for high-speed vector retrieval. It enables semantic search across document chunks and makes AI assistance fast enough for real-time use.

Why FAISS:
- Extremely fast nearest-neighbor search for high-dimensional embeddings.
- Works well with large document collections.
- Can be stored on disk and reloaded for efficiency.

How it is used in TicketPilot:
- Each document chunk is embedded and indexed in FAISS.
- Queries are embedded and searched against the index.
- Top candidates are filtered by organization and then re-ranked.

---

## 7.3 Google Gemini AI

TicketPilot uses Google Gemini for text generation and embeddings. Gemini provides a high-quality language model suitable for short, factual responses and an embeddings API for semantic search.

Usage in the project:
- **Embeddings**: Convert text chunks and user queries into vectors.
- **Generation**: Produce response drafts grounded in retrieved context.

Why Gemini:
- Strong performance on factual tasks.
- API-based usage without model hosting.
- Good latency for interactive workflows.

---

## 7.4 Supabase (Authentication and Database)

Supabase provides both managed PostgreSQL and authentication services. It is the system of record for all TicketPilot data and simplifies auth integration.

Key capabilities used:
- **PostgreSQL database** with row-level security.
- **Supabase Auth** for user registration, login, and JWT issuance.
- **Service role access** for secure backend operations.

Why Supabase:
- Production-ready PostgreSQL with minimal operational overhead.
- Built-in auth and JWT support.
- Strong integration with row-level security for multi-tenant isolation.

---

## 7.5 FastAPI

FastAPI is the backend framework used to implement TicketPilot APIs. It provides async support, validation, and auto-generated documentation.

Key benefits:
- High performance with async/await.
- Pydantic validation for request and response schemas.
- Automatic OpenAPI docs for testing and integration.

Usage in TicketPilot:
- APIs for ticketing, knowledge base, AI, admin, and org management.
- Middleware for auth and org context.
- Structured error handling and rate limiting.

---

## 7.6 Next.js

Next.js powers the frontend. It supports server rendering, fast navigation, and role-based page routing.

Key benefits:
- App Router architecture with hybrid rendering.
- TypeScript integration for type safety.
- Optimized UI performance and routing.

Usage in TicketPilot:
- Role-based dashboards (customer, rep, admin).
- Protected routes and auth flows.
- API client integration with org context.

---

## 7.7 JWT Authentication

JWT is used for secure, stateless authentication. Supabase issues JWTs and the backend validates them for every request.

Key properties:
- Stateless authentication (no server-side sessions).
- Encoded user claims for role checks.
- Compatible with Supabase Auth and frontend clients.

In TicketPilot:
- JWT tokens are stored client-side and attached to requests.
- The backend verifies signature and claims for access control.

---

## 7.8 PostgreSQL with Row-Level Security (RLS)

PostgreSQL is the primary data store, and RLS enforces multi-tenant isolation at the database layer.

Why it matters:
- Guarantees data isolation even if API bugs occur.
- Supports enterprise-style compliance needs.
- Works seamlessly with Supabase Auth and JWT claims.

---

## 7.9 TypeScript

TypeScript ensures consistent data structures across frontend components and API interactions.

Benefits:
- Compile-time detection of type mismatches.
- Better refactoring and maintainability.
- Clear contracts for API responses and UI state.

---

## 7.10 Pydantic

Pydantic is used in the backend for schema validation and serialization.

Why it is important:
- Protects the API from invalid input.
- Ensures consistent output formats.
- Integrates tightly with FastAPI for documentation.

---

## 7.11 Tailwind CSS and UI Components

Tailwind CSS and UI component libraries provide a consistent, modern interface.

Benefits:
- Fast, utility-based styling.
- Consistent design system across roles.
- Responsive layouts for desktop and mobile.

---

## 7.12 Deployment Platforms

TicketPilot uses modern hosting platforms to reduce infrastructure overhead.

- **Frontend**: Vercel
- **Backend**: Render
- **Database**: Supabase

These services enable rapid deployment, automatic SSL, and easy environment configuration.

---

## 7.13 Supporting Libraries and Tools

Additional tools used in the project:
- **FAISS** and **NumPy** for vector operations.
- **python-jose** for JWT validation.
- **slowapi** for rate limiting.
- **httpx** for external API calls.
- **Framer Motion** for UI animation.

---

This chapter provides a comprehensive overview of the technologies that make TicketPilot secure, scalable, and AI-ready.
