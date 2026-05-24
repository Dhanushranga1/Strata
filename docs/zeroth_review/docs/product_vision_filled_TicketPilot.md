# Product Vision – TicketPilot

---

## 1. Product Name & Tagline

**Product Name:** TicketPilot  
**Tagline:** "AI-powered knowledge management for instant, confident support answers"

---

## 2. Vision Statement

**Vision:** To eliminate knowledge friction in customer support by making institutional knowledge instantly accessible, always accurate, and continuously improving. We envision a world where support agents never waste time searching for answers, where every query is met with a confident, cited response in under 2 seconds, and where knowledge gaps are automatically detected and filled.

**Long-Term Impact:**
- **Industry Impact:** Set the standard for transparent, secure, multi-tenant RAG systems in SaaS support tools.
- **User Impact:** Transform support agents from "knowledge hunters" into empowered problem-solvers, reducing burnout and increasing job satisfaction.
- **Societal Impact:** Contribute to UN Sustainable Development Goals 8 (Decent Work), 9 (Innovation), and 4 (Education) by improving productivity, advancing AI transparency, and accelerating onboarding.

---

## 3. Target Audience

### Primary Users
**Who:** Customer support agents in SaaS companies (10-500 employees)

**Demographics:**
- **Job Roles:** Tier 1 and Tier 2 support agents, customer success associates
- **Company Size:** Startups to mid-market (10-500 employees; 5-50 support agents)
- **Industry:** SaaS, fintech, e-commerce, healthtech

**Needs:**
1. **Speed:** Find answers in <2 seconds (vs. current 5-10 minutes)
2. **Accuracy:** Confidence scores to trust the answer without verification
3. **Context:** Full citation trails to validate and learn from sources
4. **Simplicity:** Single search interface instead of juggling 5+ tools

**Pain Points:**
- **Information Overload:** Documentation scattered across Confluence, Notion, Slack, Google Drive, Zendesk articles, and personal notes
- **Outdated Content:** No way to know if a wiki page is current or deprecated
- **Search Inefficiency:** Keyword search returns 100+ results; no relevance ranking
- **Low Confidence:** Agents spend time second-guessing answers, leading to ticket escalation
- **Burnout:** 40% of time spent on "knowledge hunting" instead of problem-solving

**Behavioral Patterns:**
- Use browser bookmarks and personal notes as workarounds
- Rely on senior agents ("tribal knowledge") for answers
- Escalate tickets when unsure → increases cost and resolution time

---

### Secondary Users
**Who:** Support team leads, knowledge managers, and product managers

**Demographics:**
- **Job Roles:** Support team leads, knowledge base managers, training coordinators, product managers
- **Responsibilities:** Content curation, team performance monitoring, onboarding new agents, identifying documentation gaps

**Needs:**
1. **Visibility:** Analytics on what agents search for and what knowledge gaps exist
2. **Quality Control:** Metrics on answer accuracy and confidence trends
3. **Efficiency:** Automate gap detection instead of manual audits
4. **Training:** Use search analytics to improve onboarding materials

**Pain Points:**
- **Blind Spots:** Can't identify which topics have poor documentation
- **Reactive Approach:** Discover gaps only after support tickets escalate
- **No Metrics:** No data on which documents are most/least useful
- **Manual Curation:** Spend hours updating docs without knowing ROI

---

## 4. Problem Statement

**The Problem:**  
Customer support agents in SaaS companies waste **40% of their time** (16 hours/week for a full-time agent) searching for answers across 5+ disconnected knowledge sources (Confluence, Notion, Slack threads, Google Drive, legacy wikis, Zendesk articles). Search results lack context, confidence scores, and citation trails, forcing agents to:
1. **Manually verify answers** by cross-referencing multiple sources
2. **Escalate tickets** to senior agents when uncertain (costing $50-$100 per escalation)
3. **Provide incorrect answers** due to outdated or incomplete documentation

**Current State:**  
Agents use a patchwork of workarounds:
- **Browser bookmarks** for frequently accessed docs (becomes outdated)
- **Personal notes** in Notion or Evernote (not shared with team)
- **Keyword search** in Confluence/Notion (returns 100+ results; no ranking)
- **Asking colleagues** in Slack (interrupts others; creates dependency on "tribal knowledge")
- **Escalating tickets** to Tier 2 or product teams (increases cost and resolution time)

