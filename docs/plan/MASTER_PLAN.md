# TicketPilot — Master Feature Plan

> Last updated: 2026-05-01
> Status tracking: see each sprint doc

---

## Guiding principles
- One feature at a time, fully shipped before starting the next
- Every change documented in its sprint doc under "How we implemented it"
- DB connections stay under 5 concurrent (Supabase free tier limit)
- Rep UX: minimize org-switching friction with a unified view

---

## Sprint Overview

| Sprint | Theme | Status |
|--------|-------|--------|
| [Sprint 1](sprint1-quick-wins.md) | Labels, visibility, auto-assign | ✅ Done |
| [Sprint 2](sprint2-timer-and-roles.md) | Accept timer, Time to Resolve, role panels | ✅ Done |
| [Sprint 3](sprint3-org-access-control.md) | Rep↔Org assignments, unified My Tickets, admin org mgmt | ✅ Done |
| [Sprint 4](sprint4-admin-power.md) | Admin ticket view all-orgs, audit log, settings, rep contact | ✅ Done |
| [Sprint 5](sprint5-reports.md) | Monthly report export (PDF / CSV / JSON, 8 sections) | ✅ Done |
| [DB Optimisation](db-optimisation.md) | Supabase free-tier connection hardening | ✅ Done |

---

## Feature → Sprint mapping

| # | Feature | Sprint |
|---|---------|--------|
| 1 | Time to Resolve field on tickets | Sprint 2 |
| 2 | Role-based conditional panels | Sprint 2 |
| 3 | "Total Queue" → "Total In Progress" | Sprint 1 |
| 4 | Accept ticket → timer starts → in_progress | Sprint 2 |
| 5 | Admin assigns rep↔org access | Sprint 3 |
| 6 | Remove Team Members from rep view | Sprint 1 |
| 7 | Admin manages reps per org | Sprint 3 |
| 8 | Rep sees only assigned-org tickets | Sprint 1 |
| 9 | Rename Member → Client (labels) | Sprint 1 |
| 10 | Auto-assign fires on ticket creation | Sprint 1 |
| 11 | Admin creates/manages organizations | Sprint 3 |
| 12 | Rep sees only orgs assigned by admin (same as 5/8) | Sprint 3 |
| 13 | Admin ticket view: all orgs + org filter | Sprint 4 |
| 14 | Platform-wide audit log (admin only) | Sprint 4 |
| 15 | Rep contact card shown to client on ticket | Sprint 4 |
| 16 | Editable admin settings, remove mobile from signup | Sprint 4 |
| 17/18 | Monthly report export | Sprint 5 |
| — | Unified "My Tickets" page for reps (all orgs) | Sprint 3 |
| — | DB connection optimisation for Supabase free tier | DB doc |
