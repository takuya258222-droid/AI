-- Supabase SQL Editorで一度実行（Asia/Tokyoで管理ID生成）。
create extension if not exists btree_gist;
create table public.staff (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.staff enable row level security;
create table public.entries (
 id text primary key, request_id uuid unique not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 status text not null default '未対応' check(status in ('未対応','対応済み','対象外')),
 full_name text not null,phone text not null,age text not null,job_type text not null check(job_type in ('看護','介護')),qualifications text not null,
 status_current text not null,recent_emp_type text not null,total_exp numeric not null check(total_exp between 0 and 60),history_summary text not null,
 work_hours text not null,work_days text not null,call_date_1 text not null,call_time_1 text not null,call_date_2 text not null default '',call_time_2 text not null default '',
 tour_date_1 text not null default '',tour_time_1 text not null default '',tour_date_2 text not null default '',tour_time_2 text not null default '',tour_date_3 text not null default '',tour_time_3 text not null default '',
 join_date text not null,early_join text not null,user_memo text not null default '',internal_memo text not null default '',notification_status text not null default 'pending'
);
create index entries_created on public.entries(created_at desc);
create index entries_status on public.entries(status);
alter table public.entries enable row level security;
create table public.id_clock(singleton boolean primary key default true check(singleton),last_second timestamp not null);
insert into public.id_clock values(true,'2000-01-01');
alter table public.id_clock enable row level security;
create table public.submission_limits (key text primary key,bucket timestamptz not null,count integer not null);
alter table public.submission_limits enable row level security;
create table public.notifications(entry_id text primary key references public.entries(id),state text not null default 'pending',attempts int not null default 0,lease_until timestamptz,sent_at timestamptz,last_error text);
alter table public.notifications enable row level security;
create table public.appointments(entry_id text primary key references public.entries(id),starts_at timestamptz not null,ends_at timestamptz not null,state text not null default 'pending',event_url text,check(ends_at=starts_at+interval '1 hour'),exclude using gist(tstzrange(starts_at,ends_at,'[)') with &&));
alter table public.appointments enable row level security;
create table public.short_links(code text primary key check(code ~ '^[A-Za-z0-9_-]{8,24}$'),created_at timestamptz not null default now());
alter table public.short_links enable row level security;
-- ブラウザからは全テーブル読書不可。サーバーだけservice_roleを使用。
revoke all on public.staff,public.entries,public.id_clock,public.submission_limits,public.notifications,public.appointments,public.short_links from anon,authenticated;

create function public.submit_entry(payload jsonb,rate_key text) returns text language plpgsql security invoker set search_path=public as $$
declare existing_id text; n int; tick timestamp; new_id text;
begin
 perform pg_advisory_xact_lock(hashtextextended(payload->>'request_id',0));
 select id into existing_id from entries where request_id=(payload->>'request_id')::uuid;
 if existing_id is not null then return existing_id; end if;
 insert into submission_limits(key,bucket,count) values(rate_key,date_trunc('hour',now()),1)
 on conflict(key) do update set count=case when submission_limits.bucket=date_trunc('hour',now()) then submission_limits.count+1 else 1 end,bucket=date_trunc('hour',now()) returning count into n;
 if n>5 then raise exception 'RATE_LIMIT'; end if;
 update id_clock set last_second=greatest(date_trunc('second',now() at time zone 'Asia/Tokyo'),last_second+interval '1 second') where singleton returning last_second into tick;
 new_id='ENT-'||to_char(tick,'YYYYMMDDHH24MISS');
 payload=payload||jsonb_build_object('id',new_id,'created_at',now(),'updated_at',now(),'status','未対応','internal_memo','','notification_status','pending');
 insert into entries select * from jsonb_populate_record(null::entries,payload);
 insert into notifications(entry_id) values(new_id);
 return new_id;
end $$;
create function public.claim_notification(target text) returns boolean language plpgsql security invoker set search_path=public as $$
declare n int;
begin
 update notifications set state='sending',lease_until=now()+interval '10 minutes',attempts=attempts+1 where entry_id=target and state<>'sent' and (lease_until is null or lease_until<now());
 get diagnostics n=row_count;return n=1;
end $$;
revoke all on function public.submit_entry(jsonb,text) from public,anon,authenticated;
revoke all on function public.claim_notification(text) from public,anon,authenticated;
grant execute on function public.submit_entry(jsonb,text),public.claim_notification(text) to service_role;
-- 管理者作成後、下記を実行（メールは必要に応じ変更）。
-- insert into public.staff(user_id) select id from auth.users where email='t-sugimoto@kikari.co.jp';
grant all on public.staff,public.entries,public.id_clock,public.submission_limits,public.notifications,public.appointments,public.short_links to service_role;
-- 担当者別署名と、法人提出用の追記データ。元応募データとは別に保持。
create table public.author_profiles(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),company text not null,name text not null,email text not null,phone text not null default '',fax text not null default '',updated_at timestamptz not null default now());
create table public.entry_sheets(entry_id text primary key references public.entries(id),data jsonb not null,updated_at timestamptz not null default now());
alter table public.author_profiles enable row level security;
alter table public.entry_sheets enable row level security;
revoke all on public.author_profiles,public.entry_sheets from anon,authenticated;
grant all on public.author_profiles,public.entry_sheets to service_role;

-- 2026-10-26: flexible history, postal code, 30-minute and all-day availability
alter table public.entries add column postal_code text not null default '' check(postal_code='' or postal_code ~ '^[0-9]{7}$');
alter table public.appointments add column all_day boolean not null default false;
alter table public.appointments drop constraint appointments_check;
alter table public.appointments drop constraint appointments_tstzrange_excl;
alter table public.appointments add constraint appointment_duration check((all_day and ends_at=starts_at+interval '24 hours') or (not all_day and ends_at-starts_at in (interval '30 minutes',interval '1 hour')));
alter table public.appointments add constraint appointment_no_overlap exclude using gist(tstzrange(starts_at,ends_at,'[)') with &&) where (not all_day);

-- Google再接続時のカレンダー追いつき処理。
alter table public.appointments
 add column attempts integer not null default 0,
 add column last_error text,
 add column synced_at timestamptz;
alter table public.appointments drop constraint appointment_no_overlap;
alter table public.appointments add constraint appointments_state_check check(state in ('pending','syncing','confirmed','failed','conflict','expired'));
alter table public.appointments add constraint appointment_no_overlap exclude using gist(tstzrange(starts_at,ends_at,'[)') with &&) where (state='confirmed' and not all_day);
create index appointments_sync_queue on public.appointments(state,starts_at) where state in ('pending','failed');

create table public.integration_results (
 id bigint generated always as identity primary key,
 kind text not null check(kind in ('mail','calendar')),
 ok boolean not null,
 created_at timestamptz not null default now()
);
create index integration_results_latest on public.integration_results(kind,created_at desc);
create index integration_results_success on public.integration_results(kind,created_at desc) where ok;
alter table public.integration_results enable row level security;
revoke all on public.integration_results from public,anon,authenticated;
grant select,insert on public.integration_results to service_role;
grant usage,select on sequence public.integration_results_id_seq to service_role;
