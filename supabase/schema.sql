create table if not exists public.edu_analytics_state (
  workspace_id text primary key check (workspace_id = 'jardim-interlagos'),
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users (id)
);

alter table public.edu_analytics_state enable row level security;

revoke all on table public.edu_analytics_state from anon, public;
grant usage on schema public to authenticated;
grant select, insert, update on table public.edu_analytics_state to authenticated;

drop policy if exists edu_analytics_state_read on public.edu_analytics_state;
create policy edu_analytics_state_read
  on public.edu_analytics_state for select to authenticated
  using ((select lower(auth.jwt() ->> 'email')) = 'cejardiminterlagos@nrecascavel.com');

drop policy if exists edu_analytics_state_insert on public.edu_analytics_state;
create policy edu_analytics_state_insert
  on public.edu_analytics_state for insert to authenticated
  with check ((select lower(auth.jwt() ->> 'email')) = 'cejardiminterlagos@nrecascavel.com');

drop policy if exists edu_analytics_state_update on public.edu_analytics_state;
create policy edu_analytics_state_update
  on public.edu_analytics_state for update to authenticated
  using ((select lower(auth.jwt() ->> 'email')) = 'cejardiminterlagos@nrecascavel.com')
  with check ((select lower(auth.jwt() ->> 'email')) = 'cejardiminterlagos@nrecascavel.com');
