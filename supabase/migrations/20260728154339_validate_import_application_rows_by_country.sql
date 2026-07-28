create or replace function app_private.assert_import_batch_rows_in_scope(
  p_batch_id uuid,
  p_permission_key text default 'imports.apply'
)
returns void
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'internal', 'auth', 'pg_temp'
as $$
declare
  v_batch public.import_batches%rowtype;
  v_batch_country char(2);
  v_row public.import_batch_rows%rowtype;
  v_row_entity_id uuid;
  v_row_country char(2);
  v_person_id uuid;
  v_required_permission text;
begin
  select * into v_batch
  from public.import_batches batch
  where batch.id = p_batch_id;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  if v_batch.scope_entity_id is null
     or not app_private.current_user_can_manage_entity(p_permission_key, v_batch.scope_entity_id) then
    raise exception 'El lote está fuera de tu alcance de aplicación.' using errcode = '42501';
  end if;

  v_batch_country := app_private.resolve_entity_country_iso2(v_batch.scope_entity_id);
  if v_batch_country is null then
    raise exception 'No se pudo resolver el país del lote.' using errcode = '22023';
  end if;

  for v_row in
    select *
    from public.import_batch_rows row_data
    where row_data.batch_id = p_batch_id
    order by row_data.row_number
  loop
    if v_row.target_operation not in ('create','update','noop') then
      raise exception 'La fila % no tiene una operación de aplicación válida.', v_row.row_number using errcode = '22023';
    end if;

    v_row_entity_id := null;
    v_row_country := null;
    v_person_id := null;
    v_required_permission := p_permission_key;

    if v_batch.import_type = 'personas' then
      if v_row.target_operation = 'create' then
        if coalesce(v_row.target_table, '') <> 'persons' then
          raise exception 'La fila % de personas apunta a una tabla inválida.', v_row.row_number using errcode = '22023';
        end if;
        v_row_entity_id := coalesce(
          app_private.audit_json_uuid(v_row.resolved_relations, 'entidad_actual'),
          v_batch.scope_entity_id
        );
        v_required_permission := 'people.create_proposal';
      elsif v_row.target_operation = 'noop' then
        if v_row.target_table <> 'persons' or v_row.target_record_id is null then
          raise exception 'La fila % no enlaza una persona válida para noop.', v_row.row_number using errcode = '22023';
        end if;
        if not exists (
          select 1
          from app_private.person_scope_entities(v_row.target_record_id) person_scope
          where app_private.resolve_entity_country_iso2(person_scope.entity_id) = v_batch_country
            and app_private.current_user_can_manage_entity(p_permission_key, person_scope.entity_id)
        ) then
          raise exception 'La persona enlazada en la fila % está fuera del país del lote.', v_row.row_number using errcode = '42501';
        end if;
        continue;
      else
        raise exception 'Las actualizaciones directas de personas no están soportadas en la fila %.', v_row.row_number using errcode = '0A000';
      end if;

    elsif v_batch.import_type = 'parroquias' then
      if v_row.target_operation = 'create' then
        if coalesce(v_row.target_table, '') <> 'ecclesiastical_entities' then
          raise exception 'La fila % de estructuras apunta a una tabla inválida.', v_row.row_number using errcode = '22023';
        end if;
        v_row_entity_id := coalesce(
          app_private.audit_json_uuid(v_row.resolved_relations, 'parent_entity_id'),
          app_private.audit_json_uuid(v_row.resolved_relations, 'diocese_id'),
          app_private.audit_json_uuid(v_row.resolved_relations, 'diocesis'),
          app_private.audit_json_uuid(v_row.resolved_relations, 'nivel_padre')
        );
        if upper(coalesce(v_row.normalized_data->>'pais_iso2','')) <> v_batch_country::text then
          raise exception 'La fila % declara un país distinto al lote.', v_row.row_number using errcode = '42501';
        end if;
        v_required_permission := 'structures.manage';
      elsif v_row.target_operation = 'noop' then
        if v_row.target_table <> 'ecclesiastical_entities' or v_row.target_record_id is null then
          raise exception 'La fila % no enlaza una entidad válida para noop.', v_row.row_number using errcode = '22023';
        end if;
        v_row_entity_id := v_row.target_record_id;
      else
        raise exception 'Las actualizaciones estructurales directas no están soportadas en la fila %.', v_row.row_number using errcode = '0A000';
      end if;

    elsif v_batch.import_type = 'asignaciones' then
      if v_row.target_operation = 'create' then
        if coalesce(v_row.target_table, '') <> 'position_assignments' then
          raise exception 'La fila % de nombramientos apunta a una tabla inválida.', v_row.row_number using errcode = '22023';
        end if;
        v_row_entity_id := app_private.audit_json_uuid(v_row.resolved_relations, 'entidad');
        v_person_id := app_private.audit_json_uuid(v_row.resolved_relations, 'persona');
        if v_person_id is null
           or not app_private.current_user_can_manage_person('appointments.create_proposal', v_person_id)
           or not exists (
             select 1
             from app_private.person_scope_entities(v_person_id) person_scope
             where app_private.resolve_entity_country_iso2(person_scope.entity_id) = v_batch_country
           ) then
          raise exception 'La persona de la fila % está fuera del país del lote.', v_row.row_number using errcode = '42501';
        end if;
        v_required_permission := 'appointments.create_proposal';
      elsif v_row.target_operation = 'noop' then
        if v_row.target_table <> 'position_assignments' or v_row.target_record_id is null then
          raise exception 'La fila % no enlaza un nombramiento válido para noop.', v_row.row_number using errcode = '22023';
        end if;
        v_row_entity_id := app_private.review_record_scope_entity('position_assignments', v_row.target_record_id);
      else
        raise exception 'Las actualizaciones directas de nombramientos no están soportadas en la fila %.', v_row.row_number using errcode = '0A000';
      end if;

    elsif v_batch.import_type = 'eventos' then
      if v_row.target_operation = 'create' then
        if coalesce(v_row.target_table, '') <> 'canonical_events' then
          raise exception 'La fila % de eventos apunta a una tabla inválida.', v_row.row_number using errcode = '22023';
        end if;
        v_row_entity_id := app_private.audit_json_uuid(v_row.resolved_relations, 'entidad');
        v_required_permission := 'events.create_proposal';
      elsif v_row.target_operation in ('update','noop') then
        if v_row.target_table <> 'canonical_events' or v_row.target_record_id is null then
          raise exception 'La fila % no enlaza un evento canónico válido.', v_row.row_number using errcode = '22023';
        end if;
        v_row_entity_id := app_private.canonical_event_scope_entity_id(v_row.target_record_id);
        v_required_permission := case
          when v_row.target_operation = 'update' then 'events.approve'
          else 'events.view'
        end;
      end if;
    else
      raise exception 'El dominio de importación % no está soportado.', v_batch.import_type using errcode = '0A000';
    end if;

    if v_row_entity_id is null then
      raise exception 'No se pudo resolver la entidad de la fila %.', v_row.row_number using errcode = '42501';
    end if;

    v_row_country := app_private.resolve_entity_country_iso2(v_row_entity_id);
    if v_row_country is distinct from v_batch_country
       or not app_private.current_user_can_manage_entity(p_permission_key, v_row_entity_id)
       or not app_private.current_user_can_manage_entity(v_required_permission, v_row_entity_id) then
      raise exception 'La fila % está fuera del país o alcance del lote.', v_row.row_number using errcode = '42501';
    end if;
  end loop;
end;
$$;

create or replace function app_private.rpc_definer__admin_apply_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'internal', 'auth', 'pg_temp'
as $$
declare
  v_batch_id uuid := app_private.audit_json_uuid(payload, 'batch_id');
  v_scope_entity_id uuid;
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('imports.apply') then
    raise exception 'No autorizado para aplicar importaciones.' using errcode = '42501';
  end if;

  select batch.scope_entity_id
  into v_scope_entity_id
  from public.import_batches batch
  where batch.id = v_batch_id;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_manage_entity('imports.apply', v_scope_entity_id) then
    raise exception 'El lote está fuera de tu alcance de aplicación.' using errcode = '42501';
  end if;

  perform app_private.assert_import_batch_rows_in_scope(v_batch_id, 'imports.apply');
  return app_private.admin_apply_import_batch(payload);
end;
$$;

revoke all on function app_private.assert_import_batch_rows_in_scope(uuid, text) from public, anon, authenticated;
revoke all on function app_private.rpc_definer__admin_apply_import_batch(jsonb) from public, anon;
grant execute on function app_private.rpc_definer__admin_apply_import_batch(jsonb) to authenticated;