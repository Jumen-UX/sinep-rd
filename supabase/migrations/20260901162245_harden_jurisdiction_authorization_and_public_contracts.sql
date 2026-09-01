insert into public.permissions (id,key,module,description)
select gen_random_uuid(),'jurisdictions.manage','jurisdictions','Gestionar el organigrama y ciclo de vida jurisdiccional dentro del alcance asignado.'
where not exists (select 1 from public.permissions where key='jurisdictions.manage');

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r cross join public.permissions p
where r.key in ('super_admin','national_admin') and p.key='jurisdictions.manage'
on conflict do nothing;

create or replace function app_private.audit_permission_for_action(p_action text)
returns text language sql immutable set search_path to 'pg_catalog','pg_temp'
as $$
  select case
    when p_action='import.batch.prepared' or p_action like 'import.row.%' then 'imports.prepare'
    when p_action='import.batch.reviewed' then 'imports.review'
    when p_action like 'import.%' then 'imports.apply'
    when p_action in ('people.person.created','people.person.updated') then 'people.create_proposal'
    when p_action='people.person.deceased' then 'people.update_proposal'
    when p_action in ('entities.entity.created','entities.jurisdiction.created') then 'entities.create_proposal'
    when p_action='appointments.assignment.created' then 'appointments.create_proposal'
    when p_action in ('resolve_assignment_canonical_incompatibility','appointments.incompatibility.resolved') then 'appointments.approve'
    when p_action like 'structures.%' then 'structures.manage'
    when p_action in ('admin_save_office_configuration','admin_update_office_configuration','editor_suggest_office_configuration') then 'structures.manage'
    when p_action='events.draft.created' then 'events.create_proposal'
    when p_action='events.reviewed' then 'events.approve'
    when p_action='events.organization_unit.applied' then 'events.apply'
    when p_action like 'events.%' then 'events.update_proposal'
    when p_action like 'users.%' then 'users.manage'
    when p_action like 'jurisdiction.%' then 'jurisdictions.manage'
    else 'audit.create'
  end;
$$;

create or replace function app_private.current_user_can_manage_jurisdiction_account(p_permission_key text,p_account_id uuid)
returns boolean language plpgsql stable security definer
set search_path to 'pg_catalog','public','app_private','auth','pg_temp'
as $$
declare v_entity_id uuid;
begin
  if auth.uid() is null or p_account_id is null or nullif(btrim(p_permission_key),'') is null then return false; end if;
  select a.ecclesiastical_entity_id into v_entity_id from public.jurisdiction_accounts a where a.id=p_account_id;
  if v_entity_id is null then return false; end if;
  return app_private.current_user_can_manage_entity(p_permission_key,v_entity_id);
end;
$$;

create or replace function app_private.current_user_can_manage_jurisdiction_operation(p_permission_key text,p_structural_action text,p_primary_account_id uuid,p_structural_payload jsonb)
returns boolean language plpgsql stable security definer
set search_path to 'pg_catalog','public','app_private','auth','pg_temp'
as $$
declare v_action text:=coalesce(nullif(btrim(p_structural_action),''),'none'); v_parent uuid;
begin
  if auth.uid() is null then return false; end if;
  if v_action='creation' then
    begin v_parent:=nullif(coalesce(p_structural_payload,'{}'::jsonb)->>'parent_account_id','')::uuid; exception when invalid_text_representation then return false; end;
    return app_private.current_user_can_manage_jurisdiction_account(p_permission_key,v_parent);
  end if;
  if p_primary_account_id is not null then
    return app_private.current_user_can_manage_jurisdiction_account(p_permission_key,p_primary_account_id);
  end if;
  return app_private.current_user_has_role(array['super_admin']) and app_private.current_user_has_permission(p_permission_key);
end;
$$;

revoke all on function app_private.current_user_can_manage_jurisdiction_account(text,uuid) from public,anon;
revoke all on function app_private.current_user_can_manage_jurisdiction_operation(text,text,uuid,jsonb) from public,anon;
grant execute on function app_private.current_user_can_manage_jurisdiction_account(text,uuid) to authenticated;
grant execute on function app_private.current_user_can_manage_jurisdiction_operation(text,text,uuid,jsonb) to authenticated;

