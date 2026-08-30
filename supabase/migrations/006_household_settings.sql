create table if not exists household_settings (
  household_id uuid primary key references households (id) on delete cascade,
  assistant_model text not null default '',
  updated_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_household_settings_updated_at on household_settings;

create trigger trg_household_settings_updated_at
before update on household_settings
for each row
execute function set_updated_at();

alter table household_settings enable row level security;

create policy household_settings_all_household on household_settings
for all
using (household_id = current_household_id())
with check (household_id = current_household_id());

