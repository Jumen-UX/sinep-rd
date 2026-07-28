create or replace function app_private.rpc_definer__admin_close_ecclesiastical_place_affiliation(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid := app_private.audit_json_uuid(payload, 'id');
  v_valid_to date := coalesce(nullif(payload->>'valid_to','')::date, current_date);
  v_row public.ecclesiastical_place_affiliations%rowtype;
  v_place public.ecclesiastical_places%rowtype;
  v_old jsonb;
  v_new jsonb;
begin
  if v_actor is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if v_id is null then
    raise exception 'La afiliación es obligatoria.' using errcode = '22023';
  end if;

  select * into v_row
  from public.ecclesiastical_place_affiliations affiliation
  where affiliation.id = v_id
  for update;
  if not found then
    raise exception 'Afiliación no encontrada.' using errcode = 'P0002';
  end if;

  if not app_private.current_user_can_manage_ecclesiastical_place('places.update_proposal', v_row.place_id) then
    raise exception 'La afiliación está fuera de tu alcance.' using errcode = '42501';
  end if;

  select * into v_place
  from public.ecclesiastical_places place
  where place.id = v_row.place_id;

  if v_row.is_current = true
     and v_row.status = 'active'
     and v_row.ecclesiastical_entity_id = v_place.primary_entity_id
     and v_row.relationship_type = (case when v_place.is_primary_seat then 'seat_of' else 'belongs_to' end) then
    raise exception 'La afiliación primaria se modifica desde la ficha del lugar.' using errcode = '23514';
  end if;

  if v_row.valid_from is not null and v_valid_to < v_row.valid_from then
    raise exception 'La fecha final no puede preceder la fecha inicial.' using errcode = '22007';
  end if;

  v_old := to_jsonb(v_row);
  update public.ecclesiastical_place_affiliations affiliation
  set valid_to = v_valid_to,
      is_current = false,
      status = 'inactive',
      notes = case
        when payload ? 'notes' then nullif(btrim(payload->>'notes'),'')
        else affiliation.notes
      end
  where affiliation.id = v_id;

  select to_jsonb(affiliation) into v_new
  from public.ecclesiastical_place_affiliations affiliation
  where affiliation.id = v_id;

  perform public.create_audit_log(
    v_actor,
    'places.affiliation.updated',
    'ecclesiastical_place_affiliations',
    v_id,
    v_old,
    jsonb_build_object(
      'scope_entity_id', v_place.primary_entity_id,
      'country_iso2', v_place.country_iso2,
      'record', v_new,
      'transition', 'closed'
    ),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return jsonb_build_object(
    'affiliation_id', v_id,
    'place_id', v_row.place_id,
    'valid_to', v_valid_to,
    'status', 'inactive'
  );
end;
$$;

create or replace function public.admin_close_ecclesiastical_place_affiliation(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
  select app_private.rpc_definer__admin_close_ecclesiastical_place_affiliation(payload);
$$;

create or replace function app_private.rpc_definer__admin_close_ecclesial_institution_affiliation(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid := app_private.audit_json_uuid(payload, 'id');
  v_valid_to date := coalesce(nullif(payload->>'valid_to','')::date, current_date);
  v_row public.ecclesial_institution_affiliations%rowtype;
  v_institution public.ecclesial_institutions%rowtype;
  v_old jsonb;
  v_new jsonb;
begin
  if v_actor is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if v_id is null then
    raise exception 'La afiliación es obligatoria.' using errcode = '22023';
  end if;

  select * into v_row
  from public.ecclesial_institution_affiliations affiliation
  where affiliation.id = v_id
  for update;
  if not found then
    raise exception 'Afiliación no encontrada.' using errcode = 'P0002';
  end if;

  if not app_private.current_user_can_manage_ecclesial_institution('institutions.update_proposal', v_row.institution_id) then
    raise exception 'La afiliación está fuera de tu alcance.' using errcode = '42501';
  end if;

  select * into v_institution
  from public.ecclesial_institutions institution
  where institution.id = v_row.institution_id;

  if v_row.is_current = true
     and v_row.status = 'active'
     and v_row.relationship_type = 'belongs_to'
     and v_row.ecclesiastical_entity_id = v_institution.primary_entity_id then
    raise exception 'La afiliación primaria se modifica desde la ficha de la institución.' using errcode = '23514';
  end if;

  if v_row.valid_from is not null and v_valid_to < v_row.valid_from then
    raise exception 'La fecha final no puede preceder la fecha inicial.' using errcode = '22007';
  end if;

  v_old := to_jsonb(v_row);
  update public.ecclesial_institution_affiliations affiliation
  set valid_to = v_valid_to,
      is_current = false,
      status = 'inactive',
      notes = case
        when payload ? 'notes' then nullif(btrim(payload->>'notes'),'')
        else affiliation.notes
      end
  where affiliation.id = v_id;

  select to_jsonb(affiliation) into v_new
  from public.ecclesial_institution_affiliations affiliation
  where affiliation.id = v_id;

  perform public.create_audit_log(
    v_actor,
    'institutions.affiliation.updated',
    'ecclesial_institution_affiliations',
    v_id,
    v_old,
    jsonb_build_object(
      'scope_entity_id', v_institution.primary_entity_id,
      'country_iso2', v_institution.country_iso2,
      'record', v_new,
      'transition', 'closed'
    ),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return jsonb_build_object(
    'affiliation_id', v_id,
    'institution_id', v_row.institution_id,
    'valid_to', v_valid_to,
    'status', 'inactive'
  );
end;
$$;

create or replace function public.admin_close_ecclesial_institution_affiliation(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, app_private, auth, pg_temp
as $$
  select app_private.rpc_definer__admin_close_ecclesial_institution_affiliation(payload);
$$;

revoke all on function app_private.rpc_definer__admin_close_ecclesiastical_place_affiliation(jsonb) from public, anon;
grant execute on function app_private.rpc_definer__admin_close_ecclesiastical_place_affiliation(jsonb) to authenticated;
revoke all on function public.admin_close_ecclesiastical_place_affiliation(jsonb) from public, anon;
grant execute on function public.admin_close_ecclesiastical_place_affiliation(jsonb) to authenticated;

revoke all on function app_private.rpc_definer__admin_close_ecclesial_institution_affiliation(jsonb) from public, anon;
grant execute on function app_private.rpc_definer__admin_close_ecclesial_institution_affiliation(jsonb) to authenticated;
revoke all on function public.admin_close_ecclesial_institution_affiliation(jsonb) from public, anon;
grant execute on function public.admin_close_ecclesial_institution_affiliation(jsonb) to authenticated;
