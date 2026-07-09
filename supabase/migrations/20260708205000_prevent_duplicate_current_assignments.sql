-- Prevent duplicate active/current assignments for the same office and scope.
-- This protects quick wizard assignments and the general assignment RPC.

with ranked as (
  select
    pa.id,
    row_number() over (
      partition by
        pa.office_configuration_id,
        pa.organization_chart_id,
        pa.organization_unit_id,
        pa.ecclesiastical_entity_id,
        pa.pastoral_entity_id
      order by
        coalesce(pa.start_date, pa.effective_date, pa.term_start_date, pa.created_at::date) desc,
        pa.created_at desc,
        pa.id desc
    ) as rn,
    first_value(pa.id) over (
      partition by
        pa.office_configuration_id,
        pa.organization_chart_id,
        pa.organization_unit_id,
        pa.ecclesiastical_entity_id,
        pa.pastoral_entity_id
      order by
        coalesce(pa.start_date, pa.effective_date, pa.term_start_date, pa.created_at::date) desc,
        pa.created_at desc,
        pa.id desc
    ) as keeper_id,
    first_value(coalesce(pa.start_date, pa.effective_date, pa.term_start_date, pa.created_at::date)) over (
      partition by
        pa.office_configuration_id,
        pa.organization_chart_id,
        pa.organization_unit_id,
        pa.ecclesiastical_entity_id,
        pa.pastoral_entity_id
      order by
        coalesce(pa.start_date, pa.effective_date, pa.term_start_date, pa.created_at::date) desc,
        pa.created_at desc,
        pa.id desc
    ) as keeper_date
  from public.position_assignments pa
  where pa.is_current = true
    and pa.record_status = 'active'
), to_close as (
  select *
  from ranked
  where rn > 1
)
update public.position_assignments pa
set
  is_current = false,
  assignment_status = case
    when pa.assignment_status in ('active', 'term_expired_still_serving', 'vacant') then 'replaced'
    else pa.assignment_status
  end,
  actual_end_date = coalesce(pa.actual_end_date, coalesce(to_close.keeper_date, current_date) - 1),
  replaced_by_assignment_id = coalesce(pa.replaced_by_assignment_id, to_close.keeper_id),
  successor_assignment_id = coalesce(pa.successor_assignment_id, to_close.keeper_id),
  updated_at = now()
from to_close
where pa.id = to_close.id;

