-- Drop the old constraint (created during initial table creation) that was
-- never renamed when migration 0004 added 'ai' role support.
-- The replacement constraint app_messages_sender_role_check already exists
-- and covers: customer, rep, system, ai
ALTER TABLE app.messages DROP CONSTRAINT IF EXISTS messages_sender_role_check;
