-- Keep calendar work durable while Google OAuth is temporarily disconnected.
alter table public.appointments
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text,
  add column if not exists synced_at timestamptz;

alter table public.appointments drop constraint if exists appointment_no_overlap;
alter table public.appointments drop constraint if exists appointments_state_check;
alter table public.appointments
  add constraint appointments_state_check
  check (state in ('pending','syncing','confirmed','failed','conflict','expired'));
alter table public.appointments
  add constraint appointment_no_overlap
  exclude using gist (tstzrange(starts_at,ends_at,'[)') with &&)
  where (state='confirmed' and not all_day);

create index if not exists appointments_sync_queue
  on public.appointments(state,starts_at)
  where state in ('pending','failed');

-- Existing entries also become visible to the catch-up worker.
insert into public.appointments(entry_id,starts_at,ends_at,all_day,state)
select id,
  case when call_time_1='いつでも可'
    then call_date_1::date::timestamp at time zone 'Asia/Tokyo'
    else (call_date_1||' '||call_time_1)::timestamp at time zone 'Asia/Tokyo'
  end,
  case when call_time_1='いつでも可'
    then call_date_1::date::timestamp at time zone 'Asia/Tokyo' + interval '24 hours'
    else (call_date_1||' '||call_time_1)::timestamp at time zone 'Asia/Tokyo' + interval '30 minutes'
  end,
  call_time_1='いつでも可',
  'pending'
from public.entries
where not exists(select 1 from public.appointments a where a.entry_id=entries.id)
  and call_date_1 ~ '^\d{4}-\d{2}-\d{2}$'
  and (call_time_1='いつでも可' or call_time_1 ~ '^\d{2}:\d{2}$');

revoke all on public.appointments from public,anon,authenticated;
grant all on public.appointments to service_role;
