-- Rate limiting table for email sending
-- This table tracks email sends to prevent abuse

CREATE TABLE IF NOT EXISTS email_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,  -- user_id for authenticated, IP for auth hooks
  email_type TEXT NOT NULL,  -- 'auth_signup', 'auth_recovery', 'transactional', etc.
  recipient_email TEXT,      -- the email address we sent to (for audit)
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient rate limit lookups
CREATE INDEX idx_email_rate_limits_lookup 
  ON email_rate_limits (identifier, email_type, sent_at DESC);

-- Index for cleanup operations
CREATE INDEX idx_email_rate_limits_sent_at 
  ON email_rate_limits (sent_at);

-- Function to check rate limit (returns true if within limit)
CREATE OR REPLACE FUNCTION check_email_rate_limit(
  p_identifier TEXT,
  p_email_type TEXT,
  p_max_per_hour INT DEFAULT 10
)
RETURNS BOOLEAN AS $$
DECLARE
  recent_count INT;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM email_rate_limits
  WHERE identifier = p_identifier
    AND email_type = p_email_type
    AND sent_at > NOW() - INTERVAL '1 hour';
  
  RETURN recent_count < p_max_per_hour;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record an email send
CREATE OR REPLACE FUNCTION record_email_send(
  p_identifier TEXT,
  p_email_type TEXT,
  p_recipient_email TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO email_rate_limits (identifier, email_type, recipient_email)
  VALUES (p_identifier, p_email_type, p_recipient_email)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old rate limit records (call via pg_cron or scheduled job)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM email_rate_limits 
  WHERE sent_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to service role (Edge Functions use this)
GRANT SELECT, INSERT, DELETE ON email_rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION check_email_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION record_email_send TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_rate_limits TO service_role;

-- Grant access to auth admin (for auth hooks)
GRANT SELECT, INSERT ON email_rate_limits TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION check_email_rate_limit TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION record_email_send TO supabase_auth_admin;

-- RLS: Disable for this table (only accessed by service role/auth admin)
-- This is intentional - rate limits should not be user-accessible
ALTER TABLE email_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access (no public access)
CREATE POLICY "Service role full access"
  ON email_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE email_rate_limits IS 'Tracks email sends for rate limiting to prevent abuse';
COMMENT ON FUNCTION check_email_rate_limit IS 'Returns true if identifier is within rate limit for given email type';
COMMENT ON FUNCTION record_email_send IS 'Records an email send for rate limiting purposes';
COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Removes rate limit records older than 24 hours';
