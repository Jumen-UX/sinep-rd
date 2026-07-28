begin;

alter function app_private.admin_apply_person_import_batch(jsonb)
  rename to admin_apply_person_import_batch_unscoped;
alter function app_private.admin_apply_assignment_import_batch(jsonb)
  rename to admin_apply_assignment_import_batch_unscoped;

revoke all on function app_private.admin_apply_person_import_batch_unscoped(jsonb)
from public, anon, authenticated;
revoke all on function app_private.admin_apply_assignment_import_batch_unscoped(jsonb)
from public, anon, authenticated;

create or replace function app_private.admin_apply_person_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, internal, auth, pg_temp
as $$
declare
  v_batch_id uuid := app_private.audit_json_uuid(payload, 'batch_id');
  v_batch public.import_batches%rowtype;
  v_batch_country char(2);
  v_row record;
  v_row_entity_id uuid;
  v_row_country char(2);
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('imports.apply') then
    raise exception 'No autorizado para aplicar importaciones.' using errcode = '42501';
  end if;

  select * into v_batch
  from public.import_batches batch_row
  where batch_row.id = v_batch_id;

  if not found or v_batch.import_type <> 'personas' then
    raise exception 'El lote de personas no existe.' using errcode = 'P0002';
  end if;

  if v_batch.scope_entity_id is null
     or not app_private.current_user_can_manage_entity('imports.apply', v_batch.scope_entity_id) then
    raise exception 'El lote está fuera de tu alcance de aplicación.' using errcode = '42501';
  end if;

  v_batch_country := app_private.resolve_entity_country_iso2(v_batch.scope_entity_id);
  if v_batch_country is null then
    raise exception 'No se pudo resolver el país del lote.' using errcode = '22023';
  end if;

  for v_row in
    select row_data.id, row_data.row_number, row_data.resolved_relations
    from public.import_batch_rows row_data
    where row_data.batch_id = v_batch.id
  loop
    v_row_entity_id := coalesce(
      app_private.audit_json_uuid(v_row.resolved_relations, 'entidad_actual'),
      v_batch.scope_entity_id
    );
    v_row_country := app_private.resolve_entity_country_iso2(v_row_entity_id);

    if v_row_entity_id is null
       or v_row_country is distinct from v_batch_country
       or not app_private.current_user_can_manage_entity('imports.apply', v_row_entity_id)
       or not app_private.current_user_can_manage_entity('people.create_proposal', v_row_entity_id) then
      raise exception 'La fila % está fuera del país o alcance del lote.', v_row.row_number using errcode = '42501';
    end if;
  end loop;

  return app_private.admin_apply_person_import_batch_unscoped(payload);
end;
$$;

create or replace function app_private.admin_apply_assignment_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, internal, auth, pg_temp
as $$
declare
  v_batch_id uuid := app_private.audit_json_uuid(payload, 'batch_id');
  v_batch public.import_batches%rowtype;
  v_batch_country char(2);
  v_row record;
  v_row_entity_id uuid;
  v_row_person_id uuid;
  v_row_country char(2);
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('imports.apply') then
    raise exception 'No autorizado para aplicar importaciones.' using errcode = '42501';
  end if;

  select * into v_batch
  from public.import_batches batch_row
  where batch_row.id = v_batch_id;

  if not found or v_batch.import_type <> 'asignaciones' then
    raise exception 'El lote de nombramientos no existe.' using errcode = 'P0002';
  end if;

  if v_batch.scope_entity_id is null
     or not app_private.current_user_can_manage_entity('imports.apply', v_batch.scope_entity_id) then
    raise exception 'El lote está fuera de tu alcance de aplicación.' using errcode = '42501';
  end if;

  v_batch_country := app_private.resolve_entity_country_iso2(v_batch.scope_entity_id);
  if v_batch_country is null then
    raise exception 'No se pudo resolver el país del lote.' using errcode = '22023';
  end if;

  for v_row in
    select row_data.id, row_data.row_number, row_data.resolved_relations
    from public.import_batch_rows row_data
    where row_data.batch_id = v_batch.id
  loop
    v_row_entity_id := app_private.audit_json_uuid(v_row.resolved_relations, 'entidad');
    v_row_person_id := app_private.audit_json_uuid(v_row.resolved_relations, 'persona');
    v_row_country := app_private.resolve_entity_country_iso2(v_row_entity_id);

    if v_row_entity_id is null
       or v_row_person_id is null
       or v_row_country is distinct from v_batch_country
       or not app_private.current_user_can_manage_entity('imports.apply', v_row_entity_id)
       or not app_private.current_user_can_manage_entity('appointments.create_proposal', v_row_entity_id)
       or not app_private.current_user_can_manage_person('appointments.create_proposal', v_row_person_id) then
      raise exception 'La fila % está fuera del país o alcance del lote.', v_row.row_number using errcode = '42501';
    end if;
  end loop;

  return app_private.admin_apply_assignment_import_batch_unscoped(payload);