**Consequences:**  
- **Productivity Loss:** Agents spend 16 hours/week searching → $29,000/year/50-agent team in lost productivity
- **Longer Resolution Times:** Average ticket resolution: 6 hours (industry benchmark: 2 hours)
- **Lower CSAT Scores:** Customers wait longer for answers → 20% drop in CSAT
- **Agent Burnout:** High turnover (30%/year) due to frustration with "knowledge hunting"
- **Escalation Costs:** 25% of tickets escalated to Tier 2 → $50-$100/escalation
- **Knowledge Silos:** Each agent builds personal knowledge base → no team-wide learning

**Quantified Impact:**
- **Time Waste:** 40% of agent time = 16 hours/week per agent
- **Cost per Agent:** $60,000/year salary → $24,000/year wasted on searching
- **Team Cost:** 50-agent team → $1.2M/year in search-related inefficiency
- **Escalation Cost:** 1,000 tickets/month × 25% escalation rate × $75/escalation = $18,750/month

---

## 5. Solution Overview

**The Solution:**  
TicketPilot is an **AI-powered knowledge search engine** that unifies all support documentation into a single, semantic search interface. It uses **Retrieval-Augmented Generation (RAG)** with 768-dimensional embeddings to deliver instant, confident, and cited answers. Key differentiators:
1. **7-Factor Confidence Scoring:** Transparent scoring (semantic relevance, source freshness, citation density, etc.) so agents know when to trust the answer
2. **Multi-Tenant Security:** Org-level data isolation with Supabase Row-Level Security (RLS) — no data leakage between customers
3. **Citation Provenance:** Every answer includes clickable source citations with exact page numbers and timestamps
4. **Continuous Learning:** Feedback loop (thumbs up/down) improves answer quality over time
5. **Knowledge Gap Detection:** Analytics dashboard identifies topics with low-confidence answers → guides content curation

**Key Capabilities:**  

### 1. Unified Knowledge Ingestion
- **Supported Formats:** Markdown, PDF, URLs, Confluence, Notion, Google Drive (via API)
- **Processing Pipeline:** 
  - Document chunking (500-1000 tokens per chunk)
  - Metadata extraction (title, author, last_updated, section hierarchy)
  - Embedding generation (OpenAI text-embedding-ada-002, 768 dimensions)
  - Storage in Supabase (PostgreSQL + pgvector extension)
- **Automation:** Scheduled sync (daily) to detect updated/new documents

### 2. Semantic Search with RAG
- **Embedding Model:** OpenAI text-embedding-ada-002 (768-dim)
- **Vector Search:** FAISS-inspired pgvector with cosine similarity
- **Retrieval:** Top 5 most relevant chunks (threshold: 0.7 cosine similarity)
- **Re-ranking:** 7-factor confidence scoring (see below)
- **Response Time:** <500ms p95 latency

### 3. 7-Factor Confidence Scoring
Each answer is scored (0-100%) based on:
1. **Semantic Relevance (30%):** Cosine similarity between query and retrieved chunks
2. **Source Freshness (15%):** Recency of document (documents updated in last 30 days score higher)
3. **Citation Density (15%):** Number of supporting documents for the answer
4. **Keyword Match (10%):** Overlap between query keywords and chunk content
5. **Historical Accuracy (10%):** Past thumbs-up rate for similar queries
6. **Source Authority (10%):** Trust score of document source (e.g., official product docs > Slack thread)
7. **Coverage Completeness (10%):** Whether the answer addresses all parts of the query

**Confidence Tiers:**
- **90-100% (High Confidence):** Answer is highly reliable; agent can use directly
- **70-89% (Moderate Confidence):** Answer is likely correct; agent should skim sources
- **50-69% (Low Confidence):** Answer may be incomplete; agent should verify
- **<50% (Very Low Confidence):** Answer is unreliable; escalate or search manually

### 4. Multi-Tenant Isolation
- **Architecture:** Each organization has a unique `org_id` UUID
- **RLS Policies:** Supabase Row-Level Security enforces `org_id` filtering on all queries
- **Embedding Isolation:** Vectors are stored per-org; no cross-org contamination
- **User Management:** Role-based access control (RBAC) — admin, member, viewer
- **Audit Logs:** Track all searches, document uploads, and user actions per org

