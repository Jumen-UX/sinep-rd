begin;

create or replace function app_private.current_user_can_publish_assignment_person(
  p_assignment_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_assignment public.position_assignments%rowtype;
  v_scope_entity_id uuid;
begin
  if auth.uid() is null or p_assignment_id is null then
    return false;
  end if;

  select *
  into v_assignment
  from public.position_assignments assignment_row
  where assignment_row.id = p_assignment_id;

  if not found or v_assignment.person_id is null then
    return false;
  end if;

  v_scope_entity_id := app_private.review_record_scope_entity(
    'position_assignments',
    p_assignment_id
  );

  if v_scope_entity_id is not null then
    return app_private.current_user_can_manage_entity(
      'people.publish',
      v_scope_entity_id
    );
  end if;

  return app_private.current_user_has_role(array['super_admin'])
     and app_private.current_user_has_permission('people.publish');
end;
$$;

revoke all on function app_private.current_user_can_publish_assignment_person(uuid)
from public, anon, authenticated;

comment on function app_private.current_user_can_publish_assignment_person(uuid) is
  'Publishes a person only when the assignment resolves to a canonical entity within the actor country; unscoped assignments are super_admin-only.';

commit;
