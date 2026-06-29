-- Migration 003: Inventory categories, credit card imports, finance overhaul
-- Run this in Supabase SQL editor

-- ────────────────────────────────────────────────────────────────
-- 1. INVENTORY CATEGORIES
-- ────────────────────────────────────────────────────────────────
create table if not exists public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

alter table public.inventory add column if not exists category_id uuid references public.inventory_categories (id) on delete set null;

create index if not exists idx_inventory_category on public.inventory (household_id, category_id);

-- ────────────────────────────────────────────────────────────────
-- 2. EXPENSE TYPE ENUM + COLUMNS ON TRANSACTIONS
-- ────────────────────────────────────────────────────────────────
do $$ begin
  create type expense_type as enum ('fixed', 'variable', 'one_time');
exception when duplicate_object then null; end $$;

alter table public.transactions add column if not exists expense_type expense_type not null default 'variable';
alter table public.transactions add column if not exists ownership_type text not null default 'shared'
  check (ownership_type in ('shared', 'personal'));

-- ────────────────────────────────────────────────────────────────
-- 3. CREDIT CARD IMPORTS
-- ────────────────────────────────────────────────────────────────
create table if not exists public.credit_imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  file_name text not null,
  billing_month text not null,          -- YYYY-MM
  ownership_type text not null default 'shared' check (ownership_type in ('shared', 'personal')),
  owner_user_id uuid references public.users (id) on delete set null,
  imported_by uuid not null references public.users (id) on delete restrict,
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────
-- 4. CREDIT TRANSACTIONS (parsed rows from bank Excel)
-- ────────────────────────────────────────────────────────────────
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  import_id uuid references public.credit_imports (id) on delete cascade,
  card_name text,
  billing_date date,
  transaction_date date,
  business_name text not null,
  amount_ils numeric(12,2) not null,
  purchase_amount numeric(12,2),
  reference_number text,
  transaction_type_desc text,           -- 'הוראת קבע', 'עסקה רגילה', 'תשלומים'
  expense_type expense_type not null default 'variable',
  category_id uuid references public.categories (id) on delete set null,
  ownership_type text not null default 'shared' check (ownership_type in ('shared', 'personal')),
  owner_user_id uuid references public.users (id) on delete set null,
  billing_month text not null,          -- YYYY-MM
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_tx_month  on public.credit_transactions (household_id, billing_month);
create index if not exists idx_credit_tx_biz    on public.credit_transactions (household_id, business_name);
create index if not exists idx_credit_imports_h on public.credit_imports (household_id, billing_month);

-- ────────────────────────────────────────────────────────────────
-- 5. BUSINESS NAME → CATEGORY MAPPINGS (auto-classify future rows)
-- ────────────────────────────────────────────────────────────────
create table if not exists public.business_mappings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  business_name text not null,
  category_id uuid references public.categories (id) on delete set null,
  expense_type expense_type not null default 'variable',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, business_name)
);

create index if not exists idx_business_mappings on public.business_mappings (household_id, business_name);

-- ────────────────────────────────────────────────────────────────
-- 6. ROW-LEVEL SECURITY FOR NEW TABLES
-- ────────────────────────────────────────────────────────────────
alter table public.inventory_categories enable row level security;
alter table public.credit_imports       enable row level security;
alter table public.credit_transactions  enable row level security;
alter table public.business_mappings    enable row level security;

drop policy if exists inventory_categories_all_household on public.inventory_categories;
create policy inventory_categories_all_household on public.inventory_categories
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

drop policy if exists credit_imports_all_household on public.credit_imports;
create policy credit_imports_all_household on public.credit_imports
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

drop policy if exists credit_transactions_all_household on public.credit_transactions;
create policy credit_transactions_all_household on public.credit_transactions
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

