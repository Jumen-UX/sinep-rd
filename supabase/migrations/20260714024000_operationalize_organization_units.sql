create or replace function app_private.audit_permission_for_action(p_action text)
returns text
language sql
immutable
set search_path to 'pg_catalog','pg_temp'
as $function$
  select case
    when p_action = 'import.batch.prepared' or p_action like 'import.row.%' then 'imports.prepare'
    when p_action = 'import.batch.reviewed' then 'imports.review'
    when p_action like 'import.%' then 'imports.apply'
    when p_action in ('people.person.created','people.person.updated') then 'people.create_proposal'
    when p_action = 'people.person.deceased' then 'people.update_proposal'
    when p_action in ('entities.entity.created','entities.jurisdiction.created') then 'entities.create_proposal'
    when p_action = 'appointments.assignment.created' then 'appointments.create_proposal'
    when p_action in ('resolve_assignment_canonical_incompatibility','appointments.incompatibility.resolved') then 'appointments.approve'
    when p_action = 'pastorals.organization_unit.created' then 'pastorals.create_proposal'
    when p_action = 'pastorals.organization_unit.updated' then 'pastorals.update_proposal'
    when p_action = 'pastorals.organization_unit.approved' then 'pastorals.approve'
    when p_action = 'pastorals.organization_unit.published' then 'pastorals.publish'
    when p_action like 'structures.%' then 'structures.manage'
    when p_action in ('admin_save_office_configuration','admin_update_office_configuration','editor_suggest_office_configuration') then 'structures.manage'
    when p_action = 'events.draft.created' then 'events.create_proposal'
    when p_action = 'events.reviewed' then 'events.approve'
    when p_action like 'events.%' then 'events.update_proposal'
    when p_action like 'users.%' then 'users.manage'
    else 'audit.create'
  end;
$function$;