alter function public.admin_apply_jurisdiction_creation(text,text,text,text,text,uuid,text,date,text,text,uuid) set schema app_private;
alter function app_private.admin_apply_jurisdiction_creation(text,text,text,text,text,uuid,text,date,text,text,uuid) rename to rpc_definer__admin_apply_jurisdiction_creation;
alter function public.admin_apply_jurisdiction_dependency_change(uuid,uuid,text,date,text,uuid,uuid) set schema app_private;
alter function app_private.admin_apply_jurisdiction_dependency_change(uuid,uuid,text,date,text,uuid,uuid) rename to rpc_definer__admin_apply_jurisdiction_dependency_change;
alter function public.admin_apply_jurisdiction_historical_event(text,date,text,text,uuid,text,uuid,jsonb) set schema app_private;
alter function app_private.admin_apply_jurisdiction_historical_event(text,date,text,text,uuid,text,uuid,jsonb) rename to rpc_definer__admin_apply_jurisdiction_historical_event;
alter function public.admin_apply_jurisdiction_restoration(uuid,uuid,text,date,text,uuid) set schema app_private;
alter function app_private.admin_apply_jurisdiction_restoration(uuid,uuid,text,date,text,uuid) rename to rpc_definer__admin_apply_jurisdiction_restoration;
alter function public.admin_apply_jurisdiction_suppression(uuid,date,text,uuid,uuid) set schema app_private;
alter function app_private.admin_apply_jurisdiction_suppression(uuid,date,text,uuid,uuid) rename to rpc_definer__admin_apply_jurisdiction_suppression;
alter function public.admin_correct_jurisdiction(uuid,jsonb,text,timestamptz) set schema app_private;
alter function app_private.admin_correct_jurisdiction(uuid,jsonb,text,timestamptz) rename to rpc_definer__admin_correct_jurisdiction;
alter function public.admin_preview_jurisdiction_creation(text,text,text,text,text,uuid,text,date,text,text,uuid) set schema app_private;
alter function app_private.admin_preview_jurisdiction_creation(text,text,text,text,text,uuid,text,date,text,text,uuid) rename to rpc_definer__admin_preview_jurisdiction_creation;
alter function public.admin_preview_jurisdiction_dependency_change(uuid,uuid,text,date,text,uuid) set schema app_private;
alter function app_private.admin_preview_jurisdiction_dependency_change(uuid,uuid,text,date,text,uuid) rename to rpc_definer__admin_preview_jurisdiction_dependency_change;
alter function public.admin_preview_jurisdiction_historical_event(text,date,text,text,uuid,text,uuid,jsonb) set schema app_private;
alter function app_private.admin_preview_jurisdiction_historical_event(text,date,text,text,uuid,text,uuid,jsonb) rename to rpc_definer__admin_preview_jurisdiction_historical_event;
alter function public.admin_preview_jurisdiction_restoration(uuid,uuid,text,date,text,uuid) set schema app_private;
alter function app_private.admin_preview_jurisdiction_restoration(uuid,uuid,text,date,text,uuid) rename to rpc_definer__admin_preview_jurisdiction_restoration;
alter function public.admin_preview_jurisdiction_suppression(uuid,date,text,uuid) set schema app_private;
alter function app_private.admin_preview_jurisdiction_suppression(uuid,date,text,uuid) rename to rpc_definer__admin_preview_jurisdiction_suppression;
alter function public.admin_list_current_jurisdiction_tree() set schema app_private;
alter function app_private.admin_list_current_jurisdiction_tree() rename to rpc_definer__admin_list_current_jurisdiction_tree;
alter function public.admin_list_restorable_jurisdictions() set schema app_private;
alter function app_private.admin_list_restorable_jurisdictions() rename to rpc_definer__admin_list_restorable_jurisdictions;

create function public.admin_preview_jurisdiction_creation(p_entity_type_key text,p_name text,p_official_name text,p_latin_name text,p_slug text,p_parent_account_id uuid,p_relationship_type text,p_effective_date date default current_date,p_visibility text default 'internal',p_reason text default null,p_source_document_id uuid default null)
returns jsonb language plpgsql security invoker set search_path to 'pg_catalog','public','app_private','auth','pg_temp' as $$begin
 if not app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',p_parent_account_id) then raise exception 'Fuera del alcance autorizado para gestionar jurisdicciones' using errcode='42501'; end if;
 return app_private.rpc_definer__admin_preview_jurisdiction_creation(p_entity_type_key,p_name,p_official_name,p_latin_name,p_slug,p_parent_account_id,p_relationship_type,p_effective_date,p_visibility,p_reason,p_source_document_id);
end$$;
create function public.admin_apply_jurisdiction_creation(p_entity_type_key text,p_name text,p_official_name text,p_latin_name text,p_slug text,p_parent_account_id uuid,p_relationship_type text,p_effective_date date,p_visibility text,p_reason text,p_source_document_id uuid default null)
returns jsonb language plpgsql security invoker set search_path to 'pg_catalog','public','app_private','auth','pg_temp' as $$begin
 if not app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',p_parent_account_id) then raise exception 'Fuera del alcance autorizado para gestionar jurisdicciones' using errcode='42501'; end if;
 return app_private.rpc_definer__admin_apply_jurisdiction_creation(p_entity_type_key,p_name,p_official_name,p_latin_name,p_slug,p_parent_account_id,p_relationship_type,p_effective_date,p_visibility,p_reason,p_source_document_id);
