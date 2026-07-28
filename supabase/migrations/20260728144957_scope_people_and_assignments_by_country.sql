begin;

create or replace function app_private.person_scope_entities(p_person_id uuid)
returns table(entity_id uuid)
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select distinct scope_row.entity_id
  from (
    select assignment.ecclesiastical_entity_id as entity_id
    from public.position_assignments assignment
    where assignment.person_id = p_person_id
      and assignment.ecclesiastical_entity_id is not null

    union all

    select unit_row.ecclesiastical_entity_id
    from public.position_assignments assignment
    join public.organization_units unit_row on unit_row.id = assignment.organization_unit_id
    where assignment.person_id = p_person_id
      and unit_row.ecclesiastical_entity_id is not null

    union all

    select profile.current_service_entity_id
    from public.clergy_profiles profile
    where profile.person_id = p_person_id
      and profile.current_service_entity_id is not null

    union all

    select profile.incardination_entity_id
    from public.clergy_profiles profile
    where profile.person_id = p_person_id
      and profile.incardination_entity_id is not null

    union all

    select profile.current_service_entity_id
    from public.religious_profiles profile
    where profile.person_id = p_person_id
      and profile.current_service_entity_id is not null

    union all

    select role_row.jurisdiction_entity_id
    from public.episcopal_roles role_row
    where role_row.person_id = p_person_id
      and role_row.jurisdiction_entity_id is not null

    union all

    select incardination.incardination_entity_id
    from public.clerical_incardinations incardination
    where incardination.person_id = p_person_id
      and incardination.incardination_entity_id is not null

    union all

    select audit_row.scope_entity_id
    from public.audit_logs audit_row
    where audit_row.target_table = 'persons'
      and audit_row.target_id = p_person_id
      and audit_row.scope_entity_id is not null
  ) scope_row
  where scope_row.entity_id is not null;
$$;

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
begin
  if auth.uid() is null
     or p_person_id is null
     or nullif(p_permission_key, '') is null
     or not exists (select 1 from public.persons person_row where person_row.id = p_person_id) then
    return false;
  end if;

  if exists (
    select 1
    from app_private.person_scope_entities(p_person_id) scope_row
    where app_private.current_user_can_manage_entity(p_permission_key, scope_row.entity_id)
  ) then
    return true;
  end if;

  if not exists (select 1 from app_private.person_scope_entities(p_person_id)) then
    return app_private.current_user_has_role(array['super_admin'])
       and app_private.current_user_has_permission(p_permission_key);
  end if;

  return false;
end;
$$;

