create or replace function public.admin_prepare_import_batch(payload jsonb)
returns jsonb
language sql
security definer
set search_path = 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.admin_prepare_import_batch(payload);
$$;

create or replace function public.admin_review_import_batch(payload jsonb)
returns jsonb
language sql
security definer
set search_path = 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.admin_review_import_batch(payload);
$$;

create or replace function public.admin_update_import_batch_row(
  p_row_id uuid,
  p_normalized_data jsonb
)
returns jsonb
language sql
security definer
set search_path = 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.admin_update_import_batch_row(p_row_id, p_normalized_data);
$$;

revoke all on function app_private.admin_prepare_import_batch(jsonb) from public, anon, authenticated;
revoke all on function app_private.admin_review_import_batch(jsonb) from public, anon, authenticated;
revoke all on function app_private.admin_update_import_batch_row(uuid, jsonb) from public, anon, authenticated;
revoke all on function app_private.validate_import_batch(uuid) from public, anon, authenticated;

grant execute on function public.admin_prepare_import_batch(jsonb) to authenticated, service_role;
grant execute on function public.admin_review_import_batch(jsonb) to authenticated, service_role;
grant execute on function public.admin_update_import_batch_row(uuid, jsonb) to authenticated, service_role;
