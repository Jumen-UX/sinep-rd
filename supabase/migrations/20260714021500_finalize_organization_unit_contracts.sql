-- Final public/admin contracts after the legacy model has been removed.

drop function if exists public.admin_get_change_request_detail(uuid);
drop function if exists app_private.rpc_definer__admin_get_change_request_detail(uuid);
drop function if exists app_private.admin_get_change_request_detail(uuid);

create function app_private.admin_get_change_request_detail(p_change_request_id uuid)
returns table(
  id uuid,
  target_table text,
  target_id uuid,
  action_type text,
  title text,
  description text,
  original_data jsonb,
  proposed_data jsonb,
  status text,
  scope_type text,
  scope_entity_id uuid,
  diocese_id uuid,
  pastoral_area_id uuid,
  organization_unit_id uuid,
  submitted_by_name text,
  submitted_by_email text,
  submitted_at timestamptz,
  created_at timestamptz,
  can_review boolean
)
language plpgsql
stable security definer
set search_path to 'public','auth','pg_temp'
as $function$
begin
  if auth.uid() is null or not app_private.current_user_has_permission('change_requests.view') then
    raise exception 'No autorizado para consultar solicitudes' using errcode='42501';
  end if;

  return query
  select
    cr.id,
    cr.target_table,
    cr.target_id,
    cr.action_type,
    cr.title,
    cr.description,
    cr.original_data,
    cr.proposed_data,
    cr.status,
    cr.scope_type,
    cr.scope_entity_id,
    cr.diocese_id,
    cr.pastoral_area_id,
    cr.organization_unit_id,
    p.full_name,
    p.email,
    cr.submitted_at,
    cr.created_at,
    case
      when cr.target_table='persons' then
        app_private.current_user_can('people.approve','national')
        or app_private.current_user_can(
          'people.approve',
          coalesce(cr.scope_type,'national'),
          cr.scope_entity_id,
          cr.diocese_id,
          cr.pastoral_area_id,
          cr.organization_unit_id
        )
      else
        app_private.current_user_can('change_requests.approve','national')
        or app_private.current_user_can(
          'change_requests.approve',
          coalesce(cr.scope_type,'national'),
          cr.scope_entity_id,
          cr.diocese_id,
          cr.pastoral_area_id,
          cr.organization_unit_id
        )
    end
  from public.change_requests cr
  left join public.profiles p on p.id=cr.submitted_by
  where cr.id=p_change_request_id
    and (
      app_private.current_user_can('change_requests.view','national')
      or app_private.current_user_can(
        'change_requests.view',
        coalesce(cr.scope_type,'national'),
        cr.scope_entity_id,
        cr.diocese_id,
        cr.pastoral_area_id,
        cr.organization_unit_id
      )
      or cr.submitted_by=auth.uid()
    )
  limit 1;
end;
$function$;

create function app_private.rpc_definer__admin_get_change_request_detail(p_change_request_id uuid)
returns table(
  id uuid,
  target_table text,
  target_id uuid,
  action_type text,
  title text,
  description text,
  original_data jsonb,
  proposed_data jsonb,
  status text,
  scope_type text,
  scope_entity_id uuid,
  diocese_id uuid,
  pastoral_area_id uuid,
  organization_unit_id uuid,
  submitted_by_name text,
  submitted_by_email text,
  submitted_at timestamptz,
  created_at timestamptz,
  can_review boolean
)
language sql
stable security definer
set search_path to 'public','app_private','pg_temp'
as $function$
  select * from app_private.admin_get_change_request_detail(p_change_request_id);
$function$;

grant execute on function app_private.rpc_definer__admin_get_change_request_detail(uuid)
to authenticated,service_role;

