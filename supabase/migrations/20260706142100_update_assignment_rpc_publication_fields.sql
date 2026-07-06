-- Update transactional assignment RPC to store publication controls.
-- Applied to project hrvgpceqaxujlttpimdz on 2026-07-06.

create or replace function public.admin_save_position_assignment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_assignment_id uuid;
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
    select organization_chart_id into v_organization_chart_id from public.office_configurations where id = v_office_configuration_id;
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

  if v_predecessor_assignment_id is not null then
    update public.position_assignments
    set successor_assignment_id = v_assignment_id,
        replaced_by_assignment_id = v_assignment_id,
        is_current = false,
        assignment_status = case when assignment_status in ('active', 'term_expired_still_serving', 'vacant') then 'replaced' else assignment_status end,
        actual_end_date = coalesce(actual_end_date, v_start_date, v_effective_date),
        updated_at = now()
    where id = v_predecessor_assignment_id;
  end if;

  if v_successor_assignment_id is not null then
    update public.position_assignments
    set predecessor_assignment_id = v_assignment_id,
        updated_at = now()
    where id = v_successor_assignment_id;
  end if;

  if v_close_previous then
    update public.position_assignments
    set is_current = false,
        assignment_status = case when assignment_status in ('active', 'term_expired_still_serving', 'vacant') then 'replaced' else assignment_status end,
        actual_end_date = coalesce(actual_end_date, v_start_date, v_effective_date),
        replaced_by_assignment_id = coalesce(replaced_by_assignment_id, v_assignment_id),
        successor_assignment_id = coalesce(successor_assignment_id, v_assignment_id),
        updated_at = now()
    where id <> v_assignment_id
      and is_current = true
      and record_status = 'active'
      and office_configuration_id = v_office_configuration_id
      and organization_chart_id is not distinct from v_organization_chart_id
      and organization_unit_id is not distinct from v_organization_unit_id
      and ecclesiastical_entity_id is not distinct from v_ecclesiastical_entity_id
      and pastoral_entity_id is not distinct from v_pastoral_entity_id;
  end if;

  return jsonb_build_object('assignment_id', v_assignment_id);
end;
$$;

grant execute on function public.admin_save_position_assignment(jsonb) to authenticated;
