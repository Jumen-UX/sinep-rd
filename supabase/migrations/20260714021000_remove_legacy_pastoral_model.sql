-- Rewrite remaining function bodies before dropping obsolete columns.
do $migration$
declare
  r record;
  v_def text;
  v_header text;
  v_body text;
begin
  for r in
    select p.oid,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','app_private','internal')
      and p.prokind='f'
      and pg_get_functiondef(p.oid) ilike '%pastoral_entity%'
      and pg_get_functiondef(p.oid) not ilike '%organization_unit_id%'
      and not (n.nspname in ('public','app_private') and p.proname in ('current_user_can','current_user_has_scope_access'))
  loop
    v_def:=pg_get_functiondef(r.oid);
    if strpos(v_def,'AS $function$')=0 then continue; end if;

    v_header:=split_part(v_def,'AS $function$',1)||'AS $function$';
    v_body:=split_part(v_def,'AS $function$',2);
    v_body:=regexp_replace(v_body,E'\n?\$function\$\s*$','','n');

    v_body:=replace(v_body,'related_pastoral_entity_id','related_organization_unit_id');
    v_body:=replace(v_body,'linked_pastoral_entity_id','linked_organization_unit_id');
    v_body:=replace(v_body,'parent_pastoral_entity_id','parent_unit_id');
    v_body:=replace(v_body,'current_pastoral_entity_id','current_organization_unit_id');
    v_body:=replace(v_body,'current_pastoral_entity_name','current_organization_unit_name');
    v_body:=replace(v_body,'pastoral_entity_name','organization_unit_name');
    v_body:=replace(v_body,'pastoral_entity_slug','organization_unit_slug');
    v_body:=replace(v_body,'pastoral_entities','organization_units');
    v_body:=replace(v_body,'pastoral_entity_id','organization_unit_id');
    v_body:=replace(v_body,'''pastoral_entity''','''organization_unit''');
    v_body:=replace(v_body,'''pastoral_entities''','''organization_units''');
    v_body:=replace(v_body,'pastoral_entity','organization_unit');

    execute v_header||v_body||E'\n$function$';
  end loop;
end;
$migration$;

create or replace function app_private.rpc_definer__admin_save_position_assignment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','internal','app_private','auth','pg_temp'
as $function$
declare
  v_entity_id uuid := app_private.audit_json_uuid(payload,'ecclesiastical_entity_id');
  v_unit_id uuid := app_private.audit_json_uuid(payload,'organization_unit_id');
  v_predecessor_id uuid := app_private.audit_json_uuid(payload,'predecessor_assignment_id');
  v_successor_id uuid := app_private.audit_json_uuid(payload,'successor_assignment_id');
  v_related_entity_id uuid;
  v_related_unit_id uuid;
  v_result jsonb;
  v_assignment_id uuid;
  v_new jsonb;