end;
$$;

revoke all on function app_private.admin_apply_person_import_batch(jsonb)
from public, anon, authenticated;
revoke all on function app_private.admin_apply_assignment_import_batch(jsonb)
from public, anon, authenticated;

create or replace function app_private.rpc_definer__resolve_assignment_canonical_incompatibility(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_assignment_id uuid := app_private.audit_json_uuid(payload, 'assignment_id');
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  if v_assignment_id is null then
    raise exception 'Falta seleccionar el nombramiento.' using errcode = '22023';
  end if;

  v_entity_id := app_private.review_record_scope_entity('position_assignments', v_assignment_id);

  if v_entity_id is null
     or not app_private.current_user_can_manage_entity('appointments.approve', v_entity_id) then
    raise exception 'El nombramiento está fuera de tu alcance' using errcode = '42501';
  end if;

  select to_jsonb(assignment_row) into v_old
  from public.position_assignments assignment_row
  where assignment_row.id = v_assignment_id;

  v_result := internal.resolve_assignment_canonical_incompatibility(payload);

  select to_jsonb(assignment_row) into v_new
  from public.position_assignments assignment_row
  where assignment_row.id = v_assignment_id;

  perform public.create_audit_log(
    auth.uid(),
    'appointments.canonical_incompatibility.resolved',
    'position_assignments',
    v_assignment_id,
    v_old,
    jsonb_build_object('scope_entity_id', v_entity_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function internal.admin_count_missing_clergy_profiles()
returns bigint
language sql
stable
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
  select count(distinct ordination.person_id)
  from public.ordination_events ordination
  join public.persons person_row
    on person_row.id = ordination.person_id
   and person_row.status = 'active'
  left join public.clergy_profiles profile
    on profile.person_id = ordination.person_id
  where ordination.record_status = 'active'
    and ordination.degree in ('diaconate', 'presbyterate', 'episcopate')
    and profile.person_id is null
    and auth.uid() is not null
    and app_private.current_user_can_manage_person('people.view_private', ordination.person_id);
$$;

create or replace function app_private.admin_list_orphan_person_photos(
  p_older_than interval default interval '1 hour',
  p_limit integer default 100
)
returns table(photo_path text, created_at timestamptz, owner_id uuid, size_bytes bigint)
language plpgsql
stable
security definer
set search_path = public, storage, app_private, auth, pg_temp
as $$
begin
  if auth.uid() is null
     or not app_private.current_user_has_role(array['super_admin'])
     or not app_private.current_user_has_permission('people.update_proposal') then
    raise exception 'Solo un superadministrador puede revisar fotografías huérfanas.' using errcode = '42501';
  end if;

  return query
  select
    object_row.name as photo_path,
    object_row.created_at,
    object_row.owner_id,
    case
      when coalesce(object_row.metadata->>'size', '') ~ '^[0-9]+$'
      then (object_row.metadata->>'size')::bigint
      else null
    end as size_bytes
  from storage.objects object_row
  where object_row.bucket_id = 'person-photos'
    and object_row.created_at <= now() - greatest(coalesce(p_older_than, interval '1 hour'), interval '5 minutes')
    and not exists (
      select 1
      from public.persons person_row
      where person_row.photo_path = object_row.name
    )
  order by object_row.created_at
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke all on function internal.admin_count_missing_clergy_profiles() from public, anon, authenticated;
revoke all on function app_private.admin_list_orphan_person_photos(interval, integer) from public, anon, authenticated;

comment on function app_private.admin_apply_person_import_batch(jsonb) is
  'Country-scoped facade. Validates batch and every resolved entity before delegating to the sealed person import engine.';
comment on function app_private.admin_apply_assignment_import_batch(jsonb) is
  'Country-scoped facade. Validates batch, row entity and person before delegating to the sealed assignment import engine.';
comment on function app_private.admin_list_orphan_person_photos(interval, integer) is
  'Orphan photos have no canonical country owner and are therefore restricted to super_admin.';

commit;
