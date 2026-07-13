create or replace function app_private.admin_assign_user_role(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_user_id uuid := nullif(payload->>'user_id','')::uuid;
  v_role_id uuid := nullif(payload->>'role_id','')::uuid;
  v_role_key text := nullif(payload->>'role_key','');
  v_scope_type text := coalesce(nullif(payload->>'scope_type',''),'national');
  v_scope_entity_id uuid := nullif(payload->>'scope_entity_id','')::uuid;
  v_diocese_id uuid := nullif(payload->>'diocese_id','')::uuid;
  v_pastoral_area_id uuid := nullif(payload->>'pastoral_area_id','')::uuid;
  v_organization_unit_id uuid := coalesce(nullif(payload->>'organization_unit_id','')::uuid,
                                          case when v_scope_type='organization_unit' then v_scope_entity_id end);
  v_starts_at date := coalesce(nullif(payload->>'starts_at','')::date,current_date);
  v_ends_at date := nullif(payload->>'ends_at','')::date;
  v_assignment_id uuid;
  v_target_role_key text;
begin
  if v_actor_id is null or not (
    app_private.current_user_has_permission('users.assign_roles')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para asignar roles' using errcode='42501';
  end if;

  if v_user_id is null then raise exception 'Debes seleccionar un usuario' using errcode='22023'; end if;
  if v_role_id is null and v_role_key is null then raise exception 'Debes seleccionar un rol' using errcode='22023'; end if;

  select id,key into v_role_id,v_target_role_key
  from public.roles
  where id=v_role_id or key=v_role_key
  limit 1;

  if v_role_id is null then raise exception 'Rol no encontrado' using errcode='22023'; end if;
  if v_target_role_key='super_admin' and not app_private.current_user_has_role(array['super_admin']) then
    raise exception 'Solo un superadministrador puede asignar el rol super_admin' using errcode='42501';
  end if;

  if v_scope_type not in ('global','national','diocese','vicariate','zone','parish','pastoral_area','organization_unit','entity') then
    raise exception 'Alcance de rol no permitido' using errcode='22023';
  end if;
  if v_scope_type in ('diocese','vicariate','zone','parish','pastoral_area','organization_unit','entity') and v_scope_entity_id is null then
    raise exception 'Debes seleccionar la entidad concreta del alcance' using errcode='22023';
  end if;
  if v_ends_at is not null and v_ends_at<v_starts_at then
    raise exception 'La fecha final no puede ser menor que la fecha inicial' using errcode='22023';
  end if;

  if v_scope_type='diocese' then
    v_diocese_id := coalesce(v_diocese_id,v_scope_entity_id);
  elsif v_scope_type in ('vicariate','zone','entity') then
    select coalesce(v_diocese_id,sn.diocese_id)
      into v_diocese_id
    from public.structure_nodes sn
    where sn.id=v_scope_entity_id
    limit 1;
  elsif v_scope_type='parish' then
    select coalesce(v_diocese_id,sn.diocese_id)
      into v_diocese_id
    from public.structure_nodes sn
    where sn.linked_ecclesiastical_entity_id=v_scope_entity_id
      and sn.is_current=true and sn.status='active'
    limit 1;
  elsif v_scope_type='pastoral_area' then
    v_pastoral_area_id := coalesce(v_pastoral_area_id,v_scope_entity_id);
  elsif v_scope_type='organization_unit' then
    select coalesce(v_organization_unit_id,ou.id),
           coalesce(v_pastoral_area_id,ou.pastoral_area_id),
           coalesce(v_diocese_id,app_private.resolve_entity_diocese_id(ou.ecclesiastical_entity_id))
      into v_organization_unit_id,v_pastoral_area_id,v_diocese_id
    from public.organization_units ou
    where ou.id=v_scope_entity_id
    limit 1;
  end if;

  insert into public.profiles(id,email,full_name,status)
  select u.id,coalesce(u.email,''),coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),nullif(btrim(u.email),''),'Usuario SINEP'),'active'
  from auth.users u where u.id=v_user_id
  on conflict(id) do update set updated_at=now();

  if not found and not exists(select 1 from auth.users where id=v_user_id) then
    raise exception 'Usuario no encontrado en Supabase Auth' using errcode='22023';
  end if;

  select ura.id into v_assignment_id
  from public.user_role_assignments ura
  where ura.user_id=v_user_id
    and ura.role_id=v_role_id
    and ura.status='active'
    and ura.scope_type=v_scope_type
    and ura.scope_entity_id is not distinct from v_scope_entity_id
    and ura.diocese_id is not distinct from v_diocese_id
    and ura.pastoral_area_id is not distinct from v_pastoral_area_id
    and ura.organization_unit_id is not distinct from v_organization_unit_id
    and ura.starts_at<=current_date
    and (ura.ends_at is null or ura.ends_at>=current_date)
  limit 1;

  if v_assignment_id is null then
    insert into public.user_role_assignments(
      user_id,role_id,scope_type,scope_entity_id,diocese_id,pastoral_area_id,organization_unit_id,
      starts_at,ends_at,status,created_by
    ) values (
      v_user_id,v_role_id,v_scope_type,v_scope_entity_id,v_diocese_id,v_pastoral_area_id,v_organization_unit_id,
      v_starts_at,v_ends_at,'active',v_actor_id
    ) returning id into v_assignment_id;
  end if;

  insert into public.audit_logs(user_id,action,target_table,target_id,new_data,organization_unit_id)
  values(
    v_actor_id,'admin_assign_user_role','user_role_assignments',v_assignment_id,
    jsonb_build_object(
      'target_user_id',v_user_id,
      'role_id',v_role_id,
      'role_key',v_target_role_key,
      'scope_type',v_scope_type,
      'scope_entity_id',v_scope_entity_id,
      'diocese_id',v_diocese_id,
      'pastoral_area_id',v_pastoral_area_id,
      'organization_unit_id',v_organization_unit_id
    ),
    v_organization_unit_id
  );

  return jsonb_build_object(
    'assignment_id',v_assignment_id,
    'user_id',v_user_id,
    'role_id',v_role_id,
    'role_key',v_target_role_key,
    'scope_type',v_scope_type,
    'scope_entity_id',v_scope_entity_id,
    'diocese_id',v_diocese_id,
    'pastoral_area_id',v_pastoral_area_id,
    'organization_unit_id',v_organization_unit_id
  );
