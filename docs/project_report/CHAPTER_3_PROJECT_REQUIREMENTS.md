# TicketPilot Project Report - Chapter 3

This document captures the project requirements for TicketPilot, including functional, non-functional, environment requirements, and the feasibility study.

---

## 3.1 Functional Requirements

The functional requirements define what the TicketPilot system must do to support its users and workflows. They are derived from the implemented modules and documented system behavior.

### Functional Requirements Table

| ID | Requirement | Priority | Notes / Rationale |
| --- | --- | --- | --- |
| FR-01 | The system shall support secure user authentication using Supabase and JWT tokens. | High | Required for all user access and session management. |
| FR-02 | The system shall enforce role-based access control (admin, rep, customer) across all routes. | High | Ensures correct permissions and separation of responsibilities. |
| FR-03 | The system shall support organization-level multi-tenancy with strict data isolation. | High | All data must be scoped by organization_id. |
| FR-04 | The system shall allow users to switch organization context where they are members. | High | Needed for multi-org accounts. |
| FR-05 | The system shall allow customers to create and submit support tickets. | High | Core workflow entry point. |
| FR-06 | The system shall provide ticket listing with filtering and pagination. | High | Required for scalability and navigation. |
| FR-07 | The system shall provide ticket detail views with message threads. | High | Core interaction for issue resolution. |
| FR-08 | The system shall allow reps to post public replies and internal notes. | High | Supports internal coordination and customer communication. |
| FR-09 | The system shall support ticket status transitions (open, in-progress, resolved, closed). | High | Required for lifecycle management and analytics. |
| FR-10 | The system shall allow reps to escalate tickets and set escalation targets. | Medium | Supports higher-tier handoff workflows. |
| FR-11 | The system shall support priority levels and attention indicators (e.g., P1 to P7). | Medium | Enables queue triage and workload planning. |
| FR-12 | The system shall support expected time to resolve (ETR) and overdue tracking. | Medium | Improves SLA adherence and operational visibility. |
| FR-13 | The system shall provide a rep console with queue lanes and ticket counts. | High | Primary workflow for support reps. |
| FR-14 | The system shall allow admins to manage team members and roles. | High | Required for enterprise team administration. |
| FR-15 | The system shall allow admins to invite new members into an organization. | High | Supports growth and onboarding. |
| FR-16 | The system shall provide knowledge base ingestion and document indexing. | High | Required for AI retrieval and knowledge centralization. |
| FR-17 | The system shall support knowledge base search and document statistics. | High | Needed for knowledge visibility and maintenance. |
| FR-18 | The system shall generate AI-assisted response drafts grounded in knowledge base sources. | High | Core differentiator of TicketPilot. |
| FR-19 | The system shall provide citations and confidence indicators for AI answers. | High | Increases trust and verification capability. |
| FR-20 | The system shall record AI feedback (thumbs up/down) to improve response quality. | Medium | Enables continuous improvement loops. |
| FR-21 | The system shall provide admin analytics for ticket volume and performance trends. | Medium | Supports management decisions and reporting. |
| FR-22 | The system shall send notification emails for critical ticket events (new ticket, rep reply, resolution, overdue). | Medium | Improves responsiveness and accountability. |

---

## 3.2 Non-Functional Requirements

Non-functional requirements define the quality attributes and constraints for TicketPilot. These ensure the system is secure, reliable, and fit for production use.

### Non-Functional Requirements Table

| ID | Requirement | Target / Metric | Verification Method |
| --- | --- | --- | --- |
| NFR-01 | Security: Enforce JWT validation and role checks on all protected APIs. | 100% protected routes | Code review and API testing. |
| NFR-02 | Security: Enforce row-level security for organization data isolation. | No cross-org access | DB policy verification and tests. |
| NFR-03 | Security: Use parameterized queries to prevent SQL injection. | No dynamic SQL concatenation | Static review and security tests. |
| NFR-04 | Security: Apply rate limiting on sensitive endpoints (auth, AI chat). | Endpoint limits enforced | Load test and 429 validation. |
| NFR-05 | Security: Include security headers and strict CORS rules. | CSP, HSTS, XFO, etc. | Response header verification. |
| NFR-06 | Performance: Knowledge retrieval should be fast enough for real-time use. | Target p95 < 500ms retrieval | Performance monitoring. |
| NFR-07 | Performance: AI draft responses should be returned quickly enough for agent use. | Target < 2 seconds for draft | End-to-end latency tests. |
| NFR-08 | Reliability: System must recover gracefully from external API failures. | Failover and error handling | Fault injection and error logs. |
| NFR-09 | Scalability: Support multiple organizations and growing ticket volumes. | Pagination and indexed queries | Load testing and DB indexing checks. |
| NFR-10 | Availability: Maintain stable uptime with health checks. | Target 99.9% | Monitoring and uptime checks. |
| NFR-11 | Usability: Provide clear role-based navigation and workflows. | Minimal onboarding friction | User testing and walkthroughs. |
| NFR-12 | Maintainability: Use clear module boundaries and typed interfaces. | Low coupling, typed contracts | Code review and static checks. |
| NFR-13 | Observability: Log key requests and errors with context. | Structured logs for APIs | Log inspection and alerts. |
| NFR-14 | Compliance: Protect user data and secrets in config files. | No secrets in repo | Secret scanning and review. |

