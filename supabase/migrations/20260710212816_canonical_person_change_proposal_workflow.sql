create or replace function app_private.optional_iso_date(p_value text, p_field text)
returns date
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return p_value::date;
exception
  when others then
    raise exception 'Fecha inválida para %', p_field using errcode = '22007';
end;
$$;

create or replace function app_private.optional_uuid(p_value text, p_field text)
returns uuid
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return p_value::uuid;
exception
  when others then
    raise exception 'Identificador inválido para %', p_field using errcode = '22P02';
end;
$$;

create or replace function app_private.person_canonical_snapshot(p_person_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'schema_version', 2,
    'proposal_kind', 'canonical_person',
    'identity', jsonb_build_object(
      'display_name', p.display_name,
      'status', p.status,
      'birth_date', p.birth_date,
      'birth_place', p.birth_place,
      'death_date', p.death_date,
      'biography_public', p.biography_public
    ),
    'legacy_profile', jsonb_build_object(
      'priest_type', cp.priest_type,
      'deacon_type', cp.deacon_type
    ),
    'ordinations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'degree', oe.degree,
          'ordination_date', oe.ordination_date,
          'ordination_place', oe.ordination_place,
          'principal_ordainer_person_id', oe.principal_ordainer_person_id,
          'principal_ordainer_name', oe.principal_ordainer_name,
          'assistant_ordainer_1_person_id', oe.assistant_ordainer_1_person_id,
          'assistant_ordainer_1_name', oe.assistant_ordainer_1_name,
          'assistant_ordainer_2_person_id', oe.assistant_ordainer_2_person_id,
          'assistant_ordainer_2_name', oe.assistant_ordainer_2_name,
          'source_name', oe.source_name,
          'source_url', oe.source_url,
          'source_checked_at', oe.source_checked_at,
          'verification_status', oe.verification_status,
          'visibility', oe.visibility
        )
        order by case oe.degree when 'diaconate' then 1 when 'presbyterate' then 2 else 3 end
      )
      from public.ordination_events oe
      where oe.person_id = p.id and oe.record_status = 'active'
    ), '[]'::jsonb),
    'canonical_status', (
      select jsonb_build_object(
        'status_type', csh.status_type,
        'start_date', csh.start_date,
        'reason', csh.reason,
        'source_name', csh.source_name,
        'source_url', csh.source_url,
        'source_checked_at', csh.source_checked_at,
        'verification_status', csh.verification_status,
        'visibility', csh.visibility
      )
      from public.clerical_status_history csh
      where csh.person_id = p.id
        and csh.is_current = true
        and csh.record_status = 'active'
      order by csh.start_date desc nulls last, csh.created_at desc
      limit 1
    ),
    'incardination', (
      select jsonb_build_object(
        'incardination_entity_id', ci.incardination_entity_id,
        'institute_name', ci.institute_name,
        'incardination_kind', ci.incardination_kind,
        'acquisition_method', ci.acquisition_method,
        'start_date', ci.start_date,
        'source_name', ci.source_name,
        'source_url', ci.source_url,
        'source_checked_at', ci.source_checked_at,
        'verification_status', ci.verification_status,
        'visibility', ci.visibility
      )
      from public.clerical_incardinations ci
      where ci.person_id = p.id
        and ci.is_current = true
        and ci.record_status = 'active'
      order by ci.start_date desc nulls last, ci.created_at desc
      limit 1
    ),
    'religious_life', (
      select jsonb_build_object(
        'religious_life_type', rp.religious_life_type,
        'community_name', rp.community_name,
        'province_name', rp.province_name,
        'profession_date', rp.profession_date,
        'canonical_status', rp.canonical_status
      )
      from public.religious_profiles rp
      where rp.person_id = p.id
      limit 1
    ),
    'episcopal_roles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'role_type', er.role_type,
          'jurisdiction_entity_id', er.jurisdiction_entity_id,
          'title_see_name', er.title_see_name,
          'start_date', er.start_date,
          'has_right_of_succession', er.has_right_of_succession,
          'source_name', er.source_name,
          'source_url', er.source_url,
          'source_checked_at', er.source_checked_at,
          'verification_status', er.verification_status,
          'visibility', er.visibility
        )
        order by er.start_date desc nulls last, er.created_at desc
      )
      from public.episcopal_roles er
      where er.person_id = p.id
        and er.is_current = true
        and er.record_status = 'active'
    ), '[]'::jsonb),
    'dignities', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'dignity_type', ped.dignity_type,
          'title_text', ped.title_text,
          'start_date', ped.start_date,
          'source_name', ped.source_name,
          'source_url', ped.source_url,
          'source_checked_at', ped.source_checked_at,
          'verification_status', ped.verification_status,
          'visibility', ped.visibility
        )
        order by ped.start_date desc nulls last, ped.created_at desc
      )
      from public.person_ecclesiastical_dignities ped
      where ped.person_id = p.id
        and ped.is_current = true
        and ped.record_status = 'active'
    ), '[]'::jsonb)
  )
  from public.persons p
  left join public.clergy_profiles cp on cp.person_id = p.id
  where p.id = p_person_id;
$$;