create or replace function internal.admin_save_organization_unit(payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public','app_private','pg_temp'
as $function$
declare
  v_id uuid := coalesce(app_private.audit_json_uuid(payload,'id'), gen_random_uuid());
  v_existing public.organization_units%rowtype;
  v_chart_id uuid;
  v_parent_id uuid;
  v_entity_id uuid;
  v_pastoral_area_id uuid;
  v_key text;
  v_name text;
  v_description text;
  v_slug_base text;
  v_slug text;
  v_sort_order integer;
  v_visibility text;
  v_status text;
  v_valid_from date;
  v_valid_to date;
  v_is_current boolean;
  v_result jsonb;
begin
  if payload is null then
    raise exception 'El payload de la unidad organizativa es obligatorio.' using errcode='22023';
  end if;

  if payload ? 'id' then
    select * into v_existing
    from public.organization_units
    where id=v_id
    for update;
    if not found then
      raise exception 'La unidad organizativa indicada no existe.' using errcode='P0002';
    end if;
  end if;

  v_chart_id := coalesce(app_private.audit_json_uuid(payload,'organization_chart_id'),v_existing.organization_chart_id);
  v_entity_id := coalesce(app_private.audit_json_uuid(payload,'ecclesiastical_entity_id'),v_existing.ecclesiastical_entity_id);
  v_pastoral_area_id := case when payload ? 'pastoral_area_id' then app_private.audit_json_uuid(payload,'pastoral_area_id') else v_existing.pastoral_area_id end;
  v_parent_id := case when payload ? 'parent_unit_id' then app_private.audit_json_uuid(payload,'parent_unit_id') else v_existing.parent_unit_id end;
  v_name := coalesce(nullif(btrim(payload->>'name'),''),v_existing.name);
  v_description := case when payload ? 'description' then nullif(btrim(payload->>'description'),'') else v_existing.description end;
  v_key := coalesce(nullif(btrim(payload->>'key'),''),v_existing.key,public.structure_engine_slugify(v_name));
  v_sort_order := case when payload ? 'sort_order' then coalesce((payload->>'sort_order')::integer,0) else coalesce(v_existing.sort_order,0) end;
  v_visibility := coalesce(nullif(btrim(payload->>'visibility'),''),v_existing.visibility,'internal');
  v_status := coalesce(nullif(btrim(payload->>'status'),''),v_existing.status,'draft');
  v_valid_from := case when payload ? 'valid_from' then nullif(payload->>'valid_from','')::date else v_existing.valid_from end;
  v_valid_to := case when payload ? 'valid_to' then nullif(payload->>'valid_to','')::date else v_existing.valid_to end;
  v_is_current := case when payload ? 'is_current' then coalesce((payload->>'is_current')::boolean,true) else coalesce(v_existing.is_current,true) end;

  if v_chart_id is null or not exists(select 1 from public.organization_charts where id=v_chart_id and status='active') then
    raise exception 'Debe seleccionar un organigrama activo.' using errcode='22023';
  end if;
  if v_entity_id is null or not exists(select 1 from public.ecclesiastical_entities where id=v_entity_id) then
    raise exception 'Debe seleccionar una entidad eclesiástica válida.' using errcode='22023';
  end if;
  if v_name is null then
    raise exception 'El nombre de la unidad organizativa es obligatorio.' using errcode='22023';
  end if;
  if v_key is null or v_key='' then
    raise exception 'No fue posible generar la clave de la unidad organizativa.' using errcode='22023';
  end if;
  if v_parent_id=v_id then
    raise exception 'Una unidad organizativa no puede ser su propia superior.' using errcode='22023';
  end if;
  if v_valid_from is not null and v_valid_to is not null and v_valid_to<v_valid_from then
    raise exception 'La fecha final no puede ser anterior a la fecha inicial.' using errcode='22023';
  end if;

  if v_parent_id is not null then
    if not exists(
      select 1 from public.organization_units parent
      where parent.id=v_parent_id
        and parent.organization_chart_id=v_chart_id
        and parent.ecclesiastical_entity_id=v_entity_id
    ) then
      raise exception 'La unidad superior debe pertenecer al mismo organigrama y ámbito eclesiástico.' using errcode='22023';
    end if;

    if exists(
      with recursive descendants as (
        select ou.id from public.organization_units ou where ou.parent_unit_id=v_id
        union all
        select child.id
        from public.organization_units child
        join descendants d on child.parent_unit_id=d.id
      )
      select 1 from descendants where id=v_parent_id
    ) then
      raise exception 'La jerarquía produciría un ciclo organizativo.' using errcode='22023';
    end if;
  end if;

  if exists(
    select 1 from public.organization_units ou
    where ou.organization_chart_id=v_chart_id and ou.key=v_key and ou.id<>v_id
  ) then
    raise exception 'Ya existe una unidad con esa clave dentro del organigrama.' using errcode='23505';
  end if;

  v_slug_base := public.structure_engine_slugify(coalesce(nullif(btrim(payload->>'slug'),''),v_key,v_name));
  if v_slug_base is null or v_slug_base='' then
    v_slug_base := 'unidad-'||substr(replace(v_id::text,'-',''),1,12);
  end if;
  v_slug := v_slug_base;
  if exists(select 1 from public.organization_units where slug=v_slug and id<>v_id) then
    v_slug := v_slug_base||'-'||substr(replace(v_id::text,'-',''),1,8);
  end if;

  if payload ? 'id' then
    update public.organization_units
    set organization_chart_id=v_chart_id,
        parent_unit_id=v_parent_id,
        ecclesiastical_entity_id=v_entity_id,
        pastoral_area_id=v_pastoral_area_id,
        key=v_key,
        name=v_name,
        description=v_description,
        slug=v_slug,
        sort_order=v_sort_order,
        visibility=v_visibility,
        status=v_status,
        valid_from=v_valid_from,
        valid_to=v_valid_to,
        is_current=v_is_current,
        updated_at=now()
    where id=v_id;
  else
    insert into public.organization_units(
      id,organization_chart_id,parent_unit_id,ecclesiastical_entity_id,pastoral_area_id,
      key,name,description,slug,sort_order,visibility,status,valid_from,valid_to,is_current
    ) values (
      v_id,v_chart_id,v_parent_id,v_entity_id,v_pastoral_area_id,
      v_key,v_name,v_description,v_slug,v_sort_order,v_visibility,v_status,v_valid_from,v_valid_to,v_is_current
    );
  end if;

  select jsonb_build_object(
    'id',ou.id,'organization_chart_id',ou.organization_chart_id,'parent_unit_id',ou.parent_unit_id,
    'ecclesiastical_entity_id',ou.ecclesiastical_entity_id,'pastoral_area_id',ou.pastoral_area_id,
    'key',ou.key,'name',ou.name,'slug',ou.slug,'status',ou.status,'visibility',ou.visibility,
    'is_current',ou.is_current
  ) into v_result
  from public.organization_units ou where ou.id=v_id;

  return v_result;
end;
$function$;

revoke all on function internal.admin_save_organization_unit(jsonb) from public,anon,authenticated;
grant execute on function internal.admin_save_organization_unit(jsonb) to service_role;

create or replace function app_private.rpc_definer__admin_save_organization_unit(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','internal','app_private','auth','pg_temp'
as $function$
declare
  v_existing_id uuid := app_private.audit_json_uuid(payload,'id');
  v_entity_id uuid := app_private.audit_json_uuid(payload,'ecclesiastical_entity_id');
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
  v_id uuid;
  v_permission text;
  v_action text;
  v_old_status text;
  v_old_visibility text;
  v_new_status text;
  v_new_visibility text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado.' using errcode='42501';
  end if;

  if v_existing_id is not null then
    select ou.ecclesiastical_entity_id,to_jsonb(ou),ou.status,ou.visibility
      into v_entity_id,v_old,v_old_status,v_old_visibility
    from public.organization_units ou where ou.id=v_existing_id;
    if v_entity_id is null then
      raise exception 'La unidad organizativa indicada no existe.' using errcode='P0002';
    end if;
    v_permission := 'pastorals.update_proposal';
  else
    v_permission := 'pastorals.create_proposal';
  end if;

  if v_entity_id is null or not app_private.current_user_can_manage_entity(v_permission,v_entity_id) then
    raise exception 'No autorizado para modificar unidades organizativas en este ámbito.' using errcode='42501';
  end if;

  v_new_status := coalesce(nullif(btrim(payload->>'status'),''),v_old_status,'draft');
  v_new_visibility := coalesce(nullif(btrim(payload->>'visibility'),''),v_old_visibility,'internal');

  if v_new_status='active' and coalesce(v_old_status,'')<>'active'
     and not app_private.current_user_can_manage_entity('pastorals.approve',v_entity_id) then
    raise exception 'No autorizado para aprobar esta unidad organizativa.' using errcode='42501';
  end if;

  if v_new_visibility='public' and coalesce(v_old_visibility,'')<>'public'
     and not app_private.current_user_can_manage_entity('pastorals.publish',v_entity_id) then
    raise exception 'No autorizado para publicar esta unidad organizativa.' using errcode='42501';
  end if;

  v_result := internal.admin_save_organization_unit(payload);
  v_id := app_private.audit_json_uuid(v_result,'id');
  select to_jsonb(ou) into v_new from public.organization_units ou where ou.id=v_id;

  if v_new_visibility='public' and coalesce(v_old_visibility,'')<>'public' then
    v_action := 'pastorals.organization_unit.published';
  elsif v_new_status='active' and coalesce(v_old_status,'')<>'active' then
    v_action := 'pastorals.organization_unit.approved';
  elsif v_existing_id is null then
    v_action := 'pastorals.organization_unit.created';
  else
    v_action := 'pastorals.organization_unit.updated';
  end if;

  perform public.create_audit_log(
    auth.uid(),v_action,'organization_units',v_id,v_old,
    jsonb_build_object(
      'scope_type','organization_unit','scope_entity_id',v_entity_id,
      'organization_unit_id',v_id,'record',v_new,'result',v_result
    ),
    app_private.audit_json_uuid(payload,'change_request_id')
  );

  return v_result;
end;
$function$;

revoke all on function app_private.rpc_definer__admin_save_organization_unit(jsonb) from public,anon,authenticated;
grant execute on function app_private.rpc_definer__admin_save_organization_unit(jsonb) to service_role;

create or replace function public.admin_save_organization_unit(payload jsonb)
returns jsonb
language sql
set search_path to 'pg_catalog','public','app_private','auth','pg_temp'
as $function$
  select app_private.rpc_definer__admin_save_organization_unit(payload)
$function$;

revoke all on function public.admin_save_organization_unit(jsonb) from public,anon;
grant execute on function public.admin_save_organization_unit(jsonb) to authenticated,service_role;

revoke insert,update,delete,truncate,references,trigger on public.organization_units from anon,authenticated;

do $migration$
declare
  v_entity_id uuid;
  v_chart_id uuid;
  v_root_id uuid;
begin
  select id into v_entity_id
  from public.ecclesiastical_entities
  where slug='arquidiocesis-metropolitana-de-santo-domingo';

  select id into v_chart_id
  from public.organization_charts
  where key='diocesan_pastoral' and status='active';

  if v_entity_id is null or v_chart_id is null then
    raise exception 'No fue posible resolver Santo Domingo o el organigrama de pastorales diocesanas.';
  end if;

  select id into v_root_id
  from public.organization_units
  where organization_chart_id=v_chart_id
    and key='pastorales-diocesanas-arquidiocesis-metropolitana-de-santo-domingo';

  if v_root_id is null then
    insert into public.organization_units(
      organization_chart_id,parent_unit_id,ecclesiastical_entity_id,pastoral_area_id,
      key,name,description,slug,sort_order,visibility,status,is_current
    ) values (
      v_chart_id,null,v_entity_id,null,
      'pastorales-diocesanas-arquidiocesis-metropolitana-de-santo-domingo',
      'Pastorales diocesanas — Arquidiócesis Metropolitana de Santo Domingo',
      'Cabecera interna del organigrama de pastorales diocesanas de la Arquidiócesis Metropolitana de Santo Domingo.',
      'pastorales-diocesanas-arquidiocesis-metropolitana-de-santo-domingo',
      0,'internal','draft',true
    ) returning id into v_root_id;
  end if;

  update public.organization_units
  set parent_unit_id=v_root_id,updated_at=now()
  where organization_chart_id=v_chart_id
    and ecclesiastical_entity_id=v_entity_id
    and id<>v_root_id
    and pastoral_area_id is not null
    and parent_unit_id is distinct from v_root_id;
end;
$migration$;