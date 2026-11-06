-- Shopping tasks: one task per item ("חלב") instead of one per category ("קניות - שתיה"),
-- and the task closes itself once the item is restocked.

create or replace function public.create_restock_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_task_id uuid;
  v_details        text;
begin
  v_details := 'נשאר ' || trim(to_char(new.quantity, 'FM999999990.###')) || ' ' || new.unit
            || ' · מינימום ' || trim(to_char(new.critical_threshold, 'FM999999990.###')) || ' ' || new.unit;

  select t.id into existing_task_id
  from public.tasks t
  where t.household_id  = new.household_id
    and t.source_type   = 'inventory_threshold'
    and t.source_entity = 'inventory'
    and t.source_id     = new.id
    and t.status in ('todo', 'in_progress')
  limit 1;

  if new.quantity < new.critical_threshold and new.auto_restock_task then
    new.last_below_threshold_at = now();
    if existing_task_id is null then
      insert into public.tasks (
        household_id, title, description, module, task_type, status,
        priority_level, due_at, source_type, source_entity, source_id,
        created_by, assigned_to
      ) values (
        new.household_id, new.name, v_details, 'inventory', 'priority', 'todo',
        1, now() + interval '12 hours', 'inventory_threshold', 'inventory', new.id,
        new.updated_by, null
      );
    else
      -- Keep the open task's name and details in sync with the item
      update public.tasks set title = new.name, description = v_details where id = existing_task_id;
    end if;
  elsif existing_task_id is not null then
    -- Restocked (or auto-tasks turned off): the shopping task is done
    update public.tasks
    set status = case when new.quantity >= new.critical_threshold then 'done'::task_status else 'cancelled'::task_status end
    where id = existing_task_id;
  end if;

  return new;
end;
$$;

-- One-time conversion of existing open shopping tasks:
-- 1. close the old per-category tasks ("קניות - …")
update public.tasks t
set status = 'cancelled'
where t.source_type = 'inventory_threshold'
  and t.status in ('todo', 'in_progress')
  and t.source_id in (select id from public.inventory_categories);

-- 2. open a per-item task for every item that is below its minimum and has none yet
insert into public.tasks (
  household_id, title, description, module, task_type, status,
  priority_level, due_at, source_type, source_entity, source_id, created_by, assigned_to
)
select
  i.household_id, i.name,
  'נשאר ' || trim(to_char(i.quantity, 'FM999999990.###')) || ' ' || i.unit
    || ' · מינימום ' || trim(to_char(i.critical_threshold, 'FM999999990.###')) || ' ' || i.unit,
  'inventory', 'priority', 'todo', 1, now() + interval '12 hours',
  'inventory_threshold', 'inventory', i.id, i.updated_by, null
from public.inventory i
where i.auto_restock_task
  and i.quantity < i.critical_threshold
  and not exists (
    select 1 from public.tasks t
    where t.source_type = 'inventory_threshold'
      and t.source_id = i.id
      and t.status in ('todo', 'in_progress')
  );
