-- WhatsApp group commands: "פאמי, תוסיף חלב" in the family group runs the household assistant.

alter table whatsapp_settings add column if not exists assistant_enabled boolean not null default true;
alter table whatsapp_settings add column if not exists assistant_trigger text not null default 'פאמי';

-- Each incoming WhatsApp message is processed once, even if the webhook is retried
create table if not exists whatsapp_inbox (
  id_message text primary key,
  household_id uuid not null references households (id) on delete cascade,
  received_at timestamptz not null default now()
);
-- Server-only table (service role); no policies means app users can't read or write it
alter table whatsapp_inbox enable row level security;

alter table whatsapp_log drop constraint if exists whatsapp_log_kind_check;
alter table whatsapp_log add constraint whatsapp_log_kind_check
  check (kind in ('daily', 'weekly', 'custom', 'reminder', 'manual', 'assistant'));
