create or replace function app_private.registry_slug(p_value text)
returns text
language sql
immutable
set search_path='pg_catalog','pg_temp'
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(p_value,''),'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')),
    '[^a-z0-9]+','-','g'
  ));
$$;

create or replace function app_private.derive_ecclesiastical_place_context()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','app_private','pg_temp'
as $$
declare
  v_country char(2);
  v_unit_country char(2);
  v_allows_dedication boolean;
  v_allows_consecration boolean;
begin
  v_country := app_private.resolve_entity_country_iso2(new.primary_entity_id);
  if v_country is null then
    raise exception 'No se pudo resolver el país de la entidad principal del lugar.' using errcode='23514';
  end if;

  if new.managing_organization_unit_id is not null then
    select app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id)
    into v_unit_country
    from public.organization_units unit_row
    where unit_row.id=new.managing_organization_unit_id;

    if v_unit_country is null then
      raise exception 'No se pudo resolver el país de la unidad administradora.' using errcode='23514';
    end if;
    if v_unit_country <> v_country then
      raise exception 'La unidad administradora y el lugar pertenecen a países distintos.' using errcode='23514';
    end if;
  end if;

  select type_row.allows_dedication,type_row.allows_consecration
  into v_allows_dedication,v_allows_consecration
  from public.ecclesiastical_place_types type_row
  where type_row.id=new.place_type_id and type_row.status='active';

  if not found then
    raise exception 'El tipo de lugar no existe o no está activo.' using errcode='23514';
  end if;
  if new.dedicated_at is not null and not v_allows_dedication then
    raise exception 'El tipo de lugar seleccionado no admite fecha de dedicación.' using errcode='23514';
  end if;
  if new.consecrated_at is not null and not v_allows_consecration then
    raise exception 'El tipo de lugar seleccionado no admite fecha de consagración.' using errcode='23514';
  end if;
  if new.country_iso2 is not null and new.country_iso2 <> v_country then
    raise exception 'El país del lugar no coincide con su entidad principal.' using errcode='23514';
  end if;

  new.country_iso2 := v_country;
  return new;
end;
$$;

create or replace function app_private.derive_ecclesial_institution_context()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','app_private','pg_temp'
as $$
declare
  v_country char(2);
  v_unit_country char(2);
begin
  v_country := app_private.resolve_entity_country_iso2(new.primary_entity_id);
  if v_country is null then
    raise exception 'No se pudo resolver el país de la entidad principal de la institución.' using errcode='23514';
  end if;

  if new.managing_organization_unit_id is not null then
    select app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id)
    into v_unit_country
    from public.organization_units unit_row
    where unit_row.id=new.managing_organization_unit_id;

    if v_unit_country is null then
      raise exception 'No se pudo resolver el país de la unidad administradora.' using errcode='23514';
    end if;
    if v_unit_country <> v_country then
      raise exception 'La unidad administradora y la institución pertenecen a países distintos.' using errcode='23514';
    end if;
  end if;

  if not exists(
    select 1 from public.ecclesial_institution_categories category
    where category.id=new.category_id and category.status='active'
  ) then
    raise exception 'La categoría institucional no existe o no está activa.' using errcode='23514';
  end if;
  if new.country_iso2 is not null and new.country_iso2 <> v_country then
    raise exception 'El país de la institución no coincide con su entidad principal.' using errcode='23514';
  end if;

  new.country_iso2 := v_country;
  return new;
end;
$$;

create or replace function app_private.validate_ecclesiastical_place_affiliation()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','app_private','pg_temp'
as $$
declare
  v_place_country char(2);
  v_target_country char(2);
begin
  select place.country_iso2 into v_place_country
  from public.ecclesiastical_places place where place.id=new.place_id;

  if new.ecclesiastical_entity_id is not null then
    v_target_country := app_private.resolve_entity_country_iso2(new.ecclesiastical_entity_id);
  elsif new.organization_unit_id is not null then
    select app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id)
    into v_target_country
    from public.organization_units unit_row where unit_row.id=new.organization_unit_id;
  else
    select institution.country_iso2 into v_target_country
    from public.ecclesial_institutions institution where institution.id=new.institution_id;
  end if;

  if v_place_country is null or v_target_country is null or v_place_country <> v_target_country then
    raise exception 'La afiliación del lugar debe permanecer dentro del mismo país.' using errcode='23514';
  end if;
  if new.relationship_type='seat_of' and new.ecclesiastical_entity_id is null then
    raise exception 'La relación seat_of requiere una entidad eclesial.' using errcode='23514';
  end if;
  return new;
