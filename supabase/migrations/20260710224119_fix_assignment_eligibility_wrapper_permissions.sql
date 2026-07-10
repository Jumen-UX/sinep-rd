create or replace function public.admin_check_position_assignment_eligibility(
  p_person_id uuid,
  p_office_configuration_id uuid,
  p_ecclesiastical_entity_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, internal, pg_temp
as $$
begin
  if auth.uid() is null
     or (
       not public.current_user_has_permission('appointments.create_proposal')
       and not public.current_user_is_super_or_national()
     ) then
    raise exception 'No autorizado para consultar elegibilidad de cargos' using errcode = '42501';
  end if;

  return internal.evaluate_position_assignment_eligibility(
    p_person_id,p_office_configuration_id,p_ecclesiastical_entity_id,null,true
  );
end;
$$;

revoke all on function public.admin_check_position_assignment_eligibility(uuid,uuid,uuid) from public, anon;
grant execute on function public.admin_check_position_assignment_eligibility(uuid,uuid,uuid) to authenticated;
