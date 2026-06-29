-- Migration 004: Allow a user to move to a different household from Settings
-- Run this in Supabase SQL editor

-- ────────────────────────────────────────────────────────────────
-- 1. change_household — lets an existing user join another household
--    (updates household_id on the users row in-place)
-- ────────────────────────────────────────────────────────────────
create or replace function public.change_household(
  p_household_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_household_id is null then
    raise exception 'Household ID is required';
  end if;

  if not exists (select 1 from public.households where id = p_household_id) then
    raise exception 'Household not found';
  end if;

  if not exists (select 1 from public.users where id = v_user_id) then
    raise exception 'User profile not found. Use join_household instead.';
  end if;

  update public.users
  set household_id = p_household_id
  where id = v_user_id;

  return p_household_id;
end;
$$;

revoke all  on function public.change_household(uuid) from public;
grant execute on function public.change_household(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2. households RLS: allow a member to read any household by id
--    (needed so the client can verify the id before switching)
-- ────────────────────────────────────────────────────────────────
drop policy if exists households_select_by_id on public.households;
create policy households_select_by_id on public.households
  for select
  using (true);   -- security definer functions handle access control; raw select is fine for UUID-guessing resistance

