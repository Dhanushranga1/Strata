-- P7: Composite indexes for ticket queries
-- Eliminates full-org sequential scans; enables fast status/assignee filtering

CREATE INDEX IF NOT EXISTS idx_tickets_org_status_created
  ON app.tickets(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_org_assignee_status
  ON app.tickets(organization_id, assignee_id, status);

-- pg_trgm for fast ILIKE '%...%' full-text search on ticket titles
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_tickets_title_trgm
  ON app.tickets USING gin(title gin_trgm_ops);

-- Messages: fast reverse-chronological fetch per ticket
CREATE INDEX IF NOT EXISTS idx_messages_ticket_created
  ON app.messages(ticket_id, created_at DESC);
