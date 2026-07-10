begin;

create or replace function app_private.review_permission_for_table(
  p_record_table text,
  p_action text
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_record_table in ('persons', 'clergy_profiles', 'religious_profiles', 'person_private_validation')
      then 'people.' || p_action
    when p_record_table in ('ecclesiastical_entities', 'entity_relationships', 'pastoral_areas', 'pastoral_entities', 'pastoral_relationships')
      then 'entities.' || p_action
    when p_record_table in ('position_assignments', 'appointments', 'pastoral_assignments')
      then 'appointments.' || p_action
    when p_record_table in ('structure_templates', 'structure_levels', 'structure_nodes', 'structure_level_edges', 'structure_node_edges', 'diocese_structure_templates', 'diocese_structure_levels', 'pastoral_structure_templates', 'pastoral_structure_levels')
      then 'structures.manage'
    else 'change_requests.' || case when p_action = 'publish' then 'approve' else p_action end
  end;
$$;

create or replace function app_private.review_record_scope_entity(
  p_record_table text,
  p_record_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_entity_id uuid;
begin
  if p_record_id is null then
    return null;
  end if;

  case p_record_table
    when 'ecclesiastical_entities' then
      v_entity_id := p_record_id;
    when 'persons' then
      select coalesce(cp.current_service_entity_id, cp.incardination_entity_id, pa.ecclesiastical_entity_id)
        into v_entity_id
      from public.persons person_row
      left join public.clergy_profiles cp on cp.person_id = person_row.id
      left join public.position_assignments pa
        on pa.person_id = person_row.id
       and pa.is_current = true
       and pa.record_status = 'active'
      where person_row.id = p_record_id
      order by pa.updated_at desc nulls last
      limit 1;
    when 'clergy_profiles' then
      select coalesce(cp.current_service_entity_id, cp.incardination_entity_id, pa.ecclesiastical_entity_id)
        into v_entity_id
      from public.clergy_profiles cp
      left join public.position_assignments pa
        on pa.person_id = cp.person_id
       and pa.is_current = true
       and pa.record_status = 'active'
      where cp.id = p_record_id
      order by pa.updated_at desc nulls last
      limit 1;
    when 'religious_profiles' then
      select coalesce(rp.current_service_entity_id, pa.ecclesiastical_entity_id)
        into v_entity_id
      from public.religious_profiles rp
      left join public.position_assignments pa
        on pa.person_id = rp.person_id
       and pa.is_current = true
       and pa.record_status = 'active'
      where rp.id = p_record_id
      order by pa.updated_at desc nulls last
      limit 1;
    when 'position_assignments' then
      select pa.ecclesiastical_entity_id
        into v_entity_id
      from public.position_assignments pa
      where pa.id = p_record_id;
    when 'structure_templates' then
      select st.diocese_id into v_entity_id
      from public.structure_templates st
      where st.id = p_record_id;
    when 'structure_levels' then
      select st.diocese_id into v_entity_id
      from public.structure_levels sl
      join public.structure_templates st on st.id = sl.template_id
      where sl.id = p_record_id;
    when 'structure_nodes' then
      select sn.diocese_id into v_entity_id
      from public.structure_nodes sn
      where sn.id = p_record_id;
    when 'pastoral_entities' then
      select coalesce(pe.linked_ecclesiastical_entity_id, pe.diocese_id)
        into v_entity_id
      from public.pastoral_entities pe
      where pe.id = p_record_id;
    else
      v_entity_id := null;
  end case;

  return v_entity_id;
end;
$$;

create or replace function app_private.current_user_can_review_record(
  p_permission_key text,
  p_record_table text,
  p_record_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_entity_id uuid;
begin
  if auth.uid() is null or nullif(p_permission_key, '') is null then
    return false;
  end if;

  v_entity_id := app_private.review_record_scope_entity(p_record_table, p_record_id);

  if v_entity_id is not null then
    return app_private.current_user_can_manage_entity(p_permission_key, v_entity_id);
  end if;

  return public.current_user_is_super_or_national()
     and public.current_user_has_permission(p_permission_key);
end;
$$;

revoke all on function app_private.review_permission_for_table(text, text) from public, anon, authenticated;
revoke all on function app_private.review_record_scope_entity(text, uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_review_record(text, text, uuid) from public, anon, authenticated;
grant execute on function app_private.review_permission_for_table(text, text) to authenticated;
grant execute on function app_private.review_record_scope_entity(text, uuid) to authenticated;
grant execute on function app_private.current_user_can_review_record(text, text, uuid) to authenticated;

create or replace function app_private.admin_review_queue(payload jsonb default '{}'::jsonb)
returns table(
  item_key text,
  item_type text,
  record_table text,
  record_id uuid,
  source_id text,
  title text,
  detail text,
  verification_status text,
  issue_count integer,
  created_at timestamptz,
  allowed_actions text[]
)
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_limit integer := greatest(1, least(coalesce((payload->>'limit')::integer, 200), 500));
begin
  if auth.uid() is null then
    raise exception 'No autenticado para consultar la cola de revisión.' using errcode = '42501';
  end if;

  if not public.current_user_has_permission('appointments.view')
     and not public.current_user_has_permission('people.view')
     and not public.current_user_has_permission('entities.view')
     and not public.current_user_has_permission('change_requests.view')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para ver la cola de revisión.' using errcode = '42501';
  end if;

  return query
  with assignment_items as (
    select
      'position-assignment-' || pa.id::text as item_key,
      'position_assignment'::text as item_type,
      'position_assignments'::text as record_table,
      pa.id as record_id,
      pa.id::text as source_id,
      concat(coalesce(oc.display_name, 'Cargo'), ': ', coalesce(person_row.display_name, 'Vacante')) as title,
      concat_ws(' · ', entity_row.name, pa.assignment_status, pa.publication_status, pa.source_name) as detail,
      pa.verification_status,
      1::integer as issue_count,
      pa.created_at,
      array_remove(array[
        case when app_private.current_user_can_review_record('appointments.approve', 'position_assignments', pa.id)
          then 'approve_internal' end,
        case when app_private.current_user_can_review_record('appointments.approve', 'position_assignments', pa.id)
          then 'keep_internal' end,
        case when app_private.current_user_can_review_record('appointments.approve', 'position_assignments', pa.id)
          then 'needs_correction' end,
        case when app_private.current_user_can_review_record('appointments.approve', 'position_assignments', pa.id)
          then 'dispute' end,
        case when app_private.current_user_can_review_record('appointments.publish', 'position_assignments', pa.id)
          then 'publish' end
      ]::text[], null) as allowed_actions
    from public.position_assignments pa
    left join public.office_configurations oc on oc.id = pa.office_configuration_id
    left join public.persons person_row on person_row.id = pa.person_id
    left join public.ecclesiastical_entities entity_row on entity_row.id = pa.ecclesiastical_entity_id
    where pa.record_status = 'active'
      and (
        pa.verification_status in ('pending_review', 'needs_correction', 'disputed')
        or (pa.verification_status = 'verified' and pa.publication_status = 'internal')
      )
      and (
        app_private.current_user_can_review_record('appointments.view', 'position_assignments', pa.id)
        or (
          pa.pastoral_entity_id is not null
          and public.current_user_has_permission('appointments.view')
          and public.current_user_has_scope_access('pastoral_entity', pa.pastoral_entity_id, null, null, pa.pastoral_entity_id)
        )
      )
  ),
  candidate_items as (
    select
      'person-candidate-' || candidate.id::text as item_key,
      'person_candidate'::text as item_type,
      'import_parish_directory_person_candidates_sto_dgo_2026'::text as record_table,
      candidate.matched_person_id as record_id,
      candidate.id::text as source_id,
      coalesce(candidate.normalized_name, candidate.raw_text) as title,
      concat('Fila ', candidate.excel_row_number, ' · ', candidate.candidate_role, ' · ', candidate.raw_text) as detail,
      candidate.review_status as verification_status,
      1::integer as issue_count,
      candidate.created_at,
      case
        when app_private.current_user_can_review_record('people.approve', 'ecclesiastical_entities', parish.id)
          then array['approve_internal', 'needs_correction', 'reject']::text[]
        else '{}'::text[]
      end as allowed_actions
    from public.import_parish_directory_person_candidates_sto_dgo_2026 candidate
    left join public.ecclesiastical_entities parish on parish.slug = candidate.parish_slug
    where candidate.review_status in ('pending', 'needs_review')
      and app_private.current_user_can_review_record('people.view', 'ecclesiastical_entities', parish.id)
  ),
  missing_field_items as (
    select
      'missing-field-' || field_status.id::text as item_key,
      'missing_field'::text as item_type,
      field_status.record_table,
      field_status.record_id,
      field_status.id::text as source_id,
      case
        when field_status.record_table = 'persons' then coalesce((select p.display_name from public.persons p where p.id = field_status.record_id), field_status.record_table)
        when field_status.record_table = 'clergy_profiles' then coalesce((select p.display_name from public.clergy_profiles cp join public.persons p on p.id = cp.person_id where cp.id = field_status.record_id), field_status.record_table)
        when field_status.record_table = 'religious_profiles' then coalesce((select p.display_name from public.religious_profiles rp join public.persons p on p.id = rp.person_id where rp.id = field_status.record_id), field_status.record_table)
        when field_status.record_table = 'ecclesiastical_entities' then coalesce((select ee.name from public.ecclesiastical_entities ee where ee.id = field_status.record_id), field_status.record_table)
        else field_status.record_table
      end as title,
      concat(field_status.field_name, coalesce(' · ' || field_status.notes, '')) as detail,
      field_status.status as verification_status,
      1::integer as issue_count,
      field_status.created_at,
      case
        when app_private.current_user_can_review_record(
          app_private.review_permission_for_table(field_status.record_table, 'approve'),
          field_status.record_table,
          field_status.record_id
        ) then array['resolve', 'not_applicable', 'needs_correction']::text[]
        else '{}'::text[]
      end as allowed_actions
    from public.data_field_statuses field_status
    where field_status.status = 'unknown'
      and app_private.current_user_can_review_record(
        app_private.review_permission_for_table(field_status.record_table, 'view'),
        field_status.record_table,
        field_status.record_id
      )
  ),
  change_request_items as (
    select
      'change-request-' || request_row.id::text as item_key,
      'change_request'::text as item_type,
      request_row.target_table,
      request_row.target_id,
      request_row.id::text as source_id,
      request_row.title,
      concat_ws(' · ', request_row.action_type, request_row.description, request_row.priority) as detail,
      request_row.status as verification_status,
      1::integer as issue_count,
      request_row.created_at,
      case
        when (
          app_private.current_user_can(
            app_private.review_permission_for_table(request_row.target_table, 'approve'),
            'national'
          )
          or app_private.current_user_can(
            app_private.review_permission_for_table(request_row.target_table, 'approve'),
            coalesce(request_row.scope_type, 'national'),
            request_row.scope_entity_id,
            request_row.diocese_id,
            request_row.pastoral_area_id,
            request_row.pastoral_entity_id
          )
        ) then array['approved', 'needs_changes', 'rejected']::text[]
        else '{}'::text[]
      end as allowed_actions
    from public.change_requests request_row
    where request_row.status in ('pending_review', 'needs_changes')
      and (
        app_private.current_user_can('change_requests.view', 'national')
        or app_private.current_user_can(
          'change_requests.view',
          coalesce(request_row.scope_type, 'national'),
          request_row.scope_entity_id,
          request_row.diocese_id,
          request_row.pastoral_area_id,
          request_row.pastoral_entity_id
        )
      )
  ),
  items as (
    select * from assignment_items
    union all
    select * from candidate_items
    union all
    select * from missing_field_items
    union all
    select * from change_request_items
  )
  select *
  from items
  order by created_at desc, item_type, title
  limit v_limit;
end;
$$;

create or replace function app_private.admin_review_item(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item_type text := nullif(lower(btrim(payload->>'item_type')), '');
  v_record_id uuid := nullif(payload->>'record_id', '')::uuid;
  v_source_id text := nullif(payload->>'source_id', '');
  v_decision text := nullif(lower(btrim(payload->>'decision')), '');
  v_notes text := nullif(btrim(payload->>'notes'), '');
  v_publish_person boolean := coalesce((payload->>'publish_person')::boolean, false);
  v_assignment public.position_assignments%rowtype;
  v_candidate public.import_parish_directory_person_candidates_sto_dgo_2026%rowtype;
  v_field_status public.data_field_statuses%rowtype;
  v_request public.change_requests%rowtype;
  v_permission_key text;
  v_scope_entity_id uuid;
  v_new_status text;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'No autenticado para revisar registros.' using errcode = '42501';
  end if;

  if v_item_type is null or v_decision is null then
    raise exception 'item_type y decision son obligatorios.' using errcode = '22023';
  end if;

  if v_item_type = 'position_assignment' then
    if v_record_id is null then
      raise exception 'record_id es obligatorio para revisar un nombramiento.' using errcode = '22023';
    end if;

    select * into v_assignment
    from public.position_assignments
    where id = v_record_id
    for update;

    if not found then
      raise exception 'Nombramiento no encontrado.' using errcode = 'P0002';
    end if;

    if v_decision not in ('approve_internal', 'publish', 'needs_correction', 'dispute', 'keep_internal') then
      raise exception 'Decisión inválida para el nombramiento.' using errcode = '22023';
    end if;

    v_permission_key := case when v_decision = 'publish' then 'appointments.publish' else 'appointments.approve' end;

    if v_assignment.ecclesiastical_entity_id is not null then
      if not app_private.current_user_can_manage_entity(v_permission_key, v_assignment.ecclesiastical_entity_id) then
        raise exception 'El nombramiento está fuera de tu alcance.' using errcode = '42501';
      end if;
    elsif v_assignment.pastoral_entity_id is not null then
      if not public.current_user_has_permission(v_permission_key)
         or not public.current_user_has_scope_access('pastoral_entity', v_assignment.pastoral_entity_id, null, null, v_assignment.pastoral_entity_id) then
        raise exception 'El nombramiento pastoral está fuera de tu alcance.' using errcode = '42501';
      end if;
    elsif not public.current_user_is_super_or_national() or not public.current_user_has_permission(v_permission_key) then
      raise exception 'No autorizado para revisar un nombramiento sin alcance territorial.' using errcode = '42501';
    end if;

    if v_decision = 'approve_internal' then
      update public.position_assignments
      set verification_status = 'verified',
          visibility = 'internal',
          publication_status = 'internal',
          notes_internal = concat_ws(E'\n', nullif(notes_internal, ''), '[REVISIÓN] Aprobado internamente: ' || coalesce(v_notes, '')),
          updated_at = now()
      where id = v_record_id;
    elsif v_decision = 'keep_internal' then
      update public.position_assignments
      set visibility = 'internal',
          publication_status = 'internal',
          notes_internal = concat_ws(E'\n', nullif(notes_internal, ''), '[REVISIÓN] Mantener interno: ' || coalesce(v_notes, '')),
          updated_at = now()
      where id = v_record_id;
    elsif v_decision = 'publish' then
      update public.position_assignments
      set verification_status = 'verified',
          visibility = 'public',
          publication_status = 'published',
          public_from = coalesce(public_from, current_date),
          notes_internal = concat_ws(E'\n', nullif(notes_internal, ''), '[REVISIÓN] Publicado: ' || coalesce(v_notes, '')),
          updated_at = now()
      where id = v_record_id;

      if v_publish_person and v_assignment.person_id is not null then
        if v_assignment.ecclesiastical_entity_id is not null
           and not app_private.current_user_can_manage_entity('people.publish', v_assignment.ecclesiastical_entity_id) then
          raise exception 'No autorizado para publicar la persona asociada.' using errcode = '42501';
        end if;

        update public.persons
        set visibility = 'public',
            notes_internal = concat_ws(E'\n', nullif(notes_internal, ''), '[REVISIÓN] Persona publicada junto con un nombramiento.'),
            updated_at = now()
        where id = v_assignment.person_id;
      end if;
    elsif v_decision = 'needs_correction' then
      update public.position_assignments
      set verification_status = 'needs_correction',
          visibility = 'internal',
          publication_status = 'internal',
          notes_internal = concat_ws(E'\n', nullif(notes_internal, ''), '[REVISIÓN] Requiere corrección: ' || coalesce(v_notes, '')),
          updated_at = now()
      where id = v_record_id;
    elsif v_decision = 'dispute' then
      update public.position_assignments
      set verification_status = 'disputed',
          visibility = 'internal',
          publication_status = 'internal',
          notes_internal = concat_ws(E'\n', nullif(notes_internal, ''), '[REVISIÓN] En disputa: ' || coalesce(v_notes, '')),
          updated_at = now()
      where id = v_record_id;
    end if;

    insert into public.audit_logs(user_id, action, target_table, target_id, old_data, new_data)
    values (
      v_user_id,
      'review.position_assignment.' || v_decision,
      'position_assignments',
      v_record_id,
      to_jsonb(v_assignment),
      jsonb_build_object('decision', v_decision, 'notes', v_notes, 'publish_person', v_publish_person)
    );

    return jsonb_build_object('ok', true, 'item_type', v_item_type, 'record_id', v_record_id, 'decision', v_decision);
  end if;

  if v_item_type = 'person_candidate' then
    if v_source_id is null or v_source_id !~ '^[0-9]+$' then
      raise exception 'source_id inválido para el candidato.' using errcode = '22023';
    end if;

    select * into v_candidate
    from public.import_parish_directory_person_candidates_sto_dgo_2026
    where id = v_source_id::bigint
    for update;

    if not found then
      raise exception 'Candidato no encontrado.' using errcode = 'P0002';
    end if;

    select ee.id into v_scope_entity_id
    from public.ecclesiastical_entities ee
    where ee.slug = v_candidate.parish_slug
    limit 1;

    if v_scope_entity_id is null
       or not app_private.current_user_can_manage_entity('people.approve', v_scope_entity_id) then
      raise exception 'El candidato está fuera de tu alcance.' using errcode = '42501';
    end if;

    if v_decision = 'approve_internal' then
      if v_candidate.matched_person_id is null then
        raise exception 'El candidato no tiene una persona coincidente para aprobar.' using errcode = '22023';
      end if;
      v_new_status := 'matched';
    elsif v_decision = 'reject' then
      v_new_status := 'ignored';
    elsif v_decision = 'needs_correction' then
      v_new_status := 'needs_review';
    else
      raise exception 'Decisión inválida para el candidato.' using errcode = '22023';
    end if;

    update public.import_parish_directory_person_candidates_sto_dgo_2026
    set review_status = v_new_status,
        requires_review = v_new_status = 'needs_review',
        review_notes = concat_ws(E'\n', nullif(review_notes, ''), '[REVISIÓN] ' || v_decision || ': ' || coalesce(v_notes, '')),
        updated_at = now()
    where id = v_candidate.id;

    insert into public.audit_logs(user_id, action, target_table, target_id, old_data, new_data)
    values (
      v_user_id,
      'review.person_candidate.' || v_decision,
      'import_parish_directory_person_candidates_sto_dgo_2026',
      v_candidate.matched_person_id,
      to_jsonb(v_candidate),
      jsonb_build_object('candidate_id', v_candidate.id, 'decision', v_decision, 'status', v_new_status, 'notes', v_notes)
    );

    return jsonb_build_object('ok', true, 'item_type', v_item_type, 'source_id', v_candidate.id, 'decision', v_decision, 'status', v_new_status);
  end if;

  if v_item_type = 'missing_field' then
    if v_source_id is null then
      raise exception 'source_id es obligatorio para el dato faltante.' using errcode = '22023';
    end if;

    select * into v_field_status
    from public.data_field_statuses
    where id = v_source_id::uuid
    for update;

    if not found then
      raise exception 'Dato faltante no encontrado.' using errcode = 'P0002';
    end if;

    v_permission_key := app_private.review_permission_for_table(v_field_status.record_table, 'approve');
    if not app_private.current_user_can_review_record(v_permission_key, v_field_status.record_table, v_field_status.record_id) then
      raise exception 'El dato está fuera de tu alcance.' using errcode = '42501';
    end if;

    if v_decision = 'resolve' then
      v_new_status := 'verified';
    elsif v_decision = 'not_applicable' then
      v_new_status := 'not_applicable';
    elsif v_decision = 'needs_correction' then
      v_new_status := 'unknown';
    else
      raise exception 'Decisión inválida para el dato faltante.' using errcode = '22023';
    end if;

    update public.data_field_statuses
    set status = v_new_status,
        notes = concat_ws(E'\n', nullif(notes, ''), '[REVISIÓN] ' || v_decision || ': ' || coalesce(v_notes, '')),
        updated_at = now()
    where id = v_field_status.id;

    insert into public.audit_logs(user_id, action, target_table, target_id, old_data, new_data)
    values (
      v_user_id,
      'review.missing_field.' || v_decision,
      v_field_status.record_table,
      v_field_status.record_id,
      to_jsonb(v_field_status),
      jsonb_build_object('field_status_id', v_field_status.id, 'field_name', v_field_status.field_name, 'decision', v_decision, 'status', v_new_status, 'notes', v_notes)
    );

    return jsonb_build_object('ok', true, 'item_type', v_item_type, 'source_id', v_field_status.id, 'decision', v_decision, 'status', v_new_status);
  end if;

  if v_item_type = 'change_request' then
    if v_source_id is null then
      raise exception 'source_id es obligatorio para la solicitud.' using errcode = '22023';
    end if;

    select * into v_request
    from public.change_requests
    where id = v_source_id::uuid
    for update;

    if not found then
      raise exception 'Solicitud de cambio no encontrada.' using errcode = 'P0002';
    end if;

    if v_request.status not in ('pending_review', 'needs_changes') then
      raise exception 'La solicitud ya no está pendiente de revisión.' using errcode = '22023';
    end if;

    v_permission_key := app_private.review_permission_for_table(v_request.target_table, 'approve');
    if not (
      app_private.current_user_can(v_permission_key, 'national')
      or app_private.current_user_can(
        v_permission_key,
        coalesce(v_request.scope_type, 'national'),
        v_request.scope_entity_id,
        v_request.diocese_id,
        v_request.pastoral_area_id,
        v_request.pastoral_entity_id
      )
    ) then
      raise exception 'La solicitud está fuera de tu alcance.' using errcode = '42501';
    end if;

    if v_decision not in ('approved', 'rejected', 'needs_changes') then
      raise exception 'Decisión inválida para la solicitud.' using errcode = '22023';
    end if;

    if v_request.target_table = 'persons'
       and v_request.action_type = 'update'
       and v_decision in ('approved', 'rejected') then
      return app_private.admin_review_person_change_request(v_request.id, v_decision, v_notes);
    end if;

    if v_decision = 'approved' then
      update public.change_requests
      set status = 'approved',
          reviewed_by = v_user_id,
          reviewed_at = now(),
          approved_by = v_user_id,
          approved_at = now(),
          correction_notes = v_notes,
          updated_at = now()
      where id = v_request.id;
    elsif v_decision = 'rejected' then
      update public.change_requests
      set status = 'rejected',
          reviewed_by = v_user_id,
          reviewed_at = now(),
          rejection_reason = coalesce(v_notes, 'Rechazada por revisión administrativa'),
          updated_at = now()
      where id = v_request.id;
    else
      update public.change_requests
      set status = 'needs_changes',
          reviewed_by = v_user_id,
          reviewed_at = now(),
          correction_notes = coalesce(v_notes, 'Requiere correcciones antes de aprobarse'),
          updated_at = now()
      where id = v_request.id;
    end if;

    insert into public.audit_logs(user_id, action, target_table, target_id, old_data, new_data, change_request_id)
    values (
      v_user_id,
      'review.change_request.' || v_decision,
      v_request.target_table,
      v_request.target_id,
      to_jsonb(v_request),
      jsonb_build_object('decision', v_decision, 'notes', v_notes),
      v_request.id
    );

    return jsonb_build_object('ok', true, 'item_type', v_item_type, 'source_id', v_request.id, 'decision', v_decision);
  end if;

  raise exception 'Tipo de elemento de revisión no permitido.' using errcode = '22023';
end;
$$;

drop function if exists public.admin_review_queue(jsonb);

create function public.admin_review_queue(payload jsonb default '{}'::jsonb)
returns table(
  item_key text,
  item_type text,
  record_table text,
  record_id uuid,
  source_id text,
  title text,
  detail text,
  verification_status text,
  issue_count integer,
  created_at timestamptz,
  allowed_actions text[]
)
language sql
stable
set search_path = public, app_private, pg_temp
as $$
  select * from app_private.admin_review_queue(payload);
$$;

create or replace function public.admin_review_item(payload jsonb)
returns jsonb
language sql
set search_path = public, app_private, pg_temp
as $$
  select app_private.admin_review_item(payload);
$$;

create or replace function public.admin_review_imported_appointment(payload jsonb)
returns jsonb
language sql
set search_path = public, app_private, pg_temp
as $$
  select app_private.admin_review_item(
    jsonb_build_object(
      'item_type', 'position_assignment',
      'record_id', payload->>'assignment_id',
      'source_id', payload->>'assignment_id',
      'decision', payload->>'decision',
      'notes', payload->>'notes',
      'publish_person', coalesce(payload->'publish_person', 'false'::jsonb)
    )
  );
$$;

create or replace function public.admin_review_change_request(payload jsonb)
returns jsonb
language sql
set search_path = public, app_private, pg_temp
as $$
  select app_private.admin_review_item(
    jsonb_build_object(
      'item_type', 'change_request',
      'source_id', payload->>'change_request_id',
      'record_id', payload->>'target_id',
      'decision', payload->>'decision',
      'notes', coalesce(payload->>'review_notes', payload->>'notes')
    )
  );
$$;

revoke all on function app_private.admin_review_queue(jsonb) from public, anon, authenticated;
revoke all on function app_private.admin_review_item(jsonb) from public, anon, authenticated;
grant execute on function app_private.admin_review_queue(jsonb) to authenticated;
grant execute on function app_private.admin_review_item(jsonb) to authenticated;

revoke all on function public.admin_review_queue(jsonb) from public, anon;
revoke all on function public.admin_review_item(jsonb) from public, anon;
revoke all on function public.admin_review_imported_appointment(jsonb) from public, anon;
revoke all on function public.admin_review_change_request(jsonb) from public, anon;
grant execute on function public.admin_review_queue(jsonb) to authenticated;
grant execute on function public.admin_review_item(jsonb) to authenticated;
grant execute on function public.admin_review_imported_appointment(jsonb) to authenticated;
grant execute on function public.admin_review_change_request(jsonb) to authenticated;

revoke execute on function internal.admin_review_change_request(jsonb) from authenticated;

commit;
