-- Strategic data-quality layer: duplicate prevention and review queue.
-- Adds reusable RPCs for admin workflows before creating new records.

create extension if not exists pg_trgm with schema extensions;

create or replace function public.ensure_current_user_is_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regprocedure('public.current_user_has_admin_role()') is not null then
    if not public.current_user_has_admin_role() then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
  end if;
end;
$$;

grant execute on function public.ensure_current_user_is_admin() to authenticated;

create or replace function public.admin_find_similar_persons(payload jsonb)
returns table (
  record_id uuid,
  display_name text,
  slug text,
  person_type text,
  status text,
  birth_date date,
  birth_place text,
  similarity_score numeric,
  match_reason text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_query text := nullif(trim(coalesce(payload->>'display_name', payload->>'name', '')), '');
  v_first_name text := nullif(trim(coalesce(payload->>'first_name', '')), '');
  v_last_name text := nullif(trim(coalesce(payload->>'last_name', '')), '');
  v_person_type text := nullif(trim(coalesce(payload->>'person_type', '')), '');
  v_slug text := nullif(trim(coalesce(payload->>'slug', '')), '');
  v_birth_date date;
  v_limit integer := 8;
  v_threshold real := 0.32;
begin
  perform public.ensure_current_user_is_admin();

  if nullif(payload->>'limit', '') is not null then
    v_limit := least(greatest((payload->>'limit')::integer, 1), 25);
  end if;

  if nullif(payload->>'threshold', '') is not null then
    v_threshold := least(greatest((payload->>'threshold')::real, 0.10), 0.90);
  end if;

  if v_query is null then
    v_query := nullif(trim(concat_ws(' ', v_first_name, v_last_name)), '');
  end if;

  if nullif(payload->>'birth_date', '') is not null then
    begin
      v_birth_date := (payload->>'birth_date')::date;
    exception when others then
      v_birth_date := null;
    end;
  end if;

  if v_query is null or length(v_query) < 3 then
    return;
  end if;

  return query
  with candidates as (
    select
      p.id,
      p.display_name,
      p.slug,
      p.person_type,
      p.status,
      p.birth_date,
      p.birth_place,
      (
        greatest(
          similarity(coalesce(p.display_name, ''), v_query),
          similarity(concat_ws(' ', p.first_name, p.middle_name, p.last_name, p.second_last_name), v_query),
          case when v_slug is not null and lower(coalesce(p.slug, '')) = lower(v_slug) then 1 else 0 end
        )
        + case when v_birth_date is not null and p.birth_date = v_birth_date then 0.08 else 0 end
      ) as score,
      case
        when v_slug is not null and lower(coalesce(p.slug, '')) = lower(v_slug) then 'Mismo identificador público'
        when v_birth_date is not null and p.birth_date = v_birth_date then 'Nombre parecido y misma fecha de nacimiento'
        else 'Nombre parecido'
      end as reason
    from public.persons p
    where coalesce(p.status::text, 'active') <> 'deleted'
      and (
        v_person_type is null
        or p.person_type::text = v_person_type
        or (v_person_type = 'priest' and p.person_type::text in ('priest', 'deacon'))
      )
  )
  select
    c.id,
    c.display_name::text,
    c.slug::text,
    c.person_type::text,
    c.status::text,
    c.birth_date,
    c.birth_place::text,
    c.score::numeric(6,4),
    c.reason::text
  from candidates c
  where c.score >= v_threshold
  order by c.score desc, c.display_name asc
  limit v_limit;
end;
$$;

grant execute on function public.admin_find_similar_persons(jsonb) to authenticated;

create or replace function public.admin_find_similar_ecclesiastical_entities(payload jsonb)
returns table (
  record_id uuid,
  display_name text,
  slug text,
  entity_type_key text,
  hierarchy_path text,
  jurisdiction_name text,
  similarity_score numeric,
  match_reason text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_query text := nullif(trim(coalesce(payload->>'name', payload->>'display_name', '')), '');
  v_slug text := nullif(trim(coalesce(payload->>'slug', '')), '');
  v_entity_type_key text := nullif(trim(coalesce(payload->>'entity_type_key', '')), '');
  v_scope_entity_id uuid;
  v_limit integer := 8;
  v_threshold real := 0.30;
begin
  perform public.ensure_current_user_is_admin();

  if nullif(payload->>'limit', '') is not null then
    v_limit := least(greatest((payload->>'limit')::integer, 1), 25);
  end if;

  if nullif(payload->>'threshold', '') is not null then
    v_threshold := least(greatest((payload->>'threshold')::real, 0.10), 0.90);
  end if;

  if nullif(payload->>'scope_entity_id', '') is not null then
    begin
      v_scope_entity_id := (payload->>'scope_entity_id')::uuid;
    exception when others then
      v_scope_entity_id := null;
    end;
  end if;

  if v_query is null or length(v_query) < 3 then
    return;
  end if;

  return query
  with candidates as (
    select
      e.direct_entity_id,
      e.direct_entity_name,
      e.direct_entity_slug,
      e.direct_entity_type_key,
      e.hierarchy_path,
      e.jurisdiction_name,
      greatest(
        similarity(coalesce(e.direct_entity_name, ''), v_query),
        similarity(coalesce(e.hierarchy_path, ''), v_query),
        case when v_slug is not null and lower(coalesce(e.direct_entity_slug, '')) = lower(v_slug) then 1 else 0 end
      ) as score,
      case
        when v_slug is not null and lower(coalesce(e.direct_entity_slug, '')) = lower(v_slug) then 'Mismo identificador público'
        when v_scope_entity_id is not null then 'Nombre parecido dentro del mismo ámbito jerárquico'
        else 'Nombre parecido'
      end as reason
    from public.admin_entity_hierarchy_selector e
    where (v_entity_type_key is null or e.direct_entity_type_key = v_entity_type_key)
      and (
        v_scope_entity_id is null
        or e.direct_entity_id = v_scope_entity_id
        or e.jurisdiction_id = v_scope_entity_id
        or e.vicariate_id = v_scope_entity_id
        or e.zone_id = v_scope_entity_id
        or e.parish_id = v_scope_entity_id
      )
  )
  select
    c.direct_entity_id,
    c.direct_entity_name::text,
    c.direct_entity_slug::text,
    c.direct_entity_type_key::text,
    c.hierarchy_path::text,
    c.jurisdiction_name::text,
    c.score::numeric(6,4),
    c.reason::text
  from candidates c
  where c.score >= v_threshold
  order by c.score desc, c.direct_entity_name asc
  limit v_limit;
end;
$$;

grant execute on function public.admin_find_similar_ecclesiastical_entities(jsonb) to authenticated;

create or replace function public.admin_review_queue(payload jsonb default '{}'::jsonb)
returns table (
  item_key text,
  item_type text,
  record_table text,
  record_id uuid,
  title text,
  detail text,
  verification_status text,
  issue_count integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := 80;
begin
  perform public.ensure_current_user_is_admin();

  if nullif(payload->>'limit', '') is not null then
    v_limit := least(greatest((payload->>'limit')::integer, 1), 200);
  end if;

  if to_regclass('public.data_field_statuses') is not null then
    return query execute $sql$
      select
        concat('field:', dfs.record_table, ':', dfs.record_id::text, ':', dfs.field_name)::text as item_key,
        'missing_field'::text as item_type,
        dfs.record_table::text as record_table,
        dfs.record_id::uuid as record_id,
        concat(dfs.record_table, ' · ', dfs.field_name)::text as title,
        coalesce(nullif(dfs.notes, ''), 'Campo marcado como no identificado o pendiente de completar.')::text as detail,
        dfs.status::text as verification_status,
        1::integer as issue_count,
        coalesce(dfs.created_at, now())::timestamptz as created_at
      from public.data_field_statuses dfs
      where dfs.status::text in ('unknown', 'pending_review', 'not_identified', 'incomplete')
      order by coalesce(dfs.created_at, now()) desc
      limit $1
    $sql$ using v_limit;
  end if;

  if to_regclass('public.position_assignments') is not null then
    return query execute $sql$
      select
        concat('assignment:', pa.id::text)::text as item_key,
        'position_assignment'::text as item_type,
        'position_assignments'::text as record_table,
        pa.id::uuid as record_id,
        coalesce(nullif(pa.title_override, ''), 'Asignación de cargo')::text as title,
        concat_ws(' · ', pa.assignment_status::text, pa.notes_public, pa.notes_internal)::text as detail,
        pa.verification_status::text as verification_status,
        1::integer as issue_count,
        coalesce(pa.created_at, now())::timestamptz as created_at
      from public.position_assignments pa
      where pa.verification_status::text in ('pending_review', 'not_verified', 'needs_review')
        and coalesce(pa.record_status::text, 'active') = 'active'
      order by coalesce(pa.created_at, now()) desc
      limit $1
    $sql$ using v_limit;
  end if;
end;
$$;

grant execute on function public.admin_review_queue(jsonb) to authenticated;
