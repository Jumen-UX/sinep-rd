do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(function_row.oid)
  into v_definition
  from pg_proc function_row
  join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'app_private'
    and function_row.proname = 'rpc_definer__admin_save_event_reminder'
    and pg_get_function_identity_arguments(function_row.oid) = 'payload jsonb';

  if v_definition is null then
    raise exception 'No se encontró rpc_definer__admin_save_event_reminder(jsonb).';
  end if;

  v_definition := replace(
    v_definition,
    'where role_row.id = v_recipient_role_id and role_row.is_active = true',
    'where role_row.id = v_recipient_role_id'
  );

  execute v_definition;
end;
$$;
