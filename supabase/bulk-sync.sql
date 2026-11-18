-- Materialize student arrays once; preserve revision checks, grants and invoker security.
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
  with incoming as materialized (
    select value as student, value->>'id' as id, ordinality
    from jsonb_array_elements(p_students) with ordinality
  ), old_students as materialized (
    select old.value, old.value->>'id' as id, old.ordinality
    from public.edu_analytics_state as current_state
    cross join lateral jsonb_array_elements(current_state.payload->'students') with ordinality as old(value, ordinality)
    where current_state.workspace_id = 'jardim-interlagos'
      and current_state.revision = p_expected_revision
  )
  update public.edu_analytics_state as state
  set payload = (state.payload - p_removed_fields) || (p_fields - 'students') ||
      case when p_students = '[]'::jsonb and cardinality(p_removed_students) = 0 then '{}'::jsonb
      else jsonb_build_object('students', (
        select coalesce(jsonb_agg(rows.student order by rows.position, rows.ordinality), '[]'::jsonb)
        from (
          select coalesce(incoming.student, old.value) as student, 0 as position, old.ordinality
          from old_students as old
          left join incoming on incoming.id = old.id
          where not (old.id = any(p_removed_students))
          union all
          select incoming.student, 1, incoming.ordinality
          from incoming
          where not exists (
            select 1 from old_students as old
            where old.id = incoming.id
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
