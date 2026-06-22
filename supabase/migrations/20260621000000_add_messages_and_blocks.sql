-- ============================================================
-- 1:1 student↔student direct messages + blocks.  Sprint 1 = data model only.
-- Writes here are plain RLS-gated DML (so they're provable from SQL). Sprint 2
-- moves writes behind SECURITY DEFINER RPCs (and may then REVOKE direct DML).
-- Encryption is Sprint 3 — body_enc is just UTF-8 bytes for now.
-- Connection-gated: you may only message someone you're connected to.
-- ============================================================

-- ---------------- MESSAGES ----------------
-- id is the CLIENT-supplied idempotency key -> deliberately NO default. A default
-- would mint a fresh row on a retried send and defeat idempotency; S2's RPC pairs
-- this PK with ON CONFLICT (id) DO NOTHING.
CREATE TABLE IF NOT EXISTS public.messages (
  id            UUID PRIMARY KEY,
  sender_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body_enc      BYTEA NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at       TIMESTAMPTZ,
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_created
  ON public.messages (recipient_id, created_at DESC);          -- inbox/unread + realtime filter
CREATE INDEX IF NOT EXISTS idx_messages_thread
  ON public.messages (sender_id, recipient_id, created_at);    -- thread fetch (one direction)

-- ---------------- BLOCKS (self-scoped, mirrors the connections shape) ----------------
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks (blocked_id);

-- ---------------- HELPERS for RLS (SECURITY DEFINER → bypass callee RLS) ----------------
-- SELF-SCOPED on purpose (mirror is_org_member 20260526000000 / is_project_admin
-- 20260611000000): each takes only the OTHER user's id and derives the caller side
-- from auth.uid(). A policy subquery is itself under RLS, so the block check MUST run
-- as definer — else the sender can't see the recipient's block row, the check fails
-- OPEN, and a blocked send silently succeeds. Keeping both gates as helpers also stops
-- a future edit from re-inlining and re-opening that hole.
--
-- Why single-arg, not (a, b): a two-uuid SECURITY DEFINER helper is world-callable
-- (Supabase default-grants EXECUTE to anon/authenticated), so ANY caller — even a
-- logged-out anon hitting POST /rest/v1/rpc/<fn> — could probe the relationship of
-- ANY two users and enumerate the private connection graph AND the blocker-only block
-- graph (profile UUIDs are harvestable from public_profiles). Folding the caller side
-- to auth.uid() makes third-party enumeration unexpressible: a caller can only ever
-- learn facts about itself. (Residual: a caller can still learn if a specific user
-- blocked *them* — but that's already inferable, since a blocked send fails.)
CREATE OR REPLACE FUNCTION public.is_connected_to(target UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.connections c
    WHERE (c.user_id = auth.uid() AND c.target_id = target)
       OR (c.user_id = target     AND c.target_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_blocked_with(target UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks bl
    WHERE (bl.blocker_id = auth.uid() AND bl.blocked_id = target)
       OR (bl.blocker_id = target     AND bl.blocked_id = auth.uid())
  );
$$;

-- Least-privilege EXECUTE (recipe from close_project_role 20260614000000 /
-- record_project_view 20260609000000): the INSERT policy below evaluates these AS the
-- querying role, so authenticated MUST keep EXECUTE. Supabase default-grants EXECUTE
-- to anon/authenticated/service_role on new public functions, so REVOKE FROM PUBLIC
-- alone leaves anon's explicit grant — drop it too. (service_role is trusted/server-
-- side and keeps its default grant.)
REVOKE EXECUTE ON FUNCTION public.is_connected_to(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_blocked_with(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_connected_to(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_blocked_with(UUID) TO authenticated;

-- ---------------- RLS: MESSAGES ----------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Only the two participants can read a message.
DROP POLICY IF EXISTS "Messages visible to the two participants" ON public.messages;
CREATE POLICY "Messages visible to the two participants"
  ON public.messages FOR SELECT
  TO authenticated
  USING (auth.uid() IN (sender_id, recipient_id));

-- You may send only AS yourself, only to a connection (either direction), and only
-- if neither party has blocked the other. sender_id = auth.uid() is asserted here, so
-- the self-scoped helpers (auth.uid() vs recipient_id) are equivalent to the old
-- (sender_id, recipient_id) pair — just not world-probeable.
DROP POLICY IF EXISTS "Send to a connection who hasn't blocked you" ON public.messages;
CREATE POLICY "Send to a connection who hasn't blocked you"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_id <> recipient_id
    AND public.is_connected_to(recipient_id)
    AND NOT public.is_blocked_with(recipient_id)
  );

-- Only the recipient can mark a message read. (Column lock below restricts WHICH
-- columns; this restricts WHICH rows.)
DROP POLICY IF EXISTS "Recipient can mark read" ON public.messages;
CREATE POLICY "Recipient can mark read"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Column lock: RLS scopes rows, not columns, so the recipient-only UPDATE policy
-- alone would still let the recipient rewrite body_enc/sender_id. Supabase grants
-- ALL to authenticated/anon on new public tables by default, so the REVOKE is
-- load-bearing — a bare GRANT would be a no-op. (Revoke-then-grant precedent:
-- 20260614000000, 20260609000000.) After this, the only legal UPDATE is to read_at.
REVOKE UPDATE ON public.messages FROM authenticated, anon;
GRANT  UPDATE (read_at) ON public.messages TO authenticated;

-- ---------------- RLS: BLOCKS (private to the blocker; mirrors connections policies) ----------------
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own blocks" ON public.blocks;
CREATE POLICY "View own blocks" ON public.blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "Add own blocks" ON public.blocks;
CREATE POLICY "Add own blocks" ON public.blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "Remove own blocks" ON public.blocks;
CREATE POLICY "Remove own blocks" ON public.blocks
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- ---------------- REALTIME ----------------
-- INSERT-only ping on recipient_id=eq.<me>; the client refetches the row via the
-- decrypting RPC (S2+). INSERT events always carry the full new row, so default
-- (primary-key) replica identity is sufficient — no REPLICA IDENTITY FULL needed
-- (unlike team_members, which streams UPDATE/DELETE filtered on a non-PK column).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
