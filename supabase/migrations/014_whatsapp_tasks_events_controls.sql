-- Which tasks the summaries list, what details they show, and updates written without the trigger word
alter table whatsapp_settings add column if not exists tasks_filter text not null default 'all'
  check (tasks_filter in ('all', 'high', 'assigned'));
alter table whatsapp_settings add column if not exists tasks_show_assignee boolean not null default true;
alter table whatsapp_settings add column if not exists events_show_details boolean not null default true;
-- "סיימתי את הארנונה" / "דחינו את התור" updates the task/event without "פאמי"
alter table whatsapp_settings add column if not exists activity_detection boolean not null default true;
