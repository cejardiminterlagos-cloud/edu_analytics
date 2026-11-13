-- Notes are stored separately; uploaded documents never enter these tables.
create table if not exists public.edu_grade_enrollments (
 year integer not null check(year between 2000 and 2100),
 registration text not null check(registration ~ '^[0-9]{1,40}$'),
 name text not null check(length(name) between 1 and 200),
 class_group text not null check(length(class_group) between 1 and 200),
 call_number integer check(call_number between 1 and 999),
 pdf_name text, pdf_group text,
 primary key(year,registration)
);
create table if not exists public.edu_grades (
 year integer not null,
 registration text not null,
 discipline_key text not null,
 discipline text not null check(length(discipline) between 1 and 200),
 t1 numeric check(t1 between 0 and 10),
 t2 numeric check(t2 between 0 and 10),
 t3 numeric check(t3 between 0 and 10),
 source_name text,
 imported_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(year,registration,discipline_key),
 foreign key(year,registration) references public.edu_grade_enrollments(year,registration) on delete cascade
);
alter table public.edu_grade_enrollments enable row level security;
alter table public.edu_grades enable row level security;
revoke all on public.edu_grade_enrollments,public.edu_grades from public,anon;
grant select,insert,update,delete on public.edu_grade_enrollments,public.edu_grades to authenticated;
create policy grade_enrollment_access on public.edu_grade_enrollments for all to authenticated
 using ((select lower(auth.jwt()->>'email'))='cejardiminterlagos@nrecascavel.com')
 with check ((select lower(auth.jwt()->>'email'))='cejardiminterlagos@nrecascavel.com');
create policy grade_access on public.edu_grades for all to authenticated
 using ((select lower(auth.jwt()->>'email'))='cejardiminterlagos@nrecascavel.com')
 with check ((select lower(auth.jwt()->>'email'))='cejardiminterlagos@nrecascavel.com');

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
  insert into public.edu_grade_enrollments(year,registration,name,class_group,call_number,pdf_name,pdf_group)
   values((item->>'year')::integer,item->>'registration',item->>'name',item->>'group',(item->>'callNumber')::integer,item->>'pdfName',item->>'pdfGroup')
   on conflict(year,registration) do update set name=excluded.name,class_group=excluded.class_group,
    call_number=coalesce(excluded.call_number,edu_grade_enrollments.call_number),pdf_name=coalesce(excluded.pdf_name,edu_grade_enrollments.pdf_name),pdf_group=coalesce(excluded.pdf_group,edu_grade_enrollments.pdf_group);
  insert into public.edu_grades(year,registration,discipline_key,discipline,t1,t2,t3,source_name,imported_at)
   values((item->>'year')::integer,item->>'registration',item->>'disciplineKey',item->>'discipline',(item->'notes'->>0)::numeric,(item->'notes'->>1)::numeric,(item->'notes'->>2)::numeric,item->>'source',(item->>'importedAt')::timestamptz)
   on conflict(year,registration,discipline_key) do update set discipline=excluded.discipline,t1=excluded.t1,t2=excluded.t2,t3=excluded.t3,source_name=excluded.source_name,imported_at=excluded.imported_at,updated_at=now();
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
