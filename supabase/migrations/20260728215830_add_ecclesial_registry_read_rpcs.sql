create or replace function app_private.registry_entity_in_scope(
  p_entity_id uuid,
  p_managing_organization_unit_id uuid,
  p_scope_type text,
  p_scope_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path='pg_catalog','public','app_private','pg_temp'
as $$
declare
  v_scope_type text := app_private.normalize_authorization_scope_type(p_scope_type);
  v_scope_country char(2);
  v_scope_entity_id uuid;
begin
  if p_entity_id is null then return false; end if;
  if v_scope_type is null then return true; end if;
  if v_scope_type='global' then return true; end if;
  if p_scope_id is null then return false; end if;

  if v_scope_type='national' then
    v_scope_country := app_private.resolve_entity_country_iso2(p_scope_id);
    return v_scope_country is not null
       and app_private.resolve_entity_country_iso2(p_entity_id)=v_scope_country;
  end if;

  if v_scope_type in ('diocese','parish')
     or (v_scope_type='entity' and exists(
       select 1 from public.ecclesiastical_entities entity where entity.id=p_scope_id
     )) then
    return app_private.calendar_entity_in_scope(p_entity_id,p_scope_id);
  end if;

  if v_scope_type in ('vicariate','zone')
     or (v_scope_type='entity' and exists(
       select 1 from public.structure_nodes node_row where node_row.id=p_scope_id
     )) then
    return exists(
      with recursive node_lineage as (
        select node_row.id,node_row.parent_node_id,array[node_row.id]::uuid[] as visited,0 as depth
        from public.structure_nodes node_row
        where node_row.linked_ecclesiastical_entity_id=p_entity_id
          and node_row.status='active'
          and node_row.is_current=true
        union all
        select parent_row.id,parent_row.parent_node_id,
               lineage.visited||parent_row.id,lineage.depth+1
        from node_lineage lineage
        join public.structure_nodes parent_row on parent_row.id=lineage.parent_node_id
        where lineage.depth<25 and not parent_row.id=any(lineage.visited)
      )
      select 1 from node_lineage where id=p_scope_id
    );
  end if;

  if v_scope_type='organization_unit' then
    if p_managing_organization_unit_id is null then return false; end if;
    return exists(
      with recursive unit_lineage as (
        select unit_row.id,unit_row.parent_unit_id,array[unit_row.id]::uuid[] as visited,0 as depth
        from public.organization_units unit_row
        where unit_row.id=p_managing_organization_unit_id
        union all
        select parent_row.id,parent_row.parent_unit_id,
               lineage.visited||parent_row.id,lineage.depth+1
        from unit_lineage lineage
        join public.organization_units parent_row on parent_row.id=lineage.parent_unit_id
        where lineage.depth<25 and not parent_row.id=any(lineage.visited)
      )
      select 1 from unit_lineage where id=p_scope_id
    );
  end if;

  if v_scope_type='pastoral_area' then
    return exists(
      select 1 from public.organization_units unit_row
      where unit_row.id=p_managing_organization_unit_id
        and unit_row.pastoral_area_id=p_scope_id
    );
  end if;

  select coalesce(node_row.linked_ecclesiastical_entity_id,node_row.diocese_id)
  into v_scope_entity_id
  from public.structure_nodes node_row where node_row.id=p_scope_id;
  return v_scope_entity_id is not null
     and app_private.calendar_entity_in_scope(p_entity_id,v_scope_entity_id);
end;
$$;

create or replace function app_private.registry_place_in_scope(
  p_place_id uuid,
  p_scope_type text,
  p_scope_id uuid
)
returns boolean
language sql
stable
security definer
set search_path='pg_catalog','public','app_private','pg_temp'
as $$
  select exists(
    select 1
    from public.ecclesiastical_places place
    where place.id=p_place_id
      and (
        app_private.registry_entity_in_scope(
          place.primary_entity_id,place.managing_organization_unit_id,p_scope_type,p_scope_id
        )
        or exists(
          select 1
          from public.ecclesiastical_place_affiliations affiliation
          left join public.organization_units unit_row on unit_row.id=affiliation.organization_unit_id
          left join public.ecclesial_institutions institution on institution.id=affiliation.institution_id
          where affiliation.place_id=place.id
            and affiliation.status='active'
            and affiliation.is_current=true
            and app_private.registry_entity_in_scope(
              coalesce(affiliation.ecclesiastical_entity_id,unit_row.ecclesiastical_entity_id,institution.primary_entity_id),
              affiliation.organization_unit_id,
              p_scope_type,p_scope_id
            )
        )
      )
  );
$$;

create or replace function app_private.registry_institution_in_scope(
  p_institution_id uuid,
  p_scope_type text,
  p_scope_id uuid
)
returns boolean
language sql
stable
security definer
set search_path='pg_catalog','public','app_private','pg_temp'
as $$
  select exists(
    select 1
    from public.ecclesial_institutions institution
    where institution.id=p_institution_id
      and (
        app_private.registry_entity_in_scope(
          institution.primary_entity_id,institution.managing_organization_unit_id,p_scope_type,p_scope_id
        )
        or exists(
          select 1
          from public.ecclesial_institution_affiliations affiliation
          left join public.organization_units unit_row on unit_row.id=affiliation.organization_unit_id
          left join public.ecclesial_institutions parent_institution on parent_institution.id=affiliation.parent_institution_id
          where affiliation.institution_id=institution.id
            and affiliation.status='active'
            and affiliation.is_current=true
            and app_private.registry_entity_in_scope(
              coalesce(affiliation.ecclesiastical_entity_id,unit_row.ecclesiastical_entity_id,parent_institution.primary_entity_id),
              affiliation.organization_unit_id,
              p_scope_type,p_scope_id
            )
        )
      )
  );
$$;

create or replace function app_private.registry_channel_in_scope(
  p_channel_id uuid,
  p_scope_type text,
  p_scope_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path='pg_catalog','public','app_private','pg_temp'
as $$
declare
  v_channel public.communication_channels%rowtype;
  v_entity_id uuid;
  v_unit_id uuid;
begin
  select * into v_channel from public.communication_channels channel where channel.id=p_channel_id;
  if not found then return false; end if;

  if v_channel.owner_entity_id is not null then
    v_entity_id := v_channel.owner_entity_id;
  elsif v_channel.owner_organization_unit_id is not null then
    v_unit_id := v_channel.owner_organization_unit_id;
    select unit_row.ecclesiastical_entity_id into v_entity_id
    from public.organization_units unit_row where unit_row.id=v_unit_id;
  elsif v_channel.owner_place_id is not null then
    select place.primary_entity_id,place.managing_organization_unit_id
    into v_entity_id,v_unit_id
    from public.ecclesiastical_places place where place.id=v_channel.owner_place_id;
  else
    select institution.primary_entity_id,institution.managing_organization_unit_id
    into v_entity_id,v_unit_id
    from public.ecclesial_institutions institution where institution.id=v_channel.owner_institution_id;
  end if;

  return app_private.registry_entity_in_scope(v_entity_id,v_unit_id,p_scope_type,p_scope_id);
end;
$$;

create or replace function app_private.rpc_definer__admin_list_ecclesiastical_places(
  p_scope_type text default null,
  p_scope_id uuid default null,
  p_search text default null,
  p_place_type_key text default null,
  p_status text default null,
  p_visibility text default null,
  p_limit integer default 500
)
returns table(
  id uuid,name text,official_name text,slug text,place_type_key text,place_type_name text,
  primary_entity_id uuid,primary_entity_name text,managing_organization_unit_id uuid,
  managing_organization_unit_name text,country_iso2 char(2),municipality text,address text,
  dedicated_at date,consecrated_at date,is_primary_seat boolean,status text,visibility text,
  channel_count bigint,affiliation_count bigint,legacy_entity_id uuid,created_at timestamptz,updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$
begin
  if auth.uid() is null or not app_private.current_user_has_permission('places.view') then
    raise exception 'No autorizado para consultar lugares eclesiásticos.' using errcode='42501';
  end if;
  return query
  select place.id,place.name,place.official_name,place.slug,type_row.key,type_row.name,
         place.primary_entity_id,entity.name,place.managing_organization_unit_id,unit_row.name,
         place.country_iso2,place.municipality,place.address,place.dedicated_at,place.consecrated_at,
         place.is_primary_seat,place.status,place.visibility,
         (select count(*) from public.communication_channels channel where channel.owner_place_id=place.id and channel.status<>'archived'),
         (select count(*) from public.ecclesiastical_place_affiliations affiliation where affiliation.place_id=place.id and affiliation.status<>'archived'),
         place.legacy_entity_id,place.created_at,place.updated_at
  from public.ecclesiastical_places place
  join public.ecclesiastical_place_types type_row on type_row.id=place.place_type_id
  join public.ecclesiastical_entities entity on entity.id=place.primary_entity_id
  left join public.organization_units unit_row on unit_row.id=place.managing_organization_unit_id
  where app_private.current_user_can_manage_ecclesiastical_place('places.view',place.id)
    and app_private.registry_place_in_scope(place.id,p_scope_type,p_scope_id)
    and (nullif(btrim(p_search),'') is null or concat_ws(' ',place.name,place.official_name,place.description,place.address,place.municipality,entity.name) ilike '%'||btrim(p_search)||'%')
    and (nullif(p_place_type_key,'') is null or type_row.key=p_place_type_key)
    and (nullif(p_status,'') is null or place.status=p_status)
    and (nullif(p_visibility,'') is null or place.visibility=p_visibility)
  order by place.name
  limit greatest(1,least(coalesce(p_limit,500),2000));
end;
$$;

create or replace function app_private.rpc_definer__admin_list_ecclesial_institutions(
  p_scope_type text default null,
  p_scope_id uuid default null,
  p_search text default null,
  p_category_key text default null,
  p_status text default null,
  p_visibility text default null,
  p_limit integer default 500
)
returns table(
  id uuid,name text,official_name text,slug text,category_key text,category_name text,domain text,
  primary_entity_id uuid,primary_entity_name text,managing_organization_unit_id uuid,
  managing_organization_unit_name text,country_iso2 char(2),municipality text,address text,
  founded_at date,canonical_erected_at date,status text,visibility text,channel_count bigint,
  affiliation_count bigint,legacy_entity_id uuid,created_at timestamptz,updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$
begin
  if auth.uid() is null or not app_private.current_user_has_permission('institutions.view') then
    raise exception 'No autorizado para consultar instituciones.' using errcode='42501';
  end if;
  return query
  select institution.id,institution.name,institution.official_name,institution.slug,
         category.key,category.name,category.domain,institution.primary_entity_id,entity.name,
         institution.managing_organization_unit_id,unit_row.name,institution.country_iso2,
         institution.municipality,institution.address,institution.founded_at,institution.canonical_erected_at,
         institution.status,institution.visibility,
         (select count(*) from public.communication_channels channel where channel.owner_institution_id=institution.id and channel.status<>'archived'),
         (select count(*) from public.ecclesial_institution_affiliations affiliation where affiliation.institution_id=institution.id and affiliation.status<>'archived'),
         institution.legacy_entity_id,institution.created_at,institution.updated_at
  from public.ecclesial_institutions institution
  join public.ecclesial_institution_categories category on category.id=institution.category_id
  join public.ecclesiastical_entities entity on entity.id=institution.primary_entity_id
  left join public.organization_units unit_row on unit_row.id=institution.managing_organization_unit_id
  where app_private.current_user_can_manage_ecclesial_institution('institutions.view',institution.id)
    and app_private.registry_institution_in_scope(institution.id,p_scope_type,p_scope_id)
    and (nullif(btrim(p_search),'') is null or concat_ws(' ',institution.name,institution.official_name,institution.description,institution.address,institution.municipality,entity.name,category.name) ilike '%'||btrim(p_search)||'%')
    and (nullif(p_category_key,'') is null or category.key=p_category_key)
    and (nullif(p_status,'') is null or institution.status=p_status)
    and (nullif(p_visibility,'') is null or institution.visibility=p_visibility)
  order by institution.name
  limit greatest(1,least(coalesce(p_limit,500),2000));
end;
$$;

create or replace function app_private.rpc_definer__admin_list_communication_channels(
  p_scope_type text default null,
  p_scope_id uuid default null,
  p_search text default null,
  p_channel_type_key text default null,
  p_status text default null,
  p_visibility text default null,
  p_limit integer default 1000
)
returns table(
  id uuid,channel_type_key text,channel_type_name text,channel_group text,label text,value text,
  owner_kind text,owner_id uuid,owner_name text,country_iso2 char(2),is_primary boolean,
  status text,visibility text,verified_at timestamptz,created_at timestamptz,updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$
begin
  if auth.uid() is null or not app_private.current_user_has_permission('communications.view') then
    raise exception 'No autorizado para consultar canales de comunicación.' using errcode='42501';
  end if;
  return query
  select channel.id,type_row.key,type_row.name,type_row.channel_group,channel.label,channel.value,
         case when channel.owner_entity_id is not null then 'entity'
              when channel.owner_organization_unit_id is not null then 'organization_unit'
              when channel.owner_place_id is not null then 'place'
              else 'institution' end,
         coalesce(channel.owner_entity_id,channel.owner_organization_unit_id,channel.owner_place_id,channel.owner_institution_id),
         coalesce(entity.name,unit_row.name,place.name,institution.name),channel.country_iso2,
         channel.is_primary,channel.status,channel.visibility,channel.verified_at,channel.created_at,channel.updated_at
  from public.communication_channels channel
  join public.communication_channel_types type_row on type_row.id=channel.channel_type_id
  left join public.ecclesiastical_entities entity on entity.id=channel.owner_entity_id
  left join public.organization_units unit_row on unit_row.id=channel.owner_organization_unit_id
  left join public.ecclesiastical_places place on place.id=channel.owner_place_id
  left join public.ecclesial_institutions institution on institution.id=channel.owner_institution_id
  where app_private.current_user_can_manage_communication_channel('communications.view',channel.id)
    and app_private.registry_channel_in_scope(channel.id,p_scope_type,p_scope_id)
    and (nullif(btrim(p_search),'') is null or concat_ws(' ',channel.label,channel.value,entity.name,unit_row.name,place.name,institution.name,type_row.name) ilike '%'||btrim(p_search)||'%')
    and (nullif(p_channel_type_key,'') is null or type_row.key=p_channel_type_key)
    and (nullif(p_status,'') is null or channel.status=p_status)
    and (nullif(p_visibility,'') is null or channel.visibility=p_visibility)
  order by coalesce(entity.name,unit_row.name,place.name,institution.name),channel.sort_order,type_row.name
  limit greatest(1,least(coalesce(p_limit,1000),3000));
end;
$$;

create or replace function app_private.rpc_definer__admin_list_ecclesial_registry_owner_options(
  p_scope_type text default null,
  p_scope_id uuid default null,
  p_limit integer default 1500
)
returns table(
  owner_kind text,owner_id uuid,label text,country_iso2 char(2),
  allowed_for_places boolean,allowed_for_institutions boolean,allowed_for_communications boolean
)
language plpgsql
stable
security definer
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$
begin
  if auth.uid() is null or not (
    app_private.current_user_has_permission('places.create_proposal')
    or app_private.current_user_has_permission('institutions.create_proposal')
    or app_private.current_user_has_permission('communications.update_proposal')
  ) then
    raise exception 'No autorizado para consultar propietarios del registro eclesial.' using errcode='42501';
  end if;

  return query
  with options as (
    select 'entity'::text,entity.id,entity.name::text,entity.country_iso2,
           app_private.current_user_can_manage_entity('places.create_proposal',entity.id),
           app_private.current_user_can_manage_entity('institutions.create_proposal',entity.id),
           app_private.current_user_can_manage_entity('communications.update_proposal',entity.id)
    from public.ecclesiastical_entities entity
    where entity.status='active'
      and app_private.registry_entity_in_scope(entity.id,null,p_scope_type,p_scope_id)
      and (
        app_private.current_user_can_manage_entity('places.create_proposal',entity.id)
        or app_private.current_user_can_manage_entity('institutions.create_proposal',entity.id)
        or app_private.current_user_can_manage_entity('communications.update_proposal',entity.id)
      )
    union all
    select 'organization_unit'::text,unit_row.id,unit_row.name::text,
           app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id),false,false,
           app_private.current_user_can_manage_organization_unit('communications.update_proposal',unit_row.id)
    from public.organization_units unit_row
    where unit_row.status='active' and unit_row.is_current=true
      and app_private.registry_entity_in_scope(unit_row.ecclesiastical_entity_id,unit_row.id,p_scope_type,p_scope_id)
      and app_private.current_user_can_manage_organization_unit('communications.update_proposal',unit_row.id)
    union all
    select 'place'::text,place.id,place.name::text,place.country_iso2,false,false,
           app_private.current_user_can_manage_ecclesiastical_place('communications.update_proposal',place.id)
    from public.ecclesiastical_places place
    where place.status<>'archived'
      and app_private.registry_place_in_scope(place.id,p_scope_type,p_scope_id)
      and app_private.current_user_can_manage_ecclesiastical_place('communications.update_proposal',place.id)
    union all
    select 'institution'::text,institution.id,institution.name::text,institution.country_iso2,false,false,
           app_private.current_user_can_manage_ecclesial_institution('communications.update_proposal',institution.id)
    from public.ecclesial_institutions institution
    where institution.status<>'archived'
      and app_private.registry_institution_in_scope(institution.id,p_scope_type,p_scope_id)
      and app_private.current_user_can_manage_ecclesial_institution('communications.update_proposal',institution.id)
  )
  select * from options
  order by owner_kind,label
  limit greatest(1,least(coalesce(p_limit,1500),4000));
end;
$$;

create or replace function public.admin_list_ecclesiastical_places(
  p_scope_type text default null,p_scope_id uuid default null,p_search text default null,
  p_place_type_key text default null,p_status text default null,p_visibility text default null,p_limit integer default 500
)
returns table(
  id uuid,name text,official_name text,slug text,place_type_key text,place_type_name text,
  primary_entity_id uuid,primary_entity_name text,managing_organization_unit_id uuid,
  managing_organization_unit_name text,country_iso2 char(2),municipality text,address text,
  dedicated_at date,consecrated_at date,is_primary_seat boolean,status text,visibility text,
  channel_count bigint,affiliation_count bigint,legacy_entity_id uuid,created_at timestamptz,updated_at timestamptz
)
language sql stable security invoker
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$ select * from app_private.rpc_definer__admin_list_ecclesiastical_places(p_scope_type,p_scope_id,p_search,p_place_type_key,p_status,p_visibility,p_limit); $$;

create or replace function public.admin_list_ecclesial_institutions(
  p_scope_type text default null,p_scope_id uuid default null,p_search text default null,
  p_category_key text default null,p_status text default null,p_visibility text default null,p_limit integer default 500
)
returns table(
  id uuid,name text,official_name text,slug text,category_key text,category_name text,domain text,
  primary_entity_id uuid,primary_entity_name text,managing_organization_unit_id uuid,
  managing_organization_unit_name text,country_iso2 char(2),municipality text,address text,
  founded_at date,canonical_erected_at date,status text,visibility text,channel_count bigint,
  affiliation_count bigint,legacy_entity_id uuid,created_at timestamptz,updated_at timestamptz
)
language sql stable security invoker
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$ select * from app_private.rpc_definer__admin_list_ecclesial_institutions(p_scope_type,p_scope_id,p_search,p_category_key,p_status,p_visibility,p_limit); $$;

create or replace function public.admin_list_communication_channels(
  p_scope_type text default null,p_scope_id uuid default null,p_search text default null,
  p_channel_type_key text default null,p_status text default null,p_visibility text default null,p_limit integer default 1000
)
returns table(
  id uuid,channel_type_key text,channel_type_name text,channel_group text,label text,value text,
  owner_kind text,owner_id uuid,owner_name text,country_iso2 char(2),is_primary boolean,
  status text,visibility text,verified_at timestamptz,created_at timestamptz,updated_at timestamptz
)
language sql stable security invoker
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$ select * from app_private.rpc_definer__admin_list_communication_channels(p_scope_type,p_scope_id,p_search,p_channel_type_key,p_status,p_visibility,p_limit); $$;

create or replace function public.admin_list_ecclesial_registry_owner_options(
  p_scope_type text default null,p_scope_id uuid default null,p_limit integer default 1500
)
returns table(
  owner_kind text,owner_id uuid,label text,country_iso2 char(2),
  allowed_for_places boolean,allowed_for_institutions boolean,allowed_for_communications boolean
)
language sql stable security invoker
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$ select * from app_private.rpc_definer__admin_list_ecclesial_registry_owner_options(p_scope_type,p_scope_id,p_limit); $$;

grant execute on function app_private.rpc_definer__admin_list_ecclesiastical_places(text,uuid,text,text,text,text,integer) to authenticated;
grant execute on function app_private.rpc_definer__admin_list_ecclesial_institutions(text,uuid,text,text,text,text,integer) to authenticated;
grant execute on function app_private.rpc_definer__admin_list_communication_channels(text,uuid,text,text,text,text,integer) to authenticated;
grant execute on function app_private.rpc_definer__admin_list_ecclesial_registry_owner_options(text,uuid,integer) to authenticated;
grant execute on function public.admin_list_ecclesiastical_places(text,uuid,text,text,text,text,integer) to authenticated;
grant execute on function public.admin_list_ecclesial_institutions(text,uuid,text,text,text,text,integer) to authenticated;
grant execute on function public.admin_list_communication_channels(text,uuid,text,text,text,text,integer) to authenticated;
grant execute on function public.admin_list_ecclesial_registry_owner_options(text,uuid,integer) to authenticated;
revoke all on function public.admin_list_ecclesiastical_places(text,uuid,text,text,text,text,integer) from public,anon;
revoke all on function public.admin_list_ecclesial_institutions(text,uuid,text,text,text,text,integer) from public,anon;
revoke all on function public.admin_list_communication_channels(text,uuid,text,text,text,text,integer) from public,anon;
revoke all on function public.admin_list_ecclesial_registry_owner_options(text,uuid,integer) from public,anon;
revoke all on function app_private.registry_entity_in_scope(uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function app_private.registry_place_in_scope(uuid,text,uuid) from public,anon,authenticated;
revoke all on function app_private.registry_institution_in_scope(uuid,text,uuid) from public,anon,authenticated;
revoke all on function app_private.registry_channel_in_scope(uuid,text,uuid) from public,anon,authenticated;

comment on function public.admin_list_ecclesiastical_places(text,uuid,text,text,text,text,integer) is 'Lista lugares autorizados y limitados al ámbito administrativo activo.';
comment on function public.admin_list_ecclesial_institutions(text,uuid,text,text,text,text,integer) is 'Lista instituciones autorizadas y limitadas al ámbito administrativo activo.';
comment on function public.admin_list_communication_channels(text,uuid,text,text,text,text,integer) is 'Lista canales autorizados y limitados al ámbito administrativo activo.';
comment on function public.admin_list_ecclesial_registry_owner_options(text,uuid,integer) is 'Devuelve entidades, unidades, lugares e instituciones utilizables como propietarios según permisos y ámbito activo.';
