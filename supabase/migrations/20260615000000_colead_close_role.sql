-- Co-lead aware role-close. The atomic close_project_role (20260614000000) was
-- written owner-only (`owner_id = auth.uid()`), which predates co-leads. Since
-- 20260611000000, a co-lead runs the join inbox — the team_members UPDATE policy
-- and getMyPendingRequests both gate on is_project_admin — so a co-lead CAN
-- approve a join request. But the owner-only close then no-ops for them: the
-- member joins yet the flyer's "N roles open" count never drops (and reopens on
-- reload). This redefines the function with the gate widened to match the
-- approval gate — the ONLY change from 20260614000000 is the WHERE clause:
--   owner_id = auth.uid()  ->  public.is_project_admin(p_project_id)
--
-- is_project_admin is SECURITY DEFINER (defined in 20260611000000), so it
-- resolves the project's admins regardless of this function's INVOKER context;
-- the subsequent UPDATE projects runs as the invoker and passes the widened
-- projects UPDATE policy (owner OR co-lead). The guard trigger only fires on
-- owner_id/admins changes, so a roles-only write sails through. Idempotent
-- CREATE OR REPLACE; safe to replay on a drifted prod.

create or replace function public.close_project_role(p_project_id uuid, p_title text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_roles jsonb;
  v_idx int;
  v_title_exists boolean;
begin
  -- Owner OR co-lead + row lock. A non-admin call matches no row, so this
  -- returns without locking anything; concurrent admin approvals serialize
  -- on this lock and each closes a distinct still-open slot.
  select roles into v_roles
  from public.projects
  where id = p_project_id and public.is_project_admin(p_project_id)
  for update;

  if v_roles is null or jsonb_typeof(v_roles) <> 'array' then
    return;
  end if;

  -- (1) first OPEN role whose title matches the requested role
  select min(ord - 1) into v_idx
  from jsonb_array_elements(v_roles) with ordinality as t(elem, ord)
  where coalesce((elem->>'open')::boolean, false)
    and p_title is not null and p_title <> ''
    and elem->>'title' = p_title;

  -- (2) no open-title match -> close the first OPEN role, but ONLY if the title
  --     matches no role at all (empty title, or a no-role "interested" note).
  --     If it matches only a FILLED role, do nothing (don't steal another slot).
  if v_idx is null then
    select bool_or(elem->>'title' = p_title) into v_title_exists
    from jsonb_array_elements(v_roles) with ordinality as t(elem, ord)
    where p_title is not null and p_title <> '';

    if not coalesce(v_title_exists, false) then
      select min(ord - 1) into v_idx
      from jsonb_array_elements(v_roles) with ordinality as t(elem, ord)
      where coalesce((elem->>'open')::boolean, false);
    end if;
  end if;

  -- (3) write only when a slot actually closes (atomic; fixes the no-op churn)
  if v_idx is not null then
    update public.projects
    set roles = jsonb_set(roles, array[v_idx::text, 'open'], 'false'::jsonb)
    where id = p_project_id;
  end if;
end;
$$;

-- Re-assert least-privilege grants (CREATE OR REPLACE preserves them, but stay
-- explicit so this migration stands alone on a drifted DB).
revoke execute on function public.close_project_role(uuid, text) from public;
revoke execute on function public.close_project_role(uuid, text) from anon;
grant execute on function public.close_project_role(uuid, text) to authenticated;
