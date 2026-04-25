-- Migration 0017: Ticket enhancements for production launch
-- Adds internal notes, tags, resolution fields, CSAT rating.

-- ── Internal notes on messages ────────────────────────────────────────────────
-- is_internal = true messages are only visible to reps/admins, not customers.
ALTER TABLE app.messages
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_messages_internal
  ON app.messages(ticket_id)
  WHERE is_internal = true;

-- ── Ticket tags ───────────────────────────────────────────────────────────────
ALTER TABLE app.tickets
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_tickets_tags
  ON app.tickets USING gin(tags);

-- ── Resolution fields ─────────────────────────────────────────────────────────
-- resolved_at: exact timestamp of resolution (separate from updated_at churn).
-- resolution_note: rep's closing summary visible to customer.
-- customer_rating: 1-5 CSAT rating submitted by customer after resolution.
ALTER TABLE app.tickets
  ADD COLUMN IF NOT EXISTS resolution_note text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_rating smallint CHECK (customer_rating BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_tickets_resolved_at
  ON app.tickets(organization_id, resolved_at DESC)
  WHERE resolved_at IS NOT NULL;
