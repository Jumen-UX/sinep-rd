-- Consolidate all authorization and audit scope onto organization_units before
-- removing the previous functional-organization model.

update public.user_role_assignments
set organization_unit_id = coalesce(organization_unit_id, pastoral_entity_id),
    scope_type = case when scope_type = 'pastoral_entity' then 'organization_unit' else scope_type end
where pastoral_entity_id is not null or scope_type = 'pastoral_entity';

update public.audit_logs
set organization_unit_id = coalesce(organization_unit_id, pastoral_entity_id),
    scope_type = case when scope_type = 'pastoral_entity' then 'organization_unit' else scope_type end
where pastoral_entity_id is not null or scope_type = 'pastoral_entity';

update public.change_requests
set organization_unit_id = coalesce(organization_unit_id, pastoral_entity_id),
    scope_type = case when scope_type = 'pastoral_entity' then 'organization_unit' else scope_type end
where pastoral_entity_id is not null or scope_type = 'pastoral_entity';

drop policy if exists audit_logs_select_allowed on public.audit_logs;

drop function if exists public.current_user_can(text,text,uuid,uuid,uuid,uuid);
drop function if exists public.current_user_has_scope_access(text,uuid,uuid,uuid,uuid);
drop function if exists app_private.current_user_can(text,text,uuid,uuid,uuid,uuid);
drop function if exists app_private.current_user_has_scope_access(text,uuid,uuid,uuid,uuid);

create function app_private.current_user_has_scope_access(
  p_scope_type text,
  p_scope_entity_id uuid default null,
  p_diocese_id uuid default null,
  p_pastoral_area_id uuid default null,
  p_organization_unit_id uuid default null
)
returns boolean
language plpgsql
stable security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_target_scope_type text := nullif(p_scope_type,'');
  v_target_scope_entity_id uuid := p_scope_entity_id;
  v_target_diocese_id uuid := p_diocese_id;
  v_target_pastoral_area_id uuid := p_pastoral_area_id;
  v_target_organization_unit_id uuid := p_organization_unit_id;
  v_target_node_id uuid;
begin
  if v_user_id is null then return false; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user_id and p.status='active') then return false; end if;

  if exists(
    select 1
    from public.user_role_assignments ura
    where ura.user_id=v_user_id
      and ura.status='active'
      and ura.starts_at<=current_date
      and (ura.ends_at is null or ura.ends_at>=current_date)
      and ura.scope_type in ('global','national')
  ) then
    return true;
  end if;

  if v_target_scope_type='diocese' then
    v_target_diocese_id:=coalesce(v_target_diocese_id,v_target_scope_entity_id);
  elsif v_target_scope_type in ('vicariate','zone','entity') and v_target_scope_entity_id is not null then
    v_target_node_id:=v_target_scope_entity_id;
    select coalesce(v_target_diocese_id,sn.diocese_id)
      into v_target_diocese_id
    from public.structure_nodes sn
    where sn.id=v_target_scope_entity_id
    limit 1;
  elsif v_target_scope_type='parish' and v_target_scope_entity_id is not null then
    select sn.id,coalesce(v_target_diocese_id,sn.diocese_id)
      into v_target_node_id,v_target_diocese_id
    from public.structure_nodes sn
    where sn.linked_ecclesiastical_entity_id=v_target_scope_entity_id
      and sn.is_current=true
      and sn.status='active'
    limit 1;
  elsif v_target_scope_type='pastoral_area' then
    v_target_pastoral_area_id:=coalesce(v_target_pastoral_area_id,v_target_scope_entity_id);
  elsif v_target_scope_type='organization_unit' and v_target_scope_entity_id is not null then
    select coalesce(v_target_organization_unit_id,ou.id),
           coalesce(v_target_pastoral_area_id,ou.pastoral_area_id),
           coalesce(v_target_diocese_id,app_private.resolve_entity_diocese_id(ou.ecclesiastical_entity_id))
      into v_target_organization_unit_id,v_target_pastoral_area_id,v_target_diocese_id
    from public.organization_units ou
    where ou.id=v_target_scope_entity_id
    limit 1;
  end if;

  return exists(
    with recursive target_lineage as (
      select sn.id,sn.parent_node_id
      from public.structure_nodes sn
      where sn.id=v_target_node_id
      union all
      select parent.id,parent.parent_node_id
      from public.structure_nodes parent
      join target_lineage child on child.parent_node_id=parent.id
    ), unit_lineage as (
      select ou.id,ou.parent_unit_id
      from public.organization_units ou
      where ou.id=v_target_organization_unit_id
      union all
      select parent.id,parent.parent_unit_id
      from public.organization_units parent
      join unit_lineage child on child.parent_unit_id=parent.id
    )
    select 1
    from public.user_role_assignments ura
    where ura.user_id=v_user_id
      and ura.status='active'
      and ura.starts_at<=current_date
      and (ura.ends_at is null or ura.ends_at>=current_date)
      and (
        ura.scope_entity_id is not distinct from v_target_scope_entity_id
        or (ura.scope_type='diocese' and v_target_diocese_id is not null and ura.diocese_id is not distinct from v_target_diocese_id)
        or (ura.scope_type in ('vicariate','zone','entity') and v_target_node_id is not null and ura.scope_entity_id in (select id from target_lineage))
        or (ura.scope_type='parish' and v_target_scope_type='parish' and ura.scope_entity_id is not distinct from v_target_scope_entity_id)
        or (ura.scope_type='pastoral_area' and v_target_pastoral_area_id is not null and ura.pastoral_area_id is not distinct from v_target_pastoral_area_id)
        or (ura.scope_type='organization_unit' and v_target_organization_unit_id is not null and ura.organization_unit_id in (select id from unit_lineage))
      )
  );
