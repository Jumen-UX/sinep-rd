-- Priority 0: transactional bishop save + RLS advisor fixes.
-- This migration was applied to project hrvgpceqaxujlttpimdz on 2026-07-04.

create or replace function public.current_user_has_admin_role()
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and (ura.ends_at is null or ura.ends_at >= now())
      and r.key in (
        'super_admin',
        'national_admin',
        'diocesan_admin',
        'diocesan_editor',
        'vicariate_editor',
        'zone_editor',
        'parish_editor',
        'pastoral_editor'
      )
  );
$$;

grant execute on function public.current_user_has_admin_role() to authenticated;

create or replace function public.admin_save_bishop(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_mode text := coalesce(payload->>'mode', 'existing');
  v_person_id uuid;
  v_slug text;
  v_name text;
  v_first_name text;
  v_last_name text;
  v_office_configuration_id uuid;
  v_assignment_entity_id uuid;
  v_organization_chart_id uuid;
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar obispos' using errcode = '42501';
  end if;

  if v_mode = 'existing' then
    v_person_id := nullif(payload->>'selected_clergy_id', '')::uuid;

    if v_person_id is null then
      raise exception 'Falta seleccionar la persona existente' using errcode = '22023';
    end if;

    update public.persons
    set person_type = 'bishop'
    where id = v_person_id
    returning slug into v_slug;

    if v_slug is null then
      raise exception 'Persona no encontrada' using errcode = '22023';
    end if;
  else
    v_first_name := nullif(btrim(payload->>'first_name'), '');
    v_last_name := nullif(btrim(payload->>'last_name'), '');
    v_name := coalesce(nullif(btrim(payload->>'display_name'), ''), concat_ws(' ', v_first_name, nullif(btrim(payload->>'middle_name'), ''), v_last_name, nullif(btrim(payload->>'second_last_name'), '')));
    v_slug := nullif(btrim(payload->>'slug'), '');

    if v_first_name is null or v_last_name is null or v_name is null or v_slug is null then
      raise exception 'Nombre, apellido, nombre público y slug son obligatorios' using errcode = '22023';
    end if;

    insert into public.persons (
      first_name,
      middle_name,
      last_name,
      second_last_name,
      display_name,
      slug,
      person_type,
      gender,
      birth_date,
      birth_place,
      biography_public,
      status,
      visibility,
      created_by
    ) values (
      v_first_name,
      nullif(btrim(payload->>'middle_name'), ''),
      v_last_name,
      nullif(btrim(payload->>'second_last_name'), ''),
      v_name,
      v_slug,
      'bishop',
      'male',
      nullif(payload->>'birth_date', '')::date,
      nullif(btrim(payload->>'birth_place'), ''),
      nullif(btrim(payload->>'biography_public'), ''),
      'active',
      'public',
      v_user_id
    )
    returning id, slug into v_person_id, v_slug;
  end if;

  insert into public.clergy_profiles (
    person_id,
    incardination_entity_id,
    current_service_entity_id,
    priestly_ordination_date,
    episcopal_ordination_date,
    religious_order,
    canonical_status
  ) values (
    v_person_id,
    nullif(payload->>'incardination_entity_id', '')::uuid,
    nullif(payload->>'assignment_entity_id', '')::uuid,
    nullif(payload->>'priestly_ordination_date', '')::date,
    nullif(payload->>'episcopal_ordination_date', '')::date,
    nullif(btrim(payload->>'religious_order'), ''),
    'active'
  )
  on conflict (person_id) do update set
    incardination_entity_id = excluded.incardination_entity_id,
    current_service_entity_id = excluded.current_service_entity_id,
    priestly_ordination_date = coalesce(excluded.priestly_ordination_date, public.clergy_profiles.priestly_ordination_date),
    episcopal_ordination_date = coalesce(excluded.episcopal_ordination_date, public.clergy_profiles.episcopal_ordination_date),
    religious_order = coalesce(excluded.religious_order, public.clergy_profiles.religious_order),
    canonical_status = excluded.canonical_status;

  insert into public.episcopal_ordinations (
    bishop_person_id,
    ordination_date,
    ordination_place,
    principal_consecrator_person_id,
    co_consecrator_1_person_id,
    co_consecrator_2_person_id,
    principal_consecrator_name,
    co_consecrator_1_name,
    co_consecrator_2_name,
    source_name,
    source_url,
    source_checked_at,
    verification_status,
    visibility,
    status,
    notes_public,
    notes_internal,
    created_by
  ) values (
    v_person_id,
    nullif(payload->>'episcopal_ordination_date', '')::date,
    nullif(btrim(payload->>'ordination_place'), ''),
    nullif(payload->>'principal_consecrator_person_id', '')::uuid,
    nullif(payload->>'co_consecrator_1_person_id', '')::uuid,
    nullif(payload->>'co_consecrator_2_person_id', '')::uuid,
    nullif(btrim(payload->>'principal_consecrator_name'), ''),
    nullif(btrim(payload->>'co_consecrator_1_name'), ''),
    nullif(btrim(payload->>'co_consecrator_2_name'), ''),
    nullif(btrim(payload->>'source_name'), ''),
    nullif(btrim(payload->>'source_url'), ''),
    nullif(payload->>'source_checked_at', '')::date,
    'pending_review',
    'public',
    'active',
    nullif(btrim(payload->>'ordination_notes_public'), ''),
    'Guardado desde asistente transaccional de obispo.',
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
    visibility = 'public';

  v_office_configuration_id := nullif(payload->>'office_configuration_id', '')::uuid;
  v_assignment_entity_id := nullif(payload->>'assignment_entity_id', '')::uuid;

  if v_office_configuration_id is not null then
    select organization_chart_id
    into v_organization_chart_id
    from public.office_configurations
    where id = v_office_configuration_id;

    update public.position_assignments
    set is_current = false,
        assignment_status = 'ended',
        actual_end_date = coalesce(nullif(payload->>'appointment_start_date', '')::date, current_date)
    where person_id = v_person_id
      and office_configuration_id = v_office_configuration_id
      and ecclesiastical_entity_id is not distinct from v_assignment_entity_id
      and is_current = true;

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
      nullif(btrim(payload->>'title_override'), ''),
      nullif(payload->>'appointment_start_date', '')::date,
      nullif(payload->>'appointment_start_date', '')::date,
      true,
      'active',
      'appointment',
      nullif(btrim(payload->>'appointment_notes_public'), ''),
      'Cargo episcopal creado desde asistente transaccional.',
      'pending_review',
      'public',
      'active'
    );
  end if;

  return jsonb_build_object('person_id', v_person_id, 'slug', v_slug);
end;
$$;

grant execute on function public.admin_save_bishop(jsonb) to authenticated;

alter view if exists public.public_entity_hierarchy_paths set (security_invoker = true);
alter view if exists public.public_position_assignments_with_hierarchy set (security_invoker = true);
alter view if exists public.public_office_canonical_help set (security_invoker = true);
alter view if exists public.public_canonical_office_definitions set (security_invoker = true);
alter view if exists public.admin_entity_completeness set (security_invoker = true);
alter view if exists public.admin_person_completeness set (security_invoker = true);
alter view if exists public.admin_public_change_suggestions set (security_invoker = true);

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'canonical_office_definitions',
    'canonical_sources',
    'office_base_roles',
    'office_canonical_links',
    'office_categories',
    'office_configurations',
    'office_scopes',
    'organization_charts',
    'organization_units'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = tbl
        and policyname = tbl || '_select_authenticated'
    ) then
      execute format('create policy %I on public.%I for select to authenticated using (true)', tbl || '_select_authenticated', tbl);
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'position_assignments'
      and policyname = 'position_assignments_select_admin_or_public'
  ) then
    create policy position_assignments_select_admin_or_public
    on public.position_assignments
    for select
    to authenticated
    using (visibility = 'public' or (select public.current_user_has_admin_role()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'position_assignments'
      and policyname = 'position_assignments_write_admin'
  ) then
    create policy position_assignments_write_admin
    on public.position_assignments
    for all
    to authenticated
    using ((select public.current_user_has_admin_role()))
    with check ((select public.current_user_has_admin_role()));
  end if;
end $$;

drop policy if exists public_change_suggestions_admin_update on public.public_change_suggestions;
create policy public_change_suggestions_admin_update
on public.public_change_suggestions
for update
to authenticated
using ((select public.current_user_has_admin_role()))
with check ((select public.current_user_has_admin_role()));
