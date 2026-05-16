-- Fix bootstrap setup flow for first-time household creation/joining.
-- This avoids recursive RLS evaluation and removes the need for direct household insert/select during setup.

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.household_id
  from public.users u
  where u.id = auth.uid();
$$;

create or replace function public.create_household_with_owner(
  p_household_name text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.users where id = v_user_id) then
    raise exception 'User profile already exists';
  end if;

  v_display_name := coalesce(nullif(trim(p_display_name), ''), 'User');

  insert into public.households (name)
  values (coalesce(nullif(trim(p_household_name), ''), 'My Household'))
  returning id into v_household_id;

  insert into public.users (id, household_id, display_name, role)
  values (v_user_id, v_household_id, v_display_name, 'owner');

  insert into public.categories (household_id, transaction_type, name, is_system)
  values
    (v_household_id, 'income',  'Salary', true),
    (v_household_id, 'income',  'Freelance', true),
    (v_household_id, 'expense', 'Groceries', true),
    (v_household_id, 'expense', 'Rent / Mortgage', true),
    (v_household_id, 'expense', 'Baby & Kids', true),
    (v_household_id, 'expense', 'Health', true),
    (v_household_id, 'expense', 'Transport', true),
    (v_household_id, 'expense', 'Entertainment', true),
    (v_household_id, 'expense', 'Other', true)
  on conflict (household_id, transaction_type, name) do nothing;

  return v_household_id;
end;
$$;

create or replace function public.join_household(
  p_household_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_display_name text;
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

  if exists (select 1 from public.users where id = v_user_id) then
    raise exception 'User profile already exists';
  end if;

  v_display_name := coalesce(nullif(trim(p_display_name), ''), 'User');

  insert into public.users (id, household_id, display_name, role)
  values (v_user_id, p_household_id, v_display_name, 'member');

  return p_household_id;
end;
$$;

revoke all on function public.create_household_with_owner(text, text) from public;
revoke all on function public.join_household(uuid, text) from public;
grant execute on function public.create_household_with_owner(text, text) to authenticated;
grant execute on function public.join_household(uuid, text) to authenticated;

