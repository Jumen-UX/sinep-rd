drop function if exists public.admin_get_person_detail(uuid);
drop function if exists public.admin_list_people(text,integer);
drop function if exists app_private.admin_get_person_detail(uuid);
drop function if exists app_private.admin_list_people(text,integer);

create function app_private.admin_get_person_detail(p_person_id uuid)
returns table(
  person_id uuid,
  display_name text,
  person_type text,
  status text,
  visibility text,
  birth_date date,
  birth_place text,
  death_date date,
  photo_url text,
  biography_public text,
  current_entity_id uuid,
  current_entity_name text,
  current_organization_unit_id uuid,
  current_organization_unit_name text,
  incardination_entity_id uuid,
  incardination_entity_name text,
  priest_type text,
  deacon_type text,
  canonical_status text,
  religious_institute_name text,
  can_update_proposal boolean,
  can_approve boolean
)
language plpgsql
stable security definer
set search_path to 'public','auth','pg_temp'
as $function$
begin
  if auth.uid() is null or not app_private.current_user_has_permission('people.view') then
    raise exception 'No autorizado para consultar personas' using errcode='42501';
  end if;

  return query
  with current_assignment as (
    select distinct on (a.person_id)
      a.person_id,
      a.entity_id,
      a.organization_unit_id
    from public.appointments a
    where a.person_id=p_person_id
      and a.status='active'
      and a.is_current=true
      and (a.visibility is null or a.visibility<>'private')
    order by a.person_id,a.start_date desc nulls last,a.created_at desc
  ), person_context as (
    select
      p.*,
      cp.current_service_entity_id,
      cp.incardination_entity_id,
      cp.religious_house_entity_id,
      cp.priest_type,
      cp.deacon_type,
      cp.canonical_status,
      cp.religious_institute_name,
      ca.entity_id as appointment_entity_id,
      ca.organization_unit_id as appointment_organization_unit_id,
      coalesce(ca.entity_id,cp.current_service_entity_id,cp.religious_house_entity_id) as effective_entity_id,
      ca.organization_unit_id as effective_organization_unit_id
    from public.persons p
    left join public.clergy_profiles cp on cp.person_id=p.id
    left join current_assignment ca on ca.person_id=p.id
    where p.id=p_person_id
      and (p.status is null or p.status not in ('deleted','archived'))
      and (p.visibility is null or p.visibility<>'private')
  )
  select
    pc.id,
    coalesce(nullif(pc.display_name,''),btrim(concat_ws(' ',pc.first_name,pc.middle_name,pc.last_name,pc.second_last_name))),
    pc.person_type,
    pc.status,
    pc.visibility,
    pc.birth_date,
    pc.birth_place,
    pc.death_date,
    pc.photo_url,
    pc.biography_public,
    pc.effective_entity_id,
    current_entity.name,
    pc.effective_organization_unit_id,
    current_unit.name,
    pc.incardination_entity_id,
    incardination.name,
    pc.priest_type,
    pc.deacon_type,
    pc.canonical_status,
    pc.religious_institute_name,
    (
      app_private.current_user_can('people.update_proposal','national')
      or app_private.current_user_can('people.update_proposal','parish',pc.effective_entity_id)
      or app_private.current_user_can('people.update_proposal','parish',pc.incardination_entity_id)
      or app_private.current_user_can('people.update_proposal','organization_unit',pc.effective_organization_unit_id)
    ),
    (
      app_private.current_user_can('people.approve','national')
      or app_private.current_user_can('people.approve','parish',pc.effective_entity_id)
      or app_private.current_user_can('people.approve','parish',pc.incardination_entity_id)
      or app_private.current_user_can('people.approve','organization_unit',pc.effective_organization_unit_id)
    )
  from person_context pc
  left join public.ecclesiastical_entities current_entity on current_entity.id=pc.effective_entity_id
  left join public.organization_units current_unit on current_unit.id=pc.effective_organization_unit_id
  left join public.ecclesiastical_entities incardination on incardination.id=pc.incardination_entity_id
  where
    app_private.current_user_can('people.view','national')
    or app_private.current_user_can('people.view','parish',pc.effective_entity_id)
    or app_private.current_user_can('people.view','parish',pc.incardination_entity_id)
    or app_private.current_user_can('people.view','organization_unit',pc.effective_organization_unit_id);
end;
$function$;

