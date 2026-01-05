-- Migration: Restrict get_email_by_username RPC
-- 
-- Goal:
--   - Prevent anonymous or regular authenticated clients from resolving username → email
--   - Keep function available only to service_role (Edge Functions / backend only)
-- 
-- This closes an email enumeration vector where a public client could call:
--   supabase.rpc('get_email_by_username', { p_username: 'someuser' })
-- and receive that user's private email address.

DO $$
BEGIN
  -- Revoke execute from anon and authenticated roles if it exists
  REVOKE EXECUTE ON FUNCTION get_email_by_username(TEXT) FROM anon, authenticated;

  -- Allow only service_role to call this RPC.
  -- Edge Functions use the service_role key and can safely resolve
  -- username → email server-side without exposing emails to clients.
  GRANT EXECUTE ON FUNCTION get_email_by_username(TEXT) TO service_role;
EXCEPTION
  WHEN undefined_function THEN
    -- Function doesn't exist (e.g., earlier migrations not applied); no-op.
    NULL;
END;
$$;

