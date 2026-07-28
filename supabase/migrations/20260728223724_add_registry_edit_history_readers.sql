create or replace function app_private.rpc_definer__admin_get_ecclesiastical_place(p_place_id uuid)
returns table(
  id uuid,
  place_type_key text,
  primary_entity_id uuid,
  managing_organization_unit_id uuid,
  country_iso2 char(2),
  name text,
  official_name text,
  slug text,
  description text,
  dedication_title text,
  patron_name text,
  opened_at date,
  blessed_at date,
  dedicated_at date,
  consecrated_at date,
  closed_at date,
  capacity integer,
  is_primary_seat boolean,
  province text,
  municipality text,
  sector text,
  address text,
  latitude numeric,
  longitude numeric,
  source_document_id uuid,
  source_name text,
  source_url text,
  source_checked_at date,
  status text,
  visibility text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
begin
  if auth.uid() is null
     or not app_private.current_user_can_manage_ecclesiastical_place('places.view', p_place_id) then
    raise exception 'No autorizado para consultar este lugar eclesiástico.' using errcode = '42501';
  end if;

  return query
  select place.id, type_row.key, place.primary_entity_id, place.managing_organization_unit_id,
         place.country_iso2, place.name, place.official_name, place.slug, place.description,
         place.dedication_title, place.patron_name, place.opened_at, place.blessed_at,
         place.dedicated_at, place.consecrated_at, place.closed_at, place.capacity,
         place.is_primary_seat, place.province, place.municipality, place.sector, place.address,
         place.latitude, place.longitude, place.source_document_id, place.source_name,
         place.source_url, place.source_checked_at, place.status, place.visibility,
         place.created_at, place.updated_at
  from public.ecclesiastical_places place
  join public.ecclesiastical_place_types type_row on type_row.id = place.place_type_id
  where place.id = p_place_id;
end;
$$;

create or replace function public.admin_get_ecclesiastical_place(p_place_id uuid)
returns table(
  id uuid,
  place_type_key text,
  primary_entity_id uuid,
  managing_organization_unit_id uuid,
  country_iso2 char(2),
  name text,
  official_name text,
  slug text,
  description text,
  dedication_title text,
  patron_name text,
  opened_at date,
  blessed_at date,
  dedicated_at date,
  consecrated_at date,
  closed_at date,
  capacity integer,
  is_primary_seat boolean,
  province text,
  municipality text,
  sector text,
  address text,
  latitude numeric,
  longitude numeric,
  source_document_id uuid,
  source_name text,
  source_url text,
  source_checked_at date,
  status text,
  visibility text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
  select * from app_private.rpc_definer__admin_get_ecclesiastical_place(p_place_id);
$$;

create or replace function app_private.rpc_definer__admin_get_ecclesial_institution(p_institution_id uuid)
returns table(
  id uuid,
  category_key text,
  primary_entity_id uuid,
  managing_organization_unit_id uuid,
  country_iso2 char(2),
  name text,
  official_name text,
  slug text,
  description text,
  civil_legal_name text,
  civil_registration_number text,
  founded_at date,
  canonical_erected_at date,
  civil_registered_at date,
  closed_at date,
  province text,
  municipality text,
  sector text,
  address text,
  latitude numeric,
  longitude numeric,
  source_document_id uuid,
  source_name text,
  source_url text,
  source_checked_at date,
  status text,
  visibility text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
begin
  if auth.uid() is null
     or not app_private.current_user_can_manage_ecclesial_institution('institutions.view', p_institution_id) then
    raise exception 'No autorizado para consultar esta institución.' using errcode = '42501';
  end if;

  return query
  select institution.id, category.key, institution.primary_entity_id,
         institution.managing_organization_unit_id, institution.country_iso2,
         institution.name, institution.official_name, institution.slug, institution.description,
         institution.civil_legal_name, institution.civil_registration_number,
         institution.founded_at, institution.canonical_erected_at,
         institution.civil_registered_at, institution.closed_at,
         institution.province, institution.municipality, institution.sector, institution.address,
         institution.latitude, institution.longitude, institution.source_document_id,
         institution.source_name, institution.source_url, institution.source_checked_at,
         institution.status, institution.visibility, institution.created_at, institution.updated_at
  from public.ecclesial_institutions institution
  join public.ecclesial_institution_categories category on category.id = institution.category_id
  where institution.id = p_institution_id;
end;
$$;

create or replace function public.admin_get_ecclesial_institution(p_institution_id uuid)
returns table(
  id uuid,
  category_key text,
  primary_entity_id uuid,
  managing_organization_unit_id uuid,
  country_iso2 char(2),
  name text,
  official_name text,
  slug text,
  description text,
  civil_legal_name text,
  civil_registration_number text,
  founded_at date,
  canonical_erected_at date,
  civil_registered_at date,
  closed_at date,
  province text,
  municipality text,
  sector text,
  address text,
  latitude numeric,
  longitude numeric,
  source_document_id uuid,
  source_name text,
  source_url text,
  source_checked_at date,
  status text,
  visibility text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
  select * from app_private.rpc_definer__admin_get_ecclesial_institution(p_institution_id);
$$;

create or replace function app_private.rpc_definer__admin_list_ecclesiastical_place_affiliations(
  p_place_id uuid,
  p_include_history boolean default true
)
returns table(
  id uuid,
  place_id uuid,
  relationship_type text,
  target_kind text,
  target_id uuid,
  target_name text,
  valid_from date,
  valid_to date,
  is_current boolean,
  status text,
  notes text,
  source_document_id uuid,
  source_document_title text,
  is_primary_relation boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
begin
  if auth.uid() is null
     or not app_private.current_user_can_manage_ecclesiastical_place('places.view', p_place_id) then
    raise exception 'No autorizado para consultar las afiliaciones de este lugar.' using errcode = '42501';
  end if;

  return query
  select affiliation.id,
         affiliation.place_id,
         affiliation.relationship_type,
         case
           when affiliation.ecclesiastical_entity_id is not null then 'entity'
           when affiliation.organization_unit_id is not null then 'organization_unit'
           else 'institution'
         end,
         coalesce(affiliation.ecclesiastical_entity_id, affiliation.organization_unit_id, affiliation.institution_id),
         coalesce(entity.name, unit_row.name, institution.name),
         affiliation.valid_from,
         affiliation.valid_to,
         affiliation.is_current,
         affiliation.status,
         affiliation.notes,
         affiliation.source_document_id,
         document.title,
         affiliation.is_current = true
           and affiliation.status = 'active'
           and affiliation.ecclesiastical_entity_id = place.primary_entity_id
           and affiliation.relationship_type = case when place.is_primary_seat then 'seat_of' else 'belongs_to' end,
         affiliation.created_at,
         affiliation.updated_at
  from public.ecclesiastical_place_affiliations affiliation
  join public.ecclesiastical_places place on place.id = affiliation.place_id
  left join public.ecclesiastical_entities entity on entity.id = affiliation.ecclesiastical_entity_id
  left join public.organization_units unit_row on unit_row.id = affiliation.organization_unit_id
  left join public.ecclesial_institutions institution on institution.id = affiliation.institution_id
  left join public.documents document on document.id = affiliation.source_document_id
  where affiliation.place_id = p_place_id
    and (coalesce(p_include_history, true) or (affiliation.is_current = true and affiliation.status = 'active'))
  order by affiliation.is_current desc,
           coalesce(affiliation.valid_from, affiliation.created_at::date) desc,
           affiliation.created_at desc;
end;
$$;

create or replace function public.admin_list_ecclesiastical_place_affiliations(
  p_place_id uuid,
  p_include_history boolean default true
)
returns table(
  id uuid,
  place_id uuid,
  relationship_type text,
  target_kind text,
  target_id uuid,
  target_name text,
  valid_from date,
  valid_to date,
  is_current boolean,
  status text,
  notes text,
  source_document_id uuid,
  source_document_title text,
  is_primary_relation boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
  select *
  from app_private.rpc_definer__admin_list_ecclesiastical_place_affiliations(
    p_place_id,
    p_include_history
  );
$$;

create or replace function app_private.rpc_definer__admin_list_ecclesial_institution_affiliations(
  p_institution_id uuid,
  p_include_history boolean default true
)
returns table(
  id uuid,
  institution_id uuid,
  relationship_type text,
  target_kind text,
  target_id uuid,
  target_name text,
  valid_from date,
  valid_to date,
  is_current boolean,
  status text,
  notes text,
  source_document_id uuid,
  source_document_title text,
  is_primary_relation boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
begin
  if auth.uid() is null
     or not app_private.current_user_can_manage_ecclesial_institution('institutions.view', p_institution_id) then
    raise exception 'No autorizado para consultar las afiliaciones de esta institución.' using errcode = '42501';
  end if;

  return query
  select affiliation.id,
         affiliation.institution_id,
         affiliation.relationship_type,
         case
           when affiliation.ecclesiastical_entity_id is not null then 'entity'
           when affiliation.organization_unit_id is not null then 'organization_unit'
           else 'institution'
         end,
         coalesce(affiliation.ecclesiastical_entity_id, affiliation.organization_unit_id, affiliation.parent_institution_id),
         coalesce(entity.name, unit_row.name, parent_institution.name),
         affiliation.valid_from,
         affiliation.valid_to,
         affiliation.is_current,
         affiliation.status,
         affiliation.notes,
         affiliation.source_document_id,
         document.title,
         affiliation.is_current = true
           and affiliation.status = 'active'
           and affiliation.relationship_type = 'belongs_to'
           and affiliation.ecclesiastical_entity_id = institution.primary_entity_id,
         affiliation.created_at,
         affiliation.updated_at
  from public.ecclesial_institution_affiliations affiliation
  join public.ecclesial_institutions institution on institution.id = affiliation.institution_id
  left join public.ecclesiastical_entities entity on entity.id = affiliation.ecclesiastical_entity_id
  left join public.organization_units unit_row on unit_row.id = affiliation.organization_unit_id
  left join public.ecclesial_institutions parent_institution on parent_institution.id = affiliation.parent_institution_id
  left join public.documents document on document.id = affiliation.source_document_id
  where affiliation.institution_id = p_institution_id
    and (coalesce(p_include_history, true) or (affiliation.is_current = true and affiliation.status = 'active'))
  order by affiliation.is_current desc,
           coalesce(affiliation.valid_from, affiliation.created_at::date) desc,
           affiliation.created_at desc;
end;
$$;

create or replace function public.admin_list_ecclesial_institution_affiliations(
  p_institution_id uuid,
  p_include_history boolean default true
)
returns table(
  id uuid,
  institution_id uuid,
  relationship_type text,
  target_kind text,
  target_id uuid,
  target_name text,
  valid_from date,
  valid_to date,
  is_current boolean,
  status text,
  notes text,
  source_document_id uuid,
  source_document_title text,
  is_primary_relation boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
  select *
  from app_private.rpc_definer__admin_list_ecclesial_institution_affiliations(
    p_institution_id,
    p_include_history
  );
$$;

revoke all on function app_private.rpc_definer__admin_get_ecclesiastical_place(uuid) from public, anon;
grant execute on function app_private.rpc_definer__admin_get_ecclesiastical_place(uuid) to authenticated;
revoke all on function public.admin_get_ecclesiastical_place(uuid) from public, anon;
grant execute on function public.admin_get_ecclesiastical_place(uuid) to authenticated;

revoke all on function app_private.rpc_definer__admin_get_ecclesial_institution(uuid) from public, anon;
grant execute on function app_private.rpc_definer__admin_get_ecclesial_institution(uuid) to authenticated;
revoke all on function public.admin_get_ecclesial_institution(uuid) from public, anon;
grant execute on function public.admin_get_ecclesial_institution(uuid) to authenticated;

revoke all on function app_private.rpc_definer__admin_list_ecclesiastical_place_affiliations(uuid,boolean) from public, anon;
grant execute on function app_private.rpc_definer__admin_list_ecclesiastical_place_affiliations(uuid,boolean) to authenticated;
revoke all on function public.admin_list_ecclesiastical_place_affiliations(uuid,boolean) from public, anon;
grant execute on function public.admin_list_ecclesiastical_place_affiliations(uuid,boolean) to authenticated;

revoke all on function app_private.rpc_definer__admin_list_ecclesial_institution_affiliations(uuid,boolean) from public, anon;
grant execute on function app_private.rpc_definer__admin_list_ecclesial_institution_affiliations(uuid,boolean) to authenticated;
revoke all on function public.admin_list_ecclesial_institution_affiliations(uuid,boolean) from public, anon;
grant execute on function public.admin_list_ecclesial_institution_affiliations(uuid,boolean) to authenticated;
