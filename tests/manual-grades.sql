-- Run against the migrated database. All fixture writes are rolled back.
begin;
select set_config('request.jwt.claims',jsonb_build_object('email','cejardiminterlagos@nrecascavel.com','sub',(select id from auth.users where email='cejardiminterlagos@nrecascavel.com' limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare rev bigint; saved bigint; row_data record;
 item jsonb='{"year":2099,"registration":"9999999999999999999999999999999999999999","name":"Teste temporário","group":"Teste","discipline":"Teste manual","disciplineKey":"TESTE MANUAL","notes":[0,null,8],"manual":[true,true,false]}';
begin
 select revision into rev from public.edu_analytics_state where workspace_id='jardim-interlagos';
 select revision into saved from public.edu_analytics_patch_v2(rev,'{}','{}','[]','{}',jsonb_build_array(item),'[]');
 if saved<>rev+1 or saved is null then raise exception 'Initial save failed'; end if;
 select * into row_data from public.edu_grades where year=2099 and registration=item->>'registration' and discipline_key='TESTE MANUAL';
 if row_data.t1<>0 or row_data.t2 is not null or row_data.manual<>'[true,true,false]'::jsonb then raise exception 'Manual roundtrip failed'; end if;
 -- A still-open older client must not erase manually protected values.
 item=(item-'manual')||'{"notes":[9,9,9]}'::jsonb;
 select revision into saved from public.edu_analytics_patch_v2(saved,'{}','{}','[]','{}',jsonb_build_array(item),'[]');
 select * into row_data from public.edu_grades where year=2099 and registration=item->>'registration' and discipline_key='TESTE MANUAL';
 if row_data.t1<>0 or row_data.t2 is not null or row_data.t3<>9 then raise exception 'Legacy client protection failed'; end if;
 -- Explicitly release the second trimester and save a correction.
 item=item||'{"notes":[0,7,9],"manual":[true,false,false]}'::jsonb;
 select revision into saved from public.edu_analytics_patch_v2(saved,'{}','{}','[]','{}',jsonb_build_array(item),'[]');
 if not exists(select 1 from public.edu_grades where year=2099 and registration=item->>'registration' and t2=7 and manual='[true,false,false]'::jsonb) then raise exception 'Release failed'; end if;
 begin
  perform * from public.edu_analytics_patch_v2(saved,'{}','{}','[]','{}',jsonb_build_array(item||'{"manual":[true]}'::jsonb),'[]');
  raise exception 'Invalid flags accepted';
 exception when others then if sqlerrm='Invalid flags accepted' then raise; end if; end;
 if exists(select 1 from public.edu_analytics_patch_v2(rev,'{}','{}','[]','{}',jsonb_build_array(item),'[]')) then raise exception 'Stale revision accepted'; end if;
end $$;
rollback;