create function public.admin_get_change_request_detail(p_change_request_id uuid)
returns table(
  id uuid,
  target_table text,
  target_id uuid,
  action_type text,
  title text,
  description text,
  original_data jsonb,
  proposed_data jsonb,
  status text,
  scope_type text,
  scope_entity_id uuid,
  diocese_id uuid,
  pastoral_area_id uuid,
  organization_unit_id uuid,
  submitted_by_name text,
  submitted_by_email text,
  submitted_at timestamptz,
  created_at timestamptz,
  can_review boolean
)
language sql
stable
set search_path to 'pg_catalog','public','app_private','auth','pg_temp'
as $function$
  select * from app_private.rpc_definer__admin_get_change_request_detail(p_change_request_id);
$function$;

revoke all on function public.admin_get_change_request_detail(uuid) from public,anon;
grant execute on function public.admin_get_change_request_detail(uuid) to authenticated,service_role;

drop function if exists public.get_structure_selector_options(uuid,uuid,uuid,text,date);

create function public.get_structure_selector_options(
  p_diocese_id uuid,
  p_template_id uuid default null,
  p_parent_node_id uuid default null,
  p_kind_key text default null,
  p_as_of date default current_date
)
returns table(
  node_id uuid,
  template_id uuid,
  template_name text,
  kind_key text,
  level_id uuid,
  level_key text,
  level_name text,
  parent_node_id uuid,
  name text,
  official_name text,
  slug text,
  linked_ecclesiastical_entity_id uuid,
  linked_organization_unit_id uuid,
  has_children boolean
)
language sql
stable
set search_path to 'public','pg_temp'
as $function$
  select
    n.id,
    n.template_id,
    t.name,
    t.kind_key,
    n.level_id,
    l.level_key,
    l.name,
    n.parent_node_id,
    n.name,
    n.official_name,
    n.slug,
    n.linked_ecclesiastical_entity_id,
    n.linked_organization_unit_id,
    exists(
      select 1
      from public.structure_nodes c
      where c.parent_node_id=n.id
        and c.is_current
        and c.status='active'
        and c.start_date<=p_as_of
        and (c.end_date is null or c.end_date>=p_as_of)
    )
  from public.structure_nodes n
  join public.structure_templates t on t.id=n.template_id
  join public.structure_levels l on l.id=n.level_id
  where t.diocese_id=p_diocese_id
    and (p_template_id is null or t.id=p_template_id)
    and (p_kind_key is null or t.kind_key=p_kind_key)
    and (p_template_id is not null or (t.is_active and t.is_primary and t.status='active'))
    and ((p_parent_node_id is null and n.parent_node_id is null) or n.parent_node_id=p_parent_node_id)
    and n.is_current
    and n.status='active'
    and n.start_date<=p_as_of
    and (n.end_date is null or n.end_date>=p_as_of)
  order by l.level_order,n.name;
$function$;

grant execute on function public.get_structure_selector_options(uuid,uuid,uuid,text,date)
to public,anon,authenticated;

drop function if exists public.get_structure_tree(uuid,uuid,date,boolean);

