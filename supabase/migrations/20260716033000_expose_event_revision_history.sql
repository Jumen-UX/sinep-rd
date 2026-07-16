create or replace function app_private.rpc_definer__get_event_revision_history(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
declare
  v_scope_entity_id uuid;
  v_result jsonb;
begin
  if not public.current_user_has_permission('events.approve')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para consultar revisiones de eventos' using errcode='42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(p_event_id);
  if v_scope_entity_id is not null
     and not app_private.current_user_can_manage_entity('events.approve', v_scope_entity_id) then
    raise exception 'El evento está fuera de tu alcance' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', revision.id,
    'event_id', revision.event_id,
    'revision_number', revision.revision_number,
    'before_state', revision.before_state,
    'after_state', revision.after_state,
    'changed_fields', revision.changed_fields,
    'change_reason', revision.change_reason,
    'source_name', revision.source_name,
    'source_url', revision.source_url,
    'changed_by', revision.changed_by,
    'changed_at', revision.changed_at
  ) order by revision.revision_number desc), '[]'::jsonb)
  into v_result
  from public.canonical_event_revisions revision
  where revision.event_id = p_event_id;

  return v_result;
end;
$function$;

create or replace function public.get_event_revision_history(p_event_id uuid)
returns jsonb
language sql
set search_path to 'pg_catalog','public','app_private','auth','pg_temp'
as $function$
  select app_private.rpc_definer__get_event_revision_history(p_event_id)
$function$;

revoke all on function app_private.rpc_definer__get_event_revision_history(uuid) from public, anon, authenticated;
revoke all on function public.get_event_revision_history(uuid) from public, anon;
grant execute on function public.get_event_revision_history(uuid) to authenticated;
