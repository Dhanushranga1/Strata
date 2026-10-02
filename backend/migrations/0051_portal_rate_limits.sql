-- Migration 0051: durable portal submission rate limiting.
--
-- The customer portal's ticket endpoint is public (no auth), so it is
-- rate-limited per client IP. The previous limiter was an in-process dict:
-- it reset on every deploy/restart, was per-worker, and trusted the first
-- X-Forwarded-For hop (client-controlled). Counting submissions in the
-- database makes the limit survive restarts and work across workers.
--
-- Only a SHA-256 hash of the IP is stored.
CREATE TABLE IF NOT EXISTS app.portal_rate_limits (
    ip_hash    text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_rate_limits_ip_time
    ON app.portal_rate_limits (ip_hash, created_at DESC);
