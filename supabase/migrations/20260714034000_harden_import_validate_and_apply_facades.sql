create or replace function public.admin_validate_import_batch(p_batch_id uuid)
returns jsonb
language sql
security definer
set search_path to 'pg_catalog','public','app_private','auth','pg_temp'
as $function$
  select app_private.validate_import_batch_with_contract(p_batch_id)
$function$;

create or replace function public.admin_apply_import_batch(payload jsonb)
returns jsonb
language sql
security definer
set search_path to 'pg_catalog','public','app_private','internal','auth','pg_temp'
as $function$
  select app_private.admin_apply_import_batch(payload)
$function$;

revoke all on function public.admin_validate_import_batch(uuid) from public,anon;
revoke all on function public.admin_apply_import_batch(jsonb) from public,anon;
grant execute on function public.admin_validate_import_batch(uuid) to authenticated,service_role;
grant execute on function public.admin_apply_import_batch(jsonb) to authenticated,service_role;
