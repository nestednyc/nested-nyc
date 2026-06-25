-- ============================================================
-- Restrict student signups to SUPPORTED NYC-university email domains
-- ------------------------------------------------------------
-- Before this, handle_new_user accepted ANY *.edu. The product only serves the
-- NYC schools in the client taxonomy (src/design/data.jsx UNIVERSITIES), so a
-- "proper" student email must be on one of THOSE domains — or a subdomain of one
-- (e.g. baruch.cuny.edu under cuny.edu, stern.nyu.edu under nyu.edu). Enforced
-- here server-side; the client (validateEduEmail / isSupportedEduEmail) mirrors
-- it for instant feedback, but this trigger is the unbypassable gate.
--
-- Org admins (account_type='org_admin') are exempt — they use institutional
-- email of any domain. Existing users are GRANDFATHERED: this trigger fires only
-- on new auth.users INSERTs, never retroactively, and sign-in stays format-only.
--
-- KEEP THE DOMAIN LIST BELOW IN SYNC WITH UNIVERSITIES[].domain IN data.jsx.
-- ============================================================

-- Exact-or-subdomain match against the supported domains. 'notnyu.edu' does NOT
-- match 'nyu.edu' (the LIKE requires a literal '.' before the domain).
CREATE OR REPLACE FUNCTION public.is_supported_edu_email(email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH dom AS (SELECT lower(split_part(COALESCE(email, ''), '@', 2)) AS d)
  SELECT EXISTS (
    SELECT 1
    FROM dom, unnest(ARRAY[
      'nyu.edu','columbia.edu','cooper.edu','newschool.edu','cuny.edu',
      'fordham.edu','pratt.edu','sva.edu','pace.edu','nyit.edu',
      'juilliard.edu','fitnyc.edu','stjohns.edu','yu.edu','barnard.edu',
      'manhattan.edu','liu.edu','mmm.edu'
    ]) AS allowed(dom_allowed)
    WHERE dom.d = allowed.dom_allowed
       OR dom.d LIKE '%.' || allowed.dom_allowed
  );
$$;

-- Re-create handle_new_user with the allow-list check (was: NOT LIKE '%.edu').
-- Body is otherwise identical to 20260602000003_security_hardening.sql.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct TEXT := COALESCE(NEW.raw_user_meta_data->>'account_type', 'student');
BEGIN
  IF acct <> 'org_admin' AND NOT public.is_supported_edu_email(NEW.email) THEN
    RAISE EXCEPTION 'Only supported NYC university email addresses may register'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (id, account_type)
  VALUES (NEW.id, acct)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