end;
$function$;

create function app_private.current_user_can(
  p_permission_key text,
  p_scope_type text default 'national',
  p_scope_entity_id uuid default null,
  p_diocese_id uuid default null,
  p_pastoral_area_id uuid default null,
  p_organization_unit_id uuid default null
)
returns boolean
language sql
stable security definer
set search_path to 'public','auth','pg_temp'
as $function$
  select app_private.current_user_has_permission(p_permission_key)
    and app_private.current_user_has_scope_access(
      p_scope_type,p_scope_entity_id,p_diocese_id,p_pastoral_area_id,p_organization_unit_id
    );
$function$;

create function public.current_user_has_scope_access(
  p_scope_type text,
  p_scope_entity_id uuid default null,
  p_diocese_id uuid default null,
  p_pastoral_area_id uuid default null,
  p_organization_unit_id uuid default null
)
returns boolean
language sql
stable
set search_path to 'public','app_private','pg_temp'
as $function$
  select app_private.current_user_has_scope_access(
    p_scope_type,p_scope_entity_id,p_diocese_id,p_pastoral_area_id,p_organization_unit_id
  );
$function$;

create function public.current_user_can(
  p_permission_key text,
  p_scope_type text default 'national',
  p_scope_entity_id uuid default null,
  p_diocese_id uuid default null,
  p_pastoral_area_id uuid default null,
  p_organization_unit_id uuid default null
)
returns boolean
language sql
stable
set search_path to 'public','app_private','pg_temp'
as $function$
  select app_private.current_user_can(
    p_permission_key,p_scope_type,p_scope_entity_id,p_diocese_id,p_pastoral_area_id,p_organization_unit_id
  );
$function$;

