create temporary table test_bulk_state(workspace_id text primary key,payload jsonb,revision bigint,updated_at timestamptz,updated_by uuid);
-- Materialize student arrays once; preserve revision checks, grants and invoker security.
create or replace function pg_temp.test_bulk_patch(
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
    from pg_temp.test_bulk_state as current_state
    cross join lateral jsonb_array_elements(current_state.payload->'students') with ordinality as old(value, ordinality)
    where current_state.workspace_id = 'jardim-interlagos'
      and current_state.revision = p_expected_revision
  )
  update pg_temp.test_bulk_state as state
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


do $$
declare result jsonb; elapsed interval; started timestamptz; revision_after bigint;
begin
 insert into pg_temp.test_bulk_state values ('jardim-interlagos','{"students":[{"id":"a","name":"Old"},{"id":"b"},{"id":"c"}],"keep":"preserved","remove":true}',1,now(),null);
 perform * from pg_temp.test_bulk_patch(0,'{}',array[]::text[],'[]',array[]::text[]);
 select revision into revision_after from pg_temp.test_bulk_state;
 if revision_after<>1 then raise exception 'Stale revision changed data'; end if;
 perform * from pg_temp.test_bulk_patch(1,'{"new":true}',array['remove'],'[{"id":"a","name":"New"},{"id":"d"}]',array['b']);
 select payload into result from pg_temp.test_bulk_state;
 if result<>'{"students":[{"id":"a","name":"New"},{"id":"c"},{"id":"d"}],"keep":"preserved","new":true}'::jsonb then raise exception 'Merge/order/field preservation failed';end if;
 perform * from pg_temp.test_bulk_patch(2,'{"onlyField":true}',array[]::text[],'[]',array[]::text[]);
 select payload into result from pg_temp.test_bulk_state;
 if jsonb_array_length(result->'students')<>3 then raise exception 'Empty patch lost students';end if;
 perform * from pg_temp.test_bulk_patch(3,'{}',array[]::text[],'[]',array['a','c','d']);
 select payload into result from pg_temp.test_bulk_state;
 if result->'students'<>'[]'::jsonb then raise exception 'Removal failed';end if;
 update pg_temp.test_bulk_state set revision=10,payload=jsonb_build_object('students',(select jsonb_agg(jsonb_build_object('id',i::text,'history',repeat(md5(i::text),100))) from generate_series(1,3000) i));
 started=clock_timestamp();
 perform * from pg_temp.test_bulk_patch(10,'{}',array[]::text[],(select jsonb_agg(jsonb_build_object('id',i::text,'name','Synthetic','history',repeat(md5(i::text),100))) from generate_series(1,3000) i),array[]::text[]);
 elapsed=clock_timestamp()-started;
 select payload,revision into result,revision_after from pg_temp.test_bulk_state;
 if revision_after<>11 or jsonb_array_length(result->'students')<>3000 or exists(select 1 from jsonb_array_elements(result->'students') s where s->>'name'<>'Synthetic') then raise exception 'Bulk patch failed';end if;
 if elapsed>interval '10 seconds' then raise exception 'Bulk patch too slow: %',elapsed;end if;
end $$;
drop function pg_temp.test_bulk_patch(bigint,jsonb,text[],jsonb,text[]);
drop table pg_temp.test_bulk_state;