create unique index if not exists uniq_position_assignments_current_scope
on public.position_assignments (
  office_configuration_id,
  coalesce(organization_chart_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(organization_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(ecclesiastical_entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(pastoral_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
where is_current = true
  and record_status = 'active';

create or replace function internal.admin_save_position_assignment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_assignment_id uuid;
  v_closed_assignment_ids uuid[] := '{}'::uuid[];
  v_person_id uuid := nullif(payload->>'person_id', '')::uuid;
  v_office_configuration_id uuid := nullif(payload->>'office_configuration_id', '')::uuid;
  v_organization_chart_id uuid := nullif(payload->>'organization_chart_id', '')::uuid;
  v_organization_unit_id uuid := nullif(payload->>'organization_unit_id', '')::uuid;
  v_ecclesiastical_entity_id uuid := nullif(payload->>'ecclesiastical_entity_id', '')::uuid;
  v_pastoral_entity_id uuid := nullif(payload->>'pastoral_entity_id', '')::uuid;
  v_predecessor_assignment_id uuid := nullif(payload->>'predecessor_assignment_id', '')::uuid;
  v_successor_assignment_id uuid := nullif(payload->>'successor_assignment_id', '')::uuid;
  v_start_date date := nullif(payload->>'start_date', '')::date;
  v_term_start_date date := nullif(payload->>'term_start_date', '')::date;
  v_term_end_date date := nullif(payload->>'term_end_date', '')::date;
  v_actual_end_date date := nullif(payload->>'actual_end_date', '')::date;
  v_effective_date date := nullif(payload->>'effective_date', '')::date;
  v_public_from date := nullif(payload->>'public_from', '')::date;
  v_public_until date := nullif(payload->>'public_until', '')::date;
  v_confidential_until date := nullif(payload->>'confidential_until', '')::date;
  v_assignment_status text := coalesce(nullif(payload->>'assignment_status', ''), 'active');
  v_selection_method text := coalesce(nullif(payload->>'selection_method', ''), 'appointment');
  v_verification_status text := coalesce(nullif(payload->>'verification_status', ''), 'pending_review');
  v_visibility text := coalesce(nullif(payload->>'visibility', ''), 'public');
  v_publication_status text := nullif(payload->>'publication_status', '');
  v_is_current boolean;
  v_close_previous boolean := coalesce((payload->>'close_previous_current')::boolean, false);
  v_close_date date;
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar asignaciones de cargos' using errcode = '42501';
  end if;

  if v_office_configuration_id is null then
    raise exception 'Debes seleccionar un cargo configurado' using errcode = '22023';
  end if;

  if not exists (select 1 from public.office_configurations where id = v_office_configuration_id and status = 'active') then
    raise exception 'El cargo configurado no existe o no está activo' using errcode = '22023';
  end if;

  if v_assignment_status not in ('active', 'term_expired_still_serving', 'renewed', 'replaced', 'vacant', 'suspended', 'ended') then
    raise exception 'Estado de asignación no permitido' using errcode = '22023';
  end if;

  if v_selection_method not in ('appointment', 'election', 'confirmation', 'ex_officio', 'other') then
    raise exception 'Método de selección no permitido' using errcode = '22023';
  end if;

  if v_verification_status not in ('verified', 'pending_review', 'needs_correction', 'disputed') then
    raise exception 'Estado de verificación no permitido' using errcode = '22023';
  end if;

  if v_visibility not in ('public', 'internal', 'private') then
    raise exception 'Visibilidad no permitida' using errcode = '22023';
  end if;

  if v_person_id is null and v_assignment_status <> 'vacant' then
    raise exception 'Debes seleccionar una persona, excepto cuando el estado sea vacante' using errcode = '22023';
  end if;

  if v_person_id is not null and not exists (select 1 from public.persons where id = v_person_id and status = 'active') then
    raise exception 'La persona seleccionada no existe o no está activa' using errcode = '22023';
  end if;

  if v_organization_chart_id is null then
    select organization_chart_id into v_organization_chart_id
    from public.office_configurations
    where id = v_office_configuration_id;
  end if;

  if v_term_start_date is null then
    v_term_start_date := v_start_date;
  end if;

  if v_effective_date is null then
    v_effective_date := coalesce(v_start_date, v_term_start_date);
  end if;

  if v_visibility = 'public' and v_public_from is null then
    v_public_from := coalesce(v_start_date, v_term_start_date, v_effective_date, current_date);
  end if;

  if v_publication_status is null then
    v_publication_status := case
      when v_visibility = 'private' then 'private'
      when v_visibility = 'internal' then 'internal'
      when v_visibility = 'public' and v_public_from > current_date then 'scheduled'
      else 'published'
    end;
  end if;

  if v_publication_status not in ('draft','internal','scheduled','published','private','archived') then
    raise exception 'Estado de publicación no permitido' using errcode = '22023';
  end if;

  v_is_current := v_actual_end_date is null and v_assignment_status not in ('ended', 'replaced', 'suspended');
  v_close_date := coalesce(v_start_date, v_effective_date, current_date) - 1;

  if v_is_current or v_close_previous then
    select coalesce(array_agg(id order by created_at), '{}'::uuid[])
      into v_closed_assignment_ids
    from public.position_assignments
    where is_current = true
      and record_status = 'active'
      and office_configuration_id = v_office_configuration_id
      and organization_chart_id is not distinct from v_organization_chart_id
      and organization_unit_id is not distinct from v_organization_unit_id
      and ecclesiastical_entity_id is not distinct from v_ecclesiastical_entity_id
      and pastoral_entity_id is not distinct from v_pastoral_entity_id;

    if cardinality(v_closed_assignment_ids) > 0 then
      update public.position_assignments
      set is_current = false,
          assignment_status = case when assignment_status in ('active', 'term_expired_still_serving', 'vacant') then 'replaced' else assignment_status end,
          actual_end_date = coalesce(actual_end_date, v_close_date),
          updated_at = now()
      where id = any(v_closed_assignment_ids);
    end if;
  end if;

  insert into public.position_assignments (
    person_id, office_configuration_id, organization_chart_id, organization_unit_id,
    ecclesiastical_entity_id, pastoral_entity_id, title_override, start_date,
    term_start_date, term_end_date, actual_end_date, effective_date,
    public_from, public_until, confidential_until, publication_status,
    is_current, assignment_status, selection_method, predecessor_assignment_id, successor_assignment_id,
    notes_public, notes_internal, source_name, source_url, source_checked_at,
    verification_status, visibility, record_status
  ) values (
    v_person_id, v_office_configuration_id, v_organization_chart_id, v_organization_unit_id,
    v_ecclesiastical_entity_id, v_pastoral_entity_id, nullif(btrim(payload->>'title_override'), ''), v_start_date,
    v_term_start_date, v_term_end_date, v_actual_end_date, v_effective_date,
    v_public_from, v_public_until, v_confidential_until, v_publication_status,
    v_is_current, v_assignment_status, v_selection_method, v_predecessor_assignment_id, v_successor_assignment_id,
    nullif(btrim(payload->>'notes_public'), ''), nullif(btrim(payload->>'notes_internal'), ''),
    nullif(btrim(payload->>'source_name'), ''), nullif(btrim(payload->>'source_url'), ''), nullif(payload->>'source_checked_at', '')::date,
    v_verification_status, v_visibility, 'active'
  ) returning id into v_assignment_id;

  if cardinality(v_closed_assignment_ids) > 0 then
    update public.position_assignments
    set replaced_by_assignment_id = coalesce(replaced_by_assignment_id, v_assignment_id),
        successor_assignment_id = coalesce(successor_assignment_id, v_assignment_id),
        updated_at = now()
    where id = any(v_closed_assignment_ids);
  end if;

  if v_predecessor_assignment_id is not null then
    update public.position_assignments
    set successor_assignment_id = v_assignment_id,
        replaced_by_assignment_id = v_assignment_id,
        is_current = false,
        assignment_status = case when assignment_status in ('active', 'term_expired_still_serving', 'vacant') then 'replaced' else assignment_status end,
        actual_end_date = coalesce(actual_end_date, v_close_date),
        updated_at = now()
    where id = v_predecessor_assignment_id;
  end if;

  if v_successor_assignment_id is not null then
    update public.position_assignments
    set predecessor_assignment_id = v_assignment_id,
        updated_at = now()
    where id = v_successor_assignment_id;
  end if;

  return jsonb_build_object(
    'assignment_id', v_assignment_id,
    'closed_previous_current_count', cardinality(v_closed_assignment_ids)
  );
end;
$$;

create or replace function internal.admin_save_priest(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_person_id uuid := nullif(payload->>'existing_deacon_person_id', '')::uuid;
  v_clergy_profile_id uuid;
  v_assignment_id uuid;
  v_closed_assignment_ids uuid[] := '{}'::uuid[];
  v_slug text;
  v_internal_code text;
  v_first_name text := nullif(btrim(payload->>'first_name'), '');
  v_last_name text := nullif(btrim(payload->>'last_name'), '');
  v_display_name text := nullif(btrim(payload->>'display_name'), '');
  v_office_configuration_id uuid := nullif(payload->>'quick_office_configuration_id', '')::uuid;
  v_assignment_entity_id uuid;
  v_organization_chart_id uuid;
  v_start_date date := nullif(payload->>'quick_start_date', '')::date;
  v_close_date date;
  v_existing_type text;
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar sacerdotes' using errcode = '42501';
  end if;

  if v_person_id is not null then
    select person_type, slug into v_existing_type, v_slug
    from public.persons
    where id = v_person_id
    for update;

    if v_existing_type is null then
      raise exception 'No se encontró el diácono seleccionado' using errcode = '22023';
    end if;

    if v_existing_type <> 'deacon' then
      raise exception 'La persona seleccionada no está registrada como diácono' using errcode = '22023';
    end if;

    update public.persons
    set person_type = 'priest',
        gender = coalesce(nullif(payload->>'gender', ''), gender),
        birth_date = coalesce(nullif(payload->>'birth_date', '')::date, birth_date),
        birth_place = coalesce(nullif(btrim(payload->>'birth_place'), ''), birth_place),
        photo_url = coalesce(nullif(btrim(payload->>'photo_url'), ''), photo_url),
        photo_path = coalesce(nullif(btrim(payload->>'photo_path'), ''), photo_path),
        biography_public = coalesce(nullif(btrim(payload->>'biography_public'), ''), biography_public),
        notes_internal = concat_ws(E'\n', notes_internal, nullif(btrim(payload->>'notes_internal'), '')),
        updated_at = now()
    where id = v_person_id;
  else
    v_display_name := coalesce(
      v_display_name,
      concat_ws(' ', v_first_name, nullif(btrim(payload->>'middle_name'), ''), v_last_name, nullif(btrim(payload->>'second_last_name'), ''))
    );
    v_slug := nullif(btrim(payload->>'slug'), '');
    v_slug := coalesce(v_slug, regexp_replace(lower(unaccent(v_display_name)), '[^a-z0-9]+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

    if v_first_name is null or v_last_name is null or v_display_name is null or v_slug is null then
      raise exception 'Nombre, apellido y nombre para mostrar son obligatorios' using errcode = '22023';
    end if;

    insert into public.persons (
      first_name, middle_name, last_name, second_last_name, display_name, slug,
      person_type, gender, birth_date, birth_place, photo_url, photo_path,
      biography_public, notes_internal, status, visibility, created_by
    ) values (
      v_first_name,
      nullif(btrim(payload->>'middle_name'), ''),
      v_last_name,
      nullif(btrim(payload->>'second_last_name'), ''),
      v_display_name,
      v_slug,
      'priest',
      nullif(payload->>'gender', ''),
      nullif(payload->>'birth_date', '')::date,
      nullif(btrim(payload->>'birth_place'), ''),
      nullif(btrim(payload->>'photo_url'), ''),
      nullif(btrim(payload->>'photo_path'), ''),
      nullif(btrim(payload->>'biography_public'), ''),
      nullif(btrim(payload->>'notes_internal'), ''),
      'active',
      'public',
      v_user_id
    ) returning id, slug into v_person_id, v_slug;
  end if;

  insert into public.person_private_validation (
    person_id,
    internal_reference_code,
    validation_type,
    validation_value,
    validation_country,
    primary_phone,
    secondary_phone,
    contact_email,
    father_name,
    mother_name,
    family_notes,
    biography_notes,
    created_by
  ) values (
    v_person_id,
    public.generate_person_internal_code_for_type('priest'),
    nullif(payload->>'validation_type', ''),
    nullif(btrim(payload->>'validation_value'), ''),
    nullif(btrim(payload->>'validation_country'), ''),
    nullif(btrim(payload->>'primary_phone'), ''),
    nullif(btrim(payload->>'secondary_phone'), ''),
    nullif(btrim(payload->>'contact_email'), ''),
    nullif(btrim(payload->>'father_name'), ''),
    nullif(btrim(payload->>'mother_name'), ''),
    nullif(btrim(payload->>'family_notes'), ''),
    nullif(btrim(payload->>'biography_notes'), ''),
    v_user_id
  )
  on conflict (person_id) do update set
    validation_type = coalesce(excluded.validation_type, public.person_private_validation.validation_type),
    validation_value = coalesce(excluded.validation_value, public.person_private_validation.validation_value),
    validation_country = coalesce(excluded.validation_country, public.person_private_validation.validation_country),
    primary_phone = coalesce(excluded.primary_phone, public.person_private_validation.primary_phone),
    secondary_phone = coalesce(excluded.secondary_phone, public.person_private_validation.secondary_phone),
    contact_email = coalesce(excluded.contact_email, public.person_private_validation.contact_email),
    father_name = coalesce(excluded.father_name, public.person_private_validation.father_name),
    mother_name = coalesce(excluded.mother_name, public.person_private_validation.mother_name),
    family_notes = coalesce(excluded.family_notes, public.person_private_validation.family_notes),
    biography_notes = coalesce(excluded.biography_notes, public.person_private_validation.biography_notes),
    updated_at = now()
  returning internal_reference_code into v_internal_code;

  insert into public.clergy_profiles (
    person_id,
    incardination_entity_id,
    current_service_entity_id,
    diaconal_ordination_date,
    priestly_ordination_date,
    religious_order,
    canonical_status,
    notes_private
  ) values (
    v_person_id,
    nullif(payload->>'incardination_entity_id', '')::uuid,
    nullif(payload->>'current_service_entity_id', '')::uuid,
    nullif(payload->>'diaconal_ordination_date', '')::date,
    nullif(payload->>'priestly_ordination_date', '')::date,
    nullif(btrim(payload->>'religious_order'), ''),
    coalesce(nullif(payload->>'canonical_status', ''), 'active'),
    nullif(btrim(payload->>'clergy_notes'), '')
  )
  on conflict (person_id) do update set
    incardination_entity_id = coalesce(excluded.incardination_entity_id, public.clergy_profiles.incardination_entity_id),
    current_service_entity_id = coalesce(excluded.current_service_entity_id, public.clergy_profiles.current_service_entity_id),
    diaconal_ordination_date = coalesce(excluded.diaconal_ordination_date, public.clergy_profiles.diaconal_ordination_date),
    priestly_ordination_date = coalesce(excluded.priestly_ordination_date, public.clergy_profiles.priestly_ordination_date),
    religious_order = coalesce(excluded.religious_order, public.clergy_profiles.religious_order),
    canonical_status = coalesce(excluded.canonical_status, public.clergy_profiles.canonical_status),
    notes_private = concat_ws(E'\n', public.clergy_profiles.notes_private, excluded.notes_private),
    updated_at = now()
  returning id into v_clergy_profile_id;

  if v_office_configuration_id is not null then
    v_assignment_entity_id := coalesce(
      nullif(payload->>'quick_entity_id', '')::uuid,
      nullif(payload->>'current_service_entity_id', '')::uuid
    );

    select organization_chart_id into v_organization_chart_id
    from public.office_configurations
    where id = v_office_configuration_id;

    v_close_date := coalesce(v_start_date, current_date) - 1;

    select coalesce(array_agg(id order by created_at), '{}'::uuid[])
      into v_closed_assignment_ids
    from public.position_assignments
    where is_current = true
      and record_status = 'active'
      and office_configuration_id = v_office_configuration_id
      and organization_chart_id is not distinct from v_organization_chart_id
      and organization_unit_id is not distinct from null
      and ecclesiastical_entity_id is not distinct from v_assignment_entity_id
      and pastoral_entity_id is not distinct from null;

    if cardinality(v_closed_assignment_ids) > 0 then
      update public.position_assignments
      set is_current = false,
          assignment_status = case when assignment_status in ('active', 'term_expired_still_serving', 'vacant') then 'replaced' else assignment_status end,
          actual_end_date = coalesce(actual_end_date, v_close_date),
          updated_at = now()
      where id = any(v_closed_assignment_ids);
    end if;

    insert into public.position_assignments (
      person_id,
      office_configuration_id,
      organization_chart_id,
      ecclesiastical_entity_id,
      title_override,
      start_date,
      term_start_date,
      is_current,
      assignment_status,
      selection_method,
      notes_public,
      notes_internal,
      verification_status,
      visibility,
      record_status
    ) values (
      v_person_id,
      v_office_configuration_id,
      v_organization_chart_id,
      v_assignment_entity_id,
      nullif(btrim(payload->>'quick_title_override'), ''),
      v_start_date,
      v_start_date,
      true,
      'active',
      'appointment',
      nullif(btrim(payload->>'quick_notes_public'), ''),
      'Asignación creada desde asistente transaccional de sacerdote.',
      'pending_review',
      'public',
      'active'
    ) returning id into v_assignment_id;

    if cardinality(v_closed_assignment_ids) > 0 then
      update public.position_assignments
      set replaced_by_assignment_id = coalesce(replaced_by_assignment_id, v_assignment_id),
          successor_assignment_id = coalesce(successor_assignment_id, v_assignment_id),
          updated_at = now()
      where id = any(v_closed_assignment_ids);
    end if;
  end if;

  perform public.admin_mark_missing_fields(
    'persons',
    v_person_id,
    payload->'not_identified_fields',
    array['gender','birth_date','birth_place','biography_public'],
    'Marcado como no identificado desde el asistente transaccional de sacerdote.',
    v_user_id
  );

  perform public.admin_mark_missing_fields(
    'clergy_profiles',
    v_clergy_profile_id,
    payload->'not_identified_fields',
    array['priestly_ordination_date','incardination_entity_id','current_service_entity_id'],
    'Marcado como no identificado desde el asistente transaccional de sacerdote.',
    v_user_id
  );

  return jsonb_build_object(
    'person_id', v_person_id,
    'clergy_profile_id', v_clergy_profile_id,
    'assignment_id', v_assignment_id,
    'closed_previous_current_count', cardinality(v_closed_assignment_ids),
    'slug', v_slug,
    'internal_reference_code', v_internal_code
  );
end;
$$;
