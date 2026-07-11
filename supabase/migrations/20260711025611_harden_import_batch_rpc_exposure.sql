-- Keep privileged import implementations outside the exposed public schema.
-- Public RPC names remain stable through security-invoker wrappers.

begin;

alter function public.admin_prepare_import_batch(jsonb) set schema app_private;

revoke all on function app_private.admin_prepare_import_batch(jsonb) from public, anon;
grant execute on function app_private.admin_prepare_import_batch(jsonb) to authenticated;

create or replace function public.admin_prepare_import_batch(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = public, app_private, auth, pg_temp
as $$
  select app_private.admin_prepare_import_batch(payload);
$$;

revoke all on function public.admin_prepare_import_batch(jsonb) from public, anon;
grant execute on function public.admin_prepare_import_batch(jsonb) to authenticated;

alter function public.admin_update_import_batch_row(uuid, jsonb) set schema app_private;

revoke all on function app_private.admin_update_import_batch_row(uuid, jsonb) from public, anon;
grant execute on function app_private.admin_update_import_batch_row(uuid, jsonb) to authenticated;

create or replace function public.admin_update_import_batch_row(
  p_row_id uuid,
  p_normalized_data jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, app_private, auth, pg_temp
as $$
  select app_private.admin_update_import_batch_row(p_row_id, p_normalized_data);
$$;

revoke all on function public.admin_update_import_batch_row(uuid, jsonb) from public, anon;
grant execute on function public.admin_update_import_batch_row(uuid, jsonb) to authenticated;

comment on function public.admin_prepare_import_batch(jsonb) is
  'Security-invoker API wrapper for scoped import batch preparation implemented in app_private.';
comment on function public.admin_update_import_batch_row(uuid, jsonb) is
  'Security-invoker API wrapper for scoped import row correction implemented in app_private.';

commit;
