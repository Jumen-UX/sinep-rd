create table if not exists public.person_death_records (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references public.persons(id) on delete cascade,
  death_date date not null,
  death_place text,
  source_name text,
  source_url text,
  source_checked_at date,
  notes_public text,
  notes_internal text,
  closed_assignments_count integer not null default 0,
  registered_vacancies_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.person_death_records enable row level security;

drop policy if exists person_death_records_admin_select on public.person_death_records;
drop policy if exists person_death_records_admin_all on public.person_death_records;

create policy person_death_records_admin_select
on public.person_death_records
for select
to authenticated
using (public.current_user_has_admin_role());

create policy person_death_records_admin_all
on public.person_death_records
for all
to authenticated
using (public.current_user_has_admin_role())
with check (public.current_user_has_admin_role());

grant select, insert, update, delete on public.person_death_records to authenticated;

create or replace function public.admin_mark_person_deceased(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_person_id uuid := nullif(payload->>'person_id', '')::uuid;
  v_death_date date := nullif(payload->>'death_date', '')::date;
  v_death_place text := nullif(btrim(payload->>'death_place'), '');
  v_source_name text := nullif(btrim(payload->>'source_name'), '');
  v_source_url text := nullif(btrim(payload->>'source_url'), '');
  v_source_checked_at date := nullif(payload->>'source_checked_at', '')::date;
  v_notes_public text := nullif(btrim(payload->>'notes_public'), '');
  v_notes_internal text := nullif(btrim(payload->>'notes_internal'), '');
  v_close_assignments boolean := coalesce((payload->>'close_active_assignments')::boolean, true);
  v_register_parish_vacancy boolean := coalesce((payload->>'register_parish_vacancy')::boolean, false);
  v_person_type text;
  v_slug text;
  v_closed_count integer := 0;
  v_vacancy_count integer := 0;
  v_record_id uuid;
  v_assignment record;
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para marcar fallecimientos' using errcode = '42501';
  end if;

  if v_person_id is null then
    raise exception 'Falta seleccionar la persona' using errcode = '22023';
  end if;

  if v_death_date is null then
    raise exception 'La fecha de fallecimiento es obligatoria' using errcode = '22023';
  end if;

  select person_type, slug
  into v_person_type, v_slug
  from public.persons
  where id = v_person_id
  for update;

  if v_person_type is null then
    raise exception 'Persona no encontrada' using errcode = '22023';
  end if;

  update public.persons
  set death_date = v_death_date,
      status = 'deceased',
      notes_internal = concat_ws(E'\n', notes_internal, v_notes_internal),
      updated_at = now()
  where id = v_person_id;

  update public.clergy_profiles
  set canonical_status = 'deceased',
      notes_private = concat_ws(E'\n', notes_private, 'Marcado como fallecido en SINEP RD.'),
      updated_at = now()
  where person_id = v_person_id;

  update public.religious_profiles
  set canonical_status = 'deceased',
      notes_private = concat_ws(E'\n', notes_private, 'Marcado como fallecido en SINEP RD.'),
      updated_at = now()
  where person_id = v_person_id;

  if v_close_assignments then
    if v_register_parish_vacancy then
      for v_assignment in
        select
          pa.id,
          pa.office_configuration_id,
          pa.organization_chart_id,
          pa.organization_unit_id,
          pa.ecclesiastical_entity_id,
          pa.pastoral_entity_id,
          pa.visibility,
          pa.publication_status
        from public.position_assignments pa
        join public.office_configurations oc on oc.id = pa.office_configuration_id
        join public.ecclesiastical_entities ee on ee.id = pa.ecclesiastical_entity_id
        join public.entity_types et on et.id = ee.entity_type_id
        where pa.person_id = v_person_id
          and pa.record_status = 'active'
          and pa.is_current = true
          and pa.assignment_status in ('active','term_expired_still_serving','renewed')
          and oc.key in ('parroco_parroquial','administrador_parroquial')
          and et.key in ('parish','quasi_parish')
      loop
        insert into public.position_assignments (
          person_id,
          office_configuration_id,
          organization_chart_id,
          organization_unit_id,
          ecclesiastical_entity_id,
          pastoral_entity_id,
          start_date,
          term_start_date,
          is_current,
          assignment_status,
          selection_method,
          notes_public,
          notes_internal,
          verification_status,
          visibility,
          record_status,
          effective_date,
          publication_status
        ) values (
          null,
          v_assignment.office_configuration_id,
          v_assignment.organization_chart_id,
          v_assignment.organization_unit_id,
          v_assignment.ecclesiastical_entity_id,
          v_assignment.pastoral_entity_id,
          v_death_date,
          v_death_date,
          true,
          'vacant',
          'appointment',
          'Vacante por fallecimiento del responsable anterior.',
          'Vacante registrada automáticamente al marcar fallecimiento.',
          'pending_review',
          coalesce(v_assignment.visibility, 'internal'),
          'active',
          v_death_date,
          coalesce(v_assignment.publication_status, 'internal')
        );
        v_vacancy_count := v_vacancy_count + 1;
      end loop;
    end if;

    update public.position_assignments
    set is_current = false,
        assignment_status = 'ended',
        actual_end_date = v_death_date,
        notes_internal = concat_ws(E'\n', notes_internal, 'Cargo cerrado automáticamente por fallecimiento.'),
        updated_at = now()
    where person_id = v_person_id
      and record_status = 'active'
      and is_current = true
      and assignment_status in ('active','term_expired_still_serving','renewed');

    get diagnostics v_closed_count = row_count;
  end if;

  insert into public.person_death_records (
    person_id,
    death_date,
    death_place,
    source_name,
    source_url,
    source_checked_at,
    notes_public,
    notes_internal,
    closed_assignments_count,
    registered_vacancies_count,
    created_by
  ) values (
    v_person_id,
    v_death_date,
    v_death_place,
    v_source_name,
    v_source_url,
    v_source_checked_at,
    v_notes_public,
    v_notes_internal,
    v_closed_count,
    v_vacancy_count,
    v_user_id
  )
  on conflict (person_id) do update set
    death_date = excluded.death_date,
    death_place = coalesce(excluded.death_place, public.person_death_records.death_place),
    source_name = coalesce(excluded.source_name, public.person_death_records.source_name),
    source_url = coalesce(excluded.source_url, public.person_death_records.source_url),
    source_checked_at = coalesce(excluded.source_checked_at, public.person_death_records.source_checked_at),
    notes_public = coalesce(excluded.notes_public, public.person_death_records.notes_public),
    notes_internal = concat_ws(E'\n', public.person_death_records.notes_internal, excluded.notes_internal),
    closed_assignments_count = excluded.closed_assignments_count,
    registered_vacancies_count = excluded.registered_vacancies_count,
    updated_at = now()
  returning id into v_record_id;

  return jsonb_build_object(
    'person_id', v_person_id,
    'slug', v_slug,
    'person_type', v_person_type,
    'death_record_id', v_record_id,
    'closed_assignments_count', v_closed_count,
    'registered_vacancies_count', v_vacancy_count
  );
end;
$$;

grant execute on function public.admin_mark_person_deceased(jsonb) to authenticated;
