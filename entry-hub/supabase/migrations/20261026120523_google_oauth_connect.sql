-- Server-only OAuth credentials. Never expose through client APIs.
create table public.google_connections (
 id text primary key check (id='primary'),
 email text not null,
 client_id text not null,
 refresh_token text not null,
 connected_by uuid references auth.users(id) on delete set null,
 connected_at timestamptz not null default now(),
 expires_at timestamptz
);
create table public.google_oauth_states (
 state_hash text primary key,
 staff_id uuid not null references auth.users(id) on delete cascade,
 verifier text not null,
 expires_at timestamptz not null
);
create index google_oauth_states_expiry on public.google_oauth_states(expires_at);
alter table public.google_connections enable row level security;
alter table public.google_oauth_states enable row level security;
revoke all on public.google_connections,public.google_oauth_states from public,anon,authenticated;
grant select,insert,update,delete on public.google_connections,public.google_oauth_states to service_role;
