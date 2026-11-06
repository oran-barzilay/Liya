-- WhatsApp group messages: daily summary settings, recurring custom messages,
-- per-task/event reminders, and a send log. Sending itself happens in /api/whatsapp
-- (server, service role); the app only edits settings and reads the log.

create table if not exists whatsapp_settings (
  household_id uuid primary key references households (id) on delete cascade,
  enabled boolean not null default true,
  group_id text,
  group_name text,
  daily_enabled boolean not null default true,
  daily_time time not null default '07:30',
  time_zone text not null default 'Asia/Jerusalem',
  -- Which summary sections to include
  sections jsonb not null default '{"events": true, "today": true, "overdue": true, "shopping": true, "tomorrow": true}',
  greeting text,
  last_daily_sent_on date,
  updated_at timestamptz not null default now()
);

create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  text text not null,
  -- 0 = Sunday … 6 = Saturday
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  send_time time not null default '20:00',
  enabled boolean not null default true,
  last_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists whatsapp_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  kind text not null check (kind in ('daily', 'custom', 'reminder', 'manual')),
  message text not null,
  ok boolean not null,
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists whatsapp_log_household_idx on whatsapp_log (household_id, sent_at desc);
create index if not exists whatsapp_messages_household_idx on whatsapp_messages (household_id);

-- Per-item reminders: when to post a dedicated reminder to the group
alter table tasks add column if not exists whatsapp_remind text;          -- preset id, e.g. 'hour_before'
alter table tasks add column if not exists whatsapp_remind_at timestamptz;
alter table tasks add column if not exists whatsapp_reminded_at timestamptz;
alter table appointments add column if not exists whatsapp_remind text;
alter table appointments add column if not exists whatsapp_remind_at timestamptz;
alter table appointments add column if not exists whatsapp_reminded_at timestamptz;

create index if not exists tasks_whatsapp_due_idx on tasks (whatsapp_remind_at) where whatsapp_reminded_at is null;
create index if not exists appointments_whatsapp_due_idx on appointments (whatsapp_remind_at) where whatsapp_reminded_at is null;

drop trigger if exists trg_whatsapp_settings_updated_at on whatsapp_settings;
create trigger trg_whatsapp_settings_updated_at
before update on whatsapp_settings for each row execute function set_updated_at();

drop trigger if exists trg_whatsapp_messages_updated_at on whatsapp_messages;
create trigger trg_whatsapp_messages_updated_at
before update on whatsapp_messages for each row execute function set_updated_at();

alter table whatsapp_settings enable row level security;
alter table whatsapp_messages enable row level security;
alter table whatsapp_log enable row level security;

drop policy if exists whatsapp_settings_all_household on whatsapp_settings;
create policy whatsapp_settings_all_household on whatsapp_settings
for all using (household_id = current_household_id()) with check (household_id = current_household_id());

drop policy if exists whatsapp_messages_all_household on whatsapp_messages;
create policy whatsapp_messages_all_household on whatsapp_messages
for all using (household_id = current_household_id()) with check (household_id = current_household_id());

-- The log is written only by the server (service role); members can read it
drop policy if exists whatsapp_log_read_household on whatsapp_log;
create policy whatsapp_log_read_household on whatsapp_log
for select using (household_id = current_household_id());
