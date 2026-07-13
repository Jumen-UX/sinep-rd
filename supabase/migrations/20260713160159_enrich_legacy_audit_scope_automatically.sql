create or replace function app_private.audit_permission_for_action(p_action text)
returns text
language sql
immutable
set search_path = 'pg_catalog', 'pg_temp'
as $$
  select case
    when p_action = 'import.batch.prepared' or p_action like 'import.row.%' then 'imports.prepare'
    when p_action = 'import.batch.reviewed' then 'imports.review'
    when p_action like 'import.%' then 'imports.apply'
    when p_action in ('people.person.created','people.person.updated') then 'people.create_proposal'
    when p_action = 'people.person.deceased' then 'people.update_proposal'
    when p_action in ('entities.entity.created','entities.jurisdiction.created') then 'entities.create_proposal'
    when p_action = 'appointments.assignment.created' then 'appointments.create_proposal'
    when p_action in ('resolve_assignment_canonical_incompatibility','appointments.incompatibility.resolved') then 'appointments.approve'
    when p_action like 'structures.%' then 'structures.manage'
    when p_action in ('admin_save_office_configuration','admin_update_office_configuration','editor_suggest_office_configuration') then 'structures.manage'
    when p_action = 'events.draft.created' then 'events.create_proposal'
    when p_action = 'events.reviewed' then 'events.approve'
    when p_action like 'events.%' then 'events.update_proposal'
    when p_action like 'users.%' then 'users.manage'
    else 'audit.create'
  end;
$$;

create or replace function app_private.enrich_audit_log_before_write()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_scope record;
begin
  new.user_id := coalesce(new.user_id, auth.uid());
  new.permission_key := coalesce(new.permission_key, app_private.audit_permission_for_action(new.action));
  new.outcome := coalesce(new.outcome, 'success');

  if new.scope_type is null
     or new.scope_type = 'unknown'
     or new.scope_entity_id is null then
    select * into v_scope
    from app_private.resolve_audit_scope(
      new.target_table,
      new.target_id,
      coalesce(new.new_data, '{}'::jsonb)
    );

    new.scope_type := case
      when new.scope_type is null or new.scope_type = 'unknown'
        then coalesce(v_scope.resolved_scope_type, 'unknown')
      else new.scope_type
    end;
    new.scope_entity_id := coalesce(new.scope_entity_id, v_scope.resolved_scope_entity_id);
    new.diocese_id := coalesce(new.diocese_id, v_scope.resolved_diocese_id);
    new.pastoral_area_id := coalesce(new.pastoral_area_id, v_scope.resolved_pastoral_area_id);
    new.pastoral_entity_id := coalesce(new.pastoral_entity_id, v_scope.resolved_pastoral_entity_id);
  end if;

  new.scope_type := coalesce(new.scope_type, 'unknown');
  return new;
end;
$$;

revoke all on function app_private.enrich_audit_log_before_write() from public, anon, authenticated;

drop trigger if exists trg_audit_logs_normalize_scope_type on public.audit_logs;
drop trigger if exists trg_audit_logs_enrich_scope on public.audit_logs;
create trigger trg_audit_logs_enrich_scope
before insert or update of target_table, target_id, new_data, scope_type, scope_entity_id
on public.audit_logs
for each row execute function app_private.enrich_audit_log_before_write();

update public.audit_logs
set permission_key = coalesce(permission_key, app_private.audit_permission_for_action(action)),
    outcome = coalesce(outcome, 'success');
