create or replace function app_private.unique_ecclesiastical_place_slug(
  p_name text,
  p_requested_slug text default null,
  p_exclude_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path='pg_catalog','public','app_private','pg_temp'
as $$
declare
  v_base text := app_private.registry_slug(coalesce(nullif(btrim(p_requested_slug),''),p_name));
  v_candidate text;
  v_suffix integer := 1;
begin
  if nullif(v_base,'') is null then v_base := 'lugar-eclesiastico'; end if;
  v_candidate := v_base;
  while exists(
    select 1 from public.ecclesiastical_places place
    where place.slug=v_candidate and (p_exclude_id is null or place.id<>p_exclude_id)
  ) loop
    v_suffix := v_suffix+1;
    v_candidate := v_base||'-'||v_suffix;
  end loop;
  return v_candidate;
end;
$$;

create or replace function app_private.unique_ecclesial_institution_slug(
  p_name text,
  p_requested_slug text default null,
  p_exclude_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path='pg_catalog','public','app_private','pg_temp'
as $$
declare
  v_base text := app_private.registry_slug(coalesce(nullif(btrim(p_requested_slug),''),p_name));
  v_candidate text;
  v_suffix integer := 1;
begin
  if nullif(v_base,'') is null then v_base := 'institucion-eclesial'; end if;
  v_candidate := v_base;
  while exists(
    select 1 from public.ecclesial_institutions institution
    where institution.slug=v_candidate and (p_exclude_id is null or institution.id<>p_exclude_id)
  ) loop
    v_suffix := v_suffix+1;
    v_candidate := v_base||'-'||v_suffix;
  end loop;
  return v_candidate;
end;
$$;

create or replace function app_private.current_user_can_manage_channel_owner(
  p_permission_key text,
  p_owner_entity_id uuid,
  p_owner_organization_unit_id uuid,
  p_owner_place_id uuid,
  p_owner_institution_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$
begin
  if auth.uid() is null or nullif(p_permission_key,'') is null
     or num_nonnulls(p_owner_entity_id,p_owner_organization_unit_id,p_owner_place_id,p_owner_institution_id)<>1 then
    return false;
  end if;
  if p_owner_entity_id is not null then
    return app_private.current_user_can_manage_entity(p_permission_key,p_owner_entity_id);
  elsif p_owner_organization_unit_id is not null then
    return app_private.current_user_can_manage_organization_unit(p_permission_key,p_owner_organization_unit_id);
  elsif p_owner_place_id is not null then
    return app_private.current_user_can_manage_ecclesiastical_place(p_permission_key,p_owner_place_id);
  else
    return app_private.current_user_can_manage_ecclesial_institution(p_permission_key,p_owner_institution_id);
  end if;
end;
$$;

create or replace function app_private.channel_owner_scope_entity(
  p_owner_entity_id uuid,
  p_owner_organization_unit_id uuid,
  p_owner_place_id uuid,
  p_owner_institution_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path='pg_catalog','public','app_private','pg_temp'
as $$
declare
  v_entity_id uuid;
begin
  if p_owner_entity_id is not null then return p_owner_entity_id; end if;
  if p_owner_organization_unit_id is not null then
    select unit_row.ecclesiastical_entity_id into v_entity_id
    from public.organization_units unit_row where unit_row.id=p_owner_organization_unit_id;
    return v_entity_id;
  end if;
  if p_owner_place_id is not null then
    select place.primary_entity_id into v_entity_id
    from public.ecclesiastical_places place where place.id=p_owner_place_id;
    return v_entity_id;
  end if;
  select institution.primary_entity_id into v_entity_id
  from public.ecclesial_institutions institution where institution.id=p_owner_institution_id;
  return v_entity_id;
end;
$$;

create or replace function app_private.rpc_definer__admin_save_ecclesiastical_place(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid := app_private.audit_json_uuid(payload,'id');
  v_primary_entity_id uuid := app_private.audit_json_uuid(payload,'primary_entity_id');
  v_managing_unit_id uuid := app_private.audit_json_uuid(payload,'managing_organization_unit_id');
  v_source_document_id uuid := app_private.audit_json_uuid(payload,'source_document_id');
  v_type_key text := nullif(btrim(payload->>'place_type_key'),'');
  v_type_id uuid;
  v_name text := nullif(btrim(payload->>'name'),'');
  v_slug text;
  v_permission text := case when v_id is null then 'places.create_proposal' else 'places.update_proposal' end;
  v_status text;
  v_visibility text;
  v_old jsonb;
  v_new jsonb;
  v_country char(2);
  v_is_primary_seat boolean := coalesce((payload->>'is_primary_seat')::boolean,false);
begin
  if v_actor is null then raise exception 'No autenticado' using errcode='42501'; end if;
  if v_primary_entity_id is null then raise exception 'La entidad principal es obligatoria.' using errcode='22023'; end if;
  if v_type_key is null then raise exception 'El tipo de lugar es obligatorio.' using errcode='22023'; end if;
  if v_name is null then raise exception 'El nombre del lugar es obligatorio.' using errcode='22023'; end if;

  if v_id is not null then
    select to_jsonb(place) into v_old from public.ecclesiastical_places place where place.id=v_id;
    if v_old is null then raise exception 'Lugar eclesiástico no encontrado.' using errcode='P0002'; end if;
    if not app_private.current_user_can_manage_ecclesiastical_place(v_permission,v_id) then
      raise exception 'El lugar está fuera de tu alcance.' using errcode='42501';
    end if;
  end if;
  if not app_private.current_user_can_manage_entity(v_permission,v_primary_entity_id) then
    raise exception 'La entidad principal está fuera de tu alcance.' using errcode='42501';
  end if;
  if v_managing_unit_id is not null
     and not app_private.current_user_can_manage_organization_unit(v_permission,v_managing_unit_id) then
    raise exception 'La unidad administradora está fuera de tu alcance.' using errcode='42501';
  end if;

  select type_row.id into v_type_id
  from public.ecclesiastical_place_types type_row
  where type_row.key=v_type_key and type_row.status='active';
  if v_type_id is null then raise exception 'Tipo de lugar no válido.' using errcode='22023'; end if;

  v_status := coalesce(nullif(payload->>'status',''),case when v_id is null then 'under_review' else v_old->>'status' end);
  v_visibility := coalesce(nullif(payload->>'visibility',''),case when v_id is null then 'internal' else v_old->>'visibility' end);
  if (v_status='active' or v_visibility='public')
     and not app_private.current_user_can_manage_entity('places.publish',v_primary_entity_id) then
    raise exception 'No autorizado para publicar lugares.' using errcode='42501';
  end if;

  v_slug := app_private.unique_ecclesiastical_place_slug(
    v_name,
    coalesce(nullif(payload->>'slug',''),case when v_id is null then null else v_old->>'slug' end),
    v_id
  );

  if v_id is null then
    insert into public.ecclesiastical_places(
      place_type_id,primary_entity_id,managing_organization_unit_id,country_iso2,
      name,official_name,slug,description,dedication_title,patron_name,
      opened_at,blessed_at,dedicated_at,consecrated_at,closed_at,capacity,is_primary_seat,
      province,municipality,sector,address,latitude,longitude,source_document_id,
      source_name,source_url,source_checked_at,status,visibility,created_by
    ) values (
      v_type_id,v_primary_entity_id,v_managing_unit_id,
      app_private.resolve_entity_country_iso2(v_primary_entity_id),
      v_name,nullif(btrim(payload->>'official_name'),''),v_slug,nullif(btrim(payload->>'description'),''),
      nullif(btrim(payload->>'dedication_title'),''),nullif(btrim(payload->>'patron_name'),''),
      nullif(payload->>'opened_at','')::date,nullif(payload->>'blessed_at','')::date,
      nullif(payload->>'dedicated_at','')::date,nullif(payload->>'consecrated_at','')::date,
      nullif(payload->>'closed_at','')::date,nullif(payload->>'capacity','')::integer,v_is_primary_seat,
      nullif(btrim(payload->>'province'),''),nullif(btrim(payload->>'municipality'),''),
      nullif(btrim(payload->>'sector'),''),nullif(btrim(payload->>'address'),''),
      nullif(payload->>'latitude','')::numeric,nullif(payload->>'longitude','')::numeric,
      v_source_document_id,nullif(btrim(payload->>'source_name'),''),nullif(btrim(payload->>'source_url'),''),
      nullif(payload->>'source_checked_at','')::date,v_status,v_visibility,v_actor
    ) returning id,country_iso2 into v_id,v_country;
  else
    update public.ecclesiastical_places place set
      place_type_id=v_type_id,
      primary_entity_id=v_primary_entity_id,
      managing_organization_unit_id=v_managing_unit_id,
      name=v_name,
      official_name=case when payload ? 'official_name' then nullif(btrim(payload->>'official_name'),'') else place.official_name end,
      slug=v_slug,
      description=case when payload ? 'description' then nullif(btrim(payload->>'description'),'') else place.description end,
      dedication_title=case when payload ? 'dedication_title' then nullif(btrim(payload->>'dedication_title'),'') else place.dedication_title end,
      patron_name=case when payload ? 'patron_name' then nullif(btrim(payload->>'patron_name'),'') else place.patron_name end,
      opened_at=case when payload ? 'opened_at' then nullif(payload->>'opened_at','')::date else place.opened_at end,
      blessed_at=case when payload ? 'blessed_at' then nullif(payload->>'blessed_at','')::date else place.blessed_at end,
      dedicated_at=case when payload ? 'dedicated_at' then nullif(payload->>'dedicated_at','')::date else place.dedicated_at end,
      consecrated_at=case when payload ? 'consecrated_at' then nullif(payload->>'consecrated_at','')::date else place.consecrated_at end,
      closed_at=case when payload ? 'closed_at' then nullif(payload->>'closed_at','')::date else place.closed_at end,
      capacity=case when payload ? 'capacity' then nullif(payload->>'capacity','')::integer else place.capacity end,
      is_primary_seat=v_is_primary_seat,
      province=case when payload ? 'province' then nullif(btrim(payload->>'province'),'') else place.province end,
      municipality=case when payload ? 'municipality' then nullif(btrim(payload->>'municipality'),'') else place.municipality end,
      sector=case when payload ? 'sector' then nullif(btrim(payload->>'sector'),'') else place.sector end,
      address=case when payload ? 'address' then nullif(btrim(payload->>'address'),'') else place.address end,
      latitude=case when payload ? 'latitude' then nullif(payload->>'latitude','')::numeric else place.latitude end,
      longitude=case when payload ? 'longitude' then nullif(payload->>'longitude','')::numeric else place.longitude end,
      source_document_id=case when payload ? 'source_document_id' then v_source_document_id else place.source_document_id end,
      source_name=case when payload ? 'source_name' then nullif(btrim(payload->>'source_name'),'') else place.source_name end,
      source_url=case when payload ? 'source_url' then nullif(btrim(payload->>'source_url'),'') else place.source_url end,
      source_checked_at=case when payload ? 'source_checked_at' then nullif(payload->>'source_checked_at','')::date else place.source_checked_at end,
      status=v_status,
      visibility=v_visibility
    where place.id=v_id
    returning country_iso2 into v_country;
  end if;

  update public.ecclesiastical_place_affiliations affiliation set
    relationship_type=case when v_is_primary_seat then 'seat_of' else 'belongs_to' end,
    ecclesiastical_entity_id=v_primary_entity_id,
    organization_unit_id=null,
    institution_id=null,
    is_current=true,
    status='active',
    valid_to=null
  where affiliation.place_id=v_id
    and affiliation.relationship_type in ('belongs_to','seat_of')
    and affiliation.is_current=true;

  if not found then
    insert into public.ecclesiastical_place_affiliations(
      place_id,relationship_type,ecclesiastical_entity_id,is_current,status,created_by
    ) values (
      v_id,case when v_is_primary_seat then 'seat_of' else 'belongs_to' end,
      v_primary_entity_id,true,'active',v_actor
    );
  end if;

  select to_jsonb(place) into v_new from public.ecclesiastical_places place where place.id=v_id;
  perform public.create_audit_log(
    v_actor,
    case when v_old is null then 'places.place.created' else 'places.place.updated' end,
    'ecclesiastical_places',v_id,v_old,
    jsonb_build_object('scope_entity_id',v_primary_entity_id,'country_iso2',v_country,'record',v_new),
    app_private.audit_json_uuid(payload,'change_request_id')
  );

  return jsonb_build_object('place_id',v_id,'slug',v_slug,'country_iso2',v_country,'status',v_status,'visibility',v_visibility);
end;
$$;

create or replace function app_private.rpc_definer__admin_save_ecclesial_institution(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid := app_private.audit_json_uuid(payload,'id');
  v_primary_entity_id uuid := app_private.audit_json_uuid(payload,'primary_entity_id');
  v_managing_unit_id uuid := app_private.audit_json_uuid(payload,'managing_organization_unit_id');
  v_source_document_id uuid := app_private.audit_json_uuid(payload,'source_document_id');
  v_category_key text := nullif(btrim(payload->>'category_key'),'');
  v_category_id uuid;
  v_name text := nullif(btrim(payload->>'name'),'');
  v_slug text;
  v_permission text := case when v_id is null then 'institutions.create_proposal' else 'institutions.update_proposal' end;
  v_status text;
  v_visibility text;
  v_old jsonb;
  v_new jsonb;
  v_country char(2);
begin
  if v_actor is null then raise exception 'No autenticado' using errcode='42501'; end if;
  if v_primary_entity_id is null then raise exception 'La entidad principal es obligatoria.' using errcode='22023'; end if;
  if v_category_key is null then raise exception 'La categoría institucional es obligatoria.' using errcode='22023'; end if;
  if v_name is null then raise exception 'El nombre de la institución es obligatorio.' using errcode='22023'; end if;

  if v_id is not null then
    select to_jsonb(institution) into v_old from public.ecclesial_institutions institution where institution.id=v_id;
    if v_old is null then raise exception 'Institución no encontrada.' using errcode='P0002'; end if;
    if not app_private.current_user_can_manage_ecclesial_institution(v_permission,v_id) then
      raise exception 'La institución está fuera de tu alcance.' using errcode='42501';
    end if;
  end if;
  if not app_private.current_user_can_manage_entity(v_permission,v_primary_entity_id) then
    raise exception 'La entidad principal está fuera de tu alcance.' using errcode='42501';
  end if;
  if v_managing_unit_id is not null
     and not app_private.current_user_can_manage_organization_unit(v_permission,v_managing_unit_id) then
    raise exception 'La unidad administradora está fuera de tu alcance.' using errcode='42501';
  end if;

  select category.id into v_category_id
  from public.ecclesial_institution_categories category
  where category.key=v_category_key and category.status='active';
  if v_category_id is null then raise exception 'Categoría institucional no válida.' using errcode='22023'; end if;

  v_status := coalesce(nullif(payload->>'status',''),case when v_id is null then 'under_review' else v_old->>'status' end);
  v_visibility := coalesce(nullif(payload->>'visibility',''),case when v_id is null then 'internal' else v_old->>'visibility' end);
  if (v_status='active' or v_visibility='public')
     and not app_private.current_user_can_manage_entity('institutions.publish',v_primary_entity_id) then
    raise exception 'No autorizado para publicar instituciones.' using errcode='42501';
  end if;

  v_slug := app_private.unique_ecclesial_institution_slug(
    v_name,
    coalesce(nullif(payload->>'slug',''),case when v_id is null then null else v_old->>'slug' end),
    v_id
  );

  if v_id is null then
    insert into public.ecclesial_institutions(
      category_id,primary_entity_id,managing_organization_unit_id,country_iso2,
      name,official_name,slug,description,civil_legal_name,civil_registration_number,
      founded_at,canonical_erected_at,civil_registered_at,closed_at,
      province,municipality,sector,address,latitude,longitude,source_document_id,
      source_name,source_url,source_checked_at,status,visibility,created_by
    ) values (
      v_category_id,v_primary_entity_id,v_managing_unit_id,
      app_private.resolve_entity_country_iso2(v_primary_entity_id),
      v_name,nullif(btrim(payload->>'official_name'),''),v_slug,nullif(btrim(payload->>'description'),''),
      nullif(btrim(payload->>'civil_legal_name'),''),nullif(btrim(payload->>'civil_registration_number'),''),
      nullif(payload->>'founded_at','')::date,nullif(payload->>'canonical_erected_at','')::date,
      nullif(payload->>'civil_registered_at','')::date,nullif(payload->>'closed_at','')::date,
      nullif(btrim(payload->>'province'),''),nullif(btrim(payload->>'municipality'),''),
      nullif(btrim(payload->>'sector'),''),nullif(btrim(payload->>'address'),''),
      nullif(payload->>'latitude','')::numeric,nullif(payload->>'longitude','')::numeric,
      v_source_document_id,nullif(btrim(payload->>'source_name'),''),nullif(btrim(payload->>'source_url'),''),
      nullif(payload->>'source_checked_at','')::date,v_status,v_visibility,v_actor
    ) returning id,country_iso2 into v_id,v_country;
  else
    update public.ecclesial_institutions institution set
      category_id=v_category_id,
      primary_entity_id=v_primary_entity_id,
      managing_organization_unit_id=v_managing_unit_id,
      name=v_name,
      official_name=case when payload ? 'official_name' then nullif(btrim(payload->>'official_name'),'') else institution.official_name end,
      slug=v_slug,
      description=case when payload ? 'description' then nullif(btrim(payload->>'description'),'') else institution.description end,
      civil_legal_name=case when payload ? 'civil_legal_name' then nullif(btrim(payload->>'civil_legal_name'),'') else institution.civil_legal_name end,
      civil_registration_number=case when payload ? 'civil_registration_number' then nullif(btrim(payload->>'civil_registration_number'),'') else institution.civil_registration_number end,
      founded_at=case when payload ? 'founded_at' then nullif(payload->>'founded_at','')::date else institution.founded_at end,
      canonical_erected_at=case when payload ? 'canonical_erected_at' then nullif(payload->>'canonical_erected_at','')::date else institution.canonical_erected_at end,
      civil_registered_at=case when payload ? 'civil_registered_at' then nullif(payload->>'civil_registered_at','')::date else institution.civil_registered_at end,
      closed_at=case when payload ? 'closed_at' then nullif(payload->>'closed_at','')::date else institution.closed_at end,
      province=case when payload ? 'province' then nullif(btrim(payload->>'province'),'') else institution.province end,
      municipality=case when payload ? 'municipality' then nullif(btrim(payload->>'municipality'),'') else institution.municipality end,
      sector=case when payload ? 'sector' then nullif(btrim(payload->>'sector'),'') else institution.sector end,
      address=case when payload ? 'address' then nullif(btrim(payload->>'address'),'') else institution.address end,
      latitude=case when payload ? 'latitude' then nullif(payload->>'latitude','')::numeric else institution.latitude end,
      longitude=case when payload ? 'longitude' then nullif(payload->>'longitude','')::numeric else institution.longitude end,
      source_document_id=case when payload ? 'source_document_id' then v_source_document_id else institution.source_document_id end,
      source_name=case when payload ? 'source_name' then nullif(btrim(payload->>'source_name'),'') else institution.source_name end,
      source_url=case when payload ? 'source_url' then nullif(btrim(payload->>'source_url'),'') else institution.source_url end,
      source_checked_at=case when payload ? 'source_checked_at' then nullif(payload->>'source_checked_at','')::date else institution.source_checked_at end,
      status=v_status,
      visibility=v_visibility
    where institution.id=v_id
    returning country_iso2 into v_country;
  end if;

  update public.ecclesial_institution_affiliations affiliation set
    ecclesiastical_entity_id=v_primary_entity_id,
    organization_unit_id=null,
    parent_institution_id=null,
    relationship_type='belongs_to',
    is_current=true,
    status='active',
    valid_to=null
  where affiliation.institution_id=v_id
    and affiliation.relationship_type='belongs_to'
    and affiliation.is_current=true;

  if not found then
    insert into public.ecclesial_institution_affiliations(
      institution_id,relationship_type,ecclesiastical_entity_id,is_current,status,created_by
    ) values (v_id,'belongs_to',v_primary_entity_id,true,'active',v_actor);
  end if;

  select to_jsonb(institution) into v_new from public.ecclesial_institutions institution where institution.id=v_id;
  perform public.create_audit_log(
    v_actor,
    case when v_old is null then 'institutions.institution.created' else 'institutions.institution.updated' end,
    'ecclesial_institutions',v_id,v_old,
    jsonb_build_object('scope_entity_id',v_primary_entity_id,'country_iso2',v_country,'record',v_new),
    app_private.audit_json_uuid(payload,'change_request_id')
  );

  return jsonb_build_object('institution_id',v_id,'slug',v_slug,'country_iso2',v_country,'status',v_status,'visibility',v_visibility);
end;
$$;

create or replace function app_private.rpc_definer__admin_save_communication_channel(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid := app_private.audit_json_uuid(payload,'id');
  v_type_key text := nullif(btrim(payload->>'channel_type_key'),'');
  v_type_id uuid;
  v_owner_entity_id uuid := app_private.audit_json_uuid(payload,'owner_entity_id');
  v_owner_unit_id uuid := app_private.audit_json_uuid(payload,'owner_organization_unit_id');
  v_owner_place_id uuid := app_private.audit_json_uuid(payload,'owner_place_id');
  v_owner_institution_id uuid := app_private.audit_json_uuid(payload,'owner_institution_id');
  v_source_document_id uuid := app_private.audit_json_uuid(payload,'source_document_id');
  v_scope_entity_id uuid;
  v_value text := nullif(btrim(payload->>'value'),'');
  v_old jsonb;
  v_new jsonb;
  v_country char(2);
begin
  if v_actor is null then raise exception 'No autenticado' using errcode='42501'; end if;
  if v_type_key is null then raise exception 'El tipo de canal es obligatorio.' using errcode='22023'; end if;
  if v_value is null then raise exception 'El valor del canal es obligatorio.' using errcode='22023'; end if;
  if num_nonnulls(v_owner_entity_id,v_owner_unit_id,v_owner_place_id,v_owner_institution_id)<>1 then
    raise exception 'Debes indicar exactamente un propietario del canal.' using errcode='22023';
  end if;

  if v_id is not null then
    select to_jsonb(channel) into v_old from public.communication_channels channel where channel.id=v_id;
    if v_old is null then raise exception 'Canal no encontrado.' using errcode='P0002'; end if;
    if not app_private.current_user_can_manage_communication_channel('communications.update_proposal',v_id) then
      raise exception 'El canal está fuera de tu alcance.' using errcode='42501';
    end if;
  end if;

  if not app_private.current_user_can_manage_channel_owner(
    'communications.update_proposal',v_owner_entity_id,v_owner_unit_id,v_owner_place_id,v_owner_institution_id
  ) then
    raise exception 'El propietario del canal está fuera de tu alcance.' using errcode='42501';
  end if;

  select type_row.id into v_type_id
  from public.communication_channel_types type_row
  where type_row.key=v_type_key and type_row.status='active';
  if v_type_id is null then raise exception 'Tipo de canal no válido.' using errcode='22023'; end if;

  if v_id is null then
    select channel.id into v_id
    from public.communication_channels channel
    where channel.channel_type_id=v_type_id
      and channel.owner_entity_id is not distinct from v_owner_entity_id
      and channel.owner_organization_unit_id is not distinct from v_owner_unit_id
      and channel.owner_place_id is not distinct from v_owner_place_id
      and channel.owner_institution_id is not distinct from v_owner_institution_id
      and channel.value=v_value
    limit 1;
  end if;

  if v_id is null then
    insert into public.communication_channels(
      channel_type_id,owner_entity_id,owner_organization_unit_id,owner_place_id,owner_institution_id,
      country_iso2,label,value,is_primary,sort_order,verified_at,source_document_id,status,visibility,created_by
    ) values (
      v_type_id,v_owner_entity_id,v_owner_unit_id,v_owner_place_id,v_owner_institution_id,
      coalesce(
        app_private.resolve_entity_country_iso2(v_owner_entity_id),
        (select app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id) from public.organization_units unit_row where unit_row.id=v_owner_unit_id),
        (select place.country_iso2 from public.ecclesiastical_places place where place.id=v_owner_place_id),
        (select institution.country_iso2 from public.ecclesial_institutions institution where institution.id=v_owner_institution_id)
      ),
      nullif(btrim(payload->>'label'),''),v_value,coalesce((payload->>'is_primary')::boolean,false),
      coalesce(nullif(payload->>'sort_order','')::integer,100),nullif(payload->>'verified_at','')::timestamptz,
      v_source_document_id,coalesce(nullif(payload->>'status',''),'active'),coalesce(nullif(payload->>'visibility',''),'public'),v_actor
    ) returning id,country_iso2 into v_id,v_country;
  else
    update public.communication_channels channel set
      channel_type_id=v_type_id,
      owner_entity_id=v_owner_entity_id,
      owner_organization_unit_id=v_owner_unit_id,
      owner_place_id=v_owner_place_id,
      owner_institution_id=v_owner_institution_id,
      label=case when payload ? 'label' then nullif(btrim(payload->>'label'),'') else channel.label end,
      value=v_value,
      is_primary=coalesce((payload->>'is_primary')::boolean,channel.is_primary),
      sort_order=coalesce(nullif(payload->>'sort_order','')::integer,channel.sort_order),
      verified_at=case when payload ? 'verified_at' then nullif(payload->>'verified_at','')::timestamptz else channel.verified_at end,
      source_document_id=case when payload ? 'source_document_id' then v_source_document_id else channel.source_document_id end,
      status=coalesce(nullif(payload->>'status',''),channel.status),
      visibility=coalesce(nullif(payload->>'visibility',''),channel.visibility)
    where channel.id=v_id
    returning country_iso2 into v_country;
  end if;

  v_scope_entity_id := app_private.channel_owner_scope_entity(v_owner_entity_id,v_owner_unit_id,v_owner_place_id,v_owner_institution_id);
  select to_jsonb(channel) into v_new from public.communication_channels channel where channel.id=v_id;
  perform public.create_audit_log(
    v_actor,
    case when v_old is null then 'communications.channel.created' else 'communications.channel.updated' end,
    'communication_channels',v_id,v_old,
    jsonb_build_object('scope_entity_id',v_scope_entity_id,'country_iso2',v_country,'record',v_new),
    app_private.audit_json_uuid(payload,'change_request_id')
  );

  return jsonb_build_object('channel_id',v_id,'country_iso2',v_country,'status',v_new->>'status','visibility',v_new->>'visibility');
end;
$$;

create or replace function public.admin_save_ecclesiastical_place(payload jsonb)
returns jsonb
language sql
security invoker
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$ select app_private.rpc_definer__admin_save_ecclesiastical_place(payload); $$;

create or replace function public.admin_save_ecclesial_institution(payload jsonb)
returns jsonb
language sql
security invoker
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$ select app_private.rpc_definer__admin_save_ecclesial_institution(payload); $$;

create or replace function public.admin_save_communication_channel(payload jsonb)
returns jsonb
language sql
security invoker
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$ select app_private.rpc_definer__admin_save_communication_channel(payload); $$;

grant execute on function app_private.rpc_definer__admin_save_ecclesiastical_place(jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_save_ecclesial_institution(jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_save_communication_channel(jsonb) to authenticated;
grant execute on function public.admin_save_ecclesiastical_place(jsonb) to authenticated;
grant execute on function public.admin_save_ecclesial_institution(jsonb) to authenticated;
grant execute on function public.admin_save_communication_channel(jsonb) to authenticated;
revoke all on function public.admin_save_ecclesiastical_place(jsonb) from public,anon;
revoke all on function public.admin_save_ecclesial_institution(jsonb) from public,anon;
revoke all on function public.admin_save_communication_channel(jsonb) from public,anon;
revoke all on function app_private.unique_ecclesiastical_place_slug(text,text,uuid) from public,anon,authenticated;
revoke all on function app_private.unique_ecclesial_institution_slug(text,text,uuid) from public,anon,authenticated;
revoke all on function app_private.current_user_can_manage_channel_owner(text,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function app_private.channel_owner_scope_entity(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create or replace view public.public_ecclesiastical_places
with (security_invoker=true)
as
select place.id,place.name,place.official_name,place.slug,place.description,
       type_row.key as place_type_key,type_row.name as place_type_name,
       place.dedication_title,place.patron_name,place.opened_at,place.blessed_at,
       place.dedicated_at,place.consecrated_at,place.capacity,place.is_primary_seat,
       place.primary_entity_id,entity.name as primary_entity_name,entity.slug as primary_entity_slug,
       place.country_iso2,place.province,place.municipality,place.sector,place.address,
       place.latitude,place.longitude,place.source_name,place.source_url,place.source_checked_at,
       place.created_at,place.updated_at
from public.ecclesiastical_places place
join public.ecclesiastical_place_types type_row on type_row.id=place.place_type_id
join public.ecclesiastical_entities entity on entity.id=place.primary_entity_id
where place.status='active' and place.visibility='public';

create or replace view public.public_ecclesial_institutions
with (security_invoker=true)
as
select institution.id,institution.name,institution.official_name,institution.slug,institution.description,
       category.key as category_key,category.name as category_name,category.domain,
       institution.civil_legal_name,institution.founded_at,institution.canonical_erected_at,
       institution.primary_entity_id,entity.name as primary_entity_name,entity.slug as primary_entity_slug,
       institution.country_iso2,institution.province,institution.municipality,institution.sector,
       institution.address,institution.latitude,institution.longitude,
       institution.source_name,institution.source_url,institution.source_checked_at,
       institution.created_at,institution.updated_at
from public.ecclesial_institutions institution
join public.ecclesial_institution_categories category on category.id=institution.category_id
join public.ecclesiastical_entities entity on entity.id=institution.primary_entity_id
where institution.status='active' and institution.visibility='public';

create or replace view public.public_communication_channels
with (security_invoker=true)
as
select channel.id,type_row.key as channel_type_key,type_row.name as channel_type_name,
       type_row.channel_group,channel.label,channel.value,channel.is_primary,channel.sort_order,
       channel.owner_entity_id,channel.owner_organization_unit_id,channel.owner_place_id,
       channel.owner_institution_id,channel.country_iso2,channel.verified_at
from public.communication_channels channel
join public.communication_channel_types type_row on type_row.id=channel.channel_type_id
where channel.status='active' and channel.visibility='public';

grant select on public.public_ecclesiastical_places,public.public_ecclesial_institutions,public.public_communication_channels to anon,authenticated;

comment on function public.admin_save_ecclesiastical_place(jsonb) is 'Crea o actualiza un lugar físico dentro del alcance del usuario y registra auditoría.';
comment on function public.admin_save_ecclesial_institution(jsonb) is 'Crea o actualiza una institución u obra dentro del alcance del usuario y registra auditoría.';
comment on function public.admin_save_communication_channel(jsonb) is 'Crea o actualiza un canal normalizado para cualquier propietario eclesial autorizado.';
