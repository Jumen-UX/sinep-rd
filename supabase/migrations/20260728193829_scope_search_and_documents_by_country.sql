create or replace function app_private.current_user_can_manage_person(
  p_permission_key text,
  p_person_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select auth.uid() is not null
     and p_person_id is not null
     and nullif(p_permission_key, '') is not null
     and app_private.current_user_has_permission(p_permission_key)
     and (
       exists (
         select 1
         from app_private.person_scope_entities(p_person_id) scope_row
         where app_private.current_user_can_manage_entity(
           p_permission_key,
           scope_row.entity_id
         )
       )
       or exists (
         select 1
         from public.position_assignments assignment
         where assignment.person_id = p_person_id
           and assignment.organization_unit_id is not null
           and app_private.current_user_can_manage_organization_unit(
             p_permission_key,
             assignment.organization_unit_id
           )
       )
       or exists (
         select 1
         from public.appointments appointment
         where appointment.person_id = p_person_id
           and appointment.organization_unit_id is not null
           and app_private.current_user_can_manage_organization_unit(
             p_permission_key,
             appointment.organization_unit_id
           )
       )
       or (
         app_private.current_user_has_role(array['super_admin'])
         and not exists (
           select 1 from app_private.person_scope_entities(p_person_id)
         )
       )
     );
$$;

create or replace function app_private.admin_list_people(
  p_search text default null,
  p_limit integer default 120
)
returns table(
  person_id uuid,
  display_name text,
  person_type text,
  status text,
  visibility text,
  current_entity_id uuid,
  current_entity_name text,
  current_organization_unit_id uuid,
  current_organization_unit_name text,
  incardination_entity_id uuid,
  incardination_entity_name text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 120), 1), 250);
  v_search text := nullif(btrim(p_search), '');
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('people.view') then
    raise exception 'No autorizado para consultar personas.' using errcode = '42501';
  end if;

  return query
  with current_assignments as (
    select distinct on (appointment.person_id)
      appointment.person_id,
      appointment.entity_id,
      appointment.organization_unit_id
    from public.appointments appointment
    where appointment.status = 'active'
      and appointment.is_current = true
      and (appointment.visibility is null or appointment.visibility <> 'private')
      and (
        (
          appointment.entity_id is not null
          and app_private.current_user_can_manage_entity('people.view', appointment.entity_id)
        )
        or (
          appointment.organization_unit_id is not null
          and app_private.current_user_can_manage_organization_unit(
            'people.view',
            appointment.organization_unit_id
          )
        )
      )
    order by appointment.person_id,
             appointment.start_date desc nulls last,
             appointment.created_at desc
  )
  select
    person_row.id,
    coalesce(
      nullif(person_row.display_name, ''),
      btrim(concat_ws(' ', person_row.first_name, person_row.middle_name, person_row.last_name, person_row.second_last_name))
    ),
    person_row.person_type,
    person_row.status,
    person_row.visibility,
    visible_entity.id,
    visible_entity.name,
    current_assignment.organization_unit_id,
    visible_unit.name,
    visible_incardination.id,
    visible_incardination.name,
    person_row.updated_at
  from public.persons person_row
  left join public.clergy_profiles clergy_profile on clergy_profile.person_id = person_row.id
  left join current_assignments current_assignment on current_assignment.person_id = person_row.id
  left join lateral (
    select entity_row.id, entity_row.name
    from (
      values
        (1, current_assignment.entity_id),
        (2, clergy_profile.current_service_entity_id),
        (3, clergy_profile.religious_house_entity_id)
    ) candidate(priority, entity_id)
    join public.ecclesiastical_entities entity_row on entity_row.id = candidate.entity_id
    where app_private.current_user_can_manage_entity('people.view', entity_row.id)
    order by candidate.priority
    limit 1
  ) visible_entity on true
  left join public.organization_units visible_unit
    on visible_unit.id = current_assignment.organization_unit_id
   and app_private.current_user_can_manage_organization_unit('people.view', visible_unit.id)
  left join public.ecclesiastical_entities visible_incardination
    on visible_incardination.id = clergy_profile.incardination_entity_id
   and app_private.current_user_can_manage_entity('people.view', visible_incardination.id)
  where (person_row.status is null or person_row.status not in ('deleted', 'archived'))
    and (person_row.visibility is null or person_row.visibility <> 'private')
    and app_private.current_user_can_manage_person('people.view', person_row.id)
    and (
      v_search is null
      or person_row.display_name ilike '%' || v_search || '%'
      or person_row.first_name ilike '%' || v_search || '%'
      or person_row.last_name ilike '%' || v_search || '%'
      or person_row.person_type ilike '%' || v_search || '%'
      or visible_entity.name ilike '%' || v_search || '%'
      or visible_unit.name ilike '%' || v_search || '%'
      or visible_incardination.name ilike '%' || v_search || '%'
    )
  order by 2 asc nulls last, person_row.updated_at desc
  limit v_limit;
