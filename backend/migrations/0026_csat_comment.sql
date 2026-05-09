-- Add qualitative comment field to CSAT ratings
ALTER TABLE app.tickets
    ADD COLUMN IF NOT EXISTS customer_rating_comment TEXT
        CHECK (length(customer_rating_comment) <= 500);