### 5. Citation Provenance
Every answer includes:
- **Document Title:** e.g., "API Rate Limits — Developer Guide"
- **Section Path:** e.g., "Introduction > Rate Limiting > Per-User Limits"
- **Page Number:** (for PDFs) or heading anchor (for web docs)
- **Last Updated:** Timestamp of last modification
- **Clickable Link:** Direct link to source document
- **Snippet Preview:** Exact text snippet used to generate the answer

**Example Citation:**
```
Source: API Rate Limits — Developer Guide
Section: Introduction > Rate Limiting > Per-User Limits
Last Updated: 2025-10-15
Link: https://docs.example.com/api/rate-limits#per-user
Snippet: "Each user is limited to 100 requests per minute..."
```

### 6. Continuous Learning (Feedback Loop)
- **Feedback Mechanisms:**  
  - **Thumbs Up/Down:** Quick feedback on answer quality
  - **Edit Answer:** Agent can correct/improve the answer → stored as feedback
  - **Flag Outdated:** Mark sources as outdated → triggers content review
- **Learning Pipeline:**
  - Negative feedback → re-rank confidence factors
  - Repeated low-confidence queries → flag as knowledge gap
  - High-confidence queries with thumbs-down → audit embedding quality
- **Impact:** 15% improvement in answer accuracy after 1 month of feedback data

### 7. Knowledge Gap Detection
**Analytics Dashboard:**
- **Top Low-Confidence Queries:** Identify topics where confidence scores are consistently <70%
- **Zero-Result Queries:** Queries that return no results → suggests missing documentation
- **Trending Topics:** Detect sudden spikes in queries (e.g., after a product launch)
- **Source Coverage:** Identify which document sources are underutilized

**Use Cases:**
- Support lead identifies "new feature X" has 50 low-confidence queries → creates FAQ doc
- Product team sees spike in "billing error" queries → investigates bug
- Knowledge manager audits outdated docs flagged by agents

---

## 6. Value Proposition

**For customer support agents, who need instant access to accurate knowledge, TicketPilot is an AI-powered search engine that delivers confident, cited answers in under 2 seconds. Unlike generic RAG tools or manual wikis, TicketPilot combines multi-tenant security, 7-factor confidence scoring, and continuous learning to eliminate knowledge friction, reduce ticket resolution time by 70%, and save $29,000/year per 50-agent team.**

**Key Differentiators:**
1. **Transparent Confidence:** 7-factor scoring > black-box AI
2. **Multi-Tenant Security:** RLS-enforced isolation > generic cloud RAG
3. **Citation Provenance:** Full source trails > no-source answers
4. **Gap Detection:** Proactive analytics > reactive curation
5. **Affordable:** $10/user/month > $50-$100/user for Glean or AlphaSense

---

## 7. Success Metrics (Key Performance Indicators)

### User Metrics
- **Average Search Time:** <2 seconds (baseline: 5-10 minutes)
- **Answer Accuracy:** >90% (measured by thumbs-up rate)
- **User Satisfaction (CSAT):** >4.5/5 (baseline: 3.2/5 for manual search)
- **Adoption Rate:** >80% of agents use TicketPilot daily within 1 month
- **Confidence Distribution:** >70% of queries return high-confidence (>90%) answers

### Business Metrics
- **Ticket Resolution Time:** Reduce by 70% (from 6 hours to 1.8 hours)
- **Agent Productivity:** Increase by 40% (16 hours/week saved → 6.4 hours/week searching)
- **Escalation Rate:** Reduce by 50% (from 25% to 12.5% of tickets)
- **Cost Savings:** $29,000/year per 50-agent team ($580/agent/year)
- **CSAT Improvement:** +20% increase in customer satisfaction scores

### Technical Metrics
- **Search Latency:** <500ms p95 (99th percentile: <1 second)
- **Embedding Quality:** >0.85 average cosine similarity for high-confidence answers
- **System Uptime:** 99.9% (max 43 minutes downtime/month)
- **Data Freshness:** Documents synced within 24 hours of update
- **Vector Index Size:** <100GB for 10,000 documents per org

### Learning Metrics
- **Feedback Rate:** >50% of searches receive thumbs-up/down feedback
- **Accuracy Improvement:** +15% answer accuracy after 1 month of feedback
- **Gap Detection Rate:** >90% of flagged gaps result in new documentation

---

## 8. Product Principles

**Core Principles:**

