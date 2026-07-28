create or replace function app_private.rpc_definer__admin_save_ecclesiastical_place_affiliation(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid := app_private.audit_json_uuid(payload,'id');
  v_place_id uuid := app_private.audit_json_uuid(payload,'place_id');
  v_entity_id uuid := app_private.audit_json_uuid(payload,'ecclesiastical_entity_id');
  v_unit_id uuid := app_private.audit_json_uuid(payload,'organization_unit_id');
  v_institution_id uuid := app_private.audit_json_uuid(payload,'institution_id');
  v_source_document_id uuid := app_private.audit_json_uuid(payload,'source_document_id');
  v_relationship_type text := nullif(btrim(payload->>'relationship_type'),'');
  v_old jsonb;
  v_new jsonb;
  v_scope_entity_id uuid;
  v_country char(2);
begin
  if v_actor is null then raise exception 'No autenticado' using errcode='42501'; end if;
  if v_place_id is null then raise exception 'El lugar es obligatorio.' using errcode='22023'; end if;
  if v_relationship_type is null then raise exception 'El tipo de afiliación es obligatorio.' using errcode='22023'; end if;
  if num_nonnulls(v_entity_id,v_unit_id,v_institution_id)<>1 then
    raise exception 'La afiliación debe indicar exactamente un destino.' using errcode='22023';
  end if;
  if not app_private.current_user_can_manage_ecclesiastical_place('places.update_proposal',v_place_id) then
    raise exception 'El lugar está fuera de tu alcance.' using errcode='42501';
  end if;
  if v_entity_id is not null and not app_private.current_user_can_manage_entity('places.update_proposal',v_entity_id) then
    raise exception 'La entidad afiliada está fuera de tu alcance.' using errcode='42501';
  end if;
  if v_unit_id is not null and not app_private.current_user_can_manage_organization_unit('places.update_proposal',v_unit_id) then
    raise exception 'La unidad afiliada está fuera de tu alcance.' using errcode='42501';
  end if;
  if v_institution_id is not null and not app_private.current_user_can_manage_ecclesial_institution('institutions.update_proposal',v_institution_id) then
    raise exception 'La institución afiliada está fuera de tu alcance.' using errcode='42501';
  end if;

  if v_id is not null then
    select to_jsonb(affiliation) into v_old
    from public.ecclesiastical_place_affiliations affiliation where affiliation.id=v_id;
    if v_old is null then raise exception 'Afiliación no encontrada.' using errcode='P0002'; end if;
    update public.ecclesiastical_place_affiliations affiliation set
      place_id=v_place_id,
      relationship_type=v_relationship_type,
      ecclesiastical_entity_id=v_entity_id,
      organization_unit_id=v_unit_id,
      institution_id=v_institution_id,
      valid_from=case when payload ? 'valid_from' then nullif(payload->>'valid_from','')::date else affiliation.valid_from end,
      valid_to=case when payload ? 'valid_to' then nullif(payload->>'valid_to','')::date else affiliation.valid_to end,
      is_current=coalesce((payload->>'is_current')::boolean,affiliation.is_current),
      status=coalesce(nullif(payload->>'status',''),affiliation.status),
      source_document_id=case when payload ? 'source_document_id' then v_source_document_id else affiliation.source_document_id end,
      notes=case when payload ? 'notes' then nullif(btrim(payload->>'notes'),'') else affiliation.notes end
    where affiliation.id=v_id;
  else
    insert into public.ecclesiastical_place_affiliations(
      place_id,relationship_type,ecclesiastical_entity_id,organization_unit_id,institution_id,
      valid_from,valid_to,is_current,status,source_document_id,notes,created_by
    ) values (
      v_place_id,v_relationship_type,v_entity_id,v_unit_id,v_institution_id,
      nullif(payload->>'valid_from','')::date,nullif(payload->>'valid_to','')::date,
      coalesce((payload->>'is_current')::boolean,true),coalesce(nullif(payload->>'status',''),'active'),
      v_source_document_id,nullif(btrim(payload->>'notes'),''),v_actor
    ) returning id into v_id;
  end if;

  select place.primary_entity_id,place.country_iso2 into v_scope_entity_id,v_country
  from public.ecclesiastical_places place where place.id=v_place_id;
  select to_jsonb(affiliation) into v_new
  from public.ecclesiastical_place_affiliations affiliation where affiliation.id=v_id;
  perform public.create_audit_log(
    v_actor,
    case when v_old is null then 'places.affiliation.created' else 'places.affiliation.updated' end,
    'ecclesiastical_place_affiliations',v_id,v_old,
    jsonb_build_object('scope_entity_id',v_scope_entity_id,'country_iso2',v_country,'record',v_new),
    app_private.audit_json_uuid(payload,'change_request_id')
  );
  return jsonb_build_object('affiliation_id',v_id,'place_id',v_place_id,'country_iso2',v_country);
end;
$$;

create or replace function app_private.rpc_definer__admin_save_ecclesial_institution_affiliation(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid := app_private.audit_json_uuid(payload,'id');
  v_institution_id uuid := app_private.audit_json_uuid(payload,'institution_id');
  v_entity_id uuid := app_private.audit_json_uuid(payload,'ecclesiastical_entity_id');
  v_unit_id uuid := app_private.audit_json_uuid(payload,'organization_unit_id');
  v_parent_institution_id uuid := app_private.audit_json_uuid(payload,'parent_institution_id');
  v_source_document_id uuid := app_private.audit_json_uuid(payload,'source_document_id');
  v_relationship_type text := nullif(btrim(payload->>'relationship_type'),'');
  v_old jsonb;
  v_new jsonb;
  v_scope_entity_id uuid;
  v_country char(2);
begin
  if v_actor is null then raise exception 'No autenticado' using errcode='42501'; end if;
  if v_institution_id is null then raise exception 'La institución es obligatoria.' using errcode='22023'; end if;
  if v_relationship_type is null then raise exception 'El tipo de afiliación es obligatorio.' using errcode='22023'; end if;
  if num_nonnulls(v_entity_id,v_unit_id,v_parent_institution_id)<>1 then
    raise exception 'La afiliación debe indicar exactamente un destino.' using errcode='22023';
  end if;
  if not app_private.current_user_can_manage_ecclesial_institution('institutions.update_proposal',v_institution_id) then
    raise exception 'La institución está fuera de tu alcance.' using errcode='42501';
  end if;
  if v_entity_id is not null and not app_private.current_user_can_manage_entity('institutions.update_proposal',v_entity_id) then
    raise exception 'La entidad afiliada está fuera de tu alcance.' using errcode='42501';
  end if;
  if v_unit_id is not null and not app_private.current_user_can_manage_organization_unit('institutions.update_proposal',v_unit_id) then
    raise exception 'La unidad afiliada está fuera de tu alcance.' using errcode='42501';
  end if;
  if v_parent_institution_id is not null
     and not app_private.current_user_can_manage_ecclesial_institution('institutions.update_proposal',v_parent_institution_id) then
    raise exception 'La institución superior está fuera de tu alcance.' using errcode='42501';
  end if;

  if v_id is not null then
    select to_jsonb(affiliation) into v_old
    from public.ecclesial_institution_affiliations affiliation where affiliation.id=v_id;
    if v_old is null then raise exception 'Afiliación no encontrada.' using errcode='P0002'; end if;
    update public.ecclesial_institution_affiliations affiliation set
      institution_id=v_institution_id,
      relationship_type=v_relationship_type,
      ecclesiastical_entity_id=v_entity_id,
      organization_unit_id=v_unit_id,
      parent_institution_id=v_parent_institution_id,
      valid_from=case when payload ? 'valid_from' then nullif(payload->>'valid_from','')::date else affiliation.valid_from end,
      valid_to=case when payload ? 'valid_to' then nullif(payload->>'valid_to','')::date else affiliation.valid_to end,
      is_current=coalesce((payload->>'is_current')::boolean,affiliation.is_current),
      status=coalesce(nullif(payload->>'status',''),affiliation.status),
      source_document_id=case when payload ? 'source_document_id' then v_source_document_id else affiliation.source_document_id end,
      notes=case when payload ? 'notes' then nullif(btrim(payload->>'notes'),'') else affiliation.notes end
    where affiliation.id=v_id;
  else
    insert into public.ecclesial_institution_affiliations(
      institution_id,relationship_type,ecclesiastical_entity_id,organization_unit_id,parent_institution_id,
      valid_from,valid_to,is_current,status,source_document_id,notes,created_by
    ) values (
      v_institution_id,v_relationship_type,v_entity_id,v_unit_id,v_parent_institution_id,
      nullif(payload->>'valid_from','')::date,nullif(payload->>'valid_to','')::date,
      coalesce((payload->>'is_current')::boolean,true),coalesce(nullif(payload->>'status',''),'active'),
      v_source_document_id,nullif(btrim(payload->>'notes'),''),v_actor
    ) returning id into v_id;
  end if;

  select institution.primary_entity_id,institution.country_iso2 into v_scope_entity_id,v_country
  from public.ecclesial_institutions institution where institution.id=v_institution_id;
  select to_jsonb(affiliation) into v_new
  from public.ecclesial_institution_affiliations affiliation where affiliation.id=v_id;
  perform public.create_audit_log(
    v_actor,
    case when v_old is null then 'institutions.affiliation.created' else 'institutions.affiliation.updated' end,
    'ecclesial_institution_affiliations',v_id,v_old,
    jsonb_build_object('scope_entity_id',v_scope_entity_id,'country_iso2',v_country,'record',v_new),
    app_private.audit_json_uuid(payload,'change_request_id')
  );
  return jsonb_build_object('affiliation_id',v_id,'institution_id',v_institution_id,'country_iso2',v_country);
end;
$$;

create or replace function public.admin_save_ecclesiastical_place_affiliation(payload jsonb)
returns jsonb
language sql
security invoker
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$ select app_private.rpc_definer__admin_save_ecclesiastical_place_affiliation(payload); $$;

create or replace function public.admin_save_ecclesial_institution_affiliation(payload jsonb)
returns jsonb
language sql
security invoker
set search_path='pg_catalog','public','app_private','auth','pg_temp'
as $$ select app_private.rpc_definer__admin_save_ecclesial_institution_affiliation(payload); $$;

grant execute on function app_private.rpc_definer__admin_save_ecclesiastical_place_affiliation(jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_save_ecclesial_institution_affiliation(jsonb) to authenticated;
grant execute on function public.admin_save_ecclesiastical_place_affiliation(jsonb) to authenticated;
grant execute on function public.admin_save_ecclesial_institution_affiliation(jsonb) to authenticated;
revoke all on function public.admin_save_ecclesiastical_place_affiliation(jsonb) from public,anon;
revoke all on function public.admin_save_ecclesial_institution_affiliation(jsonb) from public,anon;

comment on function public.admin_save_ecclesiastical_place_affiliation(jsonb) is 'Registra relaciones vigentes o históricas de un lugar con entidades, unidades o instituciones del mismo país.';
comment on function public.admin_save_ecclesial_institution_affiliation(jsonb) is 'Registra propiedad, administración, patrocinio o adscripción de una institución dentro del mismo país.';