create function public.get_structure_tree(
  p_template_id uuid,
  p_root_node_id uuid default null,
  p_as_of date default current_date,
  p_include_inactive boolean default false
)
returns table(
  node_id uuid,
  template_id uuid,
  level_id uuid,
  level_key text,
  level_name text,
  parent_node_id uuid,
  depth integer,
  path_ids uuid[],
  path_names text[],
  name text,
  official_name text,
  slug text,
  code text,
  linked_ecclesiastical_entity_id uuid,
  linked_organization_unit_id uuid,
  start_date date,
  end_date date,
  is_current boolean,
  status text,
  visibility text,
  has_children boolean
)
language sql
stable
set search_path to 'public','pg_temp'
as $function$
  with recursive tree as (
    select
      n.id as node_id,
      n.template_id,
      n.level_id,
      l.level_key,
      l.name as level_name,
      n.parent_node_id,
      0 as depth,
      array[n.id] as path_ids,
      array[n.name] as path_names,
      n.name,
      n.official_name,
      n.slug,
      n.code,
      n.linked_ecclesiastical_entity_id,
      n.linked_organization_unit_id,
      n.start_date,
      n.end_date,
      n.is_current,
      n.status,
      n.visibility
    from public.structure_nodes n
    join public.structure_levels l on l.id=n.level_id
    where n.template_id=p_template_id
      and ((p_root_node_id is null and n.parent_node_id is null) or n.id=p_root_node_id)
      and (p_include_inactive or (n.is_current and n.status='active'))
      and (p_include_inactive or (n.start_date<=p_as_of and (n.end_date is null or n.end_date>=p_as_of)))

    union all

    select
      c.id,
      c.template_id,
      c.level_id,
      cl.level_key,
      cl.name,
      c.parent_node_id,
      t.depth+1,
      t.path_ids||c.id,
      t.path_names||c.name,
      c.name,
      c.official_name,
      c.slug,
      c.code,
      c.linked_ecclesiastical_entity_id,
      c.linked_organization_unit_id,
      c.start_date,
      c.end_date,
      c.is_current,
      c.status,
      c.visibility
    from public.structure_nodes c
    join public.structure_levels cl on cl.id=c.level_id
    join tree t on t.node_id=c.parent_node_id
    where c.template_id=p_template_id
      and not c.id=any(t.path_ids)
      and (p_include_inactive or (c.is_current and c.status='active'))
      and (p_include_inactive or (c.start_date<=p_as_of and (c.end_date is null or c.end_date>=p_as_of)))
  )
  select
    t.node_id,
    t.template_id,
    t.level_id,
    t.level_key,
    t.level_name,
    t.parent_node_id,
    t.depth,
    t.path_ids,
    t.path_names,
    t.name,
    t.official_name,
    t.slug,
    t.code,
    t.linked_ecclesiastical_entity_id,
    t.linked_organization_unit_id,
    t.start_date,
    t.end_date,
    t.is_current,
    t.status,
    t.visibility,
    exists(
      select 1
      from public.structure_nodes c
      where c.parent_node_id=t.node_id
        and c.template_id=p_template_id
        and (p_include_inactive or (c.is_current and c.status='active'))
        and (p_include_inactive or (c.start_date<=p_as_of and (c.end_date is null or c.end_date>=p_as_of)))
    )
  from tree t
  order by t.path_names;
$function$;

revoke all on function public.get_structure_tree(uuid,uuid,date,boolean) from public;
grant execute on function public.get_structure_tree(uuid,uuid,date,boolean) to anon,authenticated;

drop view if exists public.public_organization_units;

create view public.public_organization_units
with (security_invoker = true)
as
select
  ou.id,
  ou.organization_chart_id,
  oc.key as organization_chart_key,
  oc.name as organization_chart_name,
  oc.sort_order as organization_chart_sort_order,
  ou.parent_unit_id,
  parent.name as parent_unit_name,
  parent.slug as parent_unit_slug,
  ou.ecclesiastical_entity_id,
  ee.name as ecclesiastical_entity_name,
  ee.slug as ecclesiastical_entity_slug,
  ou.pastoral_area_id,
  pa.name as pastoral_area_name,
  pa.slug as pastoral_area_slug,
  ou.key,
  ou.slug,
  ou.name,
  ou.description,
  ou.sort_order,
  ou.valid_from,
  ou.valid_to,
  ou.is_current,
  ou.visibility,
  ou.status,
  ou.created_at,
  ou.updated_at
from public.organization_units ou
join public.organization_charts oc on oc.id=ou.organization_chart_id
left join public.organization_units parent on parent.id=ou.parent_unit_id
left join public.ecclesiastical_entities ee on ee.id=ou.ecclesiastical_entity_id
left join public.pastoral_areas pa on pa.id=ou.pastoral_area_id
where ou.status='active'
  and ou.visibility='public'
  and ou.is_current=true
  and oc.status='active'
  and oc.visibility='public';

grant select on public.public_organization_units to anon,authenticated;
