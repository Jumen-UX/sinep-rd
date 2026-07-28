begin;

alter table public.position_assignments
  add constraint position_assignments_scope_required
  check (ecclesiastical_entity_id is not null or organization_unit_id is not null)
  not valid;

alter table public.position_assignments
  validate constraint position_assignments_scope_required;

alter table public.import_batches
  add constraint import_batches_scope_entity_required
  check (scope_entity_id is not null)
  not valid;

alter table public.import_batches
  validate constraint import_batches_scope_entity_required;

create or replace function app_private.current_user_can_review_change_request(
  p_permission_key text,
  p_change_request_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_request public.change_requests%rowtype;
  v_entity_id uuid;
begin
  if auth.uid() is null
     or nullif(p_permission_key, '') is null
     or p_change_request_id is null then
    return false;
  end if;

  select *
  into v_request
  from public.change_requests request_row
  where request_row.id = p_change_request_id;

  if not found then
    return false;
  end if;

  v_entity_id := coalesce(v_request.scope_entity_id, v_request.diocese_id);

  if v_entity_id is null and v_request.organization_unit_id is not null then
    select unit_row.ecclesiastical_entity_id
    into v_entity_id
    from public.organization_units unit_row
    where unit_row.id = v_request.organization_unit_id;
  end if;

  if v_entity_id is null and v_request.target_id is not null then
    v_entity_id := app_private.review_record_scope_entity(
      v_request.target_table,
      v_request.target_id
    );
  end if;

  if v_entity_id is not null then
    return app_private.current_user_can_manage_entity(p_permission_key, v_entity_id);
  end if;

  return app_private.current_user_has_role(array['super_admin'])
     and app_private.current_user_has_permission(p_permission_key);
end;
$$;

revoke all on function app_private.current_user_can_review_change_request(text, uuid)
from public, anon, authenticated;

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
  if auth.uid() is null
     or nullif(p_permission_key, '') is null
     or nullif(p_record_table, '') is null
     or p_record_id is null then
    return false;
  end if;

  v_entity_id := app_private.review_record_scope_entity(p_record_table, p_record_id);

  if v_entity_id is not null then
    return app_private.current_user_can_manage_entity(p_permission_key, v_entity_id);
  end if;

  return app_private.current_user_has_role(array['super_admin'])
     and app_private.current_user_has_permission(p_permission_key);
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
  v_request public.change_requests%rowtype;
  v_person_id uuid;
  v_proposed jsonb;
  v_status text := lower(nullif(btrim(p_decision), ''));
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select *
  into v_request
  from public.change_requests request_row
  where request_row.id = p_change_request_id
    and request_row.target_table = 'persons'
    and request_row.action_type = 'update'
    and request_row.status in ('pending_review', 'needs_changes')
  limit 1
  for update;

  if not found then
    raise exception 'Solicitud no encontrada o no revisable' using errcode = 'P0002';
  end if;

  if not app_private.current_user_can_review_change_request('people.approve', v_request.id) then
    raise exception 'No autorizado para revisar esta solicitud' using errcode = '42501';
  end if;

  if v_status not in ('approved', 'rejected') then
    raise exception 'Decisión inválida' using errcode = '22023';
  end if;

  v_person_id := v_request.target_id;
  v_proposed := coalesce(v_request.proposed_data, '{}'::jsonb);

  if v_status = 'rejected' then
    update public.change_requests
    set status = 'rejected',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        rejection_reason = nullif(btrim(coalesce(p_rejection_reason, '')), ''),
        updated_at = now()
    where id = p_change_request_id;

    perform public.create_audit_log(
      v_user_id,
      'person_canonical_change_request_rejected',
      'persons',
      v_person_id,
      to_jsonb(v_request),
      jsonb_build_object(
        'scope_entity_id', coalesce(v_request.scope_entity_id, v_request.diocese_id),
        'organization_unit_id', v_request.organization_unit_id,
        'reason', p_rejection_reason
      ),
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

  perform public.create_audit_log(
    v_user_id,
    'person_canonical_change_request_approved',
    'persons',
    v_person_id,
    v_request.original_data,
    jsonb_build_object(
      'scope_entity_id', coalesce(v_request.scope_entity_id, v_request.diocese_id),
      'organization_unit_id', v_request.organization_unit_id,
      'record', v_request.proposed_data
    ),
    p_change_request_id
  );

  return jsonb_build_object('id', p_change_request_id, 'status', 'approved');
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
  v_after jsonb;
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

    select *
    into v_assignment
    from public.position_assignments
    where id = v_record_id
    for update;

    if not found then
      raise exception 'Nombramiento no encontrado.' using errcode = 'P0002';
    end if;

    if v_decision not in ('approve_internal', 'publish', 'needs_correction', 'dispute', 'keep_internal') then
      raise exception 'Decisión inválida para el nombramiento.' using errcode = '22023';
    end if;

    v_permission_key := case
      when v_decision = 'publish' then 'appointments.publish'
      else 'appointments.approve'
    end;

    v_scope_entity_id := app_private.review_record_scope_entity(
      'position_assignments',
      v_record_id
    );

    if not app_private.current_user_can_review_record(
      v_permission_key,
      'position_assignments',
      v_record_id
    ) then
      raise exception 'El nombramiento está fuera de tu alcance.' using errcode = '42501';
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
        if v_scope_entity_id is null
           or not app_private.current_user_can_manage_entity('people.publish', v_scope_entity_id) then
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

    select to_jsonb(assignment_row)
    into v_after
    from public.position_assignments assignment_row
    where assignment_row.id = v_record_id;

    perform public.create_audit_log(
      v_user_id,
      'review.position_assignment.' || v_decision,
      'position_assignments',
      v_record_id,
      to_jsonb(v_assignment),
      jsonb_build_object(
        'scope_entity_id', v_scope_entity_id,
        'organization_unit_id', v_assignment.organization_unit_id,
        'decision', v_decision,
        'notes', v_notes,
        'publish_person', v_publish_person,
        'record', v_after
      ),
      null
    );

    return jsonb_build_object(
      'ok', true,
      'item_type', v_item_type,
      'record_id', v_record_id,
      'decision', v_decision
    );
  end if;

  if v_item_type = 'person_candidate' then
    if v_source_id is null or v_source_id !~ '^[0-9]+$' then
      raise exception 'source_id inválido para el candidato.' using errcode = '22023';
    end if;

    select *
    into v_candidate
    from public.import_parish_directory_person_candidates_sto_dgo_2026
    where id = v_source_id::bigint
    for update;

    if not found then
      raise exception 'Candidato no encontrado.' using errcode = 'P0002';
    end if;

    select entity_row.id
    into v_scope_entity_id
    from public.ecclesiastical_entities entity_row
    where entity_row.slug = v_candidate.parish_slug
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

    perform public.create_audit_log(
      v_user_id,
      'review.person_candidate.' || v_decision,
      'import_parish_directory_person_candidates_sto_dgo_2026',
      v_candidate.matched_person_id,
      to_jsonb(v_candidate),
      jsonb_build_object(
        'scope_entity_id', v_scope_entity_id,
        'candidate_id', v_candidate.id,
        'decision', v_decision,
        'status', v_new_status,
        'notes', v_notes
      ),
      null
    );

    return jsonb_build_object(
      'ok', true,
      'item_type', v_item_type,
      'source_id', v_candidate.id,
      'decision', v_decision,
      'status', v_new_status
    );
  end if;

  if v_item_type = 'missing_field' then
    if v_source_id is null then
      raise exception 'source_id es obligatorio para el dato faltante.' using errcode = '22023';
    end if;

    select *
    into v_field_status
    from public.data_field_statuses
    where id = v_source_id::uuid
    for update;

    if not found then
      raise exception 'Dato faltante no encontrado.' using errcode = 'P0002';
    end if;

    v_permission_key := app_private.review_permission_for_table(
      v_field_status.record_table,
      'approve'
    );

    if not app_private.current_user_can_review_record(
      v_permission_key,
      v_field_status.record_table,
      v_field_status.record_id
    ) then
      raise exception 'El dato está fuera de tu alcance.' using errcode = '42501';
    end if;

    v_scope_entity_id := app_private.review_record_scope_entity(
      v_field_status.record_table,
      v_field_status.record_id
    );

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

    perform public.create_audit_log(
      v_user_id,
      'review.missing_field.' || v_decision,
      v_field_status.record_table,
      v_field_status.record_id,
      to_jsonb(v_field_status),
      jsonb_build_object(
        'scope_entity_id', v_scope_entity_id,
        'field_status_id', v_field_status.id,
        'field_name', v_field_status.field_name,
        'decision', v_decision,
        'status', v_new_status,
        'notes', v_notes
      ),
      null
    );

    return jsonb_build_object(
      'ok', true,
      'item_type', v_item_type,
      'source_id', v_field_status.id,
      'decision', v_decision,
      'status', v_new_status
    );
  end if;

  if v_item_type = 'change_request' then
    if v_source_id is null then
      raise exception 'source_id es obligatorio para la solicitud.' using errcode = '22023';
    end if;

    select *
    into v_request
    from public.change_requests
    where id = v_source_id::uuid
    for update;

    if not found then
      raise exception 'Solicitud de cambio no encontrada.' using errcode = 'P0002';
    end if;

    if v_request.status not in ('pending_review', 'needs_changes') then
      raise exception 'La solicitud ya no está pendiente de revisión.' using errcode = '22023';
    end if;

    v_permission_key := app_private.review_permission_for_table(
      v_request.target_table,
      'approve'
    );

    if not app_private.current_user_can_review_change_request(
      v_permission_key,
      v_request.id
    ) then
      raise exception 'La solicitud está fuera de tu alcance.' using errcode = '42501';
    end if;

    if v_decision not in ('approved', 'rejected', 'needs_changes') then
      raise exception 'Decisión inválida para la solicitud.' using errcode = '22023';
    end if;

    if v_request.target_table = 'persons'
       and v_request.action_type = 'update'
       and v_decision in ('approved', 'rejected') then
      return app_private.admin_review_person_change_request(
        v_request.id,
        v_decision,
        v_notes
      );
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

    v_scope_entity_id := coalesce(
      v_request.scope_entity_id,
      v_request.diocese_id,
      app_private.review_record_scope_entity(v_request.target_table, v_request.target_id)
    );

    perform public.create_audit_log(
      v_user_id,
      'review.change_request.' || v_decision,
      v_request.target_table,
      v_request.target_id,
      to_jsonb(v_request),
      jsonb_build_object(
        'scope_entity_id', v_scope_entity_id,
        'organization_unit_id', v_request.organization_unit_id,
        'decision', v_decision,
        'notes', v_notes
      ),
      v_request.id
    );

    return jsonb_build_object(
      'ok', true,
      'item_type', v_item_type,
      'source_id', v_request.id,
      'decision', v_decision
    );
  end if;

  raise exception 'Tipo de elemento de revisión no permitido.' using errcode = '22023';
end;
$$;

create or replace function app_private.admin_review_queue_core(payload jsonb default '{}'::jsonb)
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
     and not app_private.current_user_has_role(array['super_admin']) then
    raise exception 'No autorizado para ver la cola de revisión.' using errcode = '42501';
  end if;

  return query
  with assignment_items as (
    select
      'position-assignment-' || assignment_row.id::text as item_key,
      'position_assignment'::text as item_type,
      'position_assignments'::text as record_table,
      assignment_row.id as record_id,
      assignment_row.id::text as source_id,
      concat(coalesce(office_row.display_name, 'Cargo'), ': ', coalesce(person_row.display_name, 'Vacante')) as title,
      concat_ws(' · ', entity_row.name, assignment_row.assignment_status, assignment_row.publication_status, assignment_row.source_name) as detail,
      assignment_row.verification_status,
      1::integer as issue_count,
      assignment_row.created_at,
      array_remove(array[
        case when app_private.current_user_can_review_record('appointments.approve', 'position_assignments', assignment_row.id) then 'approve_internal' end,
        case when app_private.current_user_can_review_record('appointments.approve', 'position_assignments', assignment_row.id) then 'keep_internal' end,
        case when app_private.current_user_can_review_record('appointments.approve', 'position_assignments', assignment_row.id) then 'needs_correction' end,
        case when app_private.current_user_can_review_record('appointments.approve', 'position_assignments', assignment_row.id) then 'dispute' end,
        case when app_private.current_user_can_review_record('appointments.publish', 'position_assignments', assignment_row.id) then 'publish' end
      ]::text[], null) as allowed_actions
    from public.position_assignments assignment_row
    left join public.office_configurations office_row on office_row.id = assignment_row.office_configuration_id
    left join public.persons person_row on person_row.id = assignment_row.person_id
    left join public.ecclesiastical_entities entity_row on entity_row.id = assignment_row.ecclesiastical_entity_id
    where assignment_row.record_status = 'active'
      and (
        assignment_row.verification_status in ('pending_review', 'needs_correction', 'disputed')
        or (
          assignment_row.verification_status = 'verified'
          and assignment_row.publication_status = 'internal'
        )
      )
      and app_private.current_user_can_review_record(
        'appointments.view',
        'position_assignments',
        assignment_row.id
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
        when field_status.record_table = 'persons' then coalesce((select person_row.display_name from public.persons person_row where person_row.id = field_status.record_id), field_status.record_table)
        when field_status.record_table = 'clergy_profiles' then coalesce((select person_row.display_name from public.clergy_profiles profile_row join public.persons person_row on person_row.id = profile_row.person_id where profile_row.id = field_status.record_id), field_status.record_table)
        when field_status.record_table = 'religious_profiles' then coalesce((select person_row.display_name from public.religious_profiles profile_row join public.persons person_row on person_row.id = profile_row.person_id where profile_row.id = field_status.record_id), field_status.record_table)
        when field_status.record_table = 'ecclesiastical_entities' then coalesce((select entity_row.name from public.ecclesiastical_entities entity_row where entity_row.id = field_status.record_id), field_status.record_table)
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
        when app_private.current_user_can_review_change_request(
          app_private.review_permission_for_table(request_row.target_table, 'approve'),
          request_row.id
        ) then array['approved', 'needs_changes', 'rejected']::text[]
        else '{}'::text[]
      end as allowed_actions
    from public.change_requests request_row
    where request_row.status in ('pending_review', 'needs_changes')
      and app_private.current_user_can_review_change_request(
        'change_requests.view',
        request_row.id
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
  v_can_read_legacy boolean;
  v_can_read_imports boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado para consultar la cola de revisión.' using errcode = '42501';
  end if;

  v_can_read_legacy := public.current_user_has_permission('appointments.view')
    or public.current_user_has_permission('people.view')
    or public.current_user_has_permission('entities.view')
    or public.current_user_has_permission('change_requests.view')
    or app_private.current_user_has_role(array['super_admin']);

  v_can_read_imports := public.current_user_has_permission('imports.prepare')
    or public.current_user_has_permission('imports.review')
    or public.current_user_has_permission('imports.apply')
    or app_private.current_user_has_role(array['super_admin']);

  if not v_can_read_legacy and not v_can_read_imports then
    raise exception 'No autorizado para ver la cola de revisión.' using errcode = '42501';
  end if;

  return query
  with legacy_items as (
    select core.*
    from app_private.admin_review_queue_core(jsonb_build_object('limit', v_limit)) core
    where v_can_read_legacy
  ),
  import_items as (
    select
      'import-batch-' || batch.id::text as item_key,
      'import_batch'::text as item_type,
      'import_batches'::text as record_table,
      batch.id as record_id,
      batch.id::text as source_id,
      batch.file_name as title,
      concat_ws(
        ' · ',
        batch.import_type,
        batch.row_count || ' filas',
        case
          when batch.status = 'needs_review' then concat(
            batch.error_rows, ' errores, ',
            batch.duplicate_rows, ' duplicados, ',
            batch.unresolved_rows, ' no resueltos'
          )
          when batch.status = 'validated' and batch.review_status = 'pending'
            then 'Validado y pendiente de aprobación editorial'
          when batch.status = 'failed'
            then coalesce(batch.last_error, 'Último intento de aplicación fallido')
          else batch.status
        end
      ) as detail,
      case
        when batch.status = 'validated' and batch.review_status = 'pending'
          then 'pending_review'
        else batch.status
      end as verification_status,
      greatest(1, batch.error_rows + batch.duplicate_rows + batch.unresolved_rows)::integer as issue_count,
      batch.created_at,
      '{}'::text[] as allowed_actions
    from public.import_batches batch
    where v_can_read_imports
      and (
        batch.status in ('needs_review', 'failed')
        or (batch.status = 'validated' and batch.review_status = 'pending')
      )
      and batch.scope_entity_id is not null
      and (
        app_private.current_user_can_manage_entity('imports.prepare', batch.scope_entity_id)
        or app_private.current_user_can_manage_entity('imports.review', batch.scope_entity_id)
        or app_private.current_user_can_manage_entity('imports.apply', batch.scope_entity_id)
      )
  ),
  items as (
    select * from legacy_items
    union all
    select * from import_items
  )
  select *
  from items
  order by created_at desc, item_type, title
  limit v_limit;
end;
$$;

revoke all on function app_private.current_user_can_review_record(text, text, uuid)
from public, anon, authenticated;
revoke all on function app_private.admin_review_person_change_request(uuid, text, text)
from public, anon, authenticated;
revoke all on function app_private.admin_review_item(jsonb)
from public, anon, authenticated;
revoke all on function app_private.admin_review_queue_core(jsonb)
from public, anon, authenticated;
revoke all on function app_private.admin_review_queue(jsonb)
from public, anon, authenticated;

comment on function app_private.current_user_can_review_change_request(text, uuid) is
  'Resolves a change request to a canonical ecclesiastical entity. Unresolvable requests are restricted to super_admin.';
comment on function app_private.current_user_can_review_record(text, text, uuid) is
  'Checks review permission through canonical entity scope. Unresolvable records are restricted to super_admin.';
comment on constraint position_assignments_scope_required on public.position_assignments is
  'Every appointment must belong to an ecclesiastical entity or organization unit.';
comment on constraint import_batches_scope_entity_required on public.import_batches is
  'Every import batch must declare a canonical scope entity for country-safe review and application.';

commit;
