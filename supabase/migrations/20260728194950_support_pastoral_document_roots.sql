create or replace function app_private.organization_unit_in_scope(
  p_organization_unit_id uuid,
  p_root_organization_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
  with recursive unit_lineage as (
    select unit_row.id, unit_row.parent_unit_id, array[unit_row.id]::uuid[] as visited, 0 as depth
    from public.organization_units unit_row
    where unit_row.id = p_organization_unit_id

    union all

    select parent_row.id,
           parent_row.parent_unit_id,
           child_row.visited || parent_row.id,
           child_row.depth + 1
    from unit_lineage child_row
    join public.organization_units parent_row on parent_row.id = child_row.parent_unit_id
    where child_row.depth < 25
      and not parent_row.id = any(child_row.visited)
  )
  select p_organization_unit_id is not null
     and p_root_organization_unit_id is not null
     and exists (
       select 1
       from unit_lineage lineage
       where lineage.id = p_root_organization_unit_id
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
  v_scope_id uuid := p_scope_entity_id;
  v_scope_kind text;
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

  if v_scope_id is not null then
    if exists (select 1 from public.ecclesiastical_entities entity_row where entity_row.id = v_scope_id) then
      v_scope_kind := 'entity';
    elsif exists (select 1 from public.organization_units unit_row where unit_row.id = v_scope_id) then
      v_scope_kind := 'organization_unit';
    elsif exists (select 1 from public.pastoral_areas area_row where area_row.id = v_scope_id) then
      v_scope_kind := 'pastoral_area';
    else
      raise exception 'El ámbito documental solicitado no existe.' using errcode = 'P0002';
    end if;
  end if;

  if v_scope_id is null then
    v_scope_id := app_private.current_user_root_jurisdiction_id();
    if v_scope_id is not null then
      v_scope_kind := case
        when exists (select 1 from public.ecclesiastical_entities entity_row where entity_row.id = v_scope_id) then 'entity'
        when exists (select 1 from public.organization_units unit_row where unit_row.id = v_scope_id) then 'organization_unit'
        when exists (select 1 from public.pastoral_areas area_row where area_row.id = v_scope_id) then 'pastoral_area'
        else null
      end;
    end if;
  end if;

  if v_scope_id is null then
    select membership.country_entity_id
    into v_scope_id
    from app_private.user_country_memberships membership
    where membership.user_id = auth.uid()
      and membership.status = 'active'
    order by membership.started_at, membership.country_iso2
    limit 1;
    if v_scope_id is not null then
      v_scope_kind := 'entity';
    end if;
  end if;

  if v_scope_id is null and not app_private.current_user_has_role(array['super_admin']) then
    raise exception 'Debes consultar documentos dentro de un ámbito autorizado.' using errcode = '42501';
  end if;

  if v_scope_kind = 'entity'
     and not app_private.current_user_can_manage_entity('documents.view', v_scope_id) then
    raise exception 'La entidad solicitada está fuera de tu alcance documental.' using errcode = '42501';
  elsif v_scope_kind = 'organization_unit'
     and not app_private.current_user_can_manage_organization_unit('documents.view', v_scope_id) then
    raise exception 'La unidad solicitada está fuera de tu alcance documental.' using errcode = '42501';
  elsif v_scope_kind = 'pastoral_area'
     and not app_private.current_user_can_manage_pastoral_area('documents.view', v_scope_id) then
    raise exception 'El área pastoral solicitada está fuera de tu alcance documental.' using errcode = '42501';
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
    order by scope_row.entity_id
    limit 1
  ) matched_scope on true
  where app_private.current_user_can_view_document(
          document.id,
          document.visibility,
          document.status
        )
    and (
      v_scope_id is null
      or (
        v_scope_kind = 'entity'
        and exists (
          select 1
          from app_private.document_scope_entities(document.id) scope_row
          where app_private.calendar_entity_in_scope(scope_row.entity_id, v_scope_id)
        )
      )
      or (
        v_scope_kind = 'organization_unit'
        and exists (
          select 1
          from app_private.document_scope_units(document.id) scope_row
          where app_private.organization_unit_in_scope(
            scope_row.organization_unit_id,
            v_scope_id
          )
        )
      )
      or (
        v_scope_kind = 'pastoral_area'
        and exists (
          select 1
          from app_private.document_scope_units(document.id) scope_row
          join public.organization_units unit_row on unit_row.id = scope_row.organization_unit_id
          where unit_row.pastoral_area_id = v_scope_id
        )
      )
    )
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

revoke all on function app_private.organization_unit_in_scope(uuid, uuid) from public, anon, authenticated;

grant execute on function app_private.rpc_definer__admin_list_documents(uuid, text, text, boolean, integer) to authenticated;

comment on function app_private.organization_unit_in_scope(uuid, uuid)
is 'Comprueba si una unidad es la raíz solicitada o una descendiente, con protección contra ciclos.';