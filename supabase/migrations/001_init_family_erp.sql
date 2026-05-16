-- Family ERP initial schema for Supabase
-- Phase 1: core tables, relations, automation, and RLS

create extension if not exists pgcrypto;

create type task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type task_type as enum ('priority', 'time_sensitive');
create type task_module as enum ('general', 'inventory', 'baby', 'finance', 'medical');
create type task_source_type as enum ('manual', 'recurring', 'inventory_threshold', 'milestone');
create type baby_log_type as enum ('feeding', 'diaper_change', 'sleep', 'note');
create type appointment_status as enum ('scheduled', 'completed', 'cancelled');
create type transaction_type as enum ('income', 'expense');

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (id, household_id)
);

create table if not exists children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  birth_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  title text not null,
  description text,
  module task_module not null default 'general',
  task_type task_type not null,
  status task_status not null default 'todo',
  priority_level smallint check (priority_level between 1 and 5),
  due_at timestamptz,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  is_recurring boolean not null default false,
  recurrence_rule text,
  source_type task_source_type not null default 'manual',
  source_entity text check (source_entity in ('inventory', 'milestone') or source_entity is null),
  source_id uuid,
  created_by uuid not null references users (id) on delete restrict,
  assigned_to uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (task_type = 'priority' and scheduled_start_at is null)
    or task_type = 'time_sensitive'
  )
);

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  unit text not null,
  quantity numeric(12, 3) not null default 0,
  critical_threshold numeric(12, 3) not null default 0,
  auto_restock_task boolean not null default true,
  notes text,
  last_below_threshold_at timestamptz,
  updated_by uuid not null references users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create table if not exists baby_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  child_id uuid not null references children (id) on delete cascade,
  log_type baby_log_type not null,
  event_at timestamptz not null,
  amount numeric(10, 2),
  unit text,
  notes text,
  recorded_by uuid not null references users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  child_id uuid references children (id) on delete set null,
  title text not null,
  provider_name text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  notes text,
  status appointment_status not null default 'scheduled',
  created_by uuid not null references users (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  transaction_type transaction_type not null,
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, transaction_type, name)
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  owner_user_id uuid not null references users (id) on delete restrict,
  entered_by uuid not null references users (id) on delete restrict,
  category_id uuid not null references categories (id) on delete restrict,
  transaction_type transaction_type not null,
  amount numeric(12, 2) not null check (amount >= 0),
  is_fixed boolean not null default false,
  transaction_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_household_status on tasks (household_id, status);
create index if not exists idx_tasks_schedule on tasks (household_id, scheduled_start_at);
create index if not exists idx_inventory_household on inventory (household_id);
create index if not exists idx_inventory_low on inventory (household_id, quantity, critical_threshold);
create index if not exists idx_baby_logs_child_event on baby_logs (child_id, event_at desc);
create index if not exists idx_appointments_starts on appointments (household_id, starts_at);
create index if not exists idx_transactions_month on transactions (household_id, transaction_date);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_tasks_updated_at
before update on tasks
for each row
execute function set_updated_at();

create trigger trg_inventory_updated_at
before update on inventory
for each row
execute function set_updated_at();

create or replace function create_restock_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_task_id uuid;
begin
  if not new.auto_restock_task then
    return new;
  end if;

  if new.quantity < new.critical_threshold then
    new.last_below_threshold_at = now();

    select t.id
    into existing_task_id
    from tasks t
    where t.household_id = new.household_id
      and t.source_type = 'inventory_threshold'
      and t.source_entity = 'inventory'
      and t.source_id = new.id
      and t.status in ('todo', 'in_progress')
    limit 1;

    if existing_task_id is null then
      insert into tasks (
        household_id,
        title,
        description,
        module,
        task_type,
        status,
        priority_level,
        due_at,
        source_type,
        source_entity,
        source_id,
        created_by,
        assigned_to
      )
      values (
        new.household_id,
        'Buy ' || new.name,
        'Inventory below threshold (' || new.quantity || ' ' || new.unit || ' < ' || new.critical_threshold || ' ' || new.unit || ').',
        'inventory',
        'priority',
        'todo',
        1,
        now() + interval '12 hours',
        'inventory_threshold',
        'inventory',
        new.id,
        new.updated_by,
        null
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_inventory_restock_task
before insert or update of quantity, critical_threshold, auto_restock_task on inventory
for each row
execute function create_restock_task();

create or replace function current_household_id()
returns uuid
language sql
stable
as $$
  select u.household_id from users u where u.id = auth.uid();
$$;

alter table households enable row level security;
alter table users enable row level security;
alter table children enable row level security;
alter table tasks enable row level security;
alter table inventory enable row level security;
alter table baby_logs enable row level security;
alter table appointments enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;

create policy users_select_same_household on users
for select
using (household_id = current_household_id());

create policy users_insert_self on users
for insert
with check (id = auth.uid());

create policy users_update_self on users
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy households_select_member on households
for select
using (id = current_household_id());

create policy children_all_household on children
for all
using (household_id = current_household_id())
with check (household_id = current_household_id());

create policy tasks_all_household on tasks
for all
using (household_id = current_household_id())
with check (household_id = current_household_id());

create policy inventory_all_household on inventory
for all
using (household_id = current_household_id())
with check (household_id = current_household_id());

create policy baby_logs_all_household on baby_logs
for all
using (household_id = current_household_id())
with check (household_id = current_household_id());

create policy appointments_all_household on appointments
for all
using (household_id = current_household_id())
with check (household_id = current_household_id());

create policy categories_all_household on categories
for all
using (household_id = current_household_id())
with check (household_id = current_household_id());

create policy transactions_all_household on transactions
for all
using (household_id = current_household_id())
with check (household_id = current_household_id());

