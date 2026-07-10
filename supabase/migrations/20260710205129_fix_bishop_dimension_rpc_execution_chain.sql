create or replace function internal.admin_save_bishop_with_dimensions(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_mode text := coalesce(nullif(payload->>'mode',''), 'existing');
  v_selected_person_id uuid := nullif(payload->>'selected_clergy_id','')::uuid;
  v_target_entity_id uuid := coalesce(
    nullif(payload->>'assignment_entity_id','')::uuid,
    nullif(payload->>'incardination_entity_id','')::uuid
  );
  v_has_assignment boolean := nullif(payload->>'office_configuration_id','') is not null;
  v_role_type text := nullif(payload->>'episcopal_role_type','');
  v_status_type text := coalesce(
    nullif(payload->>'canonical_status',''),
    case when nullif(payload->>'episcopal_role_type','') = 'emeritus' then 'emeritus' else 'active' end
  );
  v_person_result jsonb;
  v_assignment_result jsonb := '{}'::jsonb;
  v_person_id uuid;
  v_assignment_id uuid;
  v_role_id uuid;
  v_dignity text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode='42501';
  end if;

  if not public.current_user_has_permission('people.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear obispos' using errcode='42501';
  end if;

  if v_mode not in ('existing','new') then
    raise exception 'Modo de registro inválido' using errcode='22023';
  end if;

  if v_role_type is not null and v_role_type not in (
    'diocesan','auxiliary','coadjutor','titular','emeritus',
    'apostolic_administrator','apostolic_vicar','apostolic_prefect','other'
  ) then
    raise exception 'Función episcopal inválida' using errcode='22023';
  end if;

  if v_status_type not in ('active','retired','emeritus','suspended','restricted','inactive','deceased','lost_clerical_state','unknown') then
    raise exception 'Estado canónico inválido' using errcode='22023';
  end if;

  if payload ? 'dignities' and jsonb_typeof(payload->'dignities') <> 'array' then
    raise exception 'Las dignidades deben enviarse como una lista' using errcode='22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(payload->'dignities','[]'::jsonb)) d(value)
    where d.value not in ('archbishop','metropolitan','cardinal','monsignor','patriarch','major_archbishop','other')
  ) then
    raise exception 'La lista contiene una dignidad no permitida' using errcode='22023';
  end if;

  if v_mode = 'existing' then
    if v_selected_person_id is null then
      raise exception 'Debes seleccionar el sacerdote' using errcode='22023';
    end if;

    if not app_private.current_user_can_manage_person('people.create_proposal', v_selected_person_id) then
      raise exception 'La persona seleccionada está fuera de tu alcance' using errcode='42501';
    end if;

    if not exists (
      select 1 from public.ordination_events oe
      where oe.person_id=v_selected_person_id and oe.degree='presbyterate' and oe.record_status='active'
    ) or exists (
      select 1 from public.ordination_events oe
      where oe.person_id=v_selected_person_id and oe.degree='episcopate' and oe.record_status='active'
    ) then
      raise exception 'La persona seleccionada debe tener presbiterado y no poseer todavía episcopado' using errcode='22023';
    end if;
  end if;

  if v_target_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'Debes indicar una jurisdicción dentro de tu alcance' using errcode='42501';
  end if;

  if v_target_entity_id is not null
     and not app_private.current_user_can_manage_entity('people.create_proposal', v_target_entity_id) then
    raise exception 'La jurisdicción seleccionada para el obispo está fuera de tu alcance' using errcode='42501';
  end if;

  if v_has_assignment then
    if not public.current_user_has_permission('appointments.create_proposal')
       and not public.current_user_is_super_or_national() then
      raise exception 'No autorizado para crear el nombramiento episcopal' using errcode='42501';
    end if;

    if v_target_entity_id is null
       or not app_private.current_user_can_manage_entity('appointments.create_proposal', v_target_entity_id) then
      raise exception 'No autorizado para crear el nombramiento episcopal en esta jurisdicción' using errcode='42501';
    end if;
  end if;

  v_person_result := internal.admin_save_bishop(
    (payload || jsonb_build_object('canonical_status',v_status_type)) - 'office_configuration_id'
  );
  v_person_id := nullif(v_person_result->>'person_id','')::uuid;

  if v_has_assignment then
    v_assignment_result := internal.admin_save_position_assignment(
      jsonb_build_object(
        'person_id',v_person_id,
        'office_configuration_id',nullif(payload->>'office_configuration_id','')::uuid,
        'ecclesiastical_entity_id',v_target_entity_id,
        'title_override',nullif(btrim(payload->>'title_override'),''),
        'start_date',nullif(payload->>'appointment_start_date','')::date,
        'term_start_date',nullif(payload->>'appointment_start_date','')::date,
        'assignment_status','active',
        'selection_method','appointment',
        'notes_public',nullif(btrim(payload->>'appointment_notes_public'),''),
        'notes_internal','Cargo episcopal creado desde asistente transaccional.',
        'source_name',nullif(btrim(payload->>'source_name'),''),
        'source_url',nullif(btrim(payload->>'source_url'),''),
        'source_checked_at',nullif(payload->>'source_checked_at','')::date,
        'verification_status','pending_review',
        'visibility','public',
        'close_previous_current',true
      )
    );
    v_assignment_id := nullif(v_assignment_result->>'assignment_id','')::uuid;
  end if;

  if v_role_type is not null then
    insert into public.episcopal_roles (
      person_id, role_type, jurisdiction_entity_id, title_see_name,
      start_date, is_current, has_right_of_succession,
      source_position_assignment_id, source_name, source_url, source_checked_at,
      verification_status, visibility, record_status, record_origin,
      notes_public, notes_internal, created_by
    ) values (
      v_person_id,
      v_role_type,
      nullif(payload->>'assignment_entity_id','')::uuid,
      nullif(btrim(payload->>'title_see_name'),''),
      nullif(payload->>'appointment_start_date','')::date,
      true,
      v_role_type='coadjutor',
      v_assignment_id,
      nullif(btrim(payload->>'source_name'),''),
      nullif(btrim(payload->>'source_url'),''),
      nullif(payload->>'source_checked_at','')::date,
      'pending_review','public','active','bishop_wizard',
      nullif(btrim(payload->>'appointment_notes_public'),''),
      'Función episcopal registrada separadamente del grado sacramental y del cargo.',
      auth.uid()
    ) returning id into v_role_id;
  end if;

  if not exists (
    select 1 from public.clerical_status_history csh
    where csh.person_id=v_person_id and csh.status_type=v_status_type
      and csh.is_current=true and csh.record_status='active'
  ) then
    insert into public.clerical_status_history (
      person_id,status_type,start_date,is_current,reason,
      source_name,source_url,source_checked_at,verification_status,
      visibility,record_status,record_origin,notes_internal,created_by
    ) values (
      v_person_id,v_status_type,nullif(payload->>'appointment_start_date','')::date,true,
      'Estado registrado desde el asistente de obispo.',
      nullif(btrim(payload->>'source_name'),''),
      nullif(btrim(payload->>'source_url'),''),
      nullif(payload->>'source_checked_at','')::date,
      'pending_review','internal','active','bishop_wizard',
      'El estado canónico se conserva independientemente de la ordenación y del nombramiento.',auth.uid()
    );
  end if;

  for v_dignity in
    select distinct value
    from jsonb_array_elements_text(coalesce(payload->'dignities','[]'::jsonb)) d(value)
  loop
    update public.person_ecclesiastical_dignities
    set title_text=coalesce(nullif(btrim(payload->>'title_override'),''),title_text),
        start_date=coalesce(start_date,nullif(payload->>'appointment_start_date','')::date),
        source_position_assignment_id=coalesce(source_position_assignment_id,v_assignment_id),
        source_name=coalesce(source_name,nullif(btrim(payload->>'source_name'),'')),
        source_url=coalesce(source_url,nullif(btrim(payload->>'source_url'),'')),
        source_checked_at=coalesce(source_checked_at,nullif(payload->>'source_checked_at','')::date),
        updated_at=now()
    where person_id=v_person_id and dignity_type=v_dignity
      and is_current=true and record_status='active';

    if not found then
      insert into public.person_ecclesiastical_dignities (
        person_id,dignity_type,title_text,start_date,is_current,
        source_position_assignment_id,source_name,source_url,source_checked_at,
        verification_status,visibility,record_status,record_origin,notes_internal,created_by
      ) values (
        v_person_id,v_dignity,nullif(btrim(payload->>'title_override'),''),
        nullif(payload->>'appointment_start_date','')::date,true,
        v_assignment_id,nullif(btrim(payload->>'source_name'),''),
        nullif(btrim(payload->>'source_url'),''),nullif(payload->>'source_checked_at','')::date,
        'pending_review','public','active','bishop_wizard',
        'Dignidad registrada separadamente del sacramento del Orden.',auth.uid()
      );
    end if;
  end loop;

  return v_person_result || v_assignment_result || jsonb_build_object('episcopal_role_id',v_role_id);
end;
$$;

revoke all on function internal.admin_save_bishop_with_dimensions(jsonb) from public, anon;
grant execute on function internal.admin_save_bishop_with_dimensions(jsonb) to authenticated;

create or replace function public.admin_save_bishop(payload jsonb)
returns jsonb
language sql
set search_path = public, internal, pg_temp
as $$
  select internal.admin_save_bishop_with_dimensions(payload);
$$;

revoke all on function public.admin_save_bishop(jsonb) from public, anon;
grant execute on function public.admin_save_bishop(jsonb) to authenticated;