end;
$$;

create or replace function app_private.admin_search_catalog(
  p_query text,
  p_limit integer default 30
)
returns table(
  result_type text,
  result_id uuid,
  title text,
  subtitle text,
  href text,
  rank integer
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_query text := nullif(btrim(p_query), '');
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 60);
begin
  if auth.uid() is null then
    raise exception 'Autenticación requerida.' using errcode = '42501';
  end if;

  if v_query is null or char_length(v_query) < 2 then
    return;
  end if;

  return query
  with people as (
    select
      'person'::text as result_type,
      person_row.person_id as result_id,
      coalesce(person_row.display_name, 'Persona sin nombre') as title,
      concat_ws(
        ' · ',
        nullif(person_row.person_type, ''),
        nullif(person_row.current_entity_name, ''),
        nullif(person_row.current_organization_unit_name, '')
      ) as subtitle,
      '/admin/personas/' || person_row.person_id::text as href,
      case
        when lower(coalesce(person_row.display_name, '')) = lower(v_query) then 0
        when lower(coalesce(person_row.display_name, '')) like lower(v_query) || '%' then 10
        else 20
      end as rank
    from app_private.admin_list_people(v_query, v_limit) person_row
  ),
  entities as (
    select
      'entity'::text,
      entity_row.id,
      entity_row.name,
      concat_ws(
        ' · ',
        nullif(entity_type.name, ''),
        nullif(entity_row.municipality, ''),
        nullif(entity_row.province, '')
      ),
      '/admin/jurisdicciones?entity=' || entity_row.id::text,
      case
        when lower(entity_row.name) = lower(v_query) then 1
        when lower(entity_row.name) like lower(v_query) || '%' then 11
        else 21
      end
    from public.ecclesiastical_entities entity_row
    left join public.entity_types entity_type on entity_type.id = entity_row.entity_type_id
    where app_private.current_user_has_permission('entities.view')
      and entity_row.status not in ('deleted', 'archived')
      and (
        entity_row.name ilike '%' || v_query || '%'
        or entity_row.official_name ilike '%' || v_query || '%'
        or entity_row.slug ilike '%' || v_query || '%'
      )
      and app_private.current_user_can_manage_entity('entities.view', entity_row.id)
    limit v_limit
  ),
  units as (
    select
      'organization_unit'::text,
      unit_row.id,
      unit_row.name,
      concat_ws(' · ', nullif(chart_row.name, ''), nullif(entity_row.name, '')),
      '/admin/organizacion?unit=' || unit_row.id::text,
      case
        when lower(unit_row.name) = lower(v_query) then 2
        when lower(unit_row.name) like lower(v_query) || '%' then 12
        else 22
      end
    from public.organization_units unit_row
    join public.organization_charts chart_row on chart_row.id = unit_row.organization_chart_id
    left join public.ecclesiastical_entities entity_row on entity_row.id = unit_row.ecclesiastical_entity_id
    where app_private.current_user_has_permission('pastorals.view')
      and unit_row.status not in ('deleted', 'archived')
      and unit_row.name ilike '%' || v_query || '%'
      and app_private.current_user_can_manage_organization_unit('pastorals.view', unit_row.id)
    limit v_limit
  )
  select *
  from (
    select * from people
    union all
    select * from entities
    union all
    select * from units
  ) results
  order by results.rank, results.title
  limit v_limit;
end;
$$;

create or replace function app_private.document_scope_entities(p_document_id uuid)
returns table(entity_id uuid)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  with document_row as (
    select * from public.documents document where document.id = p_document_id
  ), entity_candidates as (
    select document.related_entity_id as entity_id
    from document_row document

    union all
    select unit_row.ecclesiastical_entity_id
    from document_row document
    join public.organization_units unit_row on unit_row.id = document.related_organization_unit_id

    union all
    select appointment.entity_id
    from document_row document
    join public.appointments appointment on appointment.id = document.related_appointment_id

    union all
    select unit_row.ecclesiastical_entity_id
    from document_row document
    join public.appointments appointment on appointment.id = document.related_appointment_id
    join public.organization_units unit_row on unit_row.id = appointment.organization_unit_id

    union all
    select movement.entity_id
    from document_row document
    join public.movements movement on movement.id = document.related_movement_id

    union all
    select unit_row.ecclesiastical_entity_id
    from document_row document
    join public.movements movement on movement.id = document.related_movement_id
    join public.organization_units unit_row on unit_row.id = movement.organization_unit_id

    union all
    select person_scope.entity_id
    from document_row document
    cross join lateral app_private.person_scope_entities(document.related_person_id) person_scope
    where document.related_person_id is not null
  )
  select distinct candidate.entity_id
  from entity_candidates candidate
  where candidate.entity_id is not null;
