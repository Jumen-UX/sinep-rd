grant execute on function app_private.current_user_can_manage_user(uuid) to authenticated;

comment on function app_private.current_user_can_manage_user(uuid)
is 'Helper booleano utilizado por RLS y RPC para limitar gestión de usuarios a países compartidos; no expone datos de perfil.';