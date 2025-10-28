-- Migration: AI Feedback Collection
-- Purpose: Allow users to provide thumbs up/down feedback on AI responses
-- Author: UX Rescue - Phase 3
-- Date: October 16, 2025

-- Create ai_feedback table
CREATE TABLE IF NOT EXISTS app.ai_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES app.tickets(id) ON DELETE CASCADE,
    message_id UUID NOT NULL,
    user_id UUID NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Ensure one feedback per user per message
    UNIQUE(message_id, user_id)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_feedback_ticket_id ON app.ai_feedback(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_message_id ON app.ai_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at ON app.ai_feedback(created_at DESC);

-- Grant permissions
GRANT SELECT, INSERT ON app.ai_feedback TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE app.ai_feedback IS 'Stores user feedback (thumbs up/down) on AI-generated responses';
COMMENT ON COLUMN app.ai_feedback.feedback_type IS 'Either positive or negative';

-- Rollback instructions (if needed):
-- DROP TABLE IF EXISTS app.ai_feedback CASCADE;
