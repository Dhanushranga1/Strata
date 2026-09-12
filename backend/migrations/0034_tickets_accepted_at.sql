-- Migration 0034: Add accepted_at to tickets
-- rep.py queue/accept flow references app.tickets.accepted_at but the
-- column was never created — /api/rep/queue 500'd with
-- UndefinedColumnError and ticket-accept would too.

ALTER TABLE app.tickets
    ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tickets_accepted_at
    ON app.tickets (organization_id, accepted_at);
