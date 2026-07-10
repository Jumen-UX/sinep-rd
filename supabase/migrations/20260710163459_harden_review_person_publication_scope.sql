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
begin
  if auth.uid() is null or p_assignment_id is null then
    return false;
  end if;

  select * into v_assignment
  from public.position_assignments
  where id = p_assignment_id;

  if not found or v_assignment.person_id is null then
    return false;
  end if;

  if v_assignment.ecclesiastical_entity_id is not null then
    return app_private.current_user_can_manage_entity(
      'people.publish',
      v_assignment.ecclesiastical_entity_id
    );
  end if;

  if v_assignment.pastoral_entity_id is not null then
    return public.current_user_has_permission('people.publish')
       and public.current_user_has_scope_access(
         'pastoral_entity',
         v_assignment.pastoral_entity_id,
         null,
         null,
         v_assignment.pastoral_entity_id
       );
  end if;

  return public.current_user_is_super_or_national()
     and public.current_user_has_permission('people.publish');
end;
$$;

revoke all on function app_private.current_user_can_publish_assignment_person(uuid)
  from public, anon, authenticated;

create or replace function public.admin_review_item(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_item_type text := nullif(lower(btrim(payload->>'item_type')), '');
  v_decision text := nullif(lower(btrim(payload->>'decision')), '');
  v_publish_person boolean := coalesce((payload->>'publish_person')::boolean, false);
  v_assignment_id uuid := nullif(payload->>'record_id', '')::uuid;
begin
  if v_item_type = 'position_assignment'
     and v_decision = 'publish'
     and v_publish_person then
    if v_assignment_id is null
       or not app_private.current_user_can_publish_assignment_person(v_assignment_id) then
      raise exception 'No autorizado para publicar la ficha de la persona asociada.' using errcode = '42501';
    end if;
  end if;

  return app_private.admin_review_item(payload);
end;
$$;

create or replace function public.admin_review_imported_appointment(payload jsonb)
returns jsonb
language sql
set search_path = public, pg_temp
as $$
  select public.admin_review_item(
    jsonb_build_object(
      'item_type', 'position_assignment',
      'record_id', payload->>'assignment_id',
      'source_id', payload->>'assignment_id',
      'decision', payload->>'decision',
      'notes', payload->>'notes',
      'publish_person', coalesce(payload->'publish_person', 'false'::jsonb)
    )
  );
$$;

create or replace function public.admin_review_change_request(payload jsonb)
returns jsonb
language sql
set search_path = public, pg_temp
as $$
  select public.admin_review_item(
    jsonb_build_object(
      'item_type', 'change_request',
      'source_id', payload->>'change_request_id',
      'record_id', payload->>'target_id',
      'decision', payload->>'decision',
      'notes', coalesce(payload->>'review_notes', payload->>'notes')
    )
  );
$$;

revoke all on function app_private.admin_review_item(jsonb)
  from public, anon, authenticated;
revoke all on function public.admin_review_item(jsonb) from public, anon;
revoke all on function public.admin_review_imported_appointment(jsonb) from public, anon;
revoke all on function public.admin_review_change_request(jsonb) from public, anon;

grant execute on function public.admin_review_item(jsonb) to authenticated;
grant execute on function public.admin_review_imported_appointment(jsonb) to authenticated;
grant execute on function public.admin_review_change_request(jsonb) to authenticated;

comment on function public.admin_review_item(jsonb)
  is 'Security-definer review gateway. Delegates to the private review operation after enforcing person-publication scope.';

commit;
