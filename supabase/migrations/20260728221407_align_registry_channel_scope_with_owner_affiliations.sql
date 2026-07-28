create or replace function app_private.registry_channel_in_scope(
  p_channel_id uuid,
  p_scope_type text,
  p_scope_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
declare
  v_channel public.communication_channels%rowtype;
  v_entity_id uuid;
begin
  select * into v_channel
  from public.communication_channels channel
  where channel.id = p_channel_id;

  if not found then
    return false;
  end if;

  if v_channel.owner_entity_id is not null then
    return app_private.registry_entity_in_scope(
      v_channel.owner_entity_id, null, p_scope_type, p_scope_id
    );
  end if;

  if v_channel.owner_organization_unit_id is not null then
    select unit_row.ecclesiastical_entity_id
    into v_entity_id
    from public.organization_units unit_row
    where unit_row.id = v_channel.owner_organization_unit_id;

    return app_private.registry_entity_in_scope(
      v_entity_id, v_channel.owner_organization_unit_id, p_scope_type, p_scope_id
    );
  end if;

  if v_channel.owner_place_id is not null then
    return app_private.registry_place_in_scope(
      v_channel.owner_place_id, p_scope_type, p_scope_id
    );
  end if;

  return app_private.registry_institution_in_scope(
    v_channel.owner_institution_id, p_scope_type, p_scope_id
  );
end;
$$;

revoke all on function app_private.registry_channel_in_scope(uuid, text, uuid)
from public, anon, authenticated;

comment on function app_private.registry_channel_in_scope(uuid, text, uuid)
is 'Un canal de entidad o unidad usa su alcance directo; un canal de lugar o institución hereda las afiliaciones vigentes de su propietario.';