end;
$$;

create or replace function app_private.validate_ecclesial_institution_affiliation()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','app_private','pg_temp'
as $$
declare
  v_institution_country char(2);
  v_target_country char(2);
begin
  select institution.country_iso2 into v_institution_country
  from public.ecclesial_institutions institution where institution.id=new.institution_id;

  if new.ecclesiastical_entity_id is not null then
    v_target_country := app_private.resolve_entity_country_iso2(new.ecclesiastical_entity_id);
  elsif new.organization_unit_id is not null then
    select app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id)
    into v_target_country
    from public.organization_units unit_row where unit_row.id=new.organization_unit_id;
  else
    select parent.country_iso2 into v_target_country
    from public.ecclesial_institutions parent where parent.id=new.parent_institution_id;
  end if;

  if v_institution_country is null or v_target_country is null or v_institution_country <> v_target_country then
    raise exception 'La afiliación institucional debe permanecer dentro del mismo país.' using errcode='23514';
  end if;
  return new;
end;
$$;

create or replace function app_private.derive_communication_channel_context()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','app_private','pg_temp'
as $$
declare
  v_country char(2);
  v_kind text;
begin
  if new.owner_entity_id is not null then
    v_country := app_private.resolve_entity_country_iso2(new.owner_entity_id);
  elsif new.owner_organization_unit_id is not null then
    select app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id)
    into v_country
    from public.organization_units unit_row where unit_row.id=new.owner_organization_unit_id;
  elsif new.owner_place_id is not null then
    select place.country_iso2 into v_country
    from public.ecclesiastical_places place where place.id=new.owner_place_id;
  else
    select institution.country_iso2 into v_country
    from public.ecclesial_institutions institution where institution.id=new.owner_institution_id;
  end if;

  select type_row.value_kind into v_kind
  from public.communication_channel_types type_row
  where type_row.id=new.channel_type_id and type_row.status='active';

  if v_country is null then
    raise exception 'No se pudo resolver el país del propietario del canal.' using errcode='23514';
  end if;
  if v_kind is null then
    raise exception 'El tipo de canal no existe o no está activo.' using errcode='23514';
  end if;
  if v_kind='email' and btrim(new.value) !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo electrónico no tiene un formato válido.' using errcode='22023';
  end if;
  if v_kind='url' and btrim(new.value) !~* '^https?://' then
    raise exception 'El canal requiere una URL http o https.' using errcode='22023';
  end if;
  if new.country_iso2 is not null and new.country_iso2 <> v_country then
    raise exception 'El país del canal no coincide con su propietario.' using errcode='23514';
  end if;

  new.value := btrim(new.value);
  new.country_iso2 := v_country;
  return new;
end;
$$;

drop trigger if exists ecclesiastical_places_derive_context on public.ecclesiastical_places;
create trigger ecclesiastical_places_derive_context
before insert or update on public.ecclesiastical_places
for each row execute function app_private.derive_ecclesiastical_place_context();

drop trigger if exists ecclesial_institutions_derive_context on public.ecclesial_institutions;
create trigger ecclesial_institutions_derive_context
before insert or update on public.ecclesial_institutions
for each row execute function app_private.derive_ecclesial_institution_context();

drop trigger if exists ecclesiastical_place_affiliations_validate on public.ecclesiastical_place_affiliations;
create trigger ecclesiastical_place_affiliations_validate
before insert or update on public.ecclesiastical_place_affiliations
for each row execute function app_private.validate_ecclesiastical_place_affiliation();

drop trigger if exists ecclesial_institution_affiliations_validate on public.ecclesial_institution_affiliations;
create trigger ecclesial_institution_affiliations_validate
before insert or update on public.ecclesial_institution_affiliations
for each row execute function app_private.validate_ecclesial_institution_affiliation();

drop trigger if exists communication_channels_derive_context on public.communication_channels;
create trigger communication_channels_derive_context
before insert or update on public.communication_channels
for each row execute function app_private.derive_communication_channel_context();