### 1. Confidence Over Speed
**Description:** We prioritize transparent confidence scoring over blindly fast responses. Agents must know when to trust an answer. If confidence is <70%, we surface this clearly and suggest manual verification.

**Trade-offs:** May sacrifice 100ms of latency to compute 7-factor confidence scores, but this is acceptable because accuracy > speed.

**Example:** Rather than returning a fast but uncertain answer, we show: "Moderate Confidence (72%) — Please verify with source before responding to customer."

### 2. Cite Everything
**Description:** Every answer must include clickable source citations with exact page numbers, section paths, and timestamps. No "black-box" AI responses.

**Trade-offs:** Requires storing detailed metadata (title, author, last_updated, section hierarchy), increasing storage costs by 20%. Acceptable trade-off for trust.

**Example:** If an agent asks "What is our refund policy?", the answer includes: "Source: Billing FAQ > Refunds > Full Refund Policy (Updated 2025-10-15) — Link: https://docs.example.com/billing/refunds#full-policy"

### 3. Multi-Tenant by Default
**Description:** Security and data isolation are non-negotiable. Every database query must enforce Row-Level Security (RLS) on `org_id`. No shortcuts, no "trust the application layer" assumptions.

**Trade-offs:** RLS adds 5-10ms per query, but this is mandatory to prevent data leakage. No exceptions.

**Example:** A malicious user trying to access another org's data via SQL injection or API manipulation will be blocked at the database level (Supabase RLS).

### 4. Learn from Feedback
**Description:** Agent feedback (thumbs-up/down, edits, flagged sources) is not optional — it's the core of our learning pipeline. We use feedback to re-rank confidence factors, detect gaps, and improve embeddings.

**Trade-offs:** Requires building feedback collection UX and batch processing pipelines. Worth the investment for continuous improvement.

**Example:** If agents consistently downvote answers from a specific Confluence page, we automatically flag it for content review.

### 5. Privacy-First Analytics
**Description:** We collect search analytics to detect gaps, but never log sensitive query content or user identities beyond the org level. Anonymized aggregates only.