drop policy if exists business_mappings_all_household on public.business_mappings;
create policy business_mappings_all_household on public.business_mappings
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- ────────────────────────────────────────────────────────────────
-- 7. UPDATE BOOTSTRAP TO ADD HEBREW CATEGORIES + INVENTORY CATS
-- ────────────────────────────────────────────────────────────────
create or replace function public.create_household_with_owner(
  p_household_name text,
  p_display_name  text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_household_id uuid;
  v_display_name text;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.users where id = v_user_id) then
    raise exception 'User profile already exists';
  end if;

  v_display_name := coalesce(nullif(trim(p_display_name), ''), 'User');

  insert into public.households (name)
  values (coalesce(nullif(trim(p_household_name), ''), 'My Household'))
  returning id into v_household_id;

  insert into public.users (id, household_id, display_name, role)
  values (v_user_id, v_household_id, v_display_name, 'owner');

  -- Hebrew transaction categories
  insert into public.categories (household_id, transaction_type, name, is_system) values
    (v_household_id, 'income',  'משכורת',             true),
    (v_household_id, 'income',  'פרילנס',              true),
    (v_household_id, 'income',  'אחר',                true),
    (v_household_id, 'expense', 'קניות',              true),
    (v_household_id, 'expense', 'רכב',                true),
    (v_household_id, 'expense', 'בגדים',              true),
    (v_household_id, 'expense', 'שכר דירה / משכנתא', true),
    (v_household_id, 'expense', 'ילדים ותינוקות',     true),
    (v_household_id, 'expense', 'בריאות',             true),
    (v_household_id, 'expense', 'בידור',              true),
    (v_household_id, 'expense', 'חשבונות',            true),
    (v_household_id, 'expense', 'גן ילדים',           true),
    (v_household_id, 'expense', 'חוגים',              true),
    (v_household_id, 'expense', 'מסעדות ואוכל',       true),
    (v_household_id, 'expense', 'ביטוח',              true),
    (v_household_id, 'expense', 'אחר',                true)
  on conflict (household_id, transaction_type, name) do nothing;

  -- Default inventory categories
  insert into public.inventory_categories (household_id, name, sort_order, is_system) values
    (v_household_id, 'ירקות',              1, true),
    (v_household_id, 'פירות',              2, true),
    (v_household_id, 'מוצרי חלב וגבינות', 3, true),
    (v_household_id, 'בשר ועוף',           4, true),
    (v_household_id, 'לחם ומאפים',         5, true),
    (v_household_id, 'שימורים',            6, true),
    (v_household_id, 'מוצרי יסוד',         7, true),
    (v_household_id, 'ניקיון',             8, true),
    (v_household_id, 'תינוקות',            9, true),
    (v_household_id, 'אחר',               10, true)
  on conflict (household_id, name) do nothing;

  return v_household_id;
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 8. UPDATED RESTOCK TRIGGER (category-level tasks)
-- ────────────────────────────────────────────────────────────────
create or replace function public.create_restock_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_task_id uuid;
  v_category_name  text;
  v_task_title     text;
  v_task_source_id uuid;
begin
  if not new.auto_restock_task then
    return new;
  end if;

  if new.quantity < new.critical_threshold then
    new.last_below_threshold_at = now();

    if new.category_id is not null then
      select name into v_category_name
      from public.inventory_categories
      where id = new.category_id;

      v_task_title     := 'קניות - ' || coalesce(v_category_name, 'כללי');
      v_task_source_id := new.category_id;
    else
      v_task_title     := 'רכישת ' || new.name;
      v_task_source_id := new.id;
    end if;

    select t.id into existing_task_id
    from public.tasks t
    where t.household_id  = new.household_id
      and t.source_type   = 'inventory_threshold'
      and t.source_entity = 'inventory'
      and t.source_id     = v_task_source_id
      and t.status in ('todo', 'in_progress')
    limit 1;

    if existing_task_id is null then
      insert into public.tasks (
        household_id, title, description, module, task_type, status,
        priority_level, due_at, source_type, source_entity, source_id,
        created_by, assigned_to
      ) values (
        new.household_id,
        v_task_title,
        'מלאי מתחת לסף עבור: ' || new.name || ' (' || new.quantity || ' ' || new.unit || ' < ' || new.critical_threshold || ' ' || new.unit || ').',
        'inventory',
        'priority',
        'todo',
        1,
        now() + interval '12 hours',
        'inventory_threshold',
        'inventory',
        v_task_source_id,
        new.updated_by,
        null
      );
    end if;
  end if;

  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 9. ALSO ADD EXISTING INVENTORY CATEGORIES FOR EXISTING HOUSEHOLDS
--    (run for each household that doesn't have them yet)
-- ────────────────────────────────────────────────────────────────
insert into public.inventory_categories (household_id, name, sort_order, is_system)
select h.id, cats.name, cats.sort_order, true
from public.households h
cross join (values
  ('ירקות',              1),
  ('פירות',              2),
  ('מוצרי חלב וגבינות',  3),
  ('בשר ועוף',            4),
  ('לחם ומאפים',          5),
  ('שימורים',             6),
  ('מוצרי יסוד',          7),
  ('ניקיון',              8),
  ('תינוקות',             9),
  ('אחר',               10)
) as cats(name, sort_order)
on conflict (household_id, name) do nothing;

-- Add missing Hebrew expense categories for existing households
insert into public.categories (household_id, transaction_type, name, is_system)
select h.id, cats.tx_type::transaction_type, cats.name, true
from public.households h
cross join (values
  ('expense', 'קניות'),
  ('expense', 'רכב'),
  ('expense', 'בגדים'),
  ('expense', 'שכר דירה / משכנתא'),
  ('expense', 'ילדים ותינוקות'),
  ('expense', 'בריאות'),
  ('expense', 'בידור'),
  ('expense', 'חשבונות'),
  ('expense', 'גן ילדים'),
  ('expense', 'חוגים'),
  ('expense', 'מסעדות ואוכל'),
  ('expense', 'ביטוח'),
  ('expense', 'אחר'),
  ('income',  'משכורת'),
  ('income',  'פרילנס'),
  ('income',  'אחר')
) as cats(tx_type, name)
on conflict (household_id, transaction_type, name) do nothing;

