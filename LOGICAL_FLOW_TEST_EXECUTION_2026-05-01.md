# Logical Flow Test Execution

Date: 2026-05-01
Environment: Local backend (http://localhost:8000)
Run type: API-driven smoke flow across two orgs
Script: logical_flow_test_run.py

## Summary
- Result: All executed checks passed
- Notes: Two test orgs and six test users were created to exercise org isolation and ticket lifecycle actions.

## Checks Executed
- Create ticket in Org A
- Create ticket in Org B
- Rep accepts ticket
- Rep sets status to in_progress
- Rep adds internal note
- Rep sends public reply
- Rep escalates ticket
- Rep resolves ticket
- Customer rates ticket (CSAT)
- Cross-org access blocked (rep A -> ticket B)
- Cross-org access blocked (customer B -> ticket A)
- Audit log entries recorded for accept, status change, and escalation

## Test Data
- Org A ID: 13fac008-24ce-4a78-955c-ec6148dd5a5e
- Org B ID: b6ac53b5-ce30-4f74-8a88-212cda0b77ae
- Ticket A ID: b2df517f-48e4-4035-ace9-713f1689c1d8
- Ticket B ID: b65f33f8-0708-4649-95fb-1d1046182123

## Cleanup (Optional)
- Remove test users whose emails start with `tp-` and the timestamp used by the run.
- Delete Org A / Org B if no longer needed.