end;
$function$;

create or replace function app_private.admin_list_role_scope_options(p_scope_type text default null)
returns table(scope_type text,scope_entity_id uuid,label text,description text,source_table text,diocese_id uuid,parent_id uuid)
language plpgsql
stable security definer
set search_path to 'public','auth','pg_temp'
as $function$
begin
  if auth.uid() is null or not (
    app_private.current_user_has_permission('users.view')
    or app_private.current_user_has_permission('users.assign_roles')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para ver alcances de roles' using errcode='42501';
  end if;

  return query
  with requested as (select nullif(p_scope_type,'') as value)
  select 'diocese'::text,ee.id,ee.name::text,coalesce(et.name,et.key,'Jurisdicción')::text,
         'ecclesiastical_entities'::text,ee.id,null::uuid
  from public.ecclesiastical_entities ee
  join public.entity_types et on et.id=ee.entity_type_id
  cross join requested req
  where (req.value is null or req.value='diocese') and ee.status='active'
    and et.key in ('archdiocese','diocese','military_ordinariate')
  union all
  select 'parish'::text,ee.id,ee.name::text,coalesce(et.name,et.key,'Parroquia')::text,
         'ecclesiastical_entities'::text,app_private.resolve_entity_diocese_id(ee.id),null::uuid
  from public.ecclesiastical_entities ee
  join public.entity_types et on et.id=ee.entity_type_id
  cross join requested req
  where (req.value is null or req.value='parish') and ee.status='active'
    and et.key in ('parish','quasi_parish')
  union all
  select case
           when sl.level_key ilike '%vicari%' or sl.name ilike '%vicar%' then 'vicariate'
           when sl.level_key ilike '%zona%' or sl.level_key ilike '%zone%' or sl.name ilike '%zona%' or sl.name ilike '%zone%' then 'zone'
           else 'entity'
         end::text,
         sn.id,sn.name::text,concat_ws(' · ',st.name,sl.name)::text,'structure_nodes'::text,
         sn.diocese_id,sn.parent_node_id
  from public.structure_nodes sn
  join public.structure_levels sl on sl.id=sn.level_id
  join public.structure_templates st on st.id=sn.template_id
  cross join requested req
  where sn.status='active' and sn.is_current=true and st.status='active'
    and (
      req.value is null or req.value='entity'
      or (req.value='vicariate' and (sl.level_key ilike '%vicari%' or sl.name ilike '%vicar%'))
      or (req.value='zone' and (sl.level_key ilike '%zona%' or sl.level_key ilike '%zone%' or sl.name ilike '%zona%' or sl.name ilike '%zone%'))
    )
  union all
  select 'pastoral_area'::text,pa.id,pa.name::text,coalesce(pa.description,'Área pastoral')::text,
         'pastoral_areas'::text,null::uuid,null::uuid
  from public.pastoral_areas pa
  cross join requested req
  where (req.value is null or req.value='pastoral_area') and pa.status='active'
  union all
  select 'organization_unit'::text,ou.id,ou.name::text,
         coalesce(oc.name,'Unidad organizativa')::text,'organization_units'::text,
         app_private.resolve_entity_diocese_id(ou.ecclesiastical_entity_id),ou.parent_unit_id
  from public.organization_units ou
  join public.organization_charts oc on oc.id=ou.organization_chart_id
  cross join requested req
  where (req.value is null or req.value='organization_unit')
    and ou.status='active' and ou.is_current=true
  order by 1,3;
end;
$function$;

do $migration$
declare
  v_oid oid;
  v_def text;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='internal' and p.proname='list_assignment_canonical_incompatibilities'
    and pg_get_function_identity_arguments(p.oid)='p_status text, p_limit integer';
  v_def := pg_get_functiondef(v_oid);
  v_def := replace(v_def,'public.pastoral_entities','public.organization_units');
  v_def := replace(v_def,'pa.pastoral_entity_id','pa.organization_unit_id');
  execute v_def;

  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='generate_event_occurrences'
    and pg_get_function_identity_arguments(p.oid)='p_year integer';
  v_def := pg_get_functiondef(v_oid);
  v_def := replace(v_def,'related_pastoral_entity_id','related_organization_unit_id');
  v_def := replace(v_def,'pastoral_entity_id','organization_unit_id');
  v_def := replace(v_def,'public.pastoral_entities','public.organization_units');
  v_def := replace(v_def,'''pastoral_entities''','''organization_units''');
  v_def := replace(v_def,'pe.diocese_id','app_private.resolve_entity_diocese_id(pe.ecclesiastical_entity_id)');
  v_def := replace(v_def,'pe.start_date','pe.valid_from');
  execute v_def;
end;
$migration$;
