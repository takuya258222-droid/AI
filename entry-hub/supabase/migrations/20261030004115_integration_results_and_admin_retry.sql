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
-- Seed only recorded successes; never infer success from stored credentials.
insert into public.integration_results(kind,ok,created_at)
select 'mail',true,max(sent_at) from public.notifications where state='sent' having max(sent_at) is not null;
insert into public.integration_results(kind,ok,created_at)
select 'calendar',true,max(synced_at) from public.appointments where state='confirmed' having max(synced_at) is not null;