---

## 3.3 Environment Requirements

This section defines the tools, services, and runtime environment required to build, run, and deploy TicketPilot.

### Development Environment Requirements

| Category | Requirement | Notes |
| --- | --- | --- |
| OS | Linux, macOS, or Windows | Linux used in this workspace. |
| Node.js | 18+ with npm | Frontend build and dev server. |
| Python | 3.10+ (tested with 3.13+) | Backend runtime and tooling. |
| Git | Latest stable | Source control and workflow. |
| Supabase Account | Required | PostgreSQL + Auth. |
| Google Cloud Account | Required | Generative Language API access. |
| Ports | 3000 and 8000 open | Frontend and backend dev servers. |

### Required Environment Variables

| Component | Variable | Purpose |
| --- | --- | --- |
| Backend | SUPABASE_URL | Supabase project URL. |
| Backend | SUPABASE_ANON_KEY | Supabase anon key. |
| Backend | SUPABASE_JWT_SECRET | JWT verification secret. |
| Backend | DATABASE_URL | PostgreSQL connection string (pooler preferred). |
| Backend | GOOGLE_API_KEY | Embeddings and AI generation. |
| Backend | WEB_ORIGIN | CORS allowlist for frontend. |
| Frontend | NEXT_PUBLIC_SUPABASE_URL | Supabase URL for client. |
| Frontend | NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key for client. |
| Frontend | NEXT_PUBLIC_API_URL or NEXT_PUBLIC_API_BASE | Backend API base URL. |

### Production Environment Requirements

| Category | Requirement | Notes |
| --- | --- | --- |
| Hosting | Frontend on Vercel | Static + server rendering. |
| Hosting | Backend on Render | FastAPI runtime. |
| Database | Supabase PostgreSQL | RLS enabled, connection pooling. |
| AI Services | Google Generative Language API | Embeddings and model inference. |
| SSL/TLS | Required | HTTPS for all public endpoints. |
| Monitoring | Logs and health checks | Baseline observability. |

---

## 3.4 Feasibility Study

The feasibility study evaluates whether TicketPilot is practical and achievable given technical, operational, economic, and schedule constraints.

### Technical Feasibility
TicketPilot is technically feasible because the core architecture is already implemented with a stable tech stack: Next.js for frontend, FastAPI for backend, PostgreSQL with row-level security, and an AI pipeline built on FAISS and Gemini models. The system is modular, follows standard patterns, and integrates well with managed services such as Supabase.

### Operational Feasibility
Operationally, the system aligns with standard support workflows. Customers submit tickets, reps resolve them with AI assistance, and admins manage users and analytics. The role-based UI and documented setup procedures reduce onboarding friction for teams.

### Economic Feasibility
TicketPilot is cost-effective for early-stage deployment because it relies on managed services with free or low-cost tiers (Vercel, Render, Supabase). Costs scale primarily with AI usage and storage, which can be monitored and optimized as adoption grows.

### Schedule Feasibility
The project is feasible within the planned schedule because core milestones and phases are documented and already implemented. The remaining improvements are incremental rather than foundational changes.

### Legal and Ethical Feasibility
The system enforces strong access controls, avoids exposing secrets in source control, and uses citations for AI transparency. Human review remains part of the workflow, reducing the risk of automated misinformation. These controls align with responsible AI usage and data privacy best practices.

### Feasibility Summary Table

| Dimension | Assessment | Evidence | Conclusion |
| --- | --- | --- | --- |
| Technical | High | Implemented multi-tenant architecture, AI pipeline, and secure APIs. | Feasible. |
| Operational | High | Role-based flows match real support operations. | Feasible. |
| Economic | Medium to High | Uses managed services and free tiers initially. | Feasible with cost monitoring. |
| Schedule | High | Phased implementation already completed. | Feasible. |
| Legal/Ethical | Medium to High | Security, RLS, and AI transparency controls in place. | Feasible with continued governance. |

---

This requirements chapter can be extended later with test cases, traceability matrices, or formal acceptance criteria if needed.
