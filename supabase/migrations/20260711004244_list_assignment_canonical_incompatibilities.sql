create or replace function internal.list_assignment_canonical_incompatibilities(p_status text default 'open', p_limit integer default 200)
returns jsonb language plpgsql security definer set search_path=public,internal,pg_temp as $$
declare v_items jsonb; v_total integer;
begin
  if auth.uid() is null or not public.current_user_has_admin_role() then raise exception 'No autorizado' using errcode='42501'; end if;
  with evaluated as (
    select pa.id assignment_id, pa.person_id, pa.office_configuration_id, pa.start_date,
      coalesce(p.display_name,concat_ws(' ',p.first_name,p.last_name),'Persona sin nombre') person_name,
      oc.display_name office_name, coalesce(ee.name,pe.name,'Sin entidad identificada') entity_name,
      internal.evaluate_position_assignment_eligibility(pa.person_id,pa.office_configuration_id,pa.ecclesiastical_entity_id,null,true) result,
      coalesce(acr.review_status,'pending') review_status, acr.resolution_type, acr.review_notes
    from public.position_assignments pa join public.persons p on p.id=pa.person_id
    join public.office_configurations oc on oc.id=pa.office_configuration_id
    left join public.ecclesiastical_entities ee on ee.id=pa.ecclesiastical_entity_id
    left join public.pastoral_entities pe on pe.id=pa.pastoral_entity_id
    left join public.assignment_canonical_reviews acr on acr.assignment_id=pa.id
    where pa.is_current=true and pa.record_status='active'
  ), filtered as (
    select * from evaluated where coalesce((result->>'eligible')::boolean,false)=false
      and (p_status='all' or (p_status='open' and review_status in ('pending','acknowledged')) or review_status=p_status)
  ) select count(*) into v_total from filtered;
  with evaluated as (
    select pa.id assignment_id, pa.person_id, pa.office_configuration_id, pa.start_date,
      coalesce(p.display_name,concat_ws(' ',p.first_name,p.last_name),'Persona sin nombre') person_name,
      oc.display_name office_name, coalesce(ee.name,pe.name,'Sin entidad identificada') entity_name,
      internal.evaluate_position_assignment_eligibility(pa.person_id,pa.office_configuration_id,pa.ecclesiastical_entity_id,null,true) result,
      coalesce(acr.review_status,'pending') review_status, acr.resolution_type, acr.review_notes
    from public.position_assignments pa join public.persons p on p.id=pa.person_id
    join public.office_configurations oc on oc.id=pa.office_configuration_id
    left join public.ecclesiastical_entities ee on ee.id=pa.ecclesiastical_entity_id
    left join public.pastoral_entities pe on pe.id=pa.pastoral_entity_id
    left join public.assignment_canonical_reviews acr on acr.assignment_id=pa.id
    where pa.is_current=true and pa.record_status='active'
  ), filtered as (
    select * from evaluated where coalesce((result->>'eligible')::boolean,false)=false
      and (p_status='all' or (p_status='open' and review_status in ('pending','acknowledged')) or review_status=p_status)
    order by office_name,person_name limit greatest(1,least(coalesce(p_limit,200),500))
  ) select coalesce(jsonb_agg(jsonb_build_object('assignment_id',assignment_id,'person_id',person_id,'office_configuration_id',office_configuration_id,'person_name',person_name,'office_name',office_name,'entity_name',entity_name,'start_date',start_date,'reason_code',result->>'reason_code','message',result->>'message','review_status',review_status,'resolution_type',resolution_type,'review_notes',review_notes)),'[]'::jsonb) into v_items from filtered;
  return jsonb_build_object('total',v_total,'items',v_items);
end; $$;
create or replace function public.admin_list_assignment_canonical_incompatibilities(p_status text default 'open', p_limit integer default 200)
returns jsonb language sql security invoker set search_path=public,internal,pg_temp as $$ select internal.list_assignment_canonical_incompatibilities(p_status,p_limit); $$;
revoke all on function public.admin_list_assignment_canonical_incompatibilities(text,integer) from public,anon;
grant execute on function public.admin_list_assignment_canonical_incompatibilities(text,integer) to authenticated;
grant execute on function internal.list_assignment_canonical_incompatibilities(text,integer) to authenticated;
