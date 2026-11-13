-- Preserve manually corrected trimesters, including intentionally blank notes.
alter table public.edu_grades add column manual jsonb not null default '[false,false,false]'::jsonb
 check(jsonb_typeof(manual)='array' and jsonb_array_length(manual)=3
 and jsonb_typeof(manual->0)='boolean' and jsonb_typeof(manual->1)='boolean' and jsonb_typeof(manual->2)='boolean');
create or replace function public.edu_analytics_patch_v2(
 p_expected_revision bigint,p_fields jsonb,p_removed_fields text[],p_students jsonb,p_removed_students text[],
 p_grades jsonb,p_removed_grades jsonb
) returns table(revision bigint,updated_at timestamptz)
language plpgsql security invoker set search_path='' set statement_timeout='45s'
as $$
declare saved record; item jsonb;
begin
 if jsonb_typeof(p_grades) is distinct from 'array' or jsonb_typeof(p_removed_grades) is distinct from 'array' then raise exception 'Invalid grade batch'; end if;
 select * into saved from public.edu_analytics_patch_state(p_expected_revision,p_fields-'grades',array_append(p_removed_fields,'grades'),p_students,p_removed_students);
 if saved.revision is null then return; end if;
 for item in select value from jsonb_array_elements(p_grades) loop
  if jsonb_typeof(item->'notes') is distinct from 'array' or jsonb_array_length(item->'notes')<>3
   or exists(select 1 from jsonb_array_elements(item->'notes') n where jsonb_typeof(n) not in ('number','null'))
   or coalesce(item->>'disciplineKey','')='' then raise exception 'Invalid notes'; end if;
  if item ? 'manual' and (jsonb_typeof(item->'manual') is distinct from 'array' or jsonb_array_length(item->'manual')<>3 or exists(select 1 from jsonb_array_elements(item->'manual') m where jsonb_typeof(m)<>'boolean')) then raise exception 'Invalid manual flags'; end if;
  insert into public.edu_grade_enrollments(year,registration,name,class_group,call_number,pdf_name,pdf_group)
   values((item->>'year')::integer,item->>'registration',item->>'name',item->>'group',(item->>'callNumber')::integer,item->>'pdfName',item->>'pdfGroup')
   on conflict(year,registration) do update set name=excluded.name,class_group=excluded.class_group,
    call_number=coalesce(excluded.call_number,edu_grade_enrollments.call_number),pdf_name=coalesce(excluded.pdf_name,edu_grade_enrollments.pdf_name),pdf_group=coalesce(excluded.pdf_group,edu_grade_enrollments.pdf_group);
  insert into public.edu_grades(year,registration,discipline_key,discipline,t1,t2,t3,source_name,imported_at,manual)
   values((item->>'year')::integer,item->>'registration',item->>'disciplineKey',item->>'discipline',(item->'notes'->>0)::numeric,(item->'notes'->>1)::numeric,(item->'notes'->>2)::numeric,item->>'source',(item->>'importedAt')::timestamptz,coalesce(item->'manual','[false,false,false]'::jsonb))
   on conflict(year,registration,discipline_key) do update set discipline=excluded.discipline,t1=case when not (item ? 'manual') and (edu_grades.manual->>0)::boolean then edu_grades.t1 else excluded.t1 end,t2=case when not (item ? 'manual') and (edu_grades.manual->>1)::boolean then edu_grades.t2 else excluded.t2 end,t3=case when not (item ? 'manual') and (edu_grades.manual->>2)::boolean then edu_grades.t3 else excluded.t3 end,source_name=excluded.source_name,imported_at=excluded.imported_at,manual=case when item ? 'manual' then excluded.manual else edu_grades.manual end,updated_at=now();
 end loop;
 for item in select value from jsonb_array_elements(p_removed_grades) loop
  delete from public.edu_grades where year=(item->>'year')::integer and registration=item->>'registration' and discipline_key=item->>'disciplineKey';
 end loop;
 delete from public.edu_grade_enrollments e where not exists(select 1 from public.edu_grades g where g.year=e.year and g.registration=e.registration);
 return query select saved.revision::bigint,saved.updated_at::timestamptz;
end $$;
revoke all on function public.edu_analytics_patch_v2(bigint,jsonb,text[],jsonb,text[],jsonb,jsonb) from public,anon;
grant execute on function public.edu_analytics_patch_v2(bigint,jsonb,text[],jsonb,text[],jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
