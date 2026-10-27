-- Travel planning: trips and their day-by-day items (bookings, notes, optional activities)

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  destination text,
  start_date date not null,
  end_date date not null,
  currency text not null default 'USD',
  notes text,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_dates_check check (end_date >= start_date)
);

create table if not exists trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  kind text not null default 'other'
    check (kind in ('flight', 'hotel', 'car', 'transport', 'activity', 'food', 'note', 'other')),
  title text not null,
  start_date date not null,
  -- Hotels: check-out date. Flights: arrival date when overnight. Null = single day.
  end_date date,
  time_text text,
  price numeric(12, 2),
  details text,
  free_cancel_until date,
  booking_ref text,
  link text,
  status text not null default 'planned' check (status in ('planned', 'booked', 'done')),
  -- Open action for this item, e.g. "להזמין שאטל"
  todo text,
  -- Optional activities are ideas for the day; "add to plan" flips this to false
  is_optional boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_household_idx on trips (household_id, start_date);
create index if not exists trip_items_trip_idx on trip_items (trip_id, start_date, sort_order);

drop trigger if exists trg_trips_updated_at on trips;
create trigger trg_trips_updated_at
before update on trips
for each row
execute function set_updated_at();

drop trigger if exists trg_trip_items_updated_at on trip_items;
create trigger trg_trip_items_updated_at
before update on trip_items
for each row
execute function set_updated_at();

alter table trips enable row level security;
alter table trip_items enable row level security;

drop policy if exists trips_all_household on trips;
create policy trips_all_household on trips
for all
using (household_id = current_household_id())
with check (household_id = current_household_id());

drop policy if exists trip_items_all_household on trip_items;
create policy trip_items_all_household on trip_items
for all
using (household_id = current_household_id())
with check (household_id = current_household_id());
