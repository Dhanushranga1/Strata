# 📽️ PowerPoint Presentation Placeholder

**File:** `Zeroth_Review_Slides.pptx`  
**Status:** ⚠️ **REQUIRES MANUAL CREATION**  
**Tool:** Microsoft PowerPoint, Google Slides, LibreOffice Impress, or python-pptx

---

## Presentation Specifications

**Total Slides:** 10  
**Duration:** 10-15 minutes presentation  
**Aspect Ratio:** 16:9 (widescreen)  
**Theme:** Professional, clean design (recommend: PowerPoint "Integral" or "Ion" theme)

---

## Slide-by-Slide Breakdown

### Slide 1: Title Slide
**Content:**
- **Title:** TicketPilot — AI-Powered Knowledge Management for Customer Support
- **Subtitle:** Zeroth Review Presentation
- **Date:** 6-10 November 2025 (TENTATIVE)
- **Presenter:** [Your Name]
- **Institution:** [Your University/College]
- **Logo:** (Optional) TicketPilot logo or university logo

**Design Notes:**
- Use large, bold font for title
- Minimal text; focus on visual impact
- Background: Solid color or subtle gradient

---

### Slide 2: Abstract & Problem Statement
**Content:**
- **Section Title:** The Problem
- **Key Points:**
  1. Support agents waste **40% of time** searching for answers
  2. Knowledge scattered across **5+ tools** (Confluence, Notion, Slack, etc.)
  3. **No confidence scores** → agents second-guess answers
  4. **Cost:** $29,000/year lost productivity per 50-agent team

**Visuals:**
- Icon: 🔍 (magnifying glass) or 🕒 (clock)
- Chart: Pie chart showing "40% Search Time vs. 60% Problem-Solving Time"
- Before/After comparison: "Current State" vs. "With TicketPilot"

---

### Slide 3: Literature Survey & Gaps
**Content:**
- **Section Title:** What Exists? What's Missing?
- **Literature Review:**
  - 6 sources reviewed (RAG foundations, FAISS, multi-tenancy, etc.)
  - State-of-the-art: Retrieval-Augmented Generation (RAG), vector databases
- **5 Key Gaps Identified:**
  1. No transparent confidence scoring
  2. No multi-tenant vector isolation
  3. No integrated platform (all-in-one solution)
  4. No citation provenance
  5. No knowledge gap visibility

**Visuals:**
- Table: "Existing Tools vs. TicketPilot"
- Icons for each gap (e.g., 🔒 for security, 🔗 for citations)

---

### Slide 4: TicketPilot Solution Overview
**Content:**
- **Section Title:** Our Solution
- **Key Features:**
  1. **Unified Knowledge Ingestion:** Markdown, PDF, URL, Confluence, Notion
  2. **Semantic Search (RAG):** 768-dim embeddings, <500ms latency
  3. **7-Factor Confidence Scoring:** Transparent, explainable AI
  4. **Multi-Tenant Security:** Supabase RLS, org-level isolation
  5. **Citation Provenance:** Full source trails with clickable links

**Visuals:**
- Architecture diagram: User → Query → RAG Pipeline → Confident Answer
- Icons for each feature (🔍 search, 🔐 security, 📊 confidence, 🔗 citations)

---

### Slide 5: Research Objectives & Product Goals
**Content:**
- **Section Title:** What We Aim to Achieve
- **6 Research Objectives:**
  1. Investigate RAG architectures for knowledge retrieval
  2. Design 7-factor confidence scoring algorithm
  3. Implement multi-tenant vector isolation with Supabase RLS
  4. Build citation provenance system
  5. Develop knowledge gap detection analytics
  6. Validate system with real-world support data

- **Success Metrics:**
  - Reduce search time by **70%** (from 10 min to <2 sec)
  - Achieve **>90% answer accuracy** (thumbs-up rate)
  - Save **$29,000/year** per 50-agent team

**Visuals:**
- Numbered list with checkmarks
- Bar chart: "Time Savings Before vs. After"

---

