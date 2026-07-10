create or replace function internal.admin_save_bishop(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, internal, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_mode text := coalesce(nullif(payload->>'mode',''), 'existing');
  v_person_id uuid := nullif(payload->>'selected_clergy_id','')::uuid;
  v_slug text;
  v_name text;
  v_first_name text;
  v_last_name text;
  v_profile_status text;
  v_priest_type text;
  v_religious_name text := nullif(btrim(payload->>'religious_order'), '');
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar obispos' using errcode='42501';
  end if;

  if v_mode not in ('existing','new') then
    raise exception 'Modo de registro inválido' using errcode='22023';
  end if;

  v_profile_status := case coalesce(nullif(payload->>'canonical_status',''), 'active')
    when 'restricted' then 'suspended'
    when 'lost_clerical_state' then 'inactive'
    else coalesce(nullif(payload->>'canonical_status',''), 'active')
  end;

  if v_profile_status not in ('active','retired','emeritus','deceased','suspended','inactive','unknown') then
    raise exception 'Estado canónico inválido' using errcode='22023';
  end if;

  if v_mode = 'existing' then
    if v_person_id is null then
      raise exception 'Falta seleccionar el sacerdote existente' using errcode='22023';
    end if;

    select p.slug
    into v_slug
    from public.persons p
    where p.id = v_person_id
      and p.status = 'active'
      and exists (
        select 1 from public.ordination_events oe
        where oe.person_id = p.id and oe.degree='presbyterate' and oe.record_status='active'
      )
      and not exists (
        select 1 from public.ordination_events oe
        where oe.person_id = p.id and oe.degree='episcopate' and oe.record_status='active'
      )
    for update;

    if not found then
      raise exception 'La persona seleccionada debe tener presbiterado activo y no poseer todavía episcopado' using errcode='22023';
    end if;
  else
    v_first_name := nullif(btrim(payload->>'first_name'), '');
    v_last_name := nullif(btrim(payload->>'last_name'), '');
    v_name := coalesce(
      nullif(btrim(payload->>'display_name'), ''),
      concat_ws(' ', v_first_name, nullif(btrim(payload->>'middle_name'), ''), v_last_name, nullif(btrim(payload->>'second_last_name'), ''))
    );
    v_slug := nullif(btrim(payload->>'slug'), '');
    v_slug := coalesce(v_slug, regexp_replace(lower(unaccent(v_name)), '[^a-z0-9]+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

    if v_first_name is null or v_last_name is null or v_name is null or v_slug is null then
      raise exception 'Nombre y apellido son obligatorios para registrar un obispo externo' using errcode='22023';
    end if;

    insert into public.persons (
      first_name, middle_name, last_name, second_last_name, display_name, slug,
      person_type, gender, birth_date, birth_place, biography_public,
      notes_internal, status, visibility, created_by
    ) values (
      v_first_name,
      nullif(btrim(payload->>'middle_name'), ''),
      v_last_name,
      nullif(btrim(payload->>'second_last_name'), ''),
      v_name,
      v_slug,
      'layperson',
      'male',
      nullif(payload->>'birth_date','')::date,
      nullif(btrim(payload->>'birth_place'), ''),
      nullif(btrim(payload->>'biography_public'), ''),
      'Obispo externo registrado con identidad única. Los grados del Orden se conservan en ordination_events.',
      'active',
      'public',
      v_user_id
    ) returning id, slug into v_person_id, v_slug;

    insert into public.person_private_validation (
      person_id, internal_reference_code, created_by, biography_notes
    ) values (
      v_person_id,
      public.generate_person_internal_code_for_type('bishop'),
      v_user_id,
      'Historial sacerdotal externo pendiente de completar cuando no se disponga de fechas.'
    ) on conflict (person_id) do nothing;
  end if;

  insert into public.ordination_events (
    person_id, degree, ordination_date, record_origin, notes_internal, created_by
  ) values (
    v_person_id,
    'presbyterate',
    nullif(payload->>'priestly_ordination_date','')::date,
    'bishop_wizard',
    'Presbiterado confirmado como antecedente del episcopado desde el asistente de obispo.',
    v_user_id
  )
  on conflict (person_id, degree) do update set
    ordination_date = coalesce(excluded.ordination_date, public.ordination_events.ordination_date),
    record_status = 'active',
    updated_at = now();

  v_priest_type := case when v_religious_name is null then 'diocesan' else 'religious' end;

  insert into public.clergy_profiles (
    person_id, incardination_entity_id, current_service_entity_id,
    priestly_ordination_date, episcopal_ordination_date, religious_order,
    canonical_status, notes_private, priest_type, religious_institute_name
  ) values (
    v_person_id,
    nullif(payload->>'incardination_entity_id','')::uuid,
    nullif(payload->>'assignment_entity_id','')::uuid,
    nullif(payload->>'priestly_ordination_date','')::date,
    nullif(payload->>'episcopal_ordination_date','')::date,
    v_religious_name,
    v_profile_status,
    case when v_mode='existing' then 'Episcopado agregado a una identidad clerical existente.' else 'Obispo externo registrado sin duplicar identidad.' end,
    v_priest_type,
    v_religious_name
  )
  on conflict (person_id) do update set
    incardination_entity_id = coalesce(excluded.incardination_entity_id, public.clergy_profiles.incardination_entity_id),
    current_service_entity_id = coalesce(excluded.current_service_entity_id, public.clergy_profiles.current_service_entity_id),
    priestly_ordination_date = coalesce(excluded.priestly_ordination_date, public.clergy_profiles.priestly_ordination_date),
    episcopal_ordination_date = coalesce(excluded.episcopal_ordination_date, public.clergy_profiles.episcopal_ordination_date),
    religious_order = coalesce(excluded.religious_order, public.clergy_profiles.religious_order),
    canonical_status = excluded.canonical_status,
    notes_private = concat_ws(E'\n', public.clergy_profiles.notes_private, excluded.notes_private),
    priest_type = coalesce(public.clergy_profiles.priest_type, excluded.priest_type),
    religious_institute_name = coalesce(public.clergy_profiles.religious_institute_name, excluded.religious_institute_name),
    updated_at = now();

  insert into public.episcopal_ordinations (
    bishop_person_id, ordination_date, ordination_place,
    principal_consecrator_person_id, co_consecrator_1_person_id, co_consecrator_2_person_id,
    principal_consecrator_name, co_consecrator_1_name, co_consecrator_2_name,
    source_name, source_url, source_checked_at, verification_status,
    visibility, status, notes_public, notes_internal, created_by
  ) values (
    v_person_id,
    nullif(payload->>'episcopal_ordination_date','')::date,
    nullif(btrim(payload->>'ordination_place'), ''),
    nullif(payload->>'principal_consecrator_person_id','')::uuid,
    nullif(payload->>'co_consecrator_1_person_id','')::uuid,
    nullif(payload->>'co_consecrator_2_person_id','')::uuid,
    nullif(btrim(payload->>'principal_consecrator_name'), ''),
    nullif(btrim(payload->>'co_consecrator_1_name'), ''),
    nullif(btrim(payload->>'co_consecrator_2_name'), ''),
    nullif(btrim(payload->>'source_name'), ''),
    nullif(btrim(payload->>'source_url'), ''),
    nullif(payload->>'source_checked_at','')::date,
    'pending_review',
    'public',
    'active',
    nullif(btrim(payload->>'ordination_notes_public'), ''),
    'Guardado desde el asistente transaccional de obispo con historial sacramental canónico.',
    v_user_id
  )
  on conflict (bishop_person_id) do update set
    ordination_date = coalesce(excluded.ordination_date, public.episcopal_ordinations.ordination_date),
    ordination_place = coalesce(excluded.ordination_place, public.episcopal_ordinations.ordination_place),
    principal_consecrator_person_id = coalesce(excluded.principal_consecrator_person_id, public.episcopal_ordinations.principal_consecrator_person_id),
    co_consecrator_1_person_id = coalesce(excluded.co_consecrator_1_person_id, public.episcopal_ordinations.co_consecrator_1_person_id),
    co_consecrator_2_person_id = coalesce(excluded.co_consecrator_2_person_id, public.episcopal_ordinations.co_consecrator_2_person_id),
    principal_consecrator_name = coalesce(excluded.principal_consecrator_name, public.episcopal_ordinations.principal_consecrator_name),
    co_consecrator_1_name = coalesce(excluded.co_consecrator_1_name, public.episcopal_ordinations.co_consecrator_1_name),
    co_consecrator_2_name = coalesce(excluded.co_consecrator_2_name, public.episcopal_ordinations.co_consecrator_2_name),
    source_name = coalesce(excluded.source_name, public.episcopal_ordinations.source_name),
    source_url = coalesce(excluded.source_url, public.episcopal_ordinations.source_url),
    source_checked_at = coalesce(excluded.source_checked_at, public.episcopal_ordinations.source_checked_at),
    notes_public = coalesce(excluded.notes_public, public.episcopal_ordinations.notes_public),
    status = 'active',
    visibility = 'public',
    updated_at = now();

  return jsonb_build_object('person_id',v_person_id,'slug',v_slug,'mode',v_mode);
end;
$$;

revoke all on function internal.admin_save_bishop(jsonb) from public, anon, authenticated;