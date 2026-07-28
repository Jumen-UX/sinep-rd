create or replace function app_private.rpc_definer__admin_prepare_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_scope_entity_id uuid := app_private.audit_json_uuid(payload, 'scope_entity_id');
  v_payload jsonb := coalesce(payload, '{}'::jsonb);
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('imports.prepare') then
    raise exception 'No autorizado para preparar importaciones.' using errcode = '42501';
  end if;

  if v_scope_entity_id is null then
    v_scope_entity_id := app_private.current_user_root_jurisdiction_id();
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_manage_entity('imports.prepare', v_scope_entity_id) then
    raise exception 'Debes preparar el lote dentro de una entidad de tu alcance.' using errcode = '42501';
  end if;

  v_payload := jsonb_set(v_payload, '{scope_entity_id}', to_jsonb(v_scope_entity_id::text), true);
  return app_private.admin_prepare_import_batch(v_payload);
end;
$$;

create or replace function app_private.rpc_definer__admin_validate_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_scope_entity_id uuid;
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('imports.prepare') then
    raise exception 'No autorizado para validar importaciones.' using errcode = '42501';
  end if;

  select batch.scope_entity_id
  into v_scope_entity_id
  from public.import_batches batch
  where batch.id = p_batch_id;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_manage_entity('imports.prepare', v_scope_entity_id) then
    raise exception 'El lote está fuera de tu alcance de validación.' using errcode = '42501';
  end if;

  return app_private.validate_import_batch_with_contract(p_batch_id);
end;
$$;

create or replace function app_private.rpc_definer__admin_review_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_batch_id uuid := app_private.audit_json_uuid(payload, 'batch_id');
  v_scope_entity_id uuid;
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('imports.review') then
    raise exception 'No autorizado para revisar importaciones.' using errcode = '42501';
  end if;

  select batch.scope_entity_id
  into v_scope_entity_id
  from public.import_batches batch
  where batch.id = v_batch_id;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_manage_entity('imports.review', v_scope_entity_id) then
    raise exception 'El lote está fuera de tu alcance de revisión.' using errcode = '42501';
  end if;

  return app_private.admin_review_import_batch(payload);
end;
$$;

create or replace function app_private.rpc_definer__admin_update_import_batch_row(
  p_row_id uuid,
  p_normalized_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_scope_entity_id uuid;
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('imports.prepare') then
    raise exception 'No autorizado para corregir importaciones.' using errcode = '42501';
  end if;

  select batch.scope_entity_id
  into v_scope_entity_id
  from public.import_batch_rows row_data
  join public.import_batches batch on batch.id = row_data.batch_id
  where row_data.id = p_row_id;

  if not found then
    raise exception 'La fila de importación no existe.' using errcode = 'P0002';
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_manage_entity('imports.prepare', v_scope_entity_id) then
    raise exception 'La fila está fuera de tu alcance administrativo.' using errcode = '42501';
  end if;

  return app_private.admin_update_import_batch_row(p_row_id, p_normalized_data);
end;
$$;

create or replace function app_private.rpc_definer__admin_reverse_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'internal', 'auth', 'pg_temp'
as $$
declare
  v_batch_id uuid := app_private.audit_json_uuid(payload, 'batch_id');
  v_scope_entity_id uuid;
  v_has_event_changes boolean;
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('imports.apply') then
    raise exception 'No autorizado para revertir importaciones.' using errcode = '42501';
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
    raise exception 'El lote está fuera de tu alcance de reversión.' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.import_batch_changes change_row
    where change_row.batch_id = v_batch_id
      and change_row.target_table = 'canonical_events'
  ) into v_has_event_changes;

  if v_has_event_changes
     and not app_private.current_user_can_manage_entity('events.approve', v_scope_entity_id) then
    raise exception 'La reversión de eventos requiere events.approve dentro del país del lote.' using errcode = '42501';
  end if;

  return app_private.admin_reverse_import_batch(payload);
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

  return app_private.admin_apply_import_batch(payload);
end;
$$;

create or replace function app_private.rpc_definer__admin_count_missing_clergy_profiles()
returns bigint
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
  select internal.admin_count_missing_clergy_profiles()
$$;

create or replace function app_private.rpc_definer__admin_list_orphan_person_photos(
  p_older_than interval default interval '1 hour',
  p_limit integer default 100
)
returns table(photo_path text, created_at timestamptz, owner_id uuid, size_bytes bigint)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'storage', 'app_private', 'auth', 'pg_temp'
as $$
  select *
  from app_private.admin_list_orphan_person_photos(p_older_than, p_limit)
$$;

