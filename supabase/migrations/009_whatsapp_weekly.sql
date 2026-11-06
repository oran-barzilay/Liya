-- Weekly WhatsApp summary: the coming week day by day, on a chosen weekday and time.

alter table whatsapp_settings add column if not exists weekly_enabled boolean not null default false;
-- 0 = Sunday … 6 = Saturday (default: Saturday evening, ahead of the Israeli week)
alter table whatsapp_settings add column if not exists weekly_day smallint not null default 6
  check (weekly_day between 0 and 6);
alter table whatsapp_settings add column if not exists weekly_time time not null default '20:00';
alter table whatsapp_settings add column if not exists weekly_sections jsonb not null
  default '{"events": true, "tasks": true, "overdue": true, "shopping": true}';
alter table whatsapp_settings add column if not exists weekly_greeting text;
alter table whatsapp_settings add column if not exists last_weekly_sent_on date;

alter table whatsapp_log drop constraint if exists whatsapp_log_kind_check;
alter table whatsapp_log add constraint whatsapp_log_kind_check
  check (kind in ('daily', 'weekly', 'custom', 'reminder', 'manual'));