### Slide 6: SDG Alignment
**Content:**
- **Section Title:** Alignment with UN Sustainable Development Goals
- **Primary SDGs:**
  1. **SDG 8 (Decent Work and Economic Growth):** 70% search time reduction → more time for high-value work
  2. **SDG 9 (Industry, Innovation, and Infrastructure):** Pioneer transparent confidence scoring in RAG systems
  3. **SDG 4 (Quality Education):** 50% faster onboarding for new agents

- **Quantified Impact:**
  - $29,000/year productivity gain per 50-agent team
  - 30% reduction in agent turnover (less burnout)

**Visuals:**
- SDG logos (download from UN SDG website)
- Impact numbers in large, bold font
- Icons for productivity, innovation, education

---

### Slide 7: Product Backlog & Progress
**Content:**
- **Section Title:** What We've Built (Phase 1 MVP)
- **8 Epics, 44 Features:**
  1. Multi-Tenant Foundation (7/7 complete) ✅
  2. Document Ingestion (6/6 complete) ✅
  3. Embedding Pipeline (5/6 complete) 🚧
  4. Search & Retrieval (7/7 complete) ✅
  5. Confidence Scoring (7/7 complete) ✅
  6. Citation & Provenance (4/4 complete) ✅
  7. Feedback & Learning (2/3 complete) 🚧
  8. Analytics & Gap Detection (3/4 complete) 🚧

- **Overall Completion:** 88.6% (39 of 44 features)

**Visuals:**
- Progress bar: 88.6% filled (green)
- Table or checklist with status indicators (✅ complete, 🚧 in progress)

---

### Slide 8: Architecture & Technology Stack
**Content:**
- **Section Title:** How It Works (Technical Overview)
- **Backend:** Python (FastAPI), 7,318 lines of code, 49+ endpoints
- **Frontend:** TypeScript (Next.js), 15,298 lines of code
- **Database:** Supabase (PostgreSQL + pgvector), 12 tables, 20+ RLS policies
- **AI/ML:** OpenAI text-embedding-ada-002 (768-dim), 1,525-line RAG pipeline
- **Security:** Multi-tenant RLS, JWT authentication, org-level isolation

**Visuals:**
- System architecture diagram:
  - Frontend (Next.js) → Backend (FastAPI) → Supabase (DB + Vectors) → OpenAI (Embeddings)
- Tech stack logos (Python, TypeScript, Supabase, OpenAI)

---

### Slide 9: Roadmap & Timeline (Gantt Chart)
**Content:**
- **Section Title:** Project Timeline
- **Gantt Chart:** (Embed image from `visuals/gantt_zeroth_review.png`)
  - Phase 1: MVP (Oct-Dec 2024) ✅
  - **Zeroth Review:** 6-10 Nov 2025 📅 **TENTATIVE**
  - Phase 2: Scale (Jan-Mar 2025)
  - Phase 3: Enterprise (Apr-Sep 2025)

**Visuals:**
- Full-slide Gantt chart (created from `visuals/gantt_zeroth_review.png`)
- Highlight review week in red/orange

---

### Slide 10: Evaluation Rubric & Expected Outcome
**Content:**
- **Section Title:** Evaluation Criteria
- **5 Criteria (10 points total):**
  1. Problem Identification (IA) — 2 points
  2. Literature Survey (IA) — 2 points
  3. Presentation Quality (IA) — 2 points
  4. Research Objectives (GA) — 2 points
  5. SDG Alignment (GA) — 2 points

- **Decision Logic:**
  - **IA ≥ 5:** Accepted ✅
  - **IA < 5 AND 2.5 < GA < 5:** Accepted with Revision 🔄
  - **IA < 5 AND (GA ≤ 2.5 OR GA ≥ 5):** Rejected ❌

- **Self-Assessment:**
  - Total IA: **5.5/6** (92%)
  - Total GA: **4.0/4** (100%)
  - **Expected Outcome:** Accepted ✅

**Visuals:**
- Table with criteria and scores
- Decision flowchart (visual diagram)

---