begin
  if not public.current_user_has_permission('appointments.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear nombramientos' using errcode='42501';
  end if;

  if v_unit_id is not null then
    select ou.ecclesiastical_entity_id
      into v_related_entity_id
    from public.organization_units ou
    where ou.id=v_unit_id;
    v_entity_id:=coalesce(v_entity_id,v_related_entity_id);
  end if;

  if v_entity_id is null and v_unit_id is null and not public.current_user_is_super_or_national() then
    raise exception 'El nombramiento debe indicar una entidad o unidad dentro de tu alcance' using errcode='42501';
  end if;

  if v_entity_id is not null
     and not app_private.current_user_can_manage_entity('appointments.create_proposal',v_entity_id) then
    raise exception 'La entidad del nombramiento está fuera de tu alcance' using errcode='42501';
  end if;

  if v_unit_id is not null
     and not (
       public.current_user_has_permission('appointments.create_proposal')
       and public.current_user_has_scope_access('organization_unit',v_unit_id,null,null,v_unit_id)
     )
     and not public.current_user_is_super_or_national() then
    raise exception 'La unidad organizativa del nombramiento está fuera de tu alcance' using errcode='42501';
  end if;

  if v_predecessor_id is not null then
    select pa.ecclesiastical_entity_id,pa.organization_unit_id
      into v_related_entity_id,v_related_unit_id
    from public.position_assignments pa
    where pa.id=v_predecessor_id;

    if v_related_entity_id is not null
       and not app_private.current_user_can_manage_entity('appointments.create_proposal',v_related_entity_id) then
      raise exception 'El nombramiento predecesor está fuera de tu alcance' using errcode='42501';
    end if;

    if v_related_unit_id is not null
       and not public.current_user_has_scope_access('organization_unit',v_related_unit_id,null,null,v_related_unit_id)
       and not public.current_user_is_super_or_national() then
      raise exception 'La unidad del nombramiento predecesor está fuera de tu alcance' using errcode='42501';
    end if;
  end if;

  if v_successor_id is not null then
    select pa.ecclesiastical_entity_id,pa.organization_unit_id
      into v_related_entity_id,v_related_unit_id
    from public.position_assignments pa
    where pa.id=v_successor_id;

    if v_related_entity_id is not null
       and not app_private.current_user_can_manage_entity('appointments.create_proposal',v_related_entity_id) then
      raise exception 'El nombramiento sucesor está fuera de tu alcance' using errcode='42501';
    end if;

    if v_related_unit_id is not null
       and not public.current_user_has_scope_access('organization_unit',v_related_unit_id,null,null,v_related_unit_id)
       and not public.current_user_is_super_or_national() then
      raise exception 'La unidad del nombramiento sucesor está fuera de tu alcance' using errcode='42501';
    end if;
  end if;

  v_result:=internal.admin_save_position_assignment(payload);
  v_assignment_id:=app_private.audit_json_uuid(v_result,'assignment_id');
  select to_jsonb(pa) into v_new
  from public.position_assignments pa
  where pa.id=v_assignment_id;

  perform public.create_audit_log(
    auth.uid(),
    'appointments.assignment.created',
    'position_assignments',
    v_assignment_id,
    null,
    jsonb_build_object(
      'scope_entity_id',v_entity_id,
      'organization_unit_id',v_unit_id,
      'record',v_new,
      'result',v_result
    ),
    app_private.audit_json_uuid(payload,'change_request_id')
  );

  return v_result;
end;
$function$;

create or replace function internal.lock_position_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path to 'public','internal','pg_temp'
as $function$
declare
  v_lock_key bigint;
begin
  if not new.is_current
     or new.record_status<>'active'
     or new.assignment_status in ('ended','replaced','suspended') then
    return new;
  end if;

  v_lock_key:=hashtextextended(
    concat_ws('|',
      new.office_configuration_id::text,
      coalesce(new.organization_chart_id::text,'00000000-0000-0000-0000-000000000000'),
      coalesce(new.organization_unit_id::text,'00000000-0000-0000-0000-000000000000'),
      coalesce(new.ecclesiastical_entity_id::text,'00000000-0000-0000-0000-000000000000')
    ),
    0
  );

  perform pg_advisory_xact_lock(v_lock_key);
  return new;
end;
$function$;

-- Remove the duplicate scope from assignment business functions while preserving
-- cardinality, succession and automatic closure rules.
do $migration$
declare
  v_oid oid;
  v_def text;
begin
  select p.oid into v_oid
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='internal'
    and p.proname='admin_save_position_assignment'
    and pg_get_function_identity_arguments(p.oid)='payload jsonb';

  v_def:=pg_get_functiondef(v_oid);
  v_def:=regexp_replace(
    v_def,
    E'\n  v_pastoral_entity_id uuid := nullif\(payload->>''pastoral_entity_id'',''''\)::uuid;',
    '',
    'g'
  );
  v_def:=regexp_replace(
    v_def,
    E'\n      and pa\.pastoral_entity_id is not distinct from v_pastoral_entity_id',
    '',
    'g'
  );
  v_def:=replace(
    v_def,
    'ecclesiastical_entity_id,pastoral_entity_id,title_override,start_date',
    'ecclesiastical_entity_id,title_override,start_date'
  );
  v_def:=replace(
    v_def,
    'v_ecclesiastical_entity_id,v_pastoral_entity_id,nullif(btrim(payload->>''title_override''),''''),v_start_date',
    'v_ecclesiastical_entity_id,nullif(btrim(payload->>''title_override''),''''),v_start_date'
  );
  execute v_def;

  select p.oid into v_oid
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='internal'
    and p.proname='prepare_position_assignment_cardinality'
    and pg_get_function_identity_arguments(p.oid)='';

  v_def:=pg_get_functiondef(v_oid);
  v_def:=regexp_replace(
    v_def,
    E'\n      and pastoral_entity_id is not distinct from new\.pastoral_entity_id',
    '',
    'g'
  );
  v_def:=regexp_replace(
    v_def,
    E'\n      and pa\.pastoral_entity_id is not distinct from new\.pastoral_entity_id',
    '',
    'g'
  );
  execute v_def;

  select p.oid into v_oid
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='internal'
    and p.proname='admin_mark_person_deceased'
    and pg_get_function_identity_arguments(p.oid)='payload jsonb';

  v_def:=pg_get_functiondef(v_oid);
  v_def:=regexp_replace(v_def,E'\n\s*pa\.pastoral_entity_id,','','g');
  v_def:=regexp_replace(v_def,E'\n\s*pastoral_entity_id,','','g');
  v_def:=regexp_replace(v_def,E'\n\s*v_assignment\.pastoral_entity_id,','','g');
  execute v_def;
end;
$migration$;

-- Replace old constraints and indexes with canonical organization-unit scopes.
alter table public.appointments drop constraint if exists chk_appointment_has_target;
alter table public.movements drop constraint if exists chk_movement_has_target;

alter table public.appointments drop constraint if exists fk_appointments_pastoral_entity;
alter table public.change_requests drop constraint if exists change_requests_pastoral_entity_id_fkey;
alter table public.commemorative_events drop constraint if exists commemorative_events_related_pastoral_entity_id_fkey;
alter table public.documents drop constraint if exists documents_related_pastoral_entity_id_fkey;
alter table public.event_occurrences drop constraint if exists event_occurrences_related_pastoral_entity_id_fkey;
alter table public.event_reminders drop constraint if exists event_reminders_pastoral_entity_id_fkey;
alter table public.movements drop constraint if exists fk_movements_pastoral_entity;
alter table public.organization_units drop constraint if exists organization_units_pastoral_entity_id_fkey;
alter table public.position_assignments drop constraint if exists position_assignments_pastoral_entity_id_fkey;
alter table public.structure_nodes drop constraint if exists structure_nodes_linked_pastoral_entity_id_fkey;
alter table public.user_role_assignments drop constraint if exists fk_user_role_assignments_pastoral_entity;

drop index if exists public.uq_current_appointment_person_office_entity;
drop index if exists public.position_assignments_current_scope_idx;
drop index if exists public.user_role_assignments_one_active_scope_idx;

alter table public.appointments
  add constraint chk_appointment_has_target
  check (entity_id is not null or organization_unit_id is not null);

alter table public.movements
  add constraint chk_movement_has_target
  check (person_id is not null or entity_id is not null or organization_unit_id is not null);

create unique index uq_current_appointment_person_office_entity
  on public.appointments(person_id,office_id,entity_id)
  where is_current=true and entity_id is not null and organization_unit_id is null;

create unique index uq_current_appointment_person_office_unit
  on public.appointments(person_id,office_id,organization_unit_id)
  where is_current=true and organization_unit_id is not null and entity_id is null;

create index position_assignments_current_scope_idx
  on public.position_assignments(
    office_configuration_id,
    coalesce(organization_chart_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(organization_unit_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(ecclesiastical_entity_id,'00000000-0000-0000-0000-000000000000'::uuid)
  )
  where is_current=true and record_status='active';

create unique index user_role_assignments_one_active_scope_idx
  on public.user_role_assignments(
    user_id,role_id,scope_type,scope_entity_id,diocese_id,pastoral_area_id,organization_unit_id
  ) nulls not distinct
  where status='active';

-- Remove every legacy reference physically. No compatibility columns remain.
alter table public.appointments drop column pastoral_entity_id;
alter table public.audit_logs drop column pastoral_entity_id;
alter table public.change_requests drop column pastoral_entity_id;
alter table public.commemorative_events drop column related_pastoral_entity_id;
alter table public.documents drop column related_pastoral_entity_id;
alter table public.event_occurrences drop column related_pastoral_entity_id;
alter table public.event_reminders drop column pastoral_entity_id;
alter table public.movements drop column pastoral_entity_id;
alter table public.organization_units drop column pastoral_entity_id;
alter table public.position_assignments drop column pastoral_entity_id;
alter table public.structure_nodes drop column linked_pastoral_entity_id;
alter table public.user_role_assignments drop column pastoral_entity_id;

drop table public.pastoral_entities;