end$$;
create function public.admin_preview_jurisdiction_dependency_change(p_child_account_id uuid,p_new_parent_account_id uuid,p_relationship_type text,p_effective_date date default current_date,p_reason text default null,p_source_document_id uuid default null)
returns jsonb language plpgsql security invoker set search_path to 'pg_catalog','public','app_private','auth','pg_temp' as $$begin
 if not app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',p_child_account_id) or not app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',p_new_parent_account_id) then raise exception 'Fuera del alcance autorizado para cambiar la dependencia jurisdiccional' using errcode='42501'; end if;
 return app_private.rpc_definer__admin_preview_jurisdiction_dependency_change(p_child_account_id,p_new_parent_account_id,p_relationship_type,p_effective_date,p_reason,p_source_document_id);
end$$;
create function public.admin_apply_jurisdiction_dependency_change(p_child_account_id uuid,p_new_parent_account_id uuid,p_relationship_type text,p_effective_date date,p_reason text,p_source_document_id uuid default null,p_expected_current_edge_id uuid default null)
returns jsonb language plpgsql security invoker set search_path to 'pg_catalog','public','app_private','auth','pg_temp' as $$begin
 if not app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',p_child_account_id) or not app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',p_new_parent_account_id) then raise exception 'Fuera del alcance autorizado para cambiar la dependencia jurisdiccional' using errcode='42501'; end if;
 return app_private.rpc_definer__admin_apply_jurisdiction_dependency_change(p_child_account_id,p_new_parent_account_id,p_relationship_type,p_effective_date,p_reason,p_source_document_id,p_expected_current_edge_id);
end$$;
create function public.admin_preview_jurisdiction_suppression(p_account_id uuid,p_effective_date date,p_reason text,p_source_document_id uuid default null)
returns jsonb language plpgsql security invoker set search_path to 'pg_catalog','public','app_private','auth','pg_temp' as $$begin
 if not app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',p_account_id) then raise exception 'Fuera del alcance autorizado para suprimir jurisdicciones' using errcode='42501'; end if;
 return app_private.rpc_definer__admin_preview_jurisdiction_suppression(p_account_id,p_effective_date,p_reason,p_source_document_id);
end$$;
create function public.admin_apply_jurisdiction_suppression(p_account_id uuid,p_effective_date date,p_reason text,p_source_document_id uuid default null,p_expected_current_edge_id uuid default null)
returns jsonb language plpgsql security invoker set search_path to 'pg_catalog','public','app_private','auth','pg_temp' as $$begin
 if not app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',p_account_id) then raise exception 'Fuera del alcance autorizado para suprimir jurisdicciones' using errcode='42501'; end if;
 return app_private.rpc_definer__admin_apply_jurisdiction_suppression(p_account_id,p_effective_date,p_reason,p_source_document_id,p_expected_current_edge_id);
end$$;
create function public.admin_preview_jurisdiction_restoration(p_account_id uuid,p_parent_account_id uuid,p_relationship_type text,p_effective_date date,p_reason text,p_source_document_id uuid default null)
returns jsonb language plpgsql security invoker set search_path to 'pg_catalog','public','app_private','auth','pg_temp' as $$begin
 if not app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',p_account_id) or not app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',p_parent_account_id) then raise exception 'Fuera del alcance autorizado para restaurar jurisdicciones' using errcode='42501'; end if;
 return app_private.rpc_definer__admin_preview_jurisdiction_restoration(p_account_id,p_parent_account_id,p_relationship_type,p_effective_date,p_reason,p_source_document_id);
end$$;
create function public.admin_apply_jurisdiction_restoration(p_account_id uuid,p_parent_account_id uuid,p_relationship_type text,p_effective_date date,p_reason text,p_source_document_id uuid default null)
returns jsonb language plpgsql security invoker set search_path to 'pg_catalog','public','app_private','auth','pg_temp' as $$begin
 if not app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',p_account_id) or not app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',p_parent_account_id) then raise exception 'Fuera del alcance autorizado para restaurar jurisdicciones' using errcode='42501'; end if;
 return app_private.rpc_definer__admin_apply_jurisdiction_restoration(p_account_id,p_parent_account_id,p_relationship_type,p_effective_date,p_reason,p_source_document_id);
