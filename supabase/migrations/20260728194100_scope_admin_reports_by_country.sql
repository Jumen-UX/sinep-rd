create or replace function app_private.rpc_definer__get_admin_contextual_kpis(
  p_scope_type text,
  p_scope_entity_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_entity_ids uuid[];
  v_active_entities bigint;
  v_active_parishes bigint;
  v_active_assignments bigint;
  v_pending_reviews bigint;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_scope_type not in ('national', 'diocese', 'parish', 'entity') then
    raise exception 'UNSUPPORTED_SCOPE_TYPE' using errcode = '22023';
  end if;

  if p_scope_entity_id is null then
    raise exception 'SCOPE_ENTITY_REQUIRED' using errcode = '22023';
  end if;

  if not app_private.current_user_can_manage_entity('entities.view', p_scope_entity_id) then
    raise exception 'SCOPE_FORBIDDEN' using errcode = '42501';
  end if;

  select array_agg(scoped.scope_entity_id)
  into v_entity_ids
  from (
    select p_scope_entity_id as scope_entity_id
    union
    select descendant.id
    from public.get_entity_descendants(p_scope_entity_id, 20) descendant
  ) scoped;

  select count(*)
  into v_active_entities
  from public.ecclesiastical_entities entity_row
  where entity_row.status = 'active'
    and entity_row.id = any(v_entity_ids);

  select count(*)
  into v_active_parishes
  from public.ecclesiastical_entities entity_row
  join public.entity_types entity_type on entity_type.id = entity_row.entity_type_id
  where entity_row.status = 'active'
    and entity_row.id = any(v_entity_ids)
    and entity_type.key in ('parish', 'quasi_parish');

  select count(*)
  into v_active_assignments
  from public.position_assignments assignment
  left join public.organization_units unit_row on unit_row.id = assignment.organization_unit_id
  where assignment.record_status = 'active'
    and assignment.assignment_status = 'active'
    and assignment.is_current = true
    and (
      assignment.ecclesiastical_entity_id = any(v_entity_ids)
      or unit_row.ecclesiastical_entity_id = any(v_entity_ids)
    );

  select count(*)
  into v_pending_reviews
  from public.change_requests request
  left join public.organization_units unit_row on unit_row.id = request.organization_unit_id
  where request.status = 'pending_review'
    and (
      request.scope_entity_id = any(v_entity_ids)
      or request.diocese_id = any(v_entity_ids)
      or unit_row.ecclesiastical_entity_id = any(v_entity_ids)
    );

  return jsonb_build_object(
    'territorial.active_entities', v_active_entities,
    'territorial.active_parishes', v_active_parishes,
    'administrative.active_assignments', v_active_assignments,
    'administrative.pending_reviews', v_pending_reviews
  );
end;
$$;

create or replace function public.get_admin_contextual_kpis(
  p_scope_type text,
  p_scope_entity_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.rpc_definer__get_admin_contextual_kpis(
    p_scope_type,
    p_scope_entity_id
  );
$$;

create or replace function app_private.rpc_definer__admin_imported_appointment_review_summary()
returns table(metric text, value bigint)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('appointments.view') then
    raise exception 'No autorizado para ver resumen de nombramientos importados.' using errcode = '42501';
  end if;

  return query
  with scoped_rows as (
    select review_row.*
    from public.admin_imported_appointment_review review_row
    where review_row.parish_id is not null
      and app_private.current_user_can_manage_entity(
        'appointments.view',
        review_row.parish_id
      )
  )
  select 'total'::text, count(*)::bigint from scoped_rows
  union all
  select 'pending_review', count(*)::bigint from scoped_rows where review_state = 'pending_review'
  union all
  select 'approved_internal', count(*)::bigint from scoped_rows where review_state = 'approved_internal'
  union all
  select 'published', count(*)::bigint from scoped_rows where review_state = 'published'
  union all
  select 'needs_correction', count(*)::bigint from scoped_rows where review_state = 'needs_correction'
  union all
  select 'internal_assignments', count(*)::bigint from scoped_rows where visibility = 'internal'
  union all
  select 'internal_people', count(*)::bigint from scoped_rows where person_visibility = 'internal';
end;
$$;

create or replace function app_private.rpc_definer__get_institutional_state_reconstruction(
  p_entity_id uuid default null,
  p_organization_unit_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Autenticación requerida.' using errcode = '42501';
  end if;

  if (p_entity_id is null and p_organization_unit_id is null)
     or (p_entity_id is not null and p_organization_unit_id is not null) then
    raise exception 'Debes indicar exactamente una entidad o unidad organizativa.' using errcode = '22023';
  end if;

  if p_entity_id is not null
     and not app_private.current_user_can_manage_entity('events.view', p_entity_id) then
    raise exception 'La entidad solicitada está fuera de tu alcance histórico.' using errcode = '42501';
  end if;

  if p_organization_unit_id is not null
     and not app_private.current_user_can_manage_organization_unit(
       'events.view',
       p_organization_unit_id
     ) then
    raise exception 'La unidad solicitada está fuera de tu alcance histórico.' using errcode = '42501';
  end if;

  with applied_history as (
    select timeline.*
    from public.canonical_institutional_timeline timeline
    where timeline.workflow_status = 'applied'
      and (
        (p_entity_id is not null and timeline.entity_id = p_entity_id)
        or
        (p_organization_unit_id is not null and timeline.organization_unit_id = p_organization_unit_id)
      )
    order by timeline.timeline_date,
             timeline.applied_at,
             timeline.event_id,
             timeline.participant_id
  ),
  latest_projection as (
    select history.after_state, history.event_id, history.timeline_date
    from applied_history history
    where history.after_state is not null
    order by history.timeline_date desc,
             history.applied_at desc,
             history.event_id desc,
             history.participant_id desc
    limit 1
  ),
  current_state as (
    select jsonb_strip_nulls(jsonb_build_object(
      'id', entity_row.id,
      'name', entity_row.name,
      'official_name', entity_row.official_name,
      'status', entity_row.status,
      'visibility', entity_row.visibility,
      'erected_at', entity_row.erected_at,
      'suppressed_at', entity_row.suppressed_at
    )) as data
    from public.ecclesiastical_entities entity_row
    where entity_row.id = p_entity_id

    union all

    select jsonb_strip_nulls(jsonb_build_object(
      'id', unit_row.id,
      'name', unit_row.name,
      'parent_unit_id', unit_row.parent_unit_id,
      'status', unit_row.status,
      'visibility', unit_row.visibility,
      'valid_from', unit_row.valid_from,
      'valid_to', unit_row.valid_to,
      'is_current', unit_row.is_current
    )) as data
    from public.organization_units unit_row
    where unit_row.id = p_organization_unit_id
  )
  select jsonb_build_object(
    'valid_target', true,
    'target_kind', case when p_entity_id is not null then 'entity' else 'organization_unit' end,
    'target_id', coalesce(p_entity_id, p_organization_unit_id),
    'applied_event_count', (select count(*) from applied_history),
    'latest_applied_event_id', (select event_id from latest_projection),
    'latest_timeline_date', (select timeline_date from latest_projection),
    'reconstructed_state', (select after_state from latest_projection),
    'current_state', (select data from current_state limit 1),
    'reconstruction_available', exists(select 1 from latest_projection),
    'matches_current_state', case
      when not exists(select 1 from latest_projection) then null
      else (select after_state from latest_projection) <@ coalesce((select data from current_state limit 1), '{}'::jsonb)
    end,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_id', event_id,
        'event_type_key', event_type_key,
        'title', title,
        'timeline_date', timeline_date,
        'participant_role', participant_role,
        'before_state', before_state,
        'after_state', after_state
      ) order by timeline_date, applied_at, event_id, participant_id)
      from applied_history
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_institutional_state_reconstruction(
  p_entity_id uuid default null,
  p_organization_unit_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.rpc_definer__get_institutional_state_reconstruction(
    p_entity_id,
    p_organization_unit_id
  );
$$;

revoke all on function app_private.rpc_definer__get_admin_contextual_kpis(text, uuid) from public, anon, authenticated;
grant execute on function app_private.rpc_definer__get_admin_contextual_kpis(text, uuid) to authenticated;
revoke all on function public.get_admin_contextual_kpis(text, uuid) from public, anon;
grant execute on function public.get_admin_contextual_kpis(text, uuid) to authenticated;

revoke all on function app_private.rpc_definer__admin_imported_appointment_review_summary() from public, anon, authenticated;
grant execute on function app_private.rpc_definer__admin_imported_appointment_review_summary() to authenticated;
revoke all on function public.admin_imported_appointment_review_summary() from public, anon;
grant execute on function public.admin_imported_appointment_review_summary() to authenticated;

revoke all on function app_private.rpc_definer__get_institutional_state_reconstruction(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.rpc_definer__get_institutional_state_reconstruction(uuid, uuid) to authenticated;
revoke all on function public.get_institutional_state_reconstruction(uuid, uuid) from public, anon;
grant execute on function public.get_institutional_state_reconstruction(uuid, uuid) to authenticated;

comment on function public.get_admin_contextual_kpis(text, uuid)
is 'Calcula indicadores exclusivamente dentro de una raíz territorial autorizada, incluido el país para administradores nacionales.';

comment on function public.get_institutional_state_reconstruction(uuid, uuid)
is 'Reconstruye la historia aplicada de una entidad o unidad únicamente cuando el actor posee events.view en ese ámbito.';