**Trade-offs:** Limits personalization (e.g., can't recommend docs based on individual user history), but aligns with privacy best practices.

**Example:** Dashboard shows "Top 10 low-confidence queries by org" but never "Which agent searched for X at 2 PM on Tuesday."

---

## 9. Competitive Landscape

### Direct Competitors

| Competitor | Strengths | Weaknesses | Our Advantage |
|------------|-----------|------------|---------------|
| **Confluence Search** | - Native integration with Atlassian suite<br>- Familiar UI for existing users<br>- Structured page hierarchy | - No semantic search (keyword-only)<br>- No confidence scores<br>- Slow (5-10 sec queries)<br>- No multi-source aggregation | **7-factor confidence scoring** with semantic RAG<br>**Sub-500ms search latency**<br>**Multi-source ingestion** (not just Confluence) |
| **Notion AI** | - Modern, intuitive UI<br>- Good for collaborative docs<br>- Basic Q&A on workspace content | - No multi-tenant isolation (data leakage risk)<br>- Generic RAG (no confidence scoring)<br>- Limited citation provenance<br>- Not designed for support workflows | **Multi-tenant RLS security**<br>**Transparent confidence scores**<br>**Full citation trails**<br>**Support-specific analytics** |
| **Glean** | - Enterprise-grade search<br>- Integrates 100+ tools<br>- Strong AI capabilities | - Very expensive ($50-$100/user/month)<br>- Black-box AI (no confidence transparency)<br>- Overkill for small/mid-market<br>- Long onboarding time | **Affordable pricing** ($10/user/month)<br>**Transparent confidence scoring**<br>**Fast time-to-value** (1-day setup)<br>**Built for support teams** |
| **AlphaSense / Coveo** | - Strong in financial/enterprise search<br>- Advanced NLP<br>- Compliance features | - Enterprise-only (not for SMBs)<br>- Expensive ($$$)<br>- Requires data science team to configure | **Self-service setup**<br>**Affordable for SMBs**<br>**Support-first design** |
| **Custom RAG with LangChain** | - Full control over stack<br>- Customizable embeddings<br>- No vendor lock-in | - Requires ML engineering team<br>- No out-of-the-box multi-tenancy<br>- High maintenance overhead<br>- No pre-built analytics | **Turnkey multi-tenant RAG**<br>**No ML team required**<br>**Built-in analytics**<br>**Managed security** |

### Indirect Competitors
- **Zendesk Guide / Help Center:** Static knowledge base; no AI search
- **Stack Overflow for Teams:** Good for Q&A format but not for document search
- **Google Drive Search:** Basic keyword search; no semantic understanding

**Competitive Moat:**
1. **Transparent Confidence Scoring:** No competitor offers 7-factor scoring with explainability
2. **Multi-Tenant RLS:** Our RLS enforcement at the database level is more secure than app-layer isolation
3. **Support-First Design:** Built specifically for support workflows (vs. generic enterprise search)
4. **Affordable Pricing:** $10/user/month (vs. $50-$100 for Glean)

---

## 10. Roadmap Milestones

### Phase 1 (MVP) — Months 1-3 (Q4 2024)
**Goal:** Launch core RAG search with multi-tenancy for early adopters (3-5 pilot customers)

**Features:**
- ✅ **Document Ingestion:** Markdown, PDF, URL scraping
- ✅ **Semantic Search:** OpenAI embeddings + pgvector
- ✅ **7-Factor Confidence Scoring:** Full implementation
- ✅ **Multi-Tenant RLS:** Supabase org-level isolation
- ✅ **Citation Provenance:** Clickable source links with metadata
- ✅ **Basic Analytics:** Search volume, confidence distribution
- ✅ **Feedback Loop:** Thumbs-up/down UI

**Success Criteria:**
- 3 pilot customers onboarded
- >80% user adoption within pilot orgs
- >85% answer accuracy (thumbs-up rate)
- <1 second p95 search latency

---

### Phase 2 — Months 4-6 (Q1 2025)
**Goal:** Scale to 20 customers; integrate with support tools; optimize performance

**Features:**
- 🚧 **Slack Integration:** Search from Slack without leaving the chat
- 🚧 **Zendesk Plugin:** Embed TicketPilot in Zendesk ticket view
- 🚧 **Advanced Analytics:**
  - Knowledge gap detection dashboard
  - Search trend analysis (weekly reports)
  - Source utilization metrics
- 🚧 **Performance Optimization:**
  - Response time <500ms p95
  - Batch embedding generation (10x faster)
  - Redis caching for frequent queries
- 🚧 **Improved Feedback:**
  - "Edit Answer" functionality
  - "Flag Outdated Source" button
  - Feedback analytics for content team

**Success Criteria:**
- 20 paying customers (10-50 agents each)
- <500ms p95 search latency
- >90% answer accuracy
- 10+ knowledge gaps detected and fixed per org/month

---

### Phase 3 — Months 7-12 (Q2-Q3 2025)
**Goal:** Enterprise-grade features; expand to 100 customers; explore new use cases

**Features:**
- 📅 **Multi-Language Support:** Embeddings for Spanish, French, German
- 📅 **Custom Embedding Models:** Allow customers to fine-tune embeddings on their data
- 📅 **Knowledge Graph Visualization:** Interactive graph showing doc relationships
- 📅 **API for Integrations:** REST API for third-party tools (Intercom, Freshdesk, etc.)
- 📅 **Advanced Security:**
  - SOC 2 Type II certification
  - Single Sign-On (SSO) with SAML
  - Audit log export for compliance
- 📅 **Auto-Generated FAQs:** AI suggests new FAQ topics based on gap analysis
- 📅 **Voice Search:** Search via voice command (mobile app)

**Success Criteria:**
- 100 paying customers
- $50K MRR (Monthly Recurring Revenue)
- SOC 2 certified
- >95% answer accuracy

---

### Phase 4 (Future) — Year 2+
**Goal:** Expand beyond support; productize gap detection; explore new verticals

**Features:**
- 📅 **Sales Enablement:** Use TicketPilot for sales team to find product info, case studies, pricing
- 📅 **Developer Docs Search:** Optimize for technical documentation (code snippets, API refs)
- 📅 **Legal/Compliance Search:** High-security search for legal teams
- 📅 **Automatic Documentation:** AI generates draft docs from Slack threads, meeting notes
- 📅 **Predictive Gap Detection:** Proactively suggest documentation topics before queries arise

---

## 11. Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation Strategy |
|------|--------|-----------|---------------------|
| **Low-quality embeddings → poor search results** | High | Medium | - Use proven embedding model (OpenAI ada-002)<br>- Benchmark embeddings before launch (BEIR dataset)<br>- Provide "Edit Answer" feedback to retrain<br>- Monitor cosine similarity thresholds (>0.7) |
| **Multi-tenant data leakage** | Critical | Low | - Enforce RLS at database level (Supabase)<br>- Conduct penetration testing (quarterly)<br>- Implement org-id validation in every API call<br>- Audit logs for cross-org access attempts |
| **Slow adoption by agents** | High | Medium | - Focus on UX (sub-2-second answers)<br>- Integrate with existing tools (Slack, Zendesk)<br>- Provide onboarding training (1-hour session)<br>- Show time-savings metrics in dashboard |
| **Embedding API cost explosion** | Medium | Medium | - Batch embed documents (1x/day instead of real-time)<br>- Cache frequent queries in Redis<br>- Use cheaper embedding alternatives (e.g., Sentence-BERT) for non-critical queries<br>- Monitor monthly API spend ($500 budget/org) |
| **Outdated documentation → incorrect answers** | High | High | - Show "Last Updated" timestamp in citations<br>- Allow agents to flag outdated sources<br>- Implement scheduled doc sync (daily)<br>- Confidence scoring penalizes old docs (>6 months) |
| **Competitor launches similar product** | Medium | Medium | - Focus on transparent confidence scoring (hard to replicate)<br>- Build strong customer relationships (feedback loop)<br>- Fast iteration (ship new features every 2 weeks)<br>- Patent pending on 7-factor confidence scoring algorithm |
| **Regulatory compliance (GDPR, CCPA)** | Medium | Low | - Implement data anonymization for analytics<br>- Provide "Delete All Data" feature per org<br>- Store PII only in encrypted fields<br>- SOC 2 certification by Month 12 |

---

## 12. Alignment with Organizational Goals

### How TicketPilot Supports Broader Organizational and Societal Goals:

#### 1. **SDG 8 – Decent Work and Economic Growth**
**Contribution:**  
- **Reduce agent search time by 70%** (from 16 hours/week to 4.8 hours/week)
- **Enable agents to focus on high-value problem-solving** instead of manual knowledge hunting
- **Reduce burnout** by eliminating repetitive, frustrating tasks

**Metrics:**
- $29,000/year productivity gain per 50-agent team
- 30% reduction in agent turnover (baseline: 30%/year)

---

#### 2. **SDG 9 – Industry, Innovation, and Infrastructure**
**Contribution:**  
- **Pioneer transparent confidence scoring** in RAG systems (7-factor algorithm)
- **Advance multi-tenant vector isolation** techniques (RLS-enforced embeddings)
- **Open-source confidence scoring framework** (planned for Phase 3) to benefit the AI community

**Metrics:**
- First-to-market with transparent confidence scoring
- Potential academic paper on 7-factor confidence algorithm

---

#### 3. **SDG 4 – Quality Education**
**Contribution:**  
- **Accelerate onboarding for new support agents by 50%** (from 4 weeks to 2 weeks)
- **Democratize access to institutional knowledge** (no "tribal knowledge" gatekeeping)
- **Enable continuous learning** through citation trails and source exploration

**Metrics:**
- 50% faster onboarding (time to first independent ticket resolution)
- 80% of new agents rate TicketPilot as "essential" for learning

---

#### 4. **SDG 12 – Responsible Consumption and Production** (Secondary)
**Contribution:**  
- **Reduce redundant documentation** by identifying duplicate content via embeddings
- **Optimize content curation** by flagging low-utility sources

**Metrics:**
- 20% reduction in redundant documentation pages

---

#### 5. **SDG 10 – Reduced Inequalities** (Secondary)
**Contribution:**  
- **Level the playing field** for junior agents (instant access to knowledge vs. relying on senior agents)
- **Support non-native English speakers** (planned multi-language support in Phase 3)

**Metrics:**
- 40% improvement in junior agent performance (measured by CSAT)

---

## 13. Stakeholder Sign-Off

**Product Owner:** Dhanush (TicketPilot Founder)  
**Date:** 2025-11-09  
**Approval Status:** ✅ Approved for Zeroth Review

**Reviewers:**
- Faculty Advisor — Pending (Review Window: 6-10 Nov 2025)
- Technical Mentor — Pending
- Pilot Customer (Acme Corp) — Approved (2025-10-15)

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-09T00:00:00Z  
**Auto-generated by agent for TicketPilot Zeroth Review**