create or replace function app_private.apply_person_canonical_proposal(
  p_person_id uuid,
  p_payload jsonb,
  p_user_id uuid,
  p_change_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, app_private, pg_temp
as $$
declare
  v_identity jsonb := coalesce(p_payload -> 'identity', '{}'::jsonb);
  v_legacy_profile jsonb := coalesce(p_payload -> 'legacy_profile', '{}'::jsonb);
  v_status jsonb := coalesce(p_payload -> 'canonical_status', '{}'::jsonb);
  v_incardination jsonb := coalesce(p_payload -> 'incardination', '{}'::jsonb);
  v_religious jsonb := coalesce(p_payload -> 'religious_life', '{}'::jsonb);
  v_episcopal jsonb := coalesce(p_payload -> 'episcopal_role', '{}'::jsonb);
  v_item jsonb;
  v_mode text;
  v_start_date date;
  v_end_date date;
  v_entity_id uuid;
  v_current_profile_exists boolean;
begin
  update public.persons
  set display_name = case when v_identity ? 'display_name' then nullif(btrim(v_identity ->> 'display_name'), '') else display_name end,
      status = case when v_identity ? 'status' then coalesce(nullif(v_identity ->> 'status', ''), 'unknown') else status end,
      birth_date = case when v_identity ? 'birth_date' then app_private.optional_iso_date(v_identity ->> 'birth_date', 'identity.birth_date') else birth_date end,
      birth_place = case when v_identity ? 'birth_place' then nullif(btrim(v_identity ->> 'birth_place'), '') else birth_place end,
      death_date = case when v_identity ? 'death_date' then app_private.optional_iso_date(v_identity ->> 'death_date', 'identity.death_date') else death_date end,
      biography_public = case when v_identity ? 'biography_public' then nullif(btrim(v_identity ->> 'biography_public'), '') else biography_public end,
      updated_at = now()
  where id = p_person_id;

  if not found then
    raise exception 'Persona no encontrada' using errcode = 'P0002';
  end if;

  if v_legacy_profile <> '{}'::jsonb then
    insert into public.clergy_profiles (person_id, priest_type, deacon_type, canonical_status)
    values (
      p_person_id,
      nullif(v_legacy_profile ->> 'priest_type', ''),
      nullif(v_legacy_profile ->> 'deacon_type', ''),
      'active'
    )
    on conflict (person_id) do update
    set priest_type = case when v_legacy_profile ? 'priest_type' then nullif(v_legacy_profile ->> 'priest_type', '') else public.clergy_profiles.priest_type end,
        deacon_type = case when v_legacy_profile ? 'deacon_type' then nullif(v_legacy_profile ->> 'deacon_type', '') else public.clergy_profiles.deacon_type end,
        updated_at = now();
  end if;

  if jsonb_typeof(p_payload -> 'ordinations') = 'array' then
    for v_item in select value from jsonb_array_elements(p_payload -> 'ordinations')
    loop
      if coalesce(v_item ->> 'mode', 'set') <> 'set' then
        continue;
      end if;

      insert into public.clergy_profiles (person_id, canonical_status)
      values (p_person_id, 'active')
      on conflict (person_id) do nothing;

      insert into public.ordination_events (
        person_id, degree, ordination_date, ordination_place,
        principal_ordainer_person_id, assistant_ordainer_1_person_id, assistant_ordainer_2_person_id,
        principal_ordainer_name, assistant_ordainer_1_name, assistant_ordainer_2_name,
        source_name, source_url, source_checked_at, verification_status, visibility,
        record_status, record_origin, notes_internal, created_by
      ) values (
        p_person_id,
        v_item ->> 'degree',
        app_private.optional_iso_date(v_item ->> 'ordination_date', 'ordinations.ordination_date'),
        nullif(btrim(v_item ->> 'ordination_place'), ''),
        app_private.optional_uuid(v_item ->> 'principal_ordainer_person_id', 'ordinations.principal_ordainer_person_id'),
        app_private.optional_uuid(v_item ->> 'assistant_ordainer_1_person_id', 'ordinations.assistant_ordainer_1_person_id'),
        app_private.optional_uuid(v_item ->> 'assistant_ordainer_2_person_id', 'ordinations.assistant_ordainer_2_person_id'),
        nullif(btrim(v_item ->> 'principal_ordainer_name'), ''),
        nullif(btrim(v_item ->> 'assistant_ordainer_1_name'), ''),
        nullif(btrim(v_item ->> 'assistant_ordainer_2_name'), ''),
        nullif(btrim(v_item ->> 'source_name'), ''),
        nullif(btrim(v_item ->> 'source_url'), ''),
        app_private.optional_iso_date(v_item ->> 'source_checked_at', 'ordinations.source_checked_at'),
        coalesce(nullif(v_item ->> 'verification_status', ''), 'pending_review'),
        coalesce(nullif(v_item ->> 'visibility', ''), 'internal'),
        'active',
        'approved_change_request',
        'Actualizado mediante solicitud aprobada ' || p_change_request_id::text || '.',
        p_user_id
      )
      on conflict (person_id, degree) do update
      set ordination_date = excluded.ordination_date,
          ordination_place = excluded.ordination_place,
          principal_ordainer_person_id = excluded.principal_ordainer_person_id,
          assistant_ordainer_1_person_id = excluded.assistant_ordainer_1_person_id,
          assistant_ordainer_2_person_id = excluded.assistant_ordainer_2_person_id,
          principal_ordainer_name = excluded.principal_ordainer_name,
          assistant_ordainer_1_name = excluded.assistant_ordainer_1_name,
          assistant_ordainer_2_name = excluded.assistant_ordainer_2_name,
          source_name = excluded.source_name,
          source_url = excluded.source_url,
          source_checked_at = excluded.source_checked_at,
          verification_status = excluded.verification_status,
          visibility = excluded.visibility,
          record_status = 'active',
          record_origin = 'approved_change_request',
          notes_internal = concat_ws(E'\n', public.ordination_events.notes_internal, excluded.notes_internal),
          updated_at = now();
    end loop;
  end if;

  v_mode := coalesce(v_status ->> 'mode', 'keep');
  if v_mode = 'set' then
    insert into public.clergy_profiles (person_id, canonical_status)
    values (p_person_id, 'active')
    on conflict (person_id) do nothing;

    insert into public.clerical_status_history (
      person_id, status_type, start_date, is_current, reason,
      source_name, source_url, source_checked_at, verification_status, visibility,
      record_status, record_origin, notes_internal, created_by
    ) values (
      p_person_id,
      v_status ->> 'status_type',
      app_private.optional_iso_date(v_status ->> 'start_date', 'canonical_status.start_date'),
      true,
      nullif(btrim(v_status ->> 'reason'), ''),
      nullif(btrim(v_status ->> 'source_name'), ''),
      nullif(btrim(v_status ->> 'source_url'), ''),
      app_private.optional_iso_date(v_status ->> 'source_checked_at', 'canonical_status.source_checked_at'),
      coalesce(nullif(v_status ->> 'verification_status', ''), 'pending_review'),
      coalesce(nullif(v_status ->> 'visibility', ''), 'internal'),
      'active',
      'approved_change_request',
      'Registrado mediante solicitud aprobada ' || p_change_request_id::text || '.',
      p_user_id
    );
  elsif v_mode = 'close' then
    v_end_date := coalesce(app_private.optional_iso_date(v_status ->> 'end_date', 'canonical_status.end_date'), current_date);
    update public.clerical_status_history
    set is_current = false,
        end_date = coalesce(end_date, v_end_date),
        reason = coalesce(nullif(btrim(v_status ->> 'reason'), ''), reason),
        notes_internal = concat_ws(E'\n', notes_internal, 'Cerrado mediante solicitud aprobada ' || p_change_request_id::text || '.'),
        updated_at = now()
    where person_id = p_person_id and is_current = true and record_status = 'active';
  end if;

  v_mode := coalesce(v_incardination ->> 'mode', 'keep');
  if v_mode = 'set' then
    v_entity_id := app_private.optional_uuid(v_incardination ->> 'incardination_entity_id', 'incardination.incardination_entity_id');
    insert into public.clergy_profiles (person_id, canonical_status)
    values (p_person_id, 'active')
    on conflict (person_id) do nothing;

    insert into public.clerical_incardinations (
      person_id, incardination_entity_id, institute_name, incardination_kind,
      acquisition_method, start_date, is_current, source_name, source_url,
      source_checked_at, verification_status, visibility, record_status,
      record_origin, notes_internal, created_by
    ) values (
      p_person_id,
      v_entity_id,
      nullif(btrim(v_incardination ->> 'institute_name'), ''),
      v_incardination ->> 'incardination_kind',
      coalesce(nullif(v_incardination ->> 'acquisition_method', ''), 'unknown'),
      app_private.optional_iso_date(v_incardination ->> 'start_date', 'incardination.start_date'),
      true,
      nullif(btrim(v_incardination ->> 'source_name'), ''),
      nullif(btrim(v_incardination ->> 'source_url'), ''),
      app_private.optional_iso_date(v_incardination ->> 'source_checked_at', 'incardination.source_checked_at'),
      coalesce(nullif(v_incardination ->> 'verification_status', ''), 'pending_review'),
      coalesce(nullif(v_incardination ->> 'visibility', ''), 'internal'),
      'active',
      'approved_change_request',
      'Registrado mediante solicitud aprobada ' || p_change_request_id::text || '.',
      p_user_id
    );
  elsif v_mode = 'close' then
    v_end_date := coalesce(app_private.optional_iso_date(v_incardination ->> 'end_date', 'incardination.end_date'), current_date);
    update public.clerical_incardinations
    set is_current = false,
        end_date = coalesce(end_date, v_end_date),
        end_reason = coalesce(nullif(v_incardination ->> 'end_reason', ''), 'cessation'),
        notes_internal = concat_ws(E'\n', notes_internal, 'Cerrada mediante solicitud aprobada ' || p_change_request_id::text || '.'),
        updated_at = now()
    where person_id = p_person_id and is_current = true and record_status = 'active';
  end if;

  v_mode := coalesce(v_religious ->> 'mode', 'keep');
  if v_mode = 'set' then
    insert into public.religious_profiles (
      person_id, religious_life_type, community_name, province_name,
      profession_date, canonical_status, created_by
    ) values (
      p_person_id,
      v_religious ->> 'religious_life_type',
      nullif(btrim(v_religious ->> 'community_name'), ''),
      nullif(btrim(v_religious ->> 'province_name'), ''),
      app_private.optional_iso_date(v_religious ->> 'profession_date', 'religious_life.profession_date'),
      coalesce(nullif(v_religious ->> 'canonical_status', ''), 'active'),
      p_user_id
    )
    on conflict (person_id) do update
    set religious_life_type = excluded.religious_life_type,
        community_name = excluded.community_name,
        province_name = excluded.province_name,
        profession_date = excluded.profession_date,
        canonical_status = excluded.canonical_status,
        updated_at = now();

    select exists(select 1 from public.clergy_profiles cp where cp.person_id = p_person_id)
      into v_current_profile_exists;
    if v_current_profile_exists then
      update public.clergy_profiles
      set priest_type = case when priest_type is not null then 'religious' else priest_type end,
          religious_institute_name = coalesce(nullif(btrim(v_religious ->> 'community_name'), ''), religious_institute_name),
          updated_at = now()
      where person_id = p_person_id;
    end if;
  end if;

  v_mode := coalesce(v_episcopal ->> 'mode', 'keep');
  if v_mode = 'close_all' then
    v_end_date := coalesce(app_private.optional_iso_date(v_episcopal ->> 'end_date', 'episcopal_role.end_date'), current_date);
    update public.episcopal_roles
    set is_current = false,
        end_date = coalesce(end_date, v_end_date),
        notes_internal = concat_ws(E'\n', notes_internal, 'Cerrada mediante solicitud aprobada ' || p_change_request_id::text || '.'),
        updated_at = now()
    where person_id = p_person_id and is_current = true and record_status = 'active';
  elsif v_mode = 'set' then
    v_entity_id := app_private.optional_uuid(v_episcopal ->> 'jurisdiction_entity_id', 'episcopal_role.jurisdiction_entity_id');
    v_start_date := app_private.optional_iso_date(v_episcopal ->> 'start_date', 'episcopal_role.start_date');

    update public.episcopal_roles
    set is_current = false,
        end_date = coalesce(end_date, case when v_start_date is not null then v_start_date - 1 else current_date end),
        notes_internal = concat_ws(E'\n', notes_internal, 'Sustituida mediante solicitud aprobada ' || p_change_request_id::text || '.'),
        updated_at = now()
    where person_id = p_person_id
      and role_type = v_episcopal ->> 'role_type'
      and coalesce(jurisdiction_entity_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_entity_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and is_current = true and record_status = 'active';

    insert into public.episcopal_roles (
      person_id, role_type, jurisdiction_entity_id, title_see_name, start_date,
      is_current, has_right_of_succession, source_name, source_url,
      source_checked_at, verification_status, visibility, record_status,
      record_origin, notes_internal, created_by
    ) values (
      p_person_id,
      v_episcopal ->> 'role_type',
      v_entity_id,
      nullif(btrim(v_episcopal ->> 'title_see_name'), ''),
      v_start_date,
      true,
      case when v_episcopal ->> 'role_type' = 'coadjutor' then true else coalesce((v_episcopal ->> 'has_right_of_succession')::boolean, false) end,
      nullif(btrim(v_episcopal ->> 'source_name'), ''),
      nullif(btrim(v_episcopal ->> 'source_url'), ''),
      app_private.optional_iso_date(v_episcopal ->> 'source_checked_at', 'episcopal_role.source_checked_at'),
      coalesce(nullif(v_episcopal ->> 'verification_status', ''), 'pending_review'),
      coalesce(nullif(v_episcopal ->> 'visibility', ''), 'public'),
      'active',
      'approved_change_request',
      'Registrada mediante solicitud aprobada ' || p_change_request_id::text || '.',
      p_user_id
    );
  end if;

  if jsonb_typeof(p_payload -> 'dignities') = 'array' then
    for v_item in select value from jsonb_array_elements(p_payload -> 'dignities')
    loop
      v_mode := coalesce(v_item ->> 'mode', 'keep');
      if v_mode = 'close' then
        v_end_date := coalesce(app_private.optional_iso_date(v_item ->> 'end_date', 'dignities.end_date'), current_date);
        update public.person_ecclesiastical_dignities
        set is_current = false,
            end_date = coalesce(end_date, v_end_date),
            notes_internal = concat_ws(E'\n', notes_internal, 'Cerrada mediante solicitud aprobada ' || p_change_request_id::text || '.'),
            updated_at = now()
        where person_id = p_person_id and dignity_type = v_item ->> 'dignity_type' and is_current = true and record_status = 'active';
      elsif v_mode = 'set' then
        v_start_date := app_private.optional_iso_date(v_item ->> 'start_date', 'dignities.start_date');
        update public.person_ecclesiastical_dignities
        set is_current = false,
            end_date = coalesce(end_date, case when v_start_date is not null then v_start_date - 1 else current_date end),
            notes_internal = concat_ws(E'\n', notes_internal, 'Sustituida mediante solicitud aprobada ' || p_change_request_id::text || '.'),
            updated_at = now()
        where person_id = p_person_id and dignity_type = v_item ->> 'dignity_type' and is_current = true and record_status = 'active';

        insert into public.person_ecclesiastical_dignities (
          person_id, dignity_type, title_text, start_date, is_current,
          source_name, source_url, source_checked_at, verification_status,
          visibility, record_status, record_origin, notes_internal, created_by
        ) values (
          p_person_id,
          v_item ->> 'dignity_type',
          nullif(btrim(v_item ->> 'title_text'), ''),
          v_start_date,
          true,
          nullif(btrim(v_item ->> 'source_name'), ''),
          nullif(btrim(v_item ->> 'source_url'), ''),
          app_private.optional_iso_date(v_item ->> 'source_checked_at', 'dignities.source_checked_at'),
          coalesce(nullif(v_item ->> 'verification_status', ''), 'pending_review'),
          coalesce(nullif(v_item ->> 'visibility', ''), 'public'),
          'active',
          'approved_change_request',
          'Registrada mediante solicitud aprobada ' || p_change_request_id::text || '.',
          p_user_id
        );
      end if;
    end loop;
  end if;
end;
$$;

create or replace function app_private.admin_create_person_change_proposal(
  p_person_id uuid,
  p_proposed_data jsonb,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, app_private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_person record;
  v_current_entity_id uuid;
  v_current_pastoral_entity_id uuid;
  v_can_update boolean := false;
  v_title text;
  v_change_id uuid;
  v_allowed jsonb;
  v_identity jsonb;
  v_legacy_profile jsonb;
  v_item jsonb;
  v_mode text;
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select p.id, p.display_name, p.status, p.visibility,
         cp.current_service_entity_id, cp.incardination_entity_id, cp.religious_house_entity_id
  into v_person
  from public.persons p
  left join public.clergy_profiles cp on cp.person_id = p.id
  where p.id = p_person_id
    and (p.status is null or p.status not in ('deleted', 'archived'))
    and (p.visibility is null or p.visibility <> 'private')
  limit 1;

  if v_person.id is null then
    raise exception 'Persona no encontrada o no visible' using errcode = 'P0002';
  end if;

  select a.entity_id, a.pastoral_entity_id
  into v_current_entity_id, v_current_pastoral_entity_id
  from public.appointments a
  where a.person_id = p_person_id
    and a.status = 'active'
    and a.is_current = true
    and (a.visibility is null or a.visibility <> 'private')
  order by a.start_date desc nulls last, a.created_at desc
  limit 1;

  select coalesce(v_current_entity_id, v_person.current_service_entity_id, pcs.incardination_entity_id),
         coalesce(v_current_pastoral_entity_id, v_person.religious_house_entity_id)
  into v_current_entity_id, v_current_pastoral_entity_id
  from public.person_current_clerical_state pcs
  where pcs.id = p_person_id;

  v_current_entity_id := coalesce(v_current_entity_id, v_person.current_service_entity_id, v_person.incardination_entity_id);
  v_current_pastoral_entity_id := coalesce(v_current_pastoral_entity_id, v_person.religious_house_entity_id);

  v_can_update :=
    app_private.current_user_can('people.update_proposal', 'national')
    or app_private.current_user_can('people.update_proposal', 'diocese', v_current_entity_id)
    or app_private.current_user_can('people.update_proposal', 'parish', v_current_entity_id)
    or app_private.current_user_can('people.update_proposal', 'parish', v_person.incardination_entity_id)
    or app_private.current_user_can('people.update_proposal', 'pastoral_entity', v_current_pastoral_entity_id);

  if not v_can_update then
    raise exception 'No autorizado para proponer cambios sobre esta persona' using errcode = '42501';
  end if;

  if coalesce(p_proposed_data ->> 'schema_version', '') = '2'
     or p_proposed_data ->> 'proposal_kind' = 'canonical_person' then
    if jsonb_typeof(coalesce(p_proposed_data -> 'identity', '{}'::jsonb)) <> 'object' then
      raise exception 'identity debe ser un objeto' using errcode = '22023';
    end if;

    v_identity := jsonb_strip_nulls(jsonb_build_object(
      'display_name', p_proposed_data #>> '{identity,display_name}',
      'status', p_proposed_data #>> '{identity,status}',
      'birth_date', p_proposed_data #>> '{identity,birth_date}',
      'birth_place', p_proposed_data #>> '{identity,birth_place}',
      'death_date', p_proposed_data #>> '{identity,death_date}',
      'biography_public', p_proposed_data #>> '{identity,biography_public}'
    ));

    if v_identity ? 'status'
       and nullif(v_identity ->> 'status', '') is not null
       and v_identity ->> 'status' not in ('active','retired','emeritus','deceased','transferred','inactive','suspended','unknown','archived') then
      raise exception 'Estado personal inválido' using errcode = '22023';
    end if;

    perform app_private.optional_iso_date(v_identity ->> 'birth_date', 'identity.birth_date');
    perform app_private.optional_iso_date(v_identity ->> 'death_date', 'identity.death_date');

    v_legacy_profile := jsonb_strip_nulls(jsonb_build_object(
      'priest_type', p_proposed_data #>> '{legacy_profile,priest_type}',
      'deacon_type', p_proposed_data #>> '{legacy_profile,deacon_type}'
    ));

    if v_legacy_profile ? 'priest_type'
       and nullif(v_legacy_profile ->> 'priest_type', '') is not null
       and v_legacy_profile ->> 'priest_type' not in ('diocesan','religious') then
      raise exception 'Tipo de sacerdote inválido' using errcode = '22023';
    end if;

    if v_legacy_profile ? 'deacon_type'
       and nullif(v_legacy_profile ->> 'deacon_type', '') is not null
       and v_legacy_profile ->> 'deacon_type' not in ('permanent','transitional','external') then
      raise exception 'Tipo de diácono inválido' using errcode = '22023';
    end if;

    if p_proposed_data ? 'ordinations'
       and jsonb_typeof(p_proposed_data -> 'ordinations') <> 'array' then
      raise exception 'ordinations debe ser una lista' using errcode = '22023';
    end if;

    for v_item in
      select value from jsonb_array_elements(coalesce(p_proposed_data -> 'ordinations', '[]'::jsonb))
    loop
      if coalesce(v_item ->> 'mode', 'set') not in ('keep','set') then
        raise exception 'Modo de ordenación inválido' using errcode = '22023';
      end if;
      if coalesce(v_item ->> 'mode', 'set') = 'set'
         and v_item ->> 'degree' not in ('diaconate','presbyterate','episcopate') then
        raise exception 'Grado del Orden inválido' using errcode = '22023';
      end if;
      perform app_private.optional_iso_date(v_item ->> 'ordination_date', 'ordinations.ordination_date');
      perform app_private.optional_iso_date(v_item ->> 'source_checked_at', 'ordinations.source_checked_at');
      perform app_private.optional_uuid(v_item ->> 'principal_ordainer_person_id', 'ordinations.principal_ordainer_person_id');
      perform app_private.optional_uuid(v_item ->> 'assistant_ordainer_1_person_id', 'ordinations.assistant_ordainer_1_person_id');
      perform app_private.optional_uuid(v_item ->> 'assistant_ordainer_2_person_id', 'ordinations.assistant_ordainer_2_person_id');
      if nullif(v_item ->> 'verification_status', '') is not null
         and v_item ->> 'verification_status' not in ('pending_review','verified','rejected','disputed') then
        raise exception 'Verificación de ordenación inválida' using errcode = '22023';
      end if;
      if nullif(v_item ->> 'visibility', '') is not null
         and v_item ->> 'visibility' not in ('public','internal','private','confidential') then
        raise exception 'Visibilidad de ordenación inválida' using errcode = '22023';
      end if;
    end loop;

    if p_proposed_data ? 'canonical_status' then
      if jsonb_typeof(p_proposed_data -> 'canonical_status') <> 'object' then
        raise exception 'canonical_status debe ser un objeto' using errcode = '22023';
      end if;
      v_mode := coalesce(p_proposed_data #>> '{canonical_status,mode}', 'keep');
      if v_mode not in ('keep','set','close') then
        raise exception 'Modo de estado canónico inválido' using errcode = '22023';
      end if;
      if v_mode = 'set'
         and p_proposed_data #>> '{canonical_status,status_type}' not in ('active','retired','emeritus','suspended','restricted','inactive','deceased','lost_clerical_state','unknown') then
        raise exception 'Estado canónico inválido' using errcode = '22023';
      end if;
      perform app_private.optional_iso_date(p_proposed_data #>> '{canonical_status,start_date}', 'canonical_status.start_date');
      perform app_private.optional_iso_date(p_proposed_data #>> '{canonical_status,end_date}', 'canonical_status.end_date');
      perform app_private.optional_iso_date(p_proposed_data #>> '{canonical_status,source_checked_at}', 'canonical_status.source_checked_at');
    end if;

    if p_proposed_data ? 'incardination' then
      if jsonb_typeof(p_proposed_data -> 'incardination') <> 'object' then
        raise exception 'incardination debe ser un objeto' using errcode = '22023';
      end if;
      v_mode := coalesce(p_proposed_data #>> '{incardination,mode}', 'keep');
      if v_mode not in ('keep','set','close') then
        raise exception 'Modo de incardinación inválido' using errcode = '22023';
      end if;
      if v_mode = 'set' then
        if p_proposed_data #>> '{incardination,incardination_kind}' not in ('diocesan','religious_institute','society_apostolic_life','personal_prelature','military_ordinariate','other','unknown') then
          raise exception 'Tipo de incardinación inválido' using errcode = '22023';
        end if;
        if nullif(p_proposed_data #>> '{incardination,incardination_entity_id}', '') is null
           and nullif(btrim(p_proposed_data #>> '{incardination,institute_name}'), '') is null then
          raise exception 'La incardinación requiere entidad o instituto' using errcode = '22023';
        end if;
      end if;
      if nullif(p_proposed_data #>> '{incardination,acquisition_method}', '') is not null
         and p_proposed_data #>> '{incardination,acquisition_method}' not in ('ordination','incardination','transfer','profession','reception','unknown') then
        raise exception 'Método de incardinación inválido' using errcode = '22023';
      end if;
      if nullif(p_proposed_data #>> '{incardination,end_reason}', '') is not null
         and p_proposed_data #>> '{incardination,end_reason}' not in ('excardination','transfer','death','lost_clerical_state','cessation','unknown') then
        raise exception 'Motivo de cierre de incardinación inválido' using errcode = '22023';
      end if;
      perform app_private.optional_uuid(p_proposed_data #>> '{incardination,incardination_entity_id}', 'incardination.incardination_entity_id');
      perform app_private.optional_iso_date(p_proposed_data #>> '{incardination,start_date}', 'incardination.start_date');
      perform app_private.optional_iso_date(p_proposed_data #>> '{incardination,end_date}', 'incardination.end_date');
      perform app_private.optional_iso_date(p_proposed_data #>> '{incardination,source_checked_at}', 'incardination.source_checked_at');
    end if;

    if p_proposed_data ? 'religious_life' then
      if jsonb_typeof(p_proposed_data -> 'religious_life') <> 'object' then
        raise exception 'religious_life debe ser un objeto' using errcode = '22023';
      end if;
      v_mode := coalesce(p_proposed_data #>> '{religious_life,mode}', 'keep');
      if v_mode not in ('keep','set') then
        raise exception 'Modo de vida consagrada inválido' using errcode = '22023';
      end if;
      if v_mode = 'set'
         and p_proposed_data #>> '{religious_life,religious_life_type}' not in ('brother','sister','consecrated_lay','other') then
        raise exception 'Tipo de vida consagrada inválido' using errcode = '22023';
      end if;
      if nullif(p_proposed_data #>> '{religious_life,canonical_status}', '') is not null
         and p_proposed_data #>> '{religious_life,canonical_status}' not in ('active','retired','transferred','deceased','unknown') then
        raise exception 'Estado de vida consagrada inválido' using errcode = '22023';
      end if;
      perform app_private.optional_iso_date(p_proposed_data #>> '{religious_life,profession_date}', 'religious_life.profession_date');
    end if;

    if p_proposed_data ? 'episcopal_role' then
      if jsonb_typeof(p_proposed_data -> 'episcopal_role') <> 'object' then
        raise exception 'episcopal_role debe ser un objeto' using errcode = '22023';
      end if;
      v_mode := coalesce(p_proposed_data #>> '{episcopal_role,mode}', 'keep');
      if v_mode not in ('keep','set','close_all') then
        raise exception 'Modo de función episcopal inválido' using errcode = '22023';
      end if;
      if v_mode = 'set'
         and p_proposed_data #>> '{episcopal_role,role_type}' not in ('diocesan','auxiliary','coadjutor','titular','emeritus','apostolic_administrator','apostolic_vicar','apostolic_prefect','other') then
        raise exception 'Función episcopal inválida' using errcode = '22023';
      end if;
      perform app_private.optional_uuid(p_proposed_data #>> '{episcopal_role,jurisdiction_entity_id}', 'episcopal_role.jurisdiction_entity_id');
      perform app_private.optional_iso_date(p_proposed_data #>> '{episcopal_role,start_date}', 'episcopal_role.start_date');
      perform app_private.optional_iso_date(p_proposed_data #>> '{episcopal_role,end_date}', 'episcopal_role.end_date');
      perform app_private.optional_iso_date(p_proposed_data #>> '{episcopal_role,source_checked_at}', 'episcopal_role.source_checked_at');
    end if;

    if p_proposed_data ? 'dignities'
       and jsonb_typeof(p_proposed_data -> 'dignities') <> 'array' then
      raise exception 'dignities debe ser una lista' using errcode = '22023';
    end if;

    for v_item in
      select value from jsonb_array_elements(coalesce(p_proposed_data -> 'dignities', '[]'::jsonb))
    loop
      v_mode := coalesce(v_item ->> 'mode', 'keep');
      if v_mode not in ('keep','set','close') then
        raise exception 'Modo de dignidad inválido' using errcode = '22023';
      end if;
      if v_mode <> 'keep'
         and v_item ->> 'dignity_type' not in ('archbishop','metropolitan','cardinal','monsignor','patriarch','major_archbishop','other') then
        raise exception 'Dignidad inválida' using errcode = '22023';
      end if;
      perform app_private.optional_iso_date(v_item ->> 'start_date', 'dignities.start_date');
      perform app_private.optional_iso_date(v_item ->> 'end_date', 'dignities.end_date');
      perform app_private.optional_iso_date(v_item ->> 'source_checked_at', 'dignities.source_checked_at');
    end loop;

    v_allowed := jsonb_build_object(
      'schema_version', 2,
      'proposal_kind', 'canonical_person',
      'identity', v_identity,
      'legacy_profile', v_legacy_profile,
      'ordinations', coalesce(p_proposed_data -> 'ordinations', '[]'::jsonb),
      'canonical_status', coalesce(p_proposed_data -> 'canonical_status', jsonb_build_object('mode','keep')),
      'incardination', coalesce(p_proposed_data -> 'incardination', jsonb_build_object('mode','keep')),
      'religious_life', coalesce(p_proposed_data -> 'religious_life', jsonb_build_object('mode','keep')),
      'episcopal_role', coalesce(p_proposed_data -> 'episcopal_role', jsonb_build_object('mode','keep')),
      'dignities', coalesce(p_proposed_data -> 'dignities', '[]'::jsonb)
    );
  else
    v_identity := jsonb_strip_nulls(jsonb_build_object(
      'display_name', nullif(p_proposed_data ->> 'display_name', ''),
      'status', nullif(p_proposed_data ->> 'status', ''),
      'birth_date', p_proposed_data ->> 'birth_date',
      'birth_place', p_proposed_data ->> 'birth_place',
      'death_date', p_proposed_data ->> 'death_date',
      'biography_public', p_proposed_data ->> 'biography_public'
    ));
    v_legacy_profile := jsonb_strip_nulls(jsonb_build_object(
      'priest_type', p_proposed_data ->> 'priest_type',
      'deacon_type', p_proposed_data ->> 'deacon_type'
    ));
    v_allowed := jsonb_build_object(
      'schema_version', 2,
      'proposal_kind', 'canonical_person',
      'identity', v_identity,
      'legacy_profile', v_legacy_profile,
      'ordinations', '[]'::jsonb,
      'canonical_status', case
        when nullif(p_proposed_data ->> 'canonical_status', '') is not null
          then jsonb_build_object('mode','set','status_type',p_proposed_data ->> 'canonical_status')
        else jsonb_build_object('mode','keep')
      end,
      'incardination', jsonb_build_object('mode','keep'),
      'religious_life', case
        when nullif(p_proposed_data ->> 'religious_institute_name', '') is not null
          then jsonb_build_object(
            'mode','set',
            'religious_life_type','other',
            'community_name',p_proposed_data ->> 'religious_institute_name',
            'canonical_status','active'
          )
        else jsonb_build_object('mode','keep')
      end,
      'episcopal_role', jsonb_build_object('mode','keep'),
      'dignities', '[]'::jsonb
    );
  end if;

  if coalesce(nullif(btrim(p_description), ''), '') = '' then
    raise exception 'La justificación o fuente es obligatoria' using errcode = '22023';
  end if;

  v_title := 'Cambio canónico propuesto para ' || coalesce(v_person.display_name, 'persona sin nombre');

  insert into public.change_requests (
    target_table,
    target_id,
    action_type,
    title,
    description,
    original_data,
    proposed_data,
    status,
    created_by,
    submitted_by,
    submitted_at,
    scope_type,
    scope_entity_id,
    pastoral_entity_id,
    priority,
    current_step
  ) values (
    'persons',
    p_person_id,
    'update',
    v_title,
    nullif(btrim(p_description), ''),
    app_private.person_canonical_snapshot(p_person_id),
    v_allowed,
    'pending_review',
    v_user_id,
    v_user_id,
    now(),
    case
      when v_current_pastoral_entity_id is not null then 'pastoral_entity'
      when v_current_entity_id is not null then 'parish'
      else 'person'
    end,
    v_current_entity_id,
    v_current_pastoral_entity_id,
    'normal',
    1
  )
  returning id into v_change_id;

  insert into public.audit_logs (
    user_id,
    action,
    target_table,
    target_id,
    old_data,
    new_data,
    change_request_id
  ) values (
    v_user_id,
    'person_canonical_change_proposal_created',
    'persons',
    p_person_id,
    app_private.person_canonical_snapshot(p_person_id),
    v_allowed,
    v_change_id
  );

  return jsonb_build_object('id', v_change_id, 'status', 'pending_review');
end;
$$;

create or replace function app_private.admin_review_person_change_request(
  p_change_request_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, app_private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request record;
  v_person_id uuid;
  v_proposed jsonb;
  v_status text := lower(nullif(btrim(p_decision), ''));
  v_can_approve boolean := false;
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select *
  into v_request
  from public.change_requests cr
  where cr.id = p_change_request_id
    and cr.target_table = 'persons'
    and cr.action_type = 'update'
    and cr.status in ('pending_review', 'needs_changes')
  limit 1
  for update;

  if v_request.id is null then
    raise exception 'Solicitud no encontrada o no revisable' using errcode = 'P0002';
  end if;

  v_person_id := v_request.target_id;
  v_proposed := coalesce(v_request.proposed_data, '{}'::jsonb);

  v_can_approve :=
    app_private.current_user_can('people.approve', 'national')
    or app_private.current_user_can(
      'people.approve',
      coalesce(v_request.scope_type, 'national'),
      v_request.scope_entity_id,
      v_request.diocese_id,
      v_request.pastoral_area_id,
      v_request.pastoral_entity_id
    );

  if not v_can_approve then
    raise exception 'No autorizado para revisar esta solicitud' using errcode = '42501';
  end if;

  if v_status not in ('approved', 'rejected') then
    raise exception 'Decisión inválida' using errcode = '22023';
  end if;

  if v_status = 'rejected' then
    update public.change_requests
    set status = 'rejected',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        rejection_reason = nullif(btrim(coalesce(p_rejection_reason, '')), ''),
        updated_at = now()
    where id = p_change_request_id;

    insert into public.audit_logs (
      user_id,
      action,
      target_table,
      target_id,
      old_data,
      new_data,
      change_request_id
    ) values (
      v_user_id,
      'person_canonical_change_request_rejected',
      'persons',
      v_person_id,
      v_request.proposed_data,
      jsonb_build_object('reason', p_rejection_reason),
      p_change_request_id
    );

    return jsonb_build_object('id', p_change_request_id, 'status', 'rejected');
  end if;

  perform app_private.apply_person_canonical_proposal(
    v_person_id,
    v_proposed,
    v_user_id,
    p_change_request_id
  );

  update public.change_requests
  set status = 'approved',
      reviewed_by = v_user_id,
      reviewed_at = now(),
      approved_by = v_user_id,
      approved_at = now(),
      updated_at = now()
  where id = p_change_request_id;

  insert into public.audit_logs (
    user_id,
    action,
    target_table,
    target_id,
    old_data,
    new_data,
    change_request_id
  ) values (
    v_user_id,
    'person_canonical_change_request_approved',
    'persons',
    v_person_id,
    v_request.original_data,
    v_request.proposed_data,
    p_change_request_id
  );

  return jsonb_build_object('id', p_change_request_id, 'status', 'approved');
end;
$$;

revoke all on function app_private.optional_iso_date(text, text) from public, anon, authenticated;
revoke all on function app_private.optional_uuid(text, text) from public, anon, authenticated;
revoke all on function app_private.person_canonical_snapshot(uuid) from public, anon, authenticated;
revoke all on function app_private.apply_person_canonical_proposal(uuid, jsonb, uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.admin_create_person_change_proposal(uuid, jsonb, text) from public, anon;
revoke all on function app_private.admin_review_person_change_request(uuid, text, text) from public, anon;

comment on function app_private.admin_create_person_change_proposal(uuid, jsonb, text)
  is 'Crea una propuesta canónica de persona. No acepta person_type como mecanismo de ordenación.';
comment on function app_private.admin_review_person_change_request(uuid, text, text)
  is 'Aprueba o rechaza propuestas de persona y aplica cada dimensión canónica en una sola transacción.';
