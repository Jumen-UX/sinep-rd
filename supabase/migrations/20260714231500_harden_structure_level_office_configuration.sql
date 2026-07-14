create or replace function app_private.rpc_definer__admin_save_structure_level_offices(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
declare
  v_level_id uuid := app_private.audit_json_uuid(payload,'level_id');
  v_template_id uuid;
  v_diocese_id uuid;
  v_requested_ids uuid[];
  v_default_id uuid := app_private.audit_json_uuid(payload,'default_office_configuration_id');
  v_requested_count integer;
  v_valid_count integer;
  v_old jsonb;
  v_new jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado.' using errcode='42501';
  end if;

  if v_level_id is null then
    raise exception 'El nivel estructural es obligatorio.' using errcode='22023';
  end if;

  if jsonb_typeof(coalesce(payload->'office_configuration_ids','[]'::jsonb)) <> 'array' then
    raise exception 'La lista de cargos permitidos debe ser un arreglo.' using errcode='22023';
  end if;

  select sl.template_id, st.diocese_id
    into v_template_id, v_diocese_id
  from public.structure_levels sl
  join public.structure_templates st on st.id=sl.template_id
  where sl.id=v_level_id
  for update of sl;

  if v_template_id is null then
    raise exception 'El nivel estructural indicado no existe.' using errcode='P0002';
  end if;

  if not app_private.structure_template_in_scope(v_template_id) then
    raise exception 'No autorizado para modificar cargos de este nivel.' using errcode='42501';
  end if;

  select coalesce(array_agg(item.office_id order by item.ordinality),'{}'::uuid[])
    into v_requested_ids
  from (
    select distinct on (office_id) office_id, ordinality
    from jsonb_array_elements_text(coalesce(payload->'office_configuration_ids','[]'::jsonb))
      with ordinality as source(value, ordinality)
    cross join lateral (select source.value::uuid as office_id) parsed
    order by office_id, ordinality
  ) item;

  v_requested_count := coalesce(array_length(v_requested_ids,1),0);

  select count(*) into v_valid_count
  from public.office_configurations oc
  where oc.id=any(v_requested_ids) and oc.status='active';

  if v_valid_count <> v_requested_count then
    raise exception 'Uno o más cargos seleccionados no existen o no están activos.' using errcode='22023';
  end if;

  if v_requested_count=0 and v_default_id is not null then
    raise exception 'No puede definirse un cargo predeterminado sin cargos permitidos.' using errcode='22023';
  end if;

  if v_requested_count>0 and (v_default_id is null or not (v_default_id=any(v_requested_ids))) then
    raise exception 'El cargo predeterminado debe pertenecer a la selección.' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(current_row) order by current_row.sort_order),'[]'::jsonb)
    into v_old
  from public.structure_level_office_configurations current_row
  where current_row.level_id=v_level_id;

  delete from public.structure_level_office_configurations
  where level_id=v_level_id;

  insert into public.structure_level_office_configurations(
    level_id,office_configuration_id,is_default,sort_order,status
  )
  select v_level_id, office_id, office_id=v_default_id, ordinality::integer, 'active'
  from unnest(v_requested_ids) with ordinality as selected(office_id,ordinality);

  select coalesce(jsonb_agg(to_jsonb(saved_row) order by saved_row.sort_order),'[]'::jsonb)
    into v_new
  from public.structure_level_office_configurations saved_row
  where saved_row.level_id=v_level_id;

  if v_new is distinct from v_old then
    perform public.create_audit_log(
      auth.uid(),
      'structures.level_offices.updated',
      'structure_levels',
      v_level_id,
      v_old,
      jsonb_build_object(
        'scope_type','diocese',
        'scope_entity_id',v_diocese_id,
        'level_id',v_level_id,
        'records',v_new
      ),
      app_private.audit_json_uuid(payload,'change_request_id')
    );
  end if;

  return v_new;
end;
$function$;

create or replace function public.admin_save_structure_level_offices(payload jsonb)
returns jsonb
language sql
set search_path to 'pg_catalog','public','app_private','auth','pg_temp'
as $function$
  select app_private.rpc_definer__admin_save_structure_level_offices(payload)
$function$;

revoke all on function app_private.rpc_definer__admin_save_structure_level_offices(jsonb) from public,anon,authenticated;
grant execute on function app_private.rpc_definer__admin_save_structure_level_offices(jsonb) to service_role;
revoke all on function public.admin_save_structure_level_offices(jsonb) from public,anon;
grant execute on function public.admin_save_structure_level_offices(jsonb) to authenticated,service_role;