$$;

create or replace function app_private.document_scope_units(p_document_id uuid)
returns table(organization_unit_id uuid)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  with document_row as (
    select * from public.documents document where document.id = p_document_id
  ), unit_candidates as (
    select document.related_organization_unit_id as organization_unit_id
    from document_row document

    union all
    select appointment.organization_unit_id
    from document_row document
    join public.appointments appointment on appointment.id = document.related_appointment_id

    union all
    select movement.organization_unit_id
    from document_row document
    join public.movements movement on movement.id = document.related_movement_id

    union all
    select assignment.organization_unit_id
    from document_row document
    join public.position_assignments assignment on assignment.person_id = document.related_person_id
    where document.related_person_id is not null
  )
  select distinct candidate.organization_unit_id
  from unit_candidates candidate
  where candidate.organization_unit_id is not null;
$$;

create or replace function app_private.current_user_can_manage_document(
  p_permission_key text,
  p_document_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select auth.uid() is not null
     and p_document_id is not null
     and nullif(p_permission_key, '') is not null
     and app_private.current_user_has_permission(p_permission_key)
     and (
       exists (
         select 1
         from app_private.document_scope_entities(p_document_id) scope_row
         where app_private.current_user_can_manage_entity(
           p_permission_key,
           scope_row.entity_id
         )
       )
       or exists (
         select 1
         from app_private.document_scope_units(p_document_id) scope_row
         where app_private.current_user_can_manage_organization_unit(
           p_permission_key,
           scope_row.organization_unit_id
         )
       )
       or (
         app_private.current_user_has_role(array['super_admin'])
         and not exists (select 1 from app_private.document_scope_entities(p_document_id))
         and not exists (select 1 from app_private.document_scope_units(p_document_id))
       )
     );
$$;

create or replace function app_private.current_user_can_view_document(
  p_document_id uuid,
  p_visibility text,
  p_status text
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select (
    p_visibility = 'public'
    and p_status in ('active', 'approved')
  ) or (
    auth.uid() is not null
    and case
      when p_visibility in ('private', 'confidential') then
        app_private.current_user_can_manage_document('documents.view_private', p_document_id)
      else
        app_private.current_user_can_manage_document('documents.view', p_document_id)
    end
  );
$$;

create or replace function app_private.rpc_definer__admin_list_documents(
  p_scope_entity_id uuid default null,
  p_search text default null,
  p_visibility text default null,
  p_include_inactive boolean default false,
  p_limit integer default 250
)
returns table(
  id uuid,
  title text,
  document_type text,
  document_number text,
  issuing_authority text,
  document_date date,
  file_path text,
  external_url text,
  mime_type text,
  file_size_bytes bigint,
  description text,
  visibility text,
  status text,
  related_person_id uuid,
  related_entity_id uuid,
  related_organization_unit_id uuid,
  related_appointment_id uuid,
  related_movement_id uuid,
  matched_scope_entity_id uuid,
  country_iso2 char(2),
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_scope_entity_id uuid := p_scope_entity_id;
  v_search text := nullif(btrim(p_search), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 250), 1000));
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('documents.view') then
    raise exception 'No autorizado para consultar documentos.' using errcode = '42501';
  end if;

  if p_visibility is not null
     and p_visibility not in ('public', 'internal', 'private', 'confidential') then
    raise exception 'La visibilidad solicitada no es válida.' using errcode = '22023';
  end if;

  if v_scope_entity_id is null then
    v_scope_entity_id := app_private.current_user_root_jurisdiction_id();
  end if;

  if v_scope_entity_id is null then
    select membership.country_entity_id
    into v_scope_entity_id
    from app_private.user_country_memberships membership
    where membership.user_id = auth.uid()
      and membership.status = 'active'
    order by membership.started_at, membership.country_iso2
    limit 1;
  end if;

  if v_scope_entity_id is null
     and not app_private.current_user_has_role(array['super_admin']) then
    raise exception 'Debes consultar documentos dentro de una entidad autorizada.' using errcode = '42501';
  end if;

  if v_scope_entity_id is not null
     and not app_private.current_user_can_manage_entity('documents.view', v_scope_entity_id) then
    raise exception 'La entidad solicitada está fuera de tu alcance documental.' using errcode = '42501';
  end if;

  return query
  select
    document.id,
    document.title,
    document.document_type,
    document.document_number,
    document.issuing_authority,
    document.document_date,
    document.file_path,
    document.external_url,
    document.mime_type,
    document.file_size_bytes,
    document.description,
    document.visibility,
    document.status,
    document.related_person_id,
    document.related_entity_id,
    document.related_organization_unit_id,
    document.related_appointment_id,
    document.related_movement_id,
    matched_scope.entity_id,
    app_private.resolve_entity_country_iso2(matched_scope.entity_id),
    document.created_at,
    document.updated_at
  from public.documents document
  left join lateral (
    select scope_row.entity_id
    from app_private.document_scope_entities(document.id) scope_row
    where v_scope_entity_id is null
       or app_private.calendar_entity_in_scope(scope_row.entity_id, v_scope_entity_id)
    order by case when scope_row.entity_id = v_scope_entity_id then 0 else 1 end,
             scope_row.entity_id
    limit 1
  ) matched_scope on true
  where app_private.current_user_can_view_document(
          document.id,
          document.visibility,
          document.status
        )
    and (v_scope_entity_id is null or matched_scope.entity_id is not null)
    and (p_visibility is null or document.visibility = p_visibility)
    and (p_include_inactive or document.status in ('active', 'approved', 'under_review'))
    and (
      v_search is null
      or document.title ilike '%' || v_search || '%'
      or document.document_number ilike '%' || v_search || '%'
      or document.issuing_authority ilike '%' || v_search || '%'
      or document.description ilike '%' || v_search || '%'
    )
  order by document.document_date desc nulls last,
           document.created_at desc,
           document.id
  limit v_limit;
end;
$$;

create or replace function public.admin_list_documents(
  p_scope_entity_id uuid default null,
  p_search text default null,
  p_visibility text default null,
  p_include_inactive boolean default false,
  p_limit integer default 250
)
returns table(
  id uuid,
  title text,
  document_type text,
  document_number text,
  issuing_authority text,
  document_date date,
  file_path text,
  external_url text,
  mime_type text,
  file_size_bytes bigint,
  description text,
  visibility text,
  status text,
  related_person_id uuid,
  related_entity_id uuid,
  related_organization_unit_id uuid,
  related_appointment_id uuid,
  related_movement_id uuid,
  matched_scope_entity_id uuid,
  country_iso2 char(2),
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select *
  from app_private.rpc_definer__admin_list_documents(
    p_scope_entity_id,
    p_search,
    p_visibility,
    p_include_inactive,
    p_limit
  );
$$;

drop policy if exists documents_insert_uploaders on public.documents;
drop policy if exists documents_manage_admins on public.documents;
drop policy if exists documents_select_by_visibility on public.documents;
drop policy if exists documents_select_public on public.documents;
drop policy if exists documents_select_scoped_authenticated on public.documents;

create policy documents_select_public
on public.documents
for select
to anon, authenticated
using (
  visibility = 'public'
  and status in ('active', 'approved')
);

create policy documents_select_scoped_authenticated
on public.documents
for select
to authenticated
using (
  app_private.current_user_can_view_document(id, visibility, status)
);

grant select on table public.documents to anon, authenticated;
revoke insert, update, delete on table public.documents from anon, authenticated;

revoke all on function app_private.current_user_can_manage_person(text, uuid) from public, anon, authenticated;
revoke all on function app_private.document_scope_entities(uuid) from public, anon, authenticated;
revoke all on function app_private.document_scope_units(uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_manage_document(text, uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_view_document(uuid, text, text) from public, anon, authenticated;
grant execute on function app_private.current_user_can_view_document(uuid, text, text) to anon, authenticated;

revoke all on function app_private.rpc_definer__admin_list_documents(uuid, text, text, boolean, integer) from public, anon, authenticated;
revoke all on function public.admin_list_documents(uuid, text, text, boolean, integer) from public, anon;
grant execute on function public.admin_list_documents(uuid, text, text, boolean, integer) to authenticated;

comment on function app_private.current_user_can_manage_person(text, uuid)
is 'Autoriza una persona mediante cualquiera de sus entidades o unidades canónicas visibles para el actor.';

comment on function public.admin_list_documents(uuid, text, text, boolean, integer)
is 'Lista documentos dentro de una raíz territorial explícita y aplica privacidad, país y alcance pastoral.';