### Slide 11 (Bonus): Thank You / Q&A
**Content:**
- **Title:** Thank You!
- **Contact:**
  - Email: [your-email@example.com]
  - GitHub: [github.com/yourusername/ticketpilot]
  - Demo: [ticketpilot-demo.vercel.app]

- **Questions?**

**Visuals:**
- Large "Thank You" text
- QR code linking to demo or GitHub repo (optional)

---

## Design Guidelines

### Fonts
- **Headings:** Arial, Calibri, or Helvetica (24-32pt)
- **Body Text:** Arial, Calibri, or Helvetica (14-18pt)
- **Bold:** Use for key numbers and metrics

### Colors
- **Primary:** Blue (#2196F3) or Navy (#1565C0)
- **Accent:** Green (#4CAF50) for checkmarks, Red (#FF5722) for review week
- **Background:** White or light gray (#F5F5F5)

### Images & Icons
- Use high-quality icons (recommend: Font Awesome, Feather Icons, or Noun Project)
- Compress images to keep file size <10MB
- Use consistent icon style (all solid or all outline)

### Text Guidelines
- **Bullet Points:** Max 5-7 per slide
- **Text Density:** Keep slides concise; use presenter notes for details
- **Animations:** Minimal (fade-in for bullet points is acceptable)

---

## Tools for Creation

### Option 1: Microsoft PowerPoint (Professional)
1. Open PowerPoint
2. Choose "Integral" or "Ion" theme (or custom design)
3. Create 10-11 slides following structure above
4. Insert Gantt chart from `visuals/gantt_zeroth_review.png` on Slide 9
5. Export as `.pptx`

### Option 2: Google Slides (Free, Online)
1. Go to slides.google.com
2. Choose template (e.g., "Simple Light" or "Modern Writer")
3. Create slides following structure above
4. Download as `.pptx` (File > Download > Microsoft PowerPoint)

### Option 3: LibreOffice Impress (Free, Open-Source)
1. Download LibreOffice: https://www.libreoffice.org/
2. Open Impress
3. Create slides
4. Export as `.pptx`

### Option 4: Python (`python-pptx`)
**Sample Code:**
```python
from pptx import Presentation
from pptx.util import Inches, Pt

prs = Presentation()
prs.slide_width = Inches(10)
prs.slide_height = Inches(7.5)

# Slide 1: Title
slide1 = prs.slides.add_slide(prs.slide_layouts[0])
title1 = slide1.shapes.title
title1.text = "TicketPilot — AI-Powered Knowledge Management"
subtitle1 = slide1.placeholders[1]
subtitle1.text = "Zeroth Review Presentation | 6-10 November 2025"

# Slide 2: Problem Statement
slide2 = prs.slides.add_slide(prs.slide_layouts[1])
title2 = slide2.shapes.title
title2.text = "The Problem"
content2 = slide2.placeholders[1].text_frame
content2.text = "Support agents waste 40% of time searching for answers"

# ... (repeat for remaining slides)

prs.save("Zeroth_Review_Slides.pptx")
```

---

## After Creation

1. Save file as: `TicketPilot_Zeroth_Review/presentations/Zeroth_Review_Slides.pptx`
2. Verify file size <20MB
3. Test on Windows/Mac to ensure compatibility
4. Create PDF version for backup: `Zeroth_Review_Slides.pdf`
5. Update manifest.json with SHA-256 checksum

---

## Content Sources

All content for slides can be found in:
- **Abstract:** `docs/00_Abstract_and_Intro.md`
- **Literature & Gaps:** `research/literature_survey.md`, `docs/01_Literature_Survey_Gaps.md`
- **Objectives:** `docs/02_Objectives_and_Epics.md`
- **SDG:** `docs/03_SDG_and_Contribution.md`
- **Backlog:** `backlog/product_backlog.md`
- **Roadmap:** `backlog/product_roadmap.md`
- **Evaluation:** `evaluation/evaluation_summary.md`

---

**Last Updated:** 2025-11-09T00:00:00Z  
**Auto-generated by agent**
