create or replace function app_private.current_user_can_manage_person(
  p_permission_key text,
  p_person_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or p_person_id is null or nullif(p_permission_key, '') is null then
    return false;
  end if;

  if public.current_user_is_super_or_national() then
    return true;
  end if;

  return exists (
    select 1
    from public.persons p
    where p.id = p_person_id
      and p.created_by = v_user_id
  )
  or exists (
    select 1
    from public.position_assignments pa
    where pa.person_id = p_person_id
      and pa.is_current = true
      and pa.assignment_status = 'active'
      and pa.record_status = 'active'
      and pa.ecclesiastical_entity_id is not null
      and app_private.current_user_can_manage_entity(p_permission_key, pa.ecclesiastical_entity_id)
  )
  or exists (
    select 1
    from public.clergy_profiles cp
    where cp.person_id = p_person_id
      and (
        app_private.current_user_can_manage_entity(p_permission_key, cp.current_service_entity_id)
        or app_private.current_user_can_manage_entity(p_permission_key, cp.incardination_entity_id)
      )
  )
  or exists (
    select 1
    from public.religious_profiles rp
    where rp.person_id = p_person_id
      and app_private.current_user_can_manage_entity(p_permission_key, rp.current_service_entity_id)
  );
end;
$$;

revoke all on function app_private.current_user_can_manage_person(text, uuid) from public, anon, authenticated;

create or replace function app_private.admin_list_unordained_people(p_limit integer default 250)
returns table (
  id uuid,
  display_name text,
  slug text
)
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 250), 1), 500);
begin
  if auth.uid() is null
     or (
       not public.current_user_has_permission('people.create_proposal')
       and not public.current_user_is_super_or_national()
     ) then
    raise exception 'No autorizado para consultar candidatos al diaconado' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    coalesce(nullif(p.display_name, ''), btrim(concat_ws(' ', p.first_name, p.middle_name, p.last_name, p.second_last_name))) as display_name,
    p.slug
  from public.persons p
  where p.status = 'active'
    and not exists (
      select 1
      from public.ordination_events oe
      where oe.person_id = p.id
        and oe.record_status = 'active'
    )
    and app_private.current_user_can_manage_person('people.create_proposal', p.id)
  order by display_name
  limit v_limit;
end;
$$;

revoke all on function app_private.admin_list_unordained_people(integer) from public, anon, authenticated;

create or replace function public.admin_list_unordained_people(p_limit integer default 250)
returns table (
  id uuid,
  display_name text,
  slug text
)
language sql
stable
set search_path = public, app_private, pg_temp
as $$
  select * from app_private.admin_list_unordained_people(p_limit);
$$;

revoke all on function public.admin_list_unordained_people(integer) from public, anon;
grant execute on function public.admin_list_unordained_people(integer) to authenticated;

create or replace function public.admin_save_deacon(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  v_mode text := coalesce(nullif(payload->>'mode', ''), 'new');
  v_selected_person_id uuid := nullif(payload->>'selected_person_id', '')::uuid;
  v_target_entity_id uuid := coalesce(
    nullif(payload->>'quick_entity_id', '')::uuid,
    nullif(payload->>'current_service_entity_id', '')::uuid,
    nullif(payload->>'incardination_entity_id', '')::uuid
  );
  v_has_assignment boolean := nullif(payload->>'quick_office_configuration_id', '') is not null;
  v_person_result jsonb;
  v_assignment_result jsonb := '{}'::jsonb;
  v_person_id uuid;
begin
  if not public.current_user_has_permission('people.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear diáconos' using errcode = '42501';
  end if;

  if v_mode = 'existing'
     and not app_private.current_user_can_manage_person('people.create_proposal', v_selected_person_id) then
    raise exception 'La persona seleccionada está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_target_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'Debes indicar una entidad de incardinación o servicio dentro de tu alcance' using errcode = '42501';
  end if;

  if v_target_entity_id is not null
     and not app_private.current_user_can_manage_entity('people.create_proposal', v_target_entity_id) then
    raise exception 'La entidad seleccionada para el diácono está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_has_assignment then
    if not public.current_user_has_permission('appointments.create_proposal')
       and not public.current_user_is_super_or_national() then
      raise exception 'No autorizado para crear el nombramiento del diácono' using errcode = '42501';
    end if;

    if v_target_entity_id is null
       or not app_private.current_user_can_manage_entity('appointments.create_proposal', v_target_entity_id) then
      raise exception 'La entidad del nombramiento está fuera de tu alcance' using errcode = '42501';
    end if;
  end if;

  v_person_result := internal.admin_save_deacon(payload - 'quick_office_configuration_id');
  v_person_id := nullif(v_person_result->>'person_id', '')::uuid;

  if v_has_assignment then
    v_assignment_result := internal.admin_save_position_assignment(
      jsonb_build_object(
        'person_id', v_person_id,
        'office_configuration_id', nullif(payload->>'quick_office_configuration_id', '')::uuid,
        'ecclesiastical_entity_id', v_target_entity_id,
        'title_override', nullif(btrim(payload->>'quick_title_override'), ''),
        'start_date', nullif(payload->>'quick_start_date', '')::date,
        'term_start_date', nullif(payload->>'quick_start_date', '')::date,
        'assignment_status', 'active',
        'selection_method', 'appointment',
        'notes_public', nullif(btrim(payload->>'quick_notes_public'), ''),
        'notes_internal', 'Asignación creada desde asistente transaccional de diácono.',
        'verification_status', 'pending_review',
        'visibility', 'public',
        'close_previous_current', true
      )
    );
  end if;

  return v_person_result || v_assignment_result;
end;
$$;
