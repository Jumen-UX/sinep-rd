revoke all on function app_private.current_user_can_view_calendar_record(text, uuid, text) from public, anon, authenticated;
revoke all on function app_private.current_user_can_manage_calendar_record(text, text, uuid) from public, anon, authenticated;

grant execute on function app_private.current_user_can_view_calendar_record(text, uuid, text) to public;
grant execute on function app_private.current_user_can_manage_calendar_record(text, text, uuid) to authenticated;
