begin;

alter function app_private.admin_review_queue(jsonb)
  rename to admin_review_queue_core;

create or replace function app_private.admin_review_queue(payload jsonb default '{}'::jsonb)
returns table(
  item_key text,
  item_type text,
  record_table text,
  record_id uuid,
  source_id text,
  title text,
  detail text,
  verification_status text,
  issue_count integer,
  created_at timestamptz,
  allowed_actions text[]
)
language plpgsql
stable
security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
declare
  v_limit integer := greatest(1, least(coalesce((payload->>'limit')::integer, 200), 500));
  v_can_read_legacy boolean;
  v_can_read_imports boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado para consultar la cola de revisión.' using errcode='42501';
  end if;

  v_can_read_legacy := public.current_user_has_permission('appointments.view')
    or public.current_user_has_permission('people.view')
    or public.current_user_has_permission('entities.view')
    or public.current_user_has_permission('change_requests.view')
    or public.current_user_is_super_or_national();

  v_can_read_imports := public.current_user_has_permission('imports.prepare')
    or public.current_user_has_permission('imports.review')
    or public.current_user_has_permission('imports.apply')
    or public.current_user_is_super_or_national();

  if not v_can_read_legacy and not v_can_read_imports then
    raise exception 'No autorizado para ver la cola de revisión.' using errcode='42501';
  end if;

  return query
  with legacy_items as (
    select core.*
    from app_private.admin_review_queue_core(jsonb_build_object('limit', v_limit)) core
    where v_can_read_legacy
  ),
  import_items as (
    select
      'import-batch-' || batch.id::text as item_key,
      'import_batch'::text as item_type,
      'import_batches'::text as record_table,
      batch.id as record_id,
      batch.id::text as source_id,
      batch.file_name as title,
      concat_ws(
        ' · ',
        batch.import_type,
        batch.row_count || ' filas',
        case
          when batch.status='needs_review' then concat(
            batch.error_rows, ' errores, ',
            batch.duplicate_rows, ' duplicados, ',
            batch.unresolved_rows, ' no resueltos'
          )
          when batch.status='validated' and batch.review_status='pending' then 'Validado y pendiente de aprobación editorial'
          when batch.status='failed' then coalesce(batch.last_error, 'Último intento de aplicación fallido')
          else batch.status
        end
      ) as detail,
      case
        when batch.status='validated' and batch.review_status='pending' then 'pending_review'
        else batch.status
      end as verification_status,
      greatest(1, batch.error_rows + batch.duplicate_rows + batch.unresolved_rows)::integer as issue_count,
      batch.created_at,
      '{}'::text[] as allowed_actions
    from public.import_batches batch
    where v_can_read_imports
      and (
        batch.status in ('needs_review','failed')
        or (batch.status='validated' and batch.review_status='pending')
      )
      and (
        public.current_user_is_super_or_national()
        or (
          batch.scope_entity_id is null
          and (
            public.current_user_has_permission('imports.prepare')
            or public.current_user_has_permission('imports.review')
            or public.current_user_has_permission('imports.apply')
          )
        )
        or (
          batch.scope_entity_id is not null
          and (
            app_private.current_user_can_manage_entity('imports.prepare', batch.scope_entity_id)
            or app_private.current_user_can_manage_entity('imports.review', batch.scope_entity_id)
            or app_private.current_user_can_manage_entity('imports.apply', batch.scope_entity_id)
          )
        )
      )
  ),
  items as (
    select * from legacy_items
    union all
    select * from import_items
  )
  select *
  from items
  order by created_at desc, item_type, title
  limit v_limit;
end;
$function$;

revoke all on function app_private.admin_review_queue_core(jsonb) from public,anon,authenticated;
revoke all on function app_private.admin_review_queue(jsonb) from public,anon,authenticated;
grant execute on function app_private.admin_review_queue_core(jsonb) to service_role;
grant execute on function app_private.admin_review_queue(jsonb) to service_role;

commit;