create or replace function app_private.current_user_can_manage_ecclesiastical_place(
  p_permission_key text,
  p_place_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$
declare
  v_entity_id uuid;
  v_unit_id uuid;
begin
  if auth.uid() is null or p_place_id is null or nullif(p_permission_key,'') is null then return false; end if;
  select place.primary_entity_id,place.managing_organization_unit_id
  into v_entity_id,v_unit_id
  from public.ecclesiastical_places place where place.id=p_place_id;
  if not found then return false; end if;
  return app_private.current_user_can_manage_entity(p_permission_key,v_entity_id)
    or (v_unit_id is not null and app_private.current_user_can_manage_organization_unit(p_permission_key,v_unit_id));
end;
$$;

create or replace function app_private.current_user_can_manage_ecclesial_institution(
  p_permission_key text,
  p_institution_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$
declare
  v_entity_id uuid;
  v_unit_id uuid;
begin
  if auth.uid() is null or p_institution_id is null or nullif(p_permission_key,'') is null then return false; end if;
  select institution.primary_entity_id,institution.managing_organization_unit_id
  into v_entity_id,v_unit_id
  from public.ecclesial_institutions institution where institution.id=p_institution_id;
  if not found then return false; end if;
  return app_private.current_user_can_manage_entity(p_permission_key,v_entity_id)
    or (v_unit_id is not null and app_private.current_user_can_manage_organization_unit(p_permission_key,v_unit_id));
end;
$$;

create or replace function app_private.current_user_can_manage_communication_channel(
  p_permission_key text,
  p_channel_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$
declare
  v_channel public.communication_channels%rowtype;
begin
  if auth.uid() is null or p_channel_id is null or nullif(p_permission_key,'') is null then return false; end if;
  select * into v_channel from public.communication_channels channel where channel.id=p_channel_id;
  if not found then return false; end if;
  if v_channel.owner_entity_id is not null then
    return app_private.current_user_can_manage_entity(p_permission_key,v_channel.owner_entity_id);
  elsif v_channel.owner_organization_unit_id is not null then
    return app_private.current_user_can_manage_organization_unit(p_permission_key,v_channel.owner_organization_unit_id);
  elsif v_channel.owner_place_id is not null then
    return app_private.current_user_can_manage_ecclesiastical_place(p_permission_key,v_channel.owner_place_id);
  else
    return app_private.current_user_can_manage_ecclesial_institution(p_permission_key,v_channel.owner_institution_id);
  end if;
end;
$$;

alter table public.ecclesiastical_place_types enable row level security;
alter table public.ecclesial_institution_categories enable row level security;
alter table public.communication_channel_types enable row level security;
alter table public.ecclesiastical_places enable row level security;
alter table public.ecclesial_institutions enable row level security;
alter table public.ecclesiastical_place_affiliations enable row level security;
alter table public.ecclesial_institution_affiliations enable row level security;
alter table public.communication_channels enable row level security;

create policy ecclesiastical_place_types_read_active on public.ecclesiastical_place_types
for select to anon,authenticated using (status='active');
create policy institution_categories_read_active on public.ecclesial_institution_categories
for select to anon,authenticated using (status='active');
create policy communication_channel_types_read_active on public.communication_channel_types
for select to anon,authenticated using (status='active');

create policy ecclesiastical_places_public_read on public.ecclesiastical_places
for select to anon using (status='active' and visibility='public');
create policy ecclesiastical_places_scoped_read on public.ecclesiastical_places
for select to authenticated using (
  (status='active' and visibility='public')
  or app_private.current_user_can_manage_ecclesiastical_place('places.view',id)
);

create policy ecclesial_institutions_public_read on public.ecclesial_institutions
for select to anon using (status='active' and visibility='public');
create policy ecclesial_institutions_scoped_read on public.ecclesial_institutions
for select to authenticated using (
  (status='active' and visibility='public')
  or app_private.current_user_can_manage_ecclesial_institution('institutions.view',id)
);

create policy place_affiliations_public_read on public.ecclesiastical_place_affiliations
for select to anon using (
  status='active' and is_current=true and exists(
    select 1 from public.ecclesiastical_places place
    where place.id=place_id and place.status='active' and place.visibility='public'
  )
);
create policy place_affiliations_scoped_read on public.ecclesiastical_place_affiliations
for select to authenticated using (
  (status='active' and is_current=true and exists(
    select 1 from public.ecclesiastical_places place
    where place.id=place_id and place.status='active' and place.visibility='public'
  ))
  or app_private.current_user_can_manage_ecclesiastical_place('places.view',place_id)
);

create policy institution_affiliations_public_read on public.ecclesial_institution_affiliations
for select to anon using (
  status='active' and is_current=true and exists(
    select 1 from public.ecclesial_institutions institution
    where institution.id=institution_id and institution.status='active' and institution.visibility='public'
  )
);
create policy institution_affiliations_scoped_read on public.ecclesial_institution_affiliations
for select to authenticated using (
  (status='active' and is_current=true and exists(
    select 1 from public.ecclesial_institutions institution
    where institution.id=institution_id and institution.status='active' and institution.visibility='public'
  ))
  or app_private.current_user_can_manage_ecclesial_institution('institutions.view',institution_id)
);

create policy communication_channels_public_read on public.communication_channels
for select to anon using (
  status='active' and visibility='public' and (
    owner_entity_id is not null and exists(
      select 1 from public.ecclesiastical_entities entity
      where entity.id=owner_entity_id and entity.status='active' and entity.visibility='public'
    )
    or owner_organization_unit_id is not null and exists(
      select 1 from public.organization_units unit_row
      where unit_row.id=owner_organization_unit_id and unit_row.status='active' and unit_row.visibility='public'
    )
    or owner_place_id is not null and exists(
      select 1 from public.ecclesiastical_places place
      where place.id=owner_place_id and place.status='active' and place.visibility='public'
    )
    or owner_institution_id is not null and exists(
      select 1 from public.ecclesial_institutions institution
      where institution.id=owner_institution_id and institution.status='active' and institution.visibility='public'
    )
  )
);
create policy communication_channels_scoped_read on public.communication_channels
for select to authenticated using (
  (status='active' and visibility='public' and (
    owner_entity_id is not null and exists(
      select 1 from public.ecclesiastical_entities entity
      where entity.id=owner_entity_id and entity.status='active' and entity.visibility='public'
    )
    or owner_organization_unit_id is not null and exists(
      select 1 from public.organization_units unit_row
      where unit_row.id=owner_organization_unit_id and unit_row.status='active' and unit_row.visibility='public'
    )
    or owner_place_id is not null and exists(
      select 1 from public.ecclesiastical_places place
      where place.id=owner_place_id and place.status='active' and place.visibility='public'
    )
    or owner_institution_id is not null and exists(
      select 1 from public.ecclesial_institutions institution
      where institution.id=owner_institution_id and institution.status='active' and institution.visibility='public'
    )
  ))
  or app_private.current_user_can_manage_communication_channel('communications.view',id)
);

grant select on public.ecclesiastical_place_types,public.ecclesial_institution_categories,public.communication_channel_types to anon,authenticated;
grant select on public.ecclesiastical_places,public.ecclesial_institutions,public.ecclesiastical_place_affiliations,public.ecclesial_institution_affiliations,public.communication_channels to anon,authenticated;
revoke insert,update,delete on public.ecclesiastical_place_types,public.ecclesial_institution_categories,public.communication_channel_types from anon,authenticated;
revoke insert,update,delete on public.ecclesiastical_places,public.ecclesial_institutions,public.ecclesiastical_place_affiliations,public.ecclesial_institution_affiliations,public.communication_channels from anon,authenticated;

grant execute on function app_private.current_user_can_manage_ecclesiastical_place(text,uuid) to authenticated;
grant execute on function app_private.current_user_can_manage_ecclesial_institution(text,uuid) to authenticated;
grant execute on function app_private.current_user_can_manage_communication_channel(text,uuid) to authenticated;
revoke all on function app_private.registry_slug(text) from public,anon,authenticated;
revoke all on function app_private.derive_ecclesiastical_place_context() from public,anon,authenticated;
revoke all on function app_private.derive_ecclesial_institution_context() from public,anon,authenticated;
revoke all on function app_private.validate_ecclesiastical_place_affiliation() from public,anon,authenticated;
revoke all on function app_private.validate_ecclesial_institution_affiliation() from public,anon,authenticated;
revoke all on function app_private.derive_communication_channel_context() from public,anon,authenticated;

comment on function app_private.current_user_can_manage_ecclesiastical_place(text,uuid) is 'Autoriza un lugar físico mediante su entidad principal o unidad administradora, respetando país y permiso.';
comment on function app_private.current_user_can_manage_ecclesial_institution(text,uuid) is 'Autoriza una institución mediante su entidad principal o unidad administradora, respetando país y permiso.';
comment on function app_private.current_user_can_manage_communication_channel(text,uuid) is 'Autoriza un canal según el alcance canónico de su propietario.';