create or replace function app_private.current_user_can_read_person(p_person_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_status text;
  v_visibility text;
begin
  if p_person_id is null then
    return false;
  end if;

  select person_row.status, person_row.visibility
  into v_status, v_visibility
  from public.persons person_row
  where person_row.id = p_person_id;

  if not found then
    return false;
  end if;

  if v_status = 'active' and v_visibility = 'public' then
    return true;
  end if;

  return auth.uid() is not null
     and app_private.current_user_can_manage_person('people.view', p_person_id);
end;
$$;

create or replace function app_private.current_user_can_read_position_assignment(p_assignment_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_assignment public.position_assignments%rowtype;
  v_scope_entity_id uuid;
begin
  if p_assignment_id is null then
    return false;
  end if;

  select * into v_assignment
  from public.position_assignments assignment_row
  where assignment_row.id = p_assignment_id;

  if not found then
    return false;
  end if;

  if v_assignment.record_status = 'active'
     and v_assignment.visibility = 'public'
     and v_assignment.publication_status = 'published'
     and coalesce(v_assignment.public_from, v_assignment.start_date, v_assignment.term_start_date, current_date) <= current_date
     and (v_assignment.public_until is null or v_assignment.public_until >= current_date) then
    return true;
  end if;

  if auth.uid() is null then
    return false;
  end if;

  v_scope_entity_id := app_private.review_record_scope_entity('position_assignments', p_assignment_id);

  if v_scope_entity_id is not null then
    return app_private.current_user_can_manage_entity('appointments.view', v_scope_entity_id);
  end if;

  return app_private.current_user_has_role(array['super_admin'])
     and app_private.current_user_has_permission('appointments.view');
end;
$$;

revoke all on function app_private.person_scope_entities(uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_manage_person(text, uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_read_person(uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_read_position_assignment(uuid) from public, anon, authenticated;
grant execute on function app_private.current_user_can_read_person(uuid) to anon, authenticated;
grant execute on function app_private.current_user_can_read_position_assignment(uuid) to anon, authenticated;

create or replace function app_private.admin_list_unordained_people(p_limit integer default 250)
returns table(id uuid, display_name text, slug text)
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 250), 1), 500);
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('people.create_proposal') then
    raise exception 'No autorizado para consultar candidatos al diaconado' using errcode = '42501';
  end if;

  return query
  select
    person_row.id,
    coalesce(nullif(person_row.display_name, ''), btrim(concat_ws(' ', person_row.first_name, person_row.middle_name, person_row.last_name, person_row.second_last_name))) as display_name,
    person_row.slug
  from public.persons person_row
  where person_row.status = 'active'
    and not exists (
      select 1
      from public.ordination_events ordination
      where ordination.person_id = person_row.id
        and ordination.record_status = 'active'
    )
    and app_private.current_user_can_manage_person('people.create_proposal', person_row.id)
  order by display_name
  limit v_limit;
end;
$$;

create or replace function app_private.import_person_matches(p_value text)
returns uuid[]
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  with normalized as (
    select nullif(btrim(p_value), '') as value
  ), candidate as (
    select person_state.id, person_state.display_name
    from public.person_ecclesial_state person_state
    cross join normalized input_row
    where input_row.value is not null
      and person_state.status = 'active'
      and (
        (input_row.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and person_state.id = input_row.value::uuid)
        or lower(btrim(person_state.display_name)) = lower(input_row.value)
        or lower(btrim(coalesce(person_state.slug, ''))) = lower(input_row.value)
      )
      and app_private.current_user_can_manage_person('imports.prepare', person_state.id)
    order by person_state.display_name, person_state.id
    limit 20
  )
  select coalesce(array_agg(candidate.id order by candidate.display_name, candidate.id), '{}'::uuid[])
  from candidate;
$$;

create or replace function app_private.rpc_definer__admin_mark_person_deceased(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_person_id uuid := app_private.audit_json_uuid(payload, 'person_id');
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
  v_scope_entity_id uuid;
begin
  if v_person_id is null then
    raise exception 'Falta seleccionar la persona' using errcode = '22023';
  end if;

  if not app_private.current_user_can_manage_person('people.update_proposal', v_person_id) then
    raise exception 'La persona está fuera de tu alcance' using errcode = '42501';
  end if;

  select to_jsonb(person_row) into v_old from public.persons person_row where person_row.id = v_person_id;
  select scope_row.entity_id
  into v_scope_entity_id
  from app_private.person_scope_entities(v_person_id) scope_row
  where app_private.current_user_can_manage_entity('people.update_proposal', scope_row.entity_id)
  order by scope_row.entity_id
  limit 1;

  v_result := internal.admin_mark_person_deceased(payload);
  select to_jsonb(person_row) into v_new from public.persons person_row where person_row.id = v_person_id;

  perform public.create_audit_log(
    auth.uid(), 'people.person.deceased', 'persons', v_person_id, v_old,
    jsonb_build_object('scope_entity_id', v_scope_entity_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function app_private.rpc_definer__admin_save_position_assignment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_person_id uuid := app_private.audit_json_uuid(payload, 'person_id');
  v_entity_id uuid := app_private.audit_json_uuid(payload, 'ecclesiastical_entity_id');
  v_unit_id uuid := app_private.audit_json_uuid(payload, 'organization_unit_id');
  v_predecessor_id uuid := app_private.audit_json_uuid(payload, 'predecessor_assignment_id');
  v_successor_id uuid := app_private.audit_json_uuid(payload, 'successor_assignment_id');
  v_unit_entity_id uuid;
  v_related_scope_entity_id uuid;
  v_result jsonb;
  v_assignment_id uuid;
  v_new jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado para crear nombramientos' using errcode = '42501';
  end if;

  if v_unit_id is not null then
    select unit_row.ecclesiastical_entity_id
    into v_unit_entity_id
    from public.organization_units unit_row
    where unit_row.id = v_unit_id;

    if v_unit_entity_id is null then
      raise exception 'La unidad organizativa no tiene una entidad territorial resoluble' using errcode = '22023';
    end if;

    if v_entity_id is not null and v_entity_id <> v_unit_entity_id then
      raise exception 'La entidad del nombramiento no coincide con la unidad organizativa' using errcode = '22023';
    end if;

    v_entity_id := v_unit_entity_id;
  end if;

  if v_entity_id is null then
    raise exception 'El nombramiento debe indicar una entidad o unidad dentro de tu alcance' using errcode = '22023';
  end if;

  if not app_private.current_user_can_manage_entity('appointments.create_proposal', v_entity_id) then
    raise exception 'La entidad del nombramiento está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_person_id is null
     or not app_private.current_user_can_manage_person('appointments.create_proposal', v_person_id) then
    raise exception 'La persona del nombramiento está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_predecessor_id is not null then
    v_related_scope_entity_id := app_private.review_record_scope_entity('position_assignments', v_predecessor_id);
    if v_related_scope_entity_id is null
       or not app_private.current_user_can_manage_entity('appointments.create_proposal', v_related_scope_entity_id) then
      raise exception 'El nombramiento predecesor está fuera de tu alcance' using errcode = '42501';
    end if;
  end if;

  if v_successor_id is not null then
    v_related_scope_entity_id := app_private.review_record_scope_entity('position_assignments', v_successor_id);
    if v_related_scope_entity_id is null
       or not app_private.current_user_can_manage_entity('appointments.create_proposal', v_related_scope_entity_id) then
      raise exception 'El nombramiento sucesor está fuera de tu alcance' using errcode = '42501';
    end if;
  end if;

  v_result := internal.admin_save_position_assignment(payload);
  v_assignment_id := app_private.audit_json_uuid(v_result, 'assignment_id');
  select to_jsonb(assignment_row) into v_new from public.position_assignments assignment_row where assignment_row.id = v_assignment_id;

  perform public.create_audit_log(
    auth.uid(), 'appointments.assignment.created', 'position_assignments', v_assignment_id, null,
    jsonb_build_object(
      'scope_entity_id', v_entity_id,
      'organization_unit_id', v_unit_id,
      'record', v_new,
      'result', v_result
    ),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function app_private.rpc_definer__admin_save_canonical_person(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_selected_person_id uuid := coalesce(
    app_private.audit_json_uuid(payload, 'selected_person_id'),
    app_private.audit_json_uuid(payload, 'existing_deacon_person_id'),
    app_private.audit_json_uuid(payload, 'selected_clergy_id')
  );
  v_scope_entity_id uuid := coalesce(
    app_private.audit_json_uuid(payload, 'quick_entity_id'),
    app_private.audit_json_uuid(payload, 'assignment_entity_id'),
    app_private.audit_json_uuid(payload, 'jurisdiction_entity_id'),
    app_private.audit_json_uuid(payload, 'current_service_entity_id'),
    app_private.audit_json_uuid(payload, 'incardination_entity_id'),
    app_private.audit_json_uuid(payload, 'religious_house_entity_id')
  );
  v_has_assignment boolean := coalesce(
    app_private.audit_json_uuid(payload, 'quick_office_configuration_id'),
    app_private.audit_json_uuid(payload, 'office_configuration_id')
  ) is not null;
  v_result jsonb;
  v_person_id uuid;
  v_assignment_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_assignment_new jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado para registrar personas' using errcode = '42501';
  end if;

  if v_selected_person_id is not null
     and not app_private.current_user_can_manage_person('people.create_proposal', v_selected_person_id) then
    raise exception 'La persona seleccionada está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_scope_entity_id is not null then
    if not app_private.current_user_can_manage_entity('people.create_proposal', v_scope_entity_id) then
      raise exception 'La entidad seleccionada está fuera de tu alcance' using errcode = '42501';
    end if;
  elsif not (
    app_private.current_user_has_role(array['super_admin'])
    and app_private.current_user_has_permission('people.create_proposal')
  ) then
    raise exception 'Debes indicar una entidad dentro de tu alcance' using errcode = '42501';
  end if;

  if v_has_assignment
     and (
       v_scope_entity_id is null
       or not app_private.current_user_can_manage_entity('appointments.create_proposal', v_scope_entity_id)
     ) then
    raise exception 'No autorizado para crear el nombramiento en esta entidad' using errcode = '42501';
  end if;

  if v_selected_person_id is not null then
    select to_jsonb(person_row) into v_old from public.persons person_row where person_row.id = v_selected_person_id;
  end if;

  v_result := internal.admin_save_canonical_person(payload);
  v_person_id := app_private.audit_json_uuid(v_result, 'person_id');
  v_assignment_id := app_private.audit_json_uuid(v_result, 'assignment_id');
  select to_jsonb(person_row) into v_new from public.persons person_row where person_row.id = v_person_id;

  perform public.create_audit_log(
    auth.uid(),
    case when v_old is null then 'people.person.created' else 'people.person.updated' end,
    'persons', v_person_id, v_old,
    jsonb_build_object('scope_entity_id', v_scope_entity_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  if v_assignment_id is not null then
    select to_jsonb(assignment_row) into v_assignment_new from public.position_assignments assignment_row where assignment_row.id = v_assignment_id;
    perform public.create_audit_log(
      auth.uid(), 'appointments.assignment.created', 'position_assignments', v_assignment_id, null,
      jsonb_build_object('scope_entity_id', v_scope_entity_id, 'record', v_assignment_new, 'source', 'canonical_person_registration'),
      app_private.audit_json_uuid(payload, 'change_request_id')
    );
  end if;

  return v_result;
end;
$$;

create or replace function public.admin_check_position_assignment_eligibility(
  p_person_id uuid,
  p_office_configuration_id uuid,
  p_ecclesiastical_entity_id uuid default null
)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, auth, pg_temp
as $$
begin
  if auth.uid() is null
     or not app_private.current_user_can_manage_person('appointments.create_proposal', p_person_id) then
    raise exception 'No autorizado para consultar elegibilidad de esta persona' using errcode = '42501';
  end if;

  if p_ecclesiastical_entity_id is not null
     and not app_private.current_user_can_manage_entity('appointments.create_proposal', p_ecclesiastical_entity_id) then
    raise exception 'La entidad está fuera de tu alcance' using errcode = '42501';
  end if;

  return internal.evaluate_position_assignment_eligibility(
    p_person_id, p_office_configuration_id, p_ecclesiastical_entity_id, null, true
  );
end;
$$;

revoke insert, update, delete on table public.religious_profiles from authenticated;
revoke insert, update, delete on table public.ordination_events from authenticated;

drop policy if exists phase0_persons_select_680ef21 on public.persons;
drop policy if exists phase0_persons_insert_4f1ea1b on public.persons;
drop policy if exists phase0_persons_update_07db518 on public.persons;
drop policy if exists phase0_persons_remove_7fb39f7 on public.persons;
create policy persons_select_anon_public
on public.persons for select to anon
using (status = 'active' and visibility = 'public');
create policy persons_select_authenticated_scoped
on public.persons for select to authenticated
using (app_private.current_user_can_read_person(id));

drop policy if exists phase0_clergy_profiles_select_1e5ff8f on public.clergy_profiles;
create policy clergy_profiles_select_anon_public
on public.clergy_profiles for select to anon
using (
  exists (
    select 1 from public.persons person_row
    where person_row.id = person_id
      and person_row.status = 'active'
      and person_row.visibility = 'public'
  )
);
create policy clergy_profiles_select_authenticated_scoped
on public.clergy_profiles for select to authenticated
using (app_private.current_user_can_read_person(person_id));

drop policy if exists religious_profiles_public_membership_select on public.religious_profiles;
drop policy if exists phase0_religious_profiles_insert_af257c1 on public.religious_profiles;
drop policy if exists phase0_religious_profiles_remove_3bbc104 on public.religious_profiles;
drop policy if exists phase0_religious_profiles_select_70f9b33 on public.religious_profiles;
drop policy if exists phase0_religious_profiles_update_45f3ce0 on public.religious_profiles;
create policy religious_profiles_select_anon_public
on public.religious_profiles for select to anon
using (
  exists (
    select 1 from public.persons person_row
    where person_row.id = person_id
      and person_row.status = 'active'
      and person_row.visibility = 'public'
  )
);
create policy religious_profiles_select_authenticated_scoped
on public.religious_profiles for select to authenticated
using (app_private.current_user_can_read_person(person_id));

drop policy if exists phase0_position_assignments_select_f0ec817 on public.position_assignments;
drop policy if exists public_dashboard_position_assignments_select on public.position_assignments;
create policy position_assignments_select_anon_public
on public.position_assignments for select to anon
using (
  record_status = 'active'
  and visibility = 'public'
  and publication_status = 'published'
  and coalesce(public_from, start_date, term_start_date, current_date) <= current_date
  and (public_until is null or public_until >= current_date)
);
create policy position_assignments_select_authenticated_scoped
on public.position_assignments for select to authenticated
using (app_private.current_user_can_read_position_assignment(id));

drop policy if exists ordination_events_admin_delete_policy on public.ordination_events;
drop policy if exists ordination_events_admin_insert_policy on public.ordination_events;
drop policy if exists ordination_events_admin_update_policy on public.ordination_events;
drop policy if exists ordination_events_select_policy on public.ordination_events;
create policy ordination_events_select_anon_public
on public.ordination_events for select to anon
using (
  record_status = 'active'
  and visibility = 'public'
  and exists (
    select 1 from public.persons person_row
    where person_row.id = person_id
      and person_row.status = 'active'
      and person_row.visibility = 'public'
  )
);
create policy ordination_events_select_authenticated_scoped
on public.ordination_events for select to authenticated
using (app_private.current_user_can_read_person(person_id));

comment on function app_private.person_scope_entities(uuid) is
  'Canonical person-to-entity projection from assignments, clergy/religious service, episcopal roles, incardination and audit scope.';
comment on function app_private.current_user_can_manage_person(text, uuid) is
  'Authorizes person management through at least one canonical entity in the actor country. Fully unscoped people are super_admin-only.';
comment on function app_private.current_user_can_read_person(uuid) is
  'Public active people remain visible; internal people require people.view through canonical person scope.';
comment on function app_private.current_user_can_read_position_assignment(uuid) is
  'Published assignments remain public; internal assignments require appointments.view through their canonical entity.';

commit;
