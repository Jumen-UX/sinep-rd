begin;

create or replace function app_private.current_user_can_manage_canonical_event(
  p_permission_key text,
  p_event_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_scope_entity_id uuid;
begin
  if auth.uid() is null
     or nullif(p_permission_key, '') is null
     or p_event_id is null
     or not exists (select 1 from public.canonical_events event_row where event_row.id = p_event_id) then
    return false;
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(p_event_id);

  if v_scope_entity_id is not null then
    return app_private.current_user_can_manage_entity(p_permission_key, v_scope_entity_id);
  end if;

  return app_private.current_user_has_role(array['super_admin'])
     and app_private.current_user_has_permission(p_permission_key);
end;
$$;

create or replace function app_private.current_user_can_read_canonical_event(
  p_event_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_status text;
  v_scope_entity_id uuid;
begin
  if p_event_id is null then
    return false;
  end if;

  select event_row.status
  into v_status
  from public.canonical_events event_row
  where event_row.id = p_event_id;

  if not found then
    return false;
  end if;

  if v_status = 'applied' then
    return true;
  end if;

  if auth.uid() is null then
    return false;
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(p_event_id);

  if v_scope_entity_id is not null then
    return app_private.current_user_can_manage_entity('events.view', v_scope_entity_id);
  end if;

  return app_private.current_user_has_role(array['super_admin'])
     and app_private.current_user_has_permission('events.view');
end;
$$;

create or replace function app_private.current_user_can_read_structure_event(
  p_event_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_diocese_id uuid;
begin
  if auth.uid() is null
     or p_event_id is null
     or not exists (select 1 from public.structure_events event_row where event_row.id = p_event_id) then
    return false;
  end if;

  v_diocese_id := app_private.structure_event_diocese_id(p_event_id);

  if v_diocese_id is not null then
    return app_private.current_user_can_manage_entity('structures.manage', v_diocese_id);
  end if;

  return app_private.current_user_has_role(array['super_admin'])
     and app_private.current_user_has_permission('structures.manage');
end;
$$;

revoke all on function app_private.current_user_can_manage_canonical_event(text, uuid)
from public, anon, authenticated;
revoke all on function app_private.current_user_can_read_canonical_event(uuid)
from public, anon, authenticated;
revoke all on function app_private.current_user_can_read_structure_event(uuid)
from public, anon, authenticated;

grant execute on function app_private.current_user_can_read_canonical_event(uuid)
to anon, authenticated;
grant execute on function app_private.current_user_can_read_structure_event(uuid)
to authenticated;

create or replace function app_private.rpc_definer__admin_create_event_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_entity_id uuid := app_private.audit_json_uuid(payload, 'entity_id');
  v_unit_id uuid := app_private.audit_json_uuid(payload, 'organization_unit_id');
  v_scope_entity_id uuid := app_private.audit_json_uuid(payload, 'scope_entity_id');
  v_event_id uuid;
  v_new jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado para crear eventos.' using errcode = '42501';
  end if;

  if v_unit_id is not null then
    select unit_row.ecclesiastical_entity_id
    into v_scope_entity_id
    from public.organization_units unit_row
    where unit_row.id = v_unit_id;
  elsif v_scope_entity_id is null then
    v_scope_entity_id := v_entity_id;
  end if;

  if v_scope_entity_id is not null then
    if not app_private.current_user_can_manage_entity('events.create_proposal', v_scope_entity_id) then
      raise exception 'El evento está fuera de tu alcance.' using errcode = '42501';
    end if;
  elsif not (
    app_private.current_user_has_role(array['super_admin'])
    and app_private.current_user_has_permission('events.create_proposal')
  ) then
    raise exception 'El evento debe indicar un ámbito administrable.' using errcode = '42501';
  end if;

  v_event_id := internal.admin_create_event_draft(payload);

  select to_jsonb(event_row)
  into v_new
  from public.canonical_events event_row
  where event_row.id = v_event_id;

  perform public.create_audit_log(
    auth.uid(),
    'events.draft.created',
    'canonical_events',
    v_event_id,
    null,
    jsonb_build_object(
      'scope_entity_id', v_scope_entity_id,
      'organization_unit_id', v_unit_id,
      'record', v_new
    ),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_event_id;
end;
$$;

create or replace function app_private.rpc_definer__admin_generate_event_action_plan(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_event_id uuid := app_private.audit_json_uuid(payload, 'event_id');
  v_scope_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  if not app_private.current_user_can_manage_canonical_event('events.update_proposal', v_event_id) then
    raise exception 'El evento está fuera de tu alcance de preparación.' using errcode = '42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);
  select to_jsonb(event_row) into v_old from public.canonical_events event_row where event_row.id = v_event_id;
  v_result := internal.admin_generate_event_action_plan(payload);
  select to_jsonb(event_row) into v_new from public.canonical_events event_row where event_row.id = v_event_id;

  perform public.create_audit_log(
    auth.uid(), 'events.plan.generated', 'canonical_events', v_event_id, v_old,
    jsonb_build_object('scope_entity_id', v_scope_entity_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function app_private.rpc_definer__admin_review_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_event_id uuid := app_private.audit_json_uuid(payload, 'event_id');
  v_scope_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  if not app_private.current_user_can_manage_canonical_event('events.approve', v_event_id) then
    raise exception 'El evento está fuera de tu alcance de revisión.' using errcode = '42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);
  select to_jsonb(event_row) into v_old from public.canonical_events event_row where event_row.id = v_event_id;
  v_result := internal.admin_review_event(payload);
  select to_jsonb(event_row) into v_new from public.canonical_events event_row where event_row.id = v_event_id;

  perform public.create_audit_log(
    auth.uid(), 'events.reviewed', 'canonical_events', v_event_id, v_old,
    jsonb_build_object('scope_entity_id', v_scope_entity_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function app_private.rpc_definer__admin_approve_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_event_id uuid := app_private.audit_json_uuid(payload, 'event_id');
  v_scope_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  if not app_private.current_user_can_manage_canonical_event('events.approve', v_event_id) then
    raise exception 'El evento está fuera de tu alcance de aprobación.' using errcode = '42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);
  select to_jsonb(event_row) into v_old from public.canonical_events event_row where event_row.id = v_event_id;
  v_result := internal.admin_approve_event(payload);
  select to_jsonb(event_row) into v_new from public.canonical_events event_row where event_row.id = v_event_id;

  perform public.create_audit_log(
    auth.uid(), 'events.approved', 'canonical_events', v_event_id, v_old,
    jsonb_build_object('scope_entity_id', v_scope_entity_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function app_private.rpc_definer__admin_configure_event_action(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_action_id uuid := app_private.audit_json_uuid(payload, 'action_id');
  v_event_id uuid;
  v_scope_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  select action_row.event_id, to_jsonb(action_row)
  into v_event_id, v_old
  from public.canonical_event_actions action_row
  where action_row.id = v_action_id;

  if not app_private.current_user_can_manage_canonical_event('events.update_proposal', v_event_id) then
    raise exception 'La acción pertenece a un evento fuera de tu alcance.' using errcode = '42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);
  v_result := internal.admin_configure_event_action(payload);
  select to_jsonb(action_row) into v_new from public.canonical_event_actions action_row where action_row.id = v_action_id;

  perform public.create_audit_log(
    auth.uid(), 'events.action.configured', 'canonical_event_actions', v_action_id, v_old,
    jsonb_build_object('scope_entity_id', v_scope_entity_id, 'event_id', v_event_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function app_private.rpc_definer__admin_update_event_action(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_action_id uuid := app_private.audit_json_uuid(payload, 'action_id');
  v_event_id uuid;
  v_scope_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  select action_row.event_id, to_jsonb(action_row)
  into v_event_id, v_old
  from public.canonical_event_actions action_row
  where action_row.id = v_action_id;

  if not app_private.current_user_can_manage_canonical_event('events.update_proposal', v_event_id) then
    raise exception 'La acción pertenece a un evento fuera de tu alcance.' using errcode = '42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);
  v_result := internal.admin_update_event_action(payload);
  select to_jsonb(action_row) into v_new from public.canonical_event_actions action_row where action_row.id = v_action_id;

  perform public.create_audit_log(
    auth.uid(), 'events.action.updated', 'canonical_event_actions', v_action_id, v_old,
    jsonb_build_object('scope_entity_id', v_scope_entity_id, 'event_id', v_event_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function app_private.rpc_definer__admin_correct_canonical_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_event_id uuid := app_private.audit_json_uuid(payload, 'event_id');
  v_scope_entity_id uuid;
  v_result jsonb;
begin
  if not app_private.current_user_can_manage_canonical_event('events.approve', v_event_id) then
    raise exception 'El evento está fuera de tu alcance de corrección.' using errcode = '42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);
  v_result := internal.admin_correct_canonical_event(payload);

  perform public.create_audit_log(
    auth.uid(), 'events.corrected', 'canonical_events', v_event_id,
    v_result->'before_state',
    jsonb_build_object(
      'scope_entity_id', v_scope_entity_id,
      'record', v_result->'after_state',
      'revision_number', v_result->'revision_number',
      'changed_fields', v_result->'changed_fields',
      'change_reason', payload->>'change_reason'
    ),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

revoke insert, update, delete on table public.canonical_event_actions from authenticated;
revoke insert, update, delete on table public.canonical_event_participants from authenticated;
revoke insert, update, delete on table public.structure_events from authenticated;
revoke insert, update, delete on table public.structure_event_actions from authenticated;
revoke insert, update, delete on table public.structure_event_nodes from authenticated;

revoke select on table public.structure_events from anon;
revoke select on table public.structure_event_actions from anon;
revoke select on table public.structure_event_nodes from anon;

revoke select on table public.canonical_events from anon;
grant select (
  id, event_type_id, title, description, event_date, effective_date,
  status, approved_at, applied_at, created_at, load_mode, evidence_status,
  source_name_text, source_url_text, source_checked_at, verification_status,
  notes_json
) on table public.canonical_events to anon;

revoke select on table public.canonical_event_participants from anon;
grant select (id, event_id, entity_id, role, organization_unit_id)
on table public.canonical_event_participants to anon;

drop policy if exists canonical_events_select_anon_applied on public.canonical_events;
drop policy if exists canonical_events_select_authenticated_visible on public.canonical_events;
create policy canonical_events_select_anon_applied
on public.canonical_events for select to anon
using (status = 'applied');
create policy canonical_events_select_authenticated_scoped
on public.canonical_events for select to authenticated
using (app_private.current_user_can_read_canonical_event(id));

drop policy if exists canonical_event_actions_select_admin on public.canonical_event_actions;
drop policy if exists canonical_event_actions_insert_admin on public.canonical_event_actions;
drop policy if exists canonical_event_actions_update_admin on public.canonical_event_actions;
drop policy if exists canonical_event_actions_delete_admin on public.canonical_event_actions;
create policy canonical_event_actions_select_scoped
on public.canonical_event_actions for select to authenticated
using (app_private.current_user_can_read_canonical_event(event_id));

drop policy if exists canonical_event_participants_select_anon_public on public.canonical_event_participants;
drop policy if exists canonical_event_participants_select_authenticated_visible on public.canonical_event_participants;
drop policy if exists canonical_event_participants_admin_insert on public.canonical_event_participants;
drop policy if exists canonical_event_participants_admin_update on public.canonical_event_participants;
drop policy if exists canonical_event_participants_admin_delete on public.canonical_event_participants;
create policy canonical_event_participants_select_anon_public
on public.canonical_event_participants for select to anon
using (
  exists (
    select 1
    from public.canonical_events event_row
    where event_row.id = event_id
      and event_row.status = 'applied'
  )
  and (
    (entity_id is not null and exists (
      select 1 from public.ecclesiastical_entities entity_row
      where entity_row.id = entity_id
        and entity_row.status = 'active'
        and entity_row.visibility = 'public'
    ))
    or
    (organization_unit_id is not null and exists (
      select 1 from public.organization_units unit_row
      where unit_row.id = organization_unit_id
        and unit_row.status = 'active'
        and unit_row.visibility = 'public'
    ))
  )
);
create policy canonical_event_participants_select_authenticated_scoped
on public.canonical_event_participants for select to authenticated
using (app_private.current_user_can_read_canonical_event(event_id));

drop policy if exists structure_events_select_public on public.structure_events;
drop policy if exists structure_events_insert_admin on public.structure_events;
drop policy if exists structure_events_update_admin on public.structure_events;
drop policy if exists structure_events_remove_admin on public.structure_events;
create policy structure_events_select_scoped
on public.structure_events for select to authenticated
using (app_private.current_user_can_read_structure_event(id));

drop policy if exists structure_event_actions_admin_select on public.structure_event_actions;
drop policy if exists structure_event_actions_admin_insert on public.structure_event_actions;
drop policy if exists structure_event_actions_admin_update on public.structure_event_actions;
drop policy if exists structure_event_actions_admin_delete on public.structure_event_actions;
create policy structure_event_actions_select_scoped
on public.structure_event_actions for select to authenticated
using (app_private.current_user_can_read_structure_event(event_id));

drop policy if exists structure_event_nodes_select_public on public.structure_event_nodes;
drop policy if exists structure_event_nodes_insert_admin on public.structure_event_nodes;
drop policy if exists structure_event_nodes_update_admin on public.structure_event_nodes;
drop policy if exists structure_event_nodes_remove_admin on public.structure_event_nodes;
create policy structure_event_nodes_select_scoped
on public.structure_event_nodes for select to authenticated
using (app_private.current_user_can_read_structure_event(event_id));

comment on function app_private.current_user_can_manage_canonical_event(text, uuid) is
  'Authorizes canonical event mutation through its canonical entity and country. Unscoped events are super_admin-only.';
comment on function app_private.current_user_can_read_canonical_event(uuid) is
  'Applied canonical events remain public; non-applied events require events.view within the canonical entity country.';
comment on function app_private.current_user_can_read_structure_event(uuid) is
  'Structural workflow is administrative-only and requires structures.manage within the event diocese.';

commit;
