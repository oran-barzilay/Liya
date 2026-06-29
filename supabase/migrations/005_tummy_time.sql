-- Migration 005: Add tummy_time (and backfill bio_gaia / vitamin_d / leczchik)
-- to the baby_log_type enum so all app-used log types are valid.
-- Run this in the Supabase SQL editor.

do $$ begin
  if exists (
    select 1 from pg_type where typname = 'baby_log_type' and typtype = 'e'
  ) then
    begin alter type public.baby_log_type add value 'bio_gaia';   exception when duplicate_object then null; end;
    begin alter type public.baby_log_type add value 'vitamin_d';  exception when duplicate_object then null; end;
    begin alter type public.baby_log_type add value 'leczchik';   exception when duplicate_object then null; end;
    begin alter type public.baby_log_type add value 'tummy_time'; exception when duplicate_object then null; end;
  end if;
end $$;