revoke all on function public.current_user_has_scope_access(text,uuid,uuid,uuid,uuid) from public,anon;
revoke all on function public.current_user_can(text,text,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.current_user_has_scope_access(text,uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.current_user_can(text,text,uuid,uuid,uuid,uuid) to authenticated;

drop function if exists app_private.resolve_audit_scope(text,uuid,jsonb);

create function app_private.resolve_audit_scope(
  p_target_table text,
  p_target_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns table(
  resolved_scope_type text,
  resolved_scope_entity_id uuid,
  resolved_diocese_id uuid,
  resolved_pastoral_area_id uuid,
  resolved_organization_unit_id uuid
)
language plpgsql
stable security definer
set search_path to 'public','app_private','pg_temp'
as $function$
declare
  v_target_table text := lower(coalesce(nullif(btrim(p_target_table),''),'administrative_action'));
  v_scope_type text := nullif(btrim(coalesce(p_metadata,'{}'::jsonb)->>'scope_type'),'');
  v_scope_entity_id uuid := app_private.audit_json_uuid(p_metadata,'scope_entity_id');
  v_diocese_id uuid := app_private.audit_json_uuid(p_metadata,'diocese_id');
  v_pastoral_area_id uuid := app_private.audit_json_uuid(p_metadata,'pastoral_area_id');
  v_organization_unit_id uuid := app_private.audit_json_uuid(p_metadata,'organization_unit_id');
  v_batch_id uuid := app_private.audit_json_uuid(p_metadata,'batch_id');
  v_node_entity_id uuid;
  v_node_diocese_id uuid;
begin
  if v_target_table='import_batches' and p_target_id is not null then
    select coalesce(v_scope_entity_id,ib.scope_entity_id)
      into v_scope_entity_id
    from public.import_batches ib where ib.id=p_target_id;
  elsif v_target_table='position_assignments' and p_target_id is not null then
    select coalesce(v_scope_entity_id,pa.ecclesiastical_entity_id),
           coalesce(v_organization_unit_id,pa.organization_unit_id)
      into v_scope_entity_id,v_organization_unit_id
    from public.position_assignments pa where pa.id=p_target_id;
  elsif v_target_table='ecclesiastical_entities' and p_target_id is not null then
    v_scope_entity_id:=coalesce(v_scope_entity_id,p_target_id);
  elsif v_target_table='organization_units' and p_target_id is not null then
    v_organization_unit_id:=coalesce(v_organization_unit_id,p_target_id);
  elsif v_target_table='structure_nodes' and p_target_id is not null then
    select coalesce(v_scope_entity_id,sn.linked_ecclesiastical_entity_id,sn.diocese_id),
           coalesce(v_diocese_id,sn.diocese_id),
           coalesce(v_organization_unit_id,sn.linked_organization_unit_id)
      into v_scope_entity_id,v_diocese_id,v_organization_unit_id
    from public.structure_nodes sn where sn.id=p_target_id;
  elsif v_target_table='structure_templates' and p_target_id is not null then
    select coalesce(v_scope_entity_id,st.diocese_id),coalesce(v_diocese_id,st.diocese_id)
      into v_scope_entity_id,v_diocese_id
    from public.structure_templates st where st.id=p_target_id;
  elsif v_target_table='change_requests' and p_target_id is not null then
    select coalesce(v_scope_type,cr.scope_type),
           coalesce(v_scope_entity_id,cr.scope_entity_id,cr.diocese_id),
           coalesce(v_diocese_id,cr.diocese_id),
           coalesce(v_pastoral_area_id,cr.pastoral_area_id),
           coalesce(v_organization_unit_id,cr.organization_unit_id)
      into v_scope_type,v_scope_entity_id,v_diocese_id,v_pastoral_area_id,v_organization_unit_id
    from public.change_requests cr where cr.id=p_target_id;
  elsif v_target_table='canonical_events' and p_target_id is not null then
    select coalesce(v_scope_entity_id,ce.authority_entity_id)
      into v_scope_entity_id
    from public.canonical_events ce where ce.id=p_target_id;
  elsif v_target_table='user_role_assignments' and p_target_id is not null then
    select coalesce(v_scope_type,ura.scope_type),
           coalesce(v_scope_entity_id,ura.diocese_id,ura.scope_entity_id),
           coalesce(v_diocese_id,ura.diocese_id),
           coalesce(v_pastoral_area_id,ura.pastoral_area_id),
           coalesce(v_organization_unit_id,ura.organization_unit_id)
      into v_scope_type,v_scope_entity_id,v_diocese_id,v_pastoral_area_id,v_organization_unit_id
    from public.user_role_assignments ura where ura.id=p_target_id;
  elsif v_target_table='profiles' and p_target_id is not null then
    select coalesce(v_scope_type,ura.scope_type),
           coalesce(v_scope_entity_id,ura.diocese_id,ura.scope_entity_id),
           coalesce(v_diocese_id,ura.diocese_id),
           coalesce(v_pastoral_area_id,ura.pastoral_area_id),
           coalesce(v_organization_unit_id,ura.organization_unit_id)
      into v_scope_type,v_scope_entity_id,v_diocese_id,v_pastoral_area_id,v_organization_unit_id
    from public.user_role_assignments ura
    where ura.user_id=p_target_id
      and ura.status='active'
      and ura.starts_at<=current_date
      and (ura.ends_at is null or ura.ends_at>=current_date)
    order by ura.created_at desc
    limit 1;
  elsif v_target_table='persons' and p_target_id is not null then
    select coalesce(
      v_scope_entity_id,
      (select pa.ecclesiastical_entity_id from public.position_assignments pa where pa.person_id=p_target_id and pa.is_current=true and pa.record_status='active' and pa.ecclesiastical_entity_id is not null order by pa.updated_at desc limit 1),
      (select cp.current_service_entity_id from public.clergy_profiles cp where cp.person_id=p_target_id limit 1),
      (select cp.incardination_entity_id from public.clergy_profiles cp where cp.person_id=p_target_id limit 1)
    ) into v_scope_entity_id;
    select coalesce(
      v_organization_unit_id,
      (select pa.organization_unit_id from public.position_assignments pa where pa.person_id=p_target_id and pa.is_current=true and pa.record_status='active' and pa.organization_unit_id is not null order by pa.updated_at desc limit 1)
    ) into v_organization_unit_id;
  end if;

  if v_scope_entity_id is null and v_batch_id is not null then
    select ib.scope_entity_id into v_scope_entity_id
    from public.import_batches ib where ib.id=v_batch_id;
  end if;

  if v_organization_unit_id is not null then
    select coalesce(v_scope_entity_id,ou.ecclesiastical_entity_id),
           coalesce(v_diocese_id,app_private.resolve_entity_diocese_id(ou.ecclesiastical_entity_id)),
           coalesce(v_pastoral_area_id,ou.pastoral_area_id)
      into v_scope_entity_id,v_diocese_id,v_pastoral_area_id
    from public.organization_units ou where ou.id=v_organization_unit_id;
  end if;

  if v_scope_entity_id is not null
     and not exists(select 1 from public.ecclesiastical_entities ee where ee.id=v_scope_entity_id) then
    select sn.linked_ecclesiastical_entity_id,sn.diocese_id
      into v_node_entity_id,v_node_diocese_id
    from public.structure_nodes sn where sn.id=v_scope_entity_id limit 1;
    if v_node_entity_id is not null or v_node_diocese_id is not null then
      v_scope_entity_id:=coalesce(v_node_entity_id,v_node_diocese_id);
      v_diocese_id:=coalesce(v_diocese_id,v_node_diocese_id);
    end if;
  end if;

  if v_scope_entity_id is not null then
    v_diocese_id:=coalesce(v_diocese_id,app_private.resolve_entity_diocese_id(v_scope_entity_id));
  end if;
  v_scope_entity_id:=coalesce(v_scope_entity_id,v_diocese_id);

  if v_organization_unit_id is not null then
    v_scope_type:='organization_unit';
  elsif v_pastoral_area_id is not null and v_scope_entity_id is null then
    v_scope_type:='pastoral_area';
  elsif v_scope_entity_id is not null and v_diocese_id is not null and v_scope_entity_id=v_diocese_id then
    v_scope_type:='diocese';
  elsif v_scope_entity_id is not null then
    v_scope_type:=case when v_scope_type in ('vicariate','zone','parish','entity') then v_scope_type else 'entity' end;
  elsif v_scope_type not in ('global','national') then
    v_scope_type:='unknown';
  end if;

  return query
  select v_scope_type,v_scope_entity_id,v_diocese_id,v_pastoral_area_id,v_organization_unit_id;
end;
$function$;

create or replace function app_private.review_record_scope_entity(p_record_table text,p_record_id uuid)
returns uuid
language plpgsql
stable security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_entity_id uuid;
begin
  if p_record_id is null then return null; end if;

  case p_record_table
    when 'ecclesiastical_entities' then
      v_entity_id:=p_record_id;
    when 'persons' then
      select coalesce(cp.current_service_entity_id,cp.incardination_entity_id,pa.ecclesiastical_entity_id)
        into v_entity_id
      from public.persons person_row
      left join public.clergy_profiles cp on cp.person_id=person_row.id
      left join public.position_assignments pa on pa.person_id=person_row.id and pa.is_current=true and pa.record_status='active'
      where person_row.id=p_record_id
      order by pa.updated_at desc nulls last
      limit 1;
    when 'clergy_profiles' then
      select coalesce(cp.current_service_entity_id,cp.incardination_entity_id,pa.ecclesiastical_entity_id)
        into v_entity_id
      from public.clergy_profiles cp
      left join public.position_assignments pa on pa.person_id=cp.person_id and pa.is_current=true and pa.record_status='active'
      where cp.id=p_record_id
      order by pa.updated_at desc nulls last
      limit 1;
    when 'religious_profiles' then
      select coalesce(rp.current_service_entity_id,pa.ecclesiastical_entity_id)
        into v_entity_id
      from public.religious_profiles rp
      left join public.position_assignments pa on pa.person_id=rp.person_id and pa.is_current=true and pa.record_status='active'
      where rp.id=p_record_id
      order by pa.updated_at desc nulls last
      limit 1;
    when 'position_assignments' then
      select coalesce(pa.ecclesiastical_entity_id,ou.ecclesiastical_entity_id)
        into v_entity_id
      from public.position_assignments pa
      left join public.organization_units ou on ou.id=pa.organization_unit_id
      where pa.id=p_record_id;
    when 'structure_templates' then
      select st.diocese_id into v_entity_id
      from public.structure_templates st where st.id=p_record_id;
    when 'structure_levels' then
      select st.diocese_id into v_entity_id
      from public.structure_levels sl
      join public.structure_templates st on st.id=sl.template_id
      where sl.id=p_record_id;
    when 'structure_nodes' then
      select sn.diocese_id into v_entity_id
      from public.structure_nodes sn where sn.id=p_record_id;
    when 'organization_units' then
      select ou.ecclesiastical_entity_id into v_entity_id
      from public.organization_units ou where ou.id=p_record_id;
    else
      v_entity_id:=null;
  end case;

  return v_entity_id;
end;
$function$;

create policy audit_logs_select_allowed
on public.audit_logs
for select
to authenticated
using (
  app_private.current_user_is_super_or_national()
  or (
    app_private.current_user_has_permission('audit.view')
    and scope_entity_id is not null
    and app_private.current_user_can_manage_entity('audit.view',scope_entity_id)
  )
  or (
    app_private.current_user_has_permission('audit.view')
    and scope_type='organization_unit'
    and app_private.current_user_has_scope_access(
      'organization_unit',organization_unit_id,diocese_id,pastoral_area_id,organization_unit_id
    )
  )
  or (
    app_private.current_user_has_permission('audit.view')
    and scope_type='pastoral_area'
    and app_private.current_user_has_scope_access(
      'pastoral_area',pastoral_area_id,diocese_id,pastoral_area_id,null
    )
  )
);
