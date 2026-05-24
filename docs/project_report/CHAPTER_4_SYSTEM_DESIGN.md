# TicketPilot Project Report - Chapter 4

This document provides the System Design section for TicketPilot. It includes diagram descriptions and Mermaid diagram code for each required diagram.

---

## 4.1 Data Flow Diagram (DFD)

### Description
The DFD shows how data moves between external actors (Customer, Rep, Admin), the TicketPilot application, and supporting services (Supabase, AI services, FAISS). It highlights ticket submission, AI retrieval, and response delivery as primary flows.

### Mermaid (DFD)

```mermaid
flowchart LR
  subgraph External Actors
    C[Customer]
    R[Support Rep]
    A[Admin]
  end

  subgraph TicketPilot
    UI[Web UI]
    API[FastAPI API]
    KB[KB Ingestion]
    RAG[RAG Retrieval]
  end

  subgraph Data Stores
    DB[(PostgreSQL / Supabase)]
    VS[(FAISS Index)]
  end

  subgraph AI Services
    EMB[Embeddings API]
    LLM[LLM Generation]
  end

  C -->|Submit Ticket| UI --> API --> DB
  R -->|View Queue| UI --> API --> DB
  A -->|Manage Users/KB| UI --> API --> DB

  A -->|Upload Docs| UI --> KB --> DB
  KB -->|Chunk + Embed| EMB --> KB --> VS

  R -->|Ask AI| UI --> API --> RAG
  RAG --> VS
  RAG --> DB
  RAG --> LLM
  RAG --> API --> UI --> R
```

---

## 4.2 System Architecture Diagram

### Description
This architecture diagram shows the three-tier structure: presentation (Next.js UI), application (FastAPI services), and data/AI services (PostgreSQL, FAISS, and AI models). It also indicates JWT auth and multi-tenant constraints.

### Mermaid (Architecture)

```mermaid
flowchart TB
  subgraph Presentation
    FE[Next.js Frontend]
  end

  subgraph Application
    BE[FastAPI Backend]
    AUTH[JWT Auth + RBAC]
    ORG[Org Context Middleware]
  end

  subgraph Data
    DB[(PostgreSQL with RLS)]
    VS[(FAISS Vector Index)]
  end

  subgraph AI
    EMB[Embeddings API]
    LLM[LLM Generation]
  end

  FE -->|HTTPS REST| BE
  BE --> AUTH
  BE --> ORG
  BE --> DB
  BE --> VS
  BE --> EMB
  BE --> LLM
```

---

## 4.3 Workflow Diagram

### Description
The workflow diagram illustrates the end-to-end ticket lifecycle: submission, triage, AI assistance, response, escalation, and resolution.

### Mermaid (Workflow)

```mermaid
flowchart TD
  S[Customer submits ticket] --> Q[Ticket created in DB]
  Q --> T[Rep console queue]
  T -->|Open ticket| V[View ticket details]
  V -->|Ask AI| AI[Retrieve KB context + Draft response]
  AI --> R1[Rep reviews draft]
  R1 -->|Send reply| RESP[Customer receives response]
  R1 -->|Escalate| ESC[Assign to higher tier]
  RESP -->|Issue resolved| RES[Mark ticket resolved]
```

---

## 4.4 Use Case Diagram

### Description
This diagram shows the main actors and their core use cases. Customers submit and track tickets, reps work the queue and respond with AI assistance, admins manage users and knowledge.

### Mermaid (Use Case)

```mermaid
flowchart LR
  C[Customer]
  R[Support Rep]
  A[Admin]

  UC1((Submit Ticket))
  UC2((View Ticket Status))
  UC3((Respond to Ticket))
  UC4((Ask AI for Draft))
  UC5((Escalate Ticket))
  UC6((Manage Users))
  UC7((Upload KB Docs))
  UC8((View Analytics))

  C --> UC1
  C --> UC2

  R --> UC3
  R --> UC4
  R --> UC5

  A --> UC6
  A --> UC7
  A --> UC8
```

---

## 4.5 Class Diagram

### Description
The class diagram shows the core domain entities and their relationships. It focuses on organization membership, tickets, messages, and knowledge base entities.

### Mermaid (Class Diagram)

