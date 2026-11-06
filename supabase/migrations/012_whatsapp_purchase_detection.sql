-- "קניתי חלב" in the family group updates the stock even without the trigger word
alter table whatsapp_settings add column if not exists purchase_detection boolean not null default true;
