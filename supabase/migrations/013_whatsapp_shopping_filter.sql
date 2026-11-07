-- Which products the daily/weekly summaries list under "לקנות"
alter table whatsapp_settings add column if not exists shopping_filter text not null default 'low'
  check (shopping_filter in ('low', 'at_or_below', 'out'));
-- Write how much is missing next to each product ("פפסי (חסר 1)")
alter table whatsapp_settings add column if not exists shopping_show_missing boolean not null default false;
