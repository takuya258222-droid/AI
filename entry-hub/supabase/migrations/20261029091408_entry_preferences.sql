-- Nullable additions preserve submissions from forms opened before this deployment.
alter table public.entries
 add column if not exists gender text,
 add column if not exists desired_employment text,
 add column if not exists commute_method text,
 add column if not exists nearest_station text,
 add column if not exists commute_minutes text,
 add column if not exists weekend_availability text;
