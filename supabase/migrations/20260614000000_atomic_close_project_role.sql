-- #1: atomically close the applicant's role slot when a join request is approved.
-- Replaces a client-side read-modify-write of projects.roles (select roles ->
-- closeRole() in JS -> update roles) that lost a role-close under concurrent
-- approvals (last-write-wins). The row lock serializes approvals so each closes a
-- distinct still-open slot; the function writes only when a slot actually closes
-- (so no-op approvals don't churn updated_at). Mirrors JS closeRole()
-- (src/services/projectService.js) case-for-case.
--
-- SECURITY INVOKER + the explicit owner_id = auth.uid() filter keep this
-- RLS-consistent with the existing owner-only approval gate (migrations 011/002):
-- a non-owner call matches no row and no-ops without acquiring a lock.

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
  -- Owner-only + row lock. Non-owners match no row, so this returns without
  -- locking anything; concurrent owner approvals serialize on this lock.
  select roles into v_roles
  from public.projects
  where id = p_project_id and owner_id = auth.uid()
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

-- Least-privilege: only signed-in users approve (Supabase's default privileges
-- grant anon/authenticated/service_role explicitly, so revoke from public alone
-- leaves anon's grant — drop it too). The function self-gates on owner_id anyway.
revoke execute on function public.close_project_role(uuid, text) from public;
revoke execute on function public.close_project_role(uuid, text) from anon;
grant execute on function public.close_project_role(uuid, text) to authenticated;
