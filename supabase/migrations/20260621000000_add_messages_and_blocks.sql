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
-- Same idiom + rationale as is_org_member (20260526000000): a policy subquery is
-- itself subject to RLS, so the block check MUST run as definer — otherwise the
-- sender can't see the recipient's own block row, the check fails OPEN, and a
-- blocked send silently succeeds. are_connected mirrors it for uniformity (the
-- connection check is provably safe inline — see 20260607000000 — but keeping
-- both gates as helpers stops a future edit from re-inlining and re-opening this).
CREATE OR REPLACE FUNCTION public.are_connected(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.connections c
    WHERE (c.user_id = a AND c.target_id = b)
       OR (c.user_id = b AND c.target_id = a)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_blocked_between(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks bl
    WHERE (bl.blocker_id = a AND bl.blocked_id = b)
       OR (bl.blocker_id = b AND bl.blocked_id = a)
  );
$$;

-- ---------------- RLS: MESSAGES ----------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Only the two participants can read a message.
DROP POLICY IF EXISTS "Messages visible to the two participants" ON public.messages;
CREATE POLICY "Messages visible to the two participants"
  ON public.messages FOR SELECT
  TO authenticated
  USING (auth.uid() IN (sender_id, recipient_id));

-- You may send only AS yourself, only to a connection (either direction), and
-- only if neither party has blocked the other.
DROP POLICY IF EXISTS "Send to a connection who hasn't blocked you" ON public.messages;
CREATE POLICY "Send to a connection who hasn't blocked you"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_id <> recipient_id
    AND public.are_connected(sender_id, recipient_id)
    AND NOT public.is_blocked_between(sender_id, recipient_id)
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