create function public.admin_get_person_detail(p_person_id uuid)
returns table(
  person_id uuid,
  display_name text,
  person_type text,
  status text,
  visibility text,
  birth_date date,
  birth_place text,
  death_date date,
  photo_url text,
  biography_public text,
  current_entity_id uuid,
  current_entity_name text,
  current_organization_unit_id uuid,
  current_organization_unit_name text,
  incardination_entity_id uuid,
  incardination_entity_name text,
  priest_type text,
  deacon_type text,
  canonical_status text,
  religious_institute_name text,
  can_update_proposal boolean,
  can_approve boolean
)
language sql
stable
set search_path to 'public','app_private','pg_temp'
as $function$
  select * from app_private.admin_get_person_detail(p_person_id);
$function$;

revoke all on function public.admin_get_person_detail(uuid) from public,anon;
grant execute on function public.admin_get_person_detail(uuid) to authenticated;

create function app_private.admin_list_people(p_search text default null,p_limit integer default 120)
returns table(
  person_id uuid,
  display_name text,
  person_type text,
  status text,
  visibility text,
  current_entity_id uuid,
  current_entity_name text,
  current_organization_unit_id uuid,
  current_organization_unit_name text,
  incardination_entity_id uuid,
  incardination_entity_name text,
  updated_at timestamptz
)
language plpgsql
stable security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit,120),1),250);
  v_search text := nullif(btrim(p_search),'');
begin
  if auth.uid() is null or not app_private.current_user_has_permission('people.view') then
    raise exception 'No autorizado para consultar personas' using errcode='42501';
  end if;

  return query
  with current_assignments as (
    select distinct on (a.person_id)
      a.person_id,
      a.entity_id,
      a.organization_unit_id
    from public.appointments a
    where a.status='active'
      and a.is_current=true
      and (a.visibility is null or a.visibility<>'private')
    order by a.person_id,a.start_date desc nulls last,a.created_at desc
  )
  select
    p.id,
    coalesce(nullif(p.display_name,''),btrim(concat_ws(' ',p.first_name,p.middle_name,p.last_name,p.second_last_name))),
    p.person_type,
    p.status,
    p.visibility,
    coalesce(ca.entity_id,cp.current_service_entity_id,cp.religious_house_entity_id),
    current_entity.name,
    ca.organization_unit_id,
    current_unit.name,
    cp.incardination_entity_id,
    incardination.name,
    p.updated_at
  from public.persons p
  left join public.clergy_profiles cp on cp.person_id=p.id
  left join current_assignments ca on ca.person_id=p.id
  left join public.ecclesiastical_entities current_entity on current_entity.id=coalesce(ca.entity_id,cp.current_service_entity_id,cp.religious_house_entity_id)
  left join public.organization_units current_unit on current_unit.id=ca.organization_unit_id
  left join public.ecclesiastical_entities incardination on incardination.id=cp.incardination_entity_id
  where (p.status is null or p.status not in ('deleted','archived'))
    and (p.visibility is null or p.visibility<>'private')
    and (
      v_search is null
      or p.display_name ilike '%'||v_search||'%'
      or p.first_name ilike '%'||v_search||'%'
      or p.last_name ilike '%'||v_search||'%'
      or p.person_type ilike '%'||v_search||'%'
      or current_entity.name ilike '%'||v_search||'%'
      or current_unit.name ilike '%'||v_search||'%'
      or incardination.name ilike '%'||v_search||'%'
    )
    and (
      app_private.current_user_can('people.view','national')
      or app_private.current_user_can('people.view','parish',ca.entity_id)
      or app_private.current_user_can('people.view','parish',cp.current_service_entity_id)
      or app_private.current_user_can('people.view','parish',cp.incardination_entity_id)
      or app_private.current_user_can('people.view','organization_unit',ca.organization_unit_id)
    )
  order by 2 asc nulls last,p.updated_at desc
  limit v_limit;
end;
$function$;

create function public.admin_list_people(p_search text default null,p_limit integer default 120)
returns table(
  person_id uuid,
  display_name text,
  person_type text,
  status text,
  visibility text,
  current_entity_id uuid,
  current_entity_name text,
  current_organization_unit_id uuid,
  current_organization_unit_name text,
  incardination_entity_id uuid,
  incardination_entity_name text,
  updated_at timestamptz
)
language sql
stable
set search_path to 'public','app_private','pg_temp'
as $function$
  select * from app_private.admin_list_people(p_search,p_limit);
$function$;

revoke all on function public.admin_list_people(text,integer) from public,anon;
grant execute on function public.admin_list_people(text,integer) to authenticated;
