create or replace function app_private.current_user_can_publish_assignment_person(p_assignment_id uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
declare
  v_assignment public.position_assignments%rowtype;
begin
  if auth.uid() is null or p_assignment_id is null then
    return false;
  end if;

  select * into v_assignment
  from public.position_assignments
  where id=p_assignment_id;

  if not found or v_assignment.person_id is null then
    return false;
  end if;

  if v_assignment.ecclesiastical_entity_id is not null then
    return app_private.current_user_can_manage_entity(
      'people.publish',
      v_assignment.ecclesiastical_entity_id
    );
  end if;

  if v_assignment.organization_unit_id is not null then
    return public.current_user_has_permission('people.publish')
       and public.current_user_has_scope_access(
         'organization_unit',
         v_assignment.organization_unit_id,
         null,
         null,
         v_assignment.organization_unit_id
       );
  end if;

  return public.current_user_is_super_or_national()
     and public.current_user_has_permission('people.publish');
end;
$function$;

create or replace function app_private.admin_list_recent_audit_logs(p_limit integer default 100)
returns table(
  id uuid,
  actor_user_id uuid,
  actor_email text,
  actor_name text,
  action text,
  target_table text,
  target_id uuid,
  change_request_id uuid,
  created_at timestamptz
)
language plpgsql
stable security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
begin
  if auth.uid() is null or not (
    app_private.current_user_has_permission('audit.view')
    or app_private.current_user_has_permission('security.view')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para ver auditoría' using errcode='42501';
  end if;

  return query
  select
    al.id,
    al.user_id,
    p.email::text,
    p.full_name::text,
    al.action,
    al.target_table,
    al.target_id,
    al.change_request_id,
    al.created_at
  from public.audit_logs al
  left join public.profiles p on p.id=al.user_id
  where app_private.current_user_is_super_or_national()
     or (
       al.scope_entity_id is not null
       and app_private.current_user_can_manage_entity('audit.view',al.scope_entity_id)
     )
     or (
       al.scope_type='organization_unit'
       and app_private.current_user_has_scope_access(
         'organization_unit',
         al.organization_unit_id,
         al.diocese_id,
         al.pastoral_area_id,
         al.organization_unit_id
       )
     )
     or (
       al.scope_type='pastoral_area'
       and app_private.current_user_has_scope_access(
         'pastoral_area',
         al.pastoral_area_id,
         al.diocese_id,
         al.pastoral_area_id,
         null
       )
     )
  order by al.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),250));
end;
$function$;

drop policy if exists audit_logs_select_allowed on public.audit_logs;

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
      'organization_unit',
      organization_unit_id,
      diocese_id,
      pastoral_area_id,
      organization_unit_id
    )
  )
  or (
    app_private.current_user_has_permission('audit.view')
    and scope_type='pastoral_area'
    and app_private.current_user_has_scope_access(
      'pastoral_area',
      pastoral_area_id,
      diocese_id,
      pastoral_area_id,
      null
    )
  )
);