end$$;
create function public.admin_correct_jurisdiction(p_account_id uuid,p_changes jsonb,p_reason text default null,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path to 'pg_catalog','public','app_private','auth','pg_temp' as $$begin
 if not app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',p_account_id) then raise exception 'Fuera del alcance autorizado para corregir jurisdicciones' using errcode='42501'; end if;
 return app_private.rpc_definer__admin_correct_jurisdiction(p_account_id,p_changes,p_reason,p_expected_updated_at);
end$$;
create function public.admin_preview_jurisdiction_historical_event(p_event_type_key text,p_effective_date date,p_public_title text,p_public_summary text,p_source_document_id uuid,p_structural_action text default 'none',p_primary_account_id uuid default null,p_structural_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path to 'pg_catalog','public','app_private','auth','pg_temp' as $$begin
 if not app_private.current_user_can_manage_jurisdiction_operation('jurisdictions.manage',p_structural_action,p_primary_account_id,p_structural_payload) then raise exception 'Fuera del alcance autorizado para consultar o registrar historia jurisdiccional' using errcode='42501'; end if;
 return app_private.rpc_definer__admin_preview_jurisdiction_historical_event(p_event_type_key,p_effective_date,p_public_title,p_public_summary,p_source_document_id,p_structural_action,p_primary_account_id,p_structural_payload);
end$$;
create function public.admin_apply_jurisdiction_historical_event(p_event_type_key text,p_effective_date date,p_public_title text,p_public_summary text,p_source_document_id uuid,p_structural_action text default 'none',p_primary_account_id uuid default null,p_structural_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path to 'pg_catalog','public','app_private','auth','pg_temp' as $$begin
 if not app_private.current_user_can_manage_jurisdiction_operation('jurisdictions.manage',p_structural_action,p_primary_account_id,p_structural_payload) then raise exception 'Fuera del alcance autorizado para registrar historia jurisdiccional' using errcode='42501'; end if;
 return app_private.rpc_definer__admin_apply_jurisdiction_historical_event(p_event_type_key,p_effective_date,p_public_title,p_public_summary,p_source_document_id,p_structural_action,p_primary_account_id,p_structural_payload);
end$$;
create function public.admin_list_current_jurisdiction_tree()
returns table(account_id uuid,ecclesiastical_entity_id uuid,account_code text,name text,official_name text,latin_name text,slug text,account_type_key text,account_type_name text,parent_account_id uuid,parent_name text,relationship_type text,current_edge_id uuid,depth integer,path_ids uuid[],path_names text[],canonical_status text,visibility text,sort_order integer,valid_from date,updated_at timestamptz,cathedral_name text,territory_summary text,description text,source_name text,source_url text,source_checked_at date,notes text)
language sql security invoker set search_path to 'pg_catalog','public','app_private','auth','pg_temp' as $$
 select t.* from app_private.rpc_definer__admin_list_current_jurisdiction_tree() t where app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',t.account_id)
$$;
create function public.admin_list_restorable_jurisdictions()
returns table(account_id uuid,ecclesiastical_entity_id uuid,account_code text,name text,account_type_key text,account_type_name text,canonical_status text,valid_to date,suppressed_at date)
language sql security invoker set search_path to 'pg_catalog','public','app_private','auth','pg_temp' as $$
 select t.* from app_private.rpc_definer__admin_list_restorable_jurisdictions() t where app_private.current_user_can_manage_jurisdiction_account('jurisdictions.manage',t.account_id)
$$;

do $$declare r record; begin
 for r in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname like 'rpc_definer__admin_%jurisdiction%' loop execute format('revoke all on function %s from public, anon',r.fn); execute format('grant execute on function %s to authenticated',r.fn); end loop;
 for r in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'admin_%jurisdiction%' loop execute format('revoke all on function %s from public, anon',r.fn); execute format('grant execute on function %s to authenticated',r.fn); end loop;
end$$;

alter view public.public_countries set (security_invoker=true);

drop policy if exists jurisdiction_change_operations_deny_direct on public.jurisdiction_change_operations;
create policy jurisdiction_change_operations_deny_direct on public.jurisdiction_change_operations for all to anon,authenticated using(false) with check(false);
drop policy if exists jurisdiction_change_operation_accounts_deny_direct on public.jurisdiction_change_operation_accounts;
create policy jurisdiction_change_operation_accounts_deny_direct on public.jurisdiction_change_operation_accounts for all to anon,authenticated using(false) with check(false);
drop policy if exists jurisdiction_change_effects_deny_direct on public.jurisdiction_change_effects;
create policy jurisdiction_change_effects_deny_direct on public.jurisdiction_change_effects for all to anon,authenticated using(false) with check(false);
