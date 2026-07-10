create or replace function public.admin_save_structure_level_offices(payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public','internal','app_private','pg_temp'
as $$
declare
  v_level_id uuid := nullif(payload->>'level_id','')::uuid;
  v_template_id uuid;
  v_office_ids uuid[] := coalesce(array(select jsonb_array_elements_text(coalesce(payload->'office_configuration_ids','[]'::jsonb))::uuid), '{}'::uuid[]);
  v_default_id uuid := nullif(payload->>'default_office_configuration_id','')::uuid;
begin
  select sl.template_id into v_template_id from public.structure_levels sl where sl.id = v_level_id;
  if v_template_id is null then raise exception 'Structure level not found'; end if;
  if not app_private.structure_template_in_scope(v_template_id) then
    raise exception 'No autorizado para modificar cargos de este nivel' using errcode='42501';
  end if;

  delete from public.structure_level_office_configurations where level_id = v_level_id;

  insert into public.structure_level_office_configurations(level_id, office_configuration_id, is_default, sort_order, status)
  select v_level_id, x.office_id, x.office_id = v_default_id, x.ord::int, 'active'
  from unnest(v_office_ids) with ordinality as x(office_id, ord)
  join public.office_configurations oc on oc.id = x.office_id and oc.status = 'active';

  return jsonb_build_object(
    'success', true,
    'level_id', v_level_id,
    'office_count', coalesce(array_length(v_office_ids,1),0),
    'default_office_configuration_id', v_default_id
  );
end;
$$;
revoke all on function public.admin_save_structure_level_offices(jsonb) from public, anon;
grant execute on function public.admin_save_structure_level_offices(jsonb) to authenticated;

create or replace function public.get_structure_level_office_options(p_level_id uuid)
returns jsonb
language sql
stable
set search_path to 'public','app_private','pg_temp'
as $$
  select case when app_private.structure_template_in_scope(sl.template_id) then jsonb_build_object(
    'configured', coalesce((select jsonb_agg(jsonb_build_object('id',oc.id,'key',oc.key,'display_name',oc.display_name,'is_default',m.is_default,'sort_order',m.sort_order) order by m.sort_order, oc.display_name)
      from public.structure_level_office_configurations m join public.office_configurations oc on oc.id=m.office_configuration_id where m.level_id=sl.id and m.status='active'),'[]'::jsonb),
    'available', coalesce((select jsonb_agg(jsonb_build_object('id',oc.id,'key',oc.key,'display_name',oc.display_name,'description',oc.description,'requires_clergy',oc.requires_clergy) order by oc.sort_order,oc.display_name)
      from public.office_configurations oc where oc.status='active'),'[]'::jsonb)
  ) else null end
  from public.structure_levels sl where sl.id=p_level_id;
$$;
revoke all on function public.get_structure_level_office_options(uuid) from public, anon;
grant execute on function public.get_structure_level_office_options(uuid) to authenticated;
