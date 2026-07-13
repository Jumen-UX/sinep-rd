alter function public.admin_save_organization_unit(jsonb) security definer;
revoke all on function public.admin_save_organization_unit(jsonb) from public,anon;
grant execute on function public.admin_save_organization_unit(jsonb) to authenticated,service_role;

revoke all on function app_private.rpc_definer__admin_save_organization_unit(jsonb) from public,anon,authenticated;
grant execute on function app_private.rpc_definer__admin_save_organization_unit(jsonb) to service_role;
