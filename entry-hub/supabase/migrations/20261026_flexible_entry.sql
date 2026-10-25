alter table public.entries add column postal_code text not null default '' check(postal_code='' or postal_code ~ '^[0-9]{7}$');
alter table public.appointments add column all_day boolean not null default false;
alter table public.appointments drop constraint appointments_check;
alter table public.appointments drop constraint appointments_tstzrange_excl;
alter table public.appointments add constraint appointment_duration check((all_day and ends_at=starts_at+interval '24 hours') or (not all_day and ends_at-starts_at in (interval '30 minutes',interval '1 hour')));
alter table public.appointments add constraint appointment_no_overlap exclude using gist(tstzrange(starts_at,ends_at,'[)') with &&) where (not all_day);