create or replace function public.admin_prepare_import_batch(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.rpc_definer__admin_prepare_import_batch(payload)
$$;

create or replace function public.admin_validate_import_batch(p_batch_id uuid)
returns jsonb
language sql
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.rpc_definer__admin_validate_import_batch(p_batch_id)
$$;

create or replace function public.admin_review_import_batch(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.rpc_definer__admin_review_import_batch(payload)
$$;

create or replace function public.admin_update_import_batch_row(
  p_row_id uuid,
  p_normalized_data jsonb
)
returns jsonb
language sql
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.rpc_definer__admin_update_import_batch_row(p_row_id, p_normalized_data)
$$;

create or replace function public.admin_reverse_import_batch(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'internal', 'auth', 'pg_temp'
as $$
  select app_private.rpc_definer__admin_reverse_import_batch(payload)
$$;

create or replace function public.admin_apply_import_batch(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'internal', 'auth', 'pg_temp'
as $$
  select app_private.rpc_definer__admin_apply_import_batch(payload)
$$;

create or replace function public.admin_count_missing_clergy_profiles()
returns bigint
language sql
stable
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.rpc_definer__admin_count_missing_clergy_profiles()
$$;

create or replace function public.admin_list_orphan_person_photos(
  p_older_than interval default interval '1 hour',
  p_limit integer default 100
)
returns table(photo_path text, created_at timestamptz, owner_id uuid, size_bytes bigint)
language sql
stable
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select *
  from app_private.rpc_definer__admin_list_orphan_person_photos(p_older_than, p_limit)
$$;

revoke all on function app_private.admin_prepare_import_batch(jsonb) from public, anon, authenticated;
revoke all on function app_private.validate_import_batch(uuid) from public, anon, authenticated;
revoke all on function app_private.validate_import_batch_with_contract(uuid) from public, anon, authenticated;
revoke all on function app_private.admin_review_import_batch(jsonb) from public, anon, authenticated;
revoke all on function app_private.admin_update_import_batch_row(uuid, jsonb) from public, anon, authenticated;
revoke all on function app_private.admin_reverse_import_batch(jsonb) from public, anon, authenticated;
revoke all on function app_private.admin_apply_import_batch(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_count_missing_clergy_profiles() from public, anon, authenticated;
revoke all on function app_private.admin_list_orphan_person_photos(interval, integer) from public, anon, authenticated;

revoke all on function app_private.rpc_definer__admin_prepare_import_batch(jsonb) from public, anon;
revoke all on function app_private.rpc_definer__admin_validate_import_batch(uuid) from public, anon;
revoke all on function app_private.rpc_definer__admin_review_import_batch(jsonb) from public, anon;
revoke all on function app_private.rpc_definer__admin_update_import_batch_row(uuid, jsonb) from public, anon;
revoke all on function app_private.rpc_definer__admin_reverse_import_batch(jsonb) from public, anon;
revoke all on function app_private.rpc_definer__admin_apply_import_batch(jsonb) from public, anon;
revoke all on function app_private.rpc_definer__admin_count_missing_clergy_profiles() from public, anon;
revoke all on function app_private.rpc_definer__admin_list_orphan_person_photos(interval, integer) from public, anon;

grant execute on function app_private.rpc_definer__admin_prepare_import_batch(jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_validate_import_batch(uuid) to authenticated;
grant execute on function app_private.rpc_definer__admin_review_import_batch(jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_update_import_batch_row(uuid, jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_reverse_import_batch(jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_apply_import_batch(jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_count_missing_clergy_profiles() to authenticated;
grant execute on function app_private.rpc_definer__admin_list_orphan_person_photos(interval, integer) to authenticated;

revoke all on function public.admin_prepare_import_batch(jsonb) from public, anon;
revoke all on function public.admin_validate_import_batch(uuid) from public, anon;
revoke all on function public.admin_review_import_batch(jsonb) from public, anon;
revoke all on function public.admin_update_import_batch_row(uuid, jsonb) from public, anon;
revoke all on function public.admin_reverse_import_batch(jsonb) from public, anon;
revoke all on function public.admin_apply_import_batch(jsonb) from public, anon;
revoke all on function public.admin_count_missing_clergy_profiles() from public, anon;
revoke all on function public.admin_list_orphan_person_photos(interval, integer) from public, anon;

grant execute on function public.admin_prepare_import_batch(jsonb) to authenticated;
grant execute on function public.admin_validate_import_batch(uuid) to authenticated;
grant execute on function public.admin_review_import_batch(jsonb) to authenticated;
grant execute on function public.admin_update_import_batch_row(uuid, jsonb) to authenticated;
grant execute on function public.admin_reverse_import_batch(jsonb) to authenticated;
grant execute on function public.admin_apply_import_batch(jsonb) to authenticated;
grant execute on function public.admin_count_missing_clergy_profiles() to authenticated;
grant execute on function public.admin_list_orphan_person_photos(interval, integer) to authenticated;