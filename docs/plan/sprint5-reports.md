# Sprint 5 — Monthly Report Export

## Status: BLOCKED
Waiting for report format specification from Rashid.

## What we know
- Admin-only feature
- Multiple export formats (PDF, CSV, Excel minimum)
- Monthly scope (can be any calendar month, not just "last month")

## Pre-work we can do now (not blocked)
- Scaffold the "Export Report" button and modal in admin analytics page
- Add format selector dropdown (PDF / CSV / Excel) — disabled until spec arrives
- Design the data queries we'll need regardless of format:
  - Tickets opened/closed per month per org
  - Rep performance (response time, resolution rate)
  - AI resolution rate vs escalation rate
  - KB usage stats

## Implementation log

### Report format (self-designed — 8 sections)

| # | Section | What it contains |
|---|---------|-----------------|
| 1 | Executive Summary | Opened, resolved, carried-in, still-open, overdue, resolution rate, avg 1st response, avg resolution time, CSAT rating, MoM volume change |
| 2 | Weekly Volume | Per-week opened vs resolved breakdown for the month |
| 3 | Status Breakdown | Count by status (open / in_progress / resolved / closed / escalated) |
| 4 | Priority Breakdown | Count + resolution rate per priority level |
| 5 | Rep Performance | Per-rep: assigned, resolved, resolution rate, avg 1st response, avg resolution time, avg customer rating |
| 6 | AI Performance | Total AI interactions, self-resolve %, escalation %, avg confidence, avg latency |
| 7 | SLA / ETR Compliance | Tickets with ETR set, met vs breached, compliance rate % |
| 8 | Top Tags | Top 10 tags by ticket count |

### Export formats
- **PDF** — ReportLab-generated: KPI card rows, colour-coded tables, purple header branding, auto page breaks
- **CSV** — Sectioned spreadsheet with `=== Section ===` headers, importable into Excel / Google Sheets
- **JSON** — Raw structured data for integrations or further analysis

### Backend (`backend/app/reports.py`) — NEW
- `GET /api/admin/reports/monthly?year=&month=&format=json|csv|pdf`
- Requires admin role + org context header
- All 8 sections in one function `_collect()` using the asyncpg pool
- `_build_csv()` — stdlib `csv` module, sectioned layout
- `_build_pdf()` — ReportLab `SimpleDocTemplate` with `kpi_row()` helper for summary cards and `tbl()` helper for data tables
- Returns `StreamingResponse` for CSV/PDF (triggers browser download), plain dict for JSON

### Dependencies added
- `reportlab>=4.0.0` — PDF generation
- `openpyxl>=3.1.0` — available for future Excel format

### Frontend (`frontend/src/app/(protected)/admin/analytics/page.tsx`)
- "Export Monthly Report" button in page header
- `Dialog` modal with:
  - Month + year selectors (defaults to last month)
  - 3-button format picker: PDF / CSV / JSON with icons and descriptions
  - Report contents summary (what's included)
  - Download button triggers `fetch()` + `URL.createObjectURL()` for file save
- No new page needed — modal lives on the existing analytics page
