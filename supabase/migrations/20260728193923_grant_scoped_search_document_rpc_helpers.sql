grant execute on function app_private.admin_search_catalog(text, integer) to authenticated;
grant execute on function app_private.admin_list_people(text, integer) to authenticated;
grant execute on function app_private.rpc_definer__admin_list_documents(uuid, text, text, boolean, integer) to authenticated;

revoke all on function app_private.admin_search_catalog(text, integer) from anon;
revoke all on function app_private.admin_list_people(text, integer) from anon;
revoke all on function app_private.rpc_definer__admin_list_documents(uuid, text, text, boolean, integer) from anon;