```mermaid
classDiagram
  class User {
    +uuid id
    +string email
    +string role
  }

  class Organization {
    +uuid id
    +string name
    +jsonb settings
  }

  class OrganizationMember {
    +uuid org_id
    +uuid user_id
    +string role
  }

  class Ticket {
    +uuid id
    +uuid organization_id
    +uuid customer_id
    +uuid assignee_id
    +string status
    +int priority_level
    +bool needs_attention
  }

  class Message {
    +uuid id
    +uuid ticket_id
    +uuid sender_id
    +string content
    +bool is_internal
  }

  class Document {
    +uuid id
    +uuid organization_id
    +string title
    +string status
  }

  class Chunk {
    +uuid id
    +uuid document_id
    +int faiss_id
    +float[] embedding
  }

  Organization "1" --> "many" OrganizationMember
  User "1" --> "many" OrganizationMember

  Organization "1" --> "many" Ticket
  Ticket "1" --> "many" Message
  User "1" --> "many" Message

  Organization "1" --> "many" Document
  Document "1" --> "many" Chunk
```

---

## 4.6 Activity Diagram

### Description
The activity diagram shows the detailed steps a rep takes while resolving a ticket with AI assistance.

### Mermaid (Activity)

```mermaid
flowchart TD
  A[Start] --> B[Rep opens queue]
  B --> C[Select ticket]
  C --> D[Read details and messages]
  D --> E{Need AI help?}
  E -- Yes --> F[Run RAG retrieval]
  F --> G[Receive draft + citations]
  G --> H[Edit response]
  E -- No --> H
  H --> I[Send response]
  I --> J{Resolved?}
  J -- Yes --> K[Mark resolved]
  J -- No --> L[Keep open]
  K --> M[End]
  L --> M
```

---

## 4.7 Sequence Diagram

### Description
The sequence diagram captures the request flow when a rep asks the AI for a draft response.

### Mermaid (Sequence)

```mermaid
sequenceDiagram
  participant Rep
  participant UI
  participant API
  participant RAG
  participant DB
  participant VS
  participant LLM

  Rep->>UI: Click "Ask AI"
  UI->>API: POST /api/tickets/{id}/chat
  API->>RAG: retrieve(context, org_id)
  RAG->>VS: vector_search(query)
  RAG->>DB: fetch chunks by org_id
  RAG->>LLM: generate draft with context
  LLM-->>RAG: draft + citations
  RAG-->>API: response payload
  API-->>UI: draft + confidence + citations
  UI-->>Rep: show AI suggestion
```

---

## 4.8 ER Diagram

### Description
The ER diagram shows the relational structure of the database with key entities and relationships. It reflects multi-tenancy and ticket lifecycle support.

### Mermaid (ER)

```mermaid
erDiagram
  ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : has
  USERS ||--o{ ORGANIZATION_MEMBERS : belongs

  ORGANIZATIONS ||--o{ TICKETS : owns
  USERS ||--o{ TICKETS : created
  USERS ||--o{ MESSAGES : sent
  TICKETS ||--o{ MESSAGES : contains

  ORGANIZATIONS ||--o{ DOCUMENTS : stores
  DOCUMENTS ||--o{ CHUNKS : contains

  ORGANIZATIONS {
    uuid id PK
    text name
    jsonb settings
  }
  USERS {
    uuid id PK
    text email
  }
  ORGANIZATION_MEMBERS {
    uuid organization_id FK
    uuid user_id FK
    text role
  }
  TICKETS {
    uuid id PK
    uuid organization_id FK
    uuid customer_id FK
    uuid assignee_id FK
    text status
    int priority_level
  }
  MESSAGES {
    uuid id PK
    uuid ticket_id FK
    uuid sender_id FK
    boolean is_internal
  }
  DOCUMENTS {
    uuid id PK
    uuid organization_id FK
    text title
    text status
  }
  CHUNKS {
    uuid id PK
    uuid document_id FK
    int faiss_id
  }
```

---

## 4.9 Design Philosophy and Features

### Design Philosophy
TicketPilot is designed to be secure, role-aware, and AI-augmented without removing human oversight. The system follows these guiding principles:
- Security first: data isolation and access control are enforced at every layer.
- Human-in-the-loop AI: AI drafts assist, but reps decide and finalize responses.
- Transparency: citations and confidence scores allow verification.
- Scalability: multi-tenant foundations support growth without redesign.
- Operational clarity: dashboards and analytics provide measurable insight.

### Key Features
- Multi-tenant organization model with row-level security.
- Role-based dashboards and workflows for customers, reps, and admins.
- Ticket lifecycle management with escalation, priority, and ETR.
- Knowledge base ingestion, chunking, and semantic retrieval.
- RAG-based AI response drafting with citations and confidence.
- Admin tools for user management, invites, and settings.
- Analytics for ticket volume, resolution rates, and response times.

---

All diagrams are provided as Mermaid code so they can be rendered directly in Markdown viewers that support Mermaid.
