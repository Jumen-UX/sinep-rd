revoke all on function app_private.admin_get_change_request_detail(uuid) from public, anon, authenticated;
grant execute on function app_private.admin_get_change_request_detail(uuid) to service_role;

revoke all on function app_private.admin_get_person_detail(uuid) from public, anon;
grant execute on function app_private.admin_get_person_detail(uuid) to authenticated, service_role;

revoke all on function app_private.admin_list_people(text, integer) from public, anon;
grant execute on function app_private.admin_list_people(text, integer) to authenticated, service_role;

revoke all on function app_private.admin_list_role_scope_options(text) from public, anon;
grant execute on function app_private.admin_list_role_scope_options(text) to authenticated, service_role;

revoke all on function app_private.admin_list_roles_with_permissions() from public, anon;
grant execute on function app_private.admin_list_roles_with_permissions() to authenticated, service_role;

revoke all on function app_private.admin_list_users() from public, anon;
grant execute on function app_private.admin_list_users() to authenticated, service_role;

revoke all on function app_private.current_user_can(text, text, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function app_private.current_user_can(text, text, uuid, uuid, uuid, uuid) to authenticated, service_role;

revoke all on function app_private.current_user_has_scope_access(text, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function app_private.current_user_has_scope_access(text, uuid, uuid, uuid, uuid) to authenticated, service_role;

revoke all on function app_private.handle_new_auth_user_profile() from public, anon, authenticated;

revoke all on function app_private.resolve_audit_scope(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function app_private.resolve_audit_scope(text, uuid, jsonb) to service_role;

revoke all on function app_private.rpc_definer__admin_get_change_request_detail(uuid) from public, anon;
grant execute on function app_private.rpc_definer__admin_get_change_request_detail(uuid) to authenticated, service_role;

revoke all on function internal.list_assignment_canonical_incompatibilities(text, integer) from public, anon;
grant execute on function internal.list_assignment_canonical_incompatibilities(text, integer) to authenticated, service_role;
