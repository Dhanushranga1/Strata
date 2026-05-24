# TicketPilot Project Report - Chapter 5

This document describes the methodology used in TicketPilot, focusing on workflow, the RAG pipeline, embeddings and retrieval, AI response generation, confidence scoring, escalation, and processing flow.

---

## 5.1 Overview of System Workflow

TicketPilot follows a structured workflow that combines standard ticketing practices with AI-assisted knowledge retrieval. The workflow is designed to keep a human in the loop while accelerating response time and improving answer quality.

High-level workflow stages:
1. **Ticket submission**
   - A customer creates a ticket with title, description, and context.
   - The backend stores the ticket in the organization-scoped database.

2. **Queue triage**
   - Tickets appear in the rep console queue with priority indicators.
   - Reps filter, sort, and select tickets based on urgency.

3. **Context review**
   - The rep opens a ticket and reads the conversation history.
   - The system shows metadata such as priority, overdue status, and escalation details.

4. **AI assistance (optional)**
   - Reps can request AI support, triggering the RAG pipeline.
   - The system retrieves relevant knowledge chunks and drafts a response.

5. **Human validation**
   - The rep reviews and edits the AI draft if needed.
   - The rep decides whether to respond, escalate, or keep the ticket open.

6. **Resolution and feedback**
   - When resolved, the rep marks the ticket as resolved and optionally adds a resolution note.
   - The system captures AI feedback signals for continuous improvement.

This workflow ensures AI is used as an assistive layer rather than an autonomous decision-maker, maintaining accountability and accuracy.

---

## 5.2 RAG Pipeline (Retrieval and Generation)

TicketPilot uses Retrieval-Augmented Generation (RAG) to produce responses grounded in the organization’s own knowledge base. RAG combines two stages: retrieval (find relevant sources) and generation (produce a response using those sources).

### Retrieval Stage
- The user query (ticket context + question) is converted into an embedding vector.
- The vector is searched against a FAISS index of knowledge base chunks.
- Top candidates are retrieved and filtered by organization scope.
- Chunks are re-ranked using multiple factors (MMR and relevance metrics).

### Generation Stage
- The final set of top chunks is compiled into a prompt context.
- The Gemini model generates a draft response using the retrieved context.
- Citations are attached to ensure transparency and traceability.

This pipeline ensures the AI response is grounded in real documents rather than purely generative text.

---

## 5.3 Embedding and FAISS Retrieval

### Embedding Process
TicketPilot converts knowledge base documents into embeddings during ingestion:
- Documents are split into overlapping text chunks.
- Each chunk is embedded using the embeddings API.
- Embeddings are stored in the database and added to a FAISS index.

### FAISS Retrieval
FAISS (Facebook AI Similarity Search) is used for fast nearest-neighbor search:
- Query embeddings are compared against chunk embeddings.
- The index returns top candidates based on cosine similarity.
- Candidates are constrained to the current organization to enforce isolation.

Key design decisions:
- Embeddings allow semantic similarity beyond keyword matching.
- FAISS provides low-latency retrieval suitable for real-time support usage.
- Organization-based filtering prevents cross-tenant data leakage.

---

## 5.4 AI Response Generation (Gemini)

TicketPilot uses Google Gemini for response generation. The model receives:
- The ticket question or message
- Retrieved knowledge chunks
- System instructions emphasizing accuracy and citation

The generation process:
1. Build a structured prompt containing the ticket query and KB context.
2. Send prompt to Gemini with a temperature tuned for factual responses.
3. Extract the response and map each statement to citations.
4. Return the response to the rep with confidence indicators.

This ensures responses are both helpful and verifiable, with citations acting as a trust mechanism.

---

## 5.5 CASPER Confidence Scoring Algorithm

TicketPilot applies the CASPER (Contextual Adaptive Scoring with Probabilistic Ensemble Ranking) method to score confidence. The goal is to quantify how reliable the AI response is, based on multiple factors.

### Core Confidence Factors
- **Semantic relevance**: similarity between query and retrieved chunks.
- **Citation density**: number of sources that support the response.
- **Source freshness**: newer documents are weighted higher.
- **Source authority**: trusted sources carry more weight.
- **Coverage completeness**: whether all parts of the query are addressed.
- **Historical accuracy**: feedback from previous similar answers.
- **Diversity of evidence**: responses backed by multiple distinct sources.

### Confidence Output
- A numeric confidence score is computed and mapped to a tier.
- Example tiers:
  - High confidence: safe to respond directly.
  - Medium confidence: rep should verify.
  - Low confidence: escalate or review manually.

This algorithm makes AI behavior more transparent and supports consistent decision-making.

---

## 5.6 Escalation Mechanism

Escalation is critical when confidence is low or the ticket requires specialized handling. TicketPilot supports both manual and AI-assisted escalation.

### Escalation Triggers
- AI confidence falls below a defined threshold.
- The rep explicitly escalates based on business rules.
- The ticket exceeds SLA or expected resolution time.

### Escalation Flow
1. Ticket is marked as escalated.
2. An escalation target (rep or team) is assigned.
3. The ticket is moved to the escalation queue.
4. Notifications are sent to the assigned target.

This ensures high-risk or complex issues receive appropriate attention without delay.

---

## 5.7 Processing Flow

The processing flow combines the above components into a single end-to-end pipeline.

### Processing Steps
1. Ticket creation and storage.
2. Rep opens the ticket and optionally invokes AI.
3. RAG retrieval collects relevant context.
4. Gemini generates a draft response.
5. CASPER scores confidence.
6. Rep reviews the response and decides on next action.
7. If confident, the response is sent; if not, escalate.
8. System logs actions and collects feedback.

### Summary
This processing flow ensures that TicketPilot delivers faster responses while maintaining accuracy, accountability, and data security. The combination of retrieval, generation, confidence scoring, and escalation provides a comprehensive methodology for AI-assisted support.
