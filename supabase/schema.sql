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

create or replace function public.edu_analytics_save_state(
  p_payload jsonb,
  p_expected_revision bigint
)
returns table (revision bigint, updated_at timestamptz)
language sql
security invoker
set search_path = ''
set statement_timeout = '45s'
as $$
  update public.edu_analytics_state as state
  set payload = p_payload,
      revision = state.revision + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where state.workspace_id = 'jardim-interlagos'
    and state.revision = p_expected_revision
  returning state.revision, state.updated_at;
$$;

revoke all on function public.edu_analytics_save_state(jsonb, bigint) from public, anon;
grant execute on function public.edu_analytics_save_state(jsonb, bigint) to authenticated;

notify pgrst, 'reload schema';

create or replace function public.edu_analytics_patch_state(
  p_expected_revision bigint,
  p_fields jsonb,
  p_removed_fields text[],
  p_students jsonb,
  p_removed_students text[]
)
returns table (revision bigint, updated_at timestamptz)
language sql
security invoker
set search_path = ''
set statement_timeout = '45s'
as $$
  with incoming as (
    select value as student, value->>'id' as id, ordinality
    from jsonb_array_elements(p_students) with ordinality
  )
  update public.edu_analytics_state as state
  set payload = (state.payload - p_removed_fields) || (p_fields - 'students') ||
      case when p_students = '[]'::jsonb and cardinality(p_removed_students) = 0 then '{}'::jsonb
      else jsonb_build_object('students', (
        select coalesce(jsonb_agg(rows.student order by rows.position, rows.ordinality), '[]'::jsonb)
        from (
          select coalesce(incoming.student, old.value) as student, 0 as position, old.ordinality
          from jsonb_array_elements(state.payload->'students') with ordinality as old(value, ordinality)
          left join incoming on incoming.id = old.value->>'id'
          where not ((old.value->>'id') = any(p_removed_students))
          union all
          select incoming.student, 1, incoming.ordinality
          from incoming
          where not exists (
            select 1 from jsonb_array_elements(state.payload->'students') as old(value)
            where old.value->>'id' = incoming.id
          )
        ) rows
      )) end,
      revision = state.revision + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where state.workspace_id = 'jardim-interlagos'
    and state.revision = p_expected_revision
  returning state.revision, state.updated_at;
$$;

revoke all on function public.edu_analytics_patch_state(bigint,jsonb,text[],jsonb,text[]) from public, anon;
grant execute on function public.edu_analytics_patch_state(bigint,jsonb,text[],jsonb,text[]) to authenticated;

notify pgrst, 'reload schema';
