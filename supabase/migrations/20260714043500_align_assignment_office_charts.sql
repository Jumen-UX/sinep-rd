begin;

create or replace function app_private.enforce_position_assignment_office_chart()
returns trigger
language plpgsql
set search_path = public, app_private, pg_temp
as $$
declare
  v_office_chart_id uuid;
begin
  select oc.organization_chart_id
  into v_office_chart_id
  from public.office_configurations oc
  where oc.id = new.office_configuration_id;

  if not found then
    raise exception 'El cargo configurado del nombramiento no existe.' using errcode = '23503';
  end if;

  if v_office_chart_id is not null then
    if new.organization_chart_id is null then
      new.organization_chart_id := v_office_chart_id;
    elsif new.organization_chart_id is distinct from v_office_chart_id then
      raise exception 'El organigrama del nombramiento no coincide con el organigrama configurado para el cargo.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_position_assignment_office_chart() from public, anon, authenticated;
grant execute on function app_private.enforce_position_assignment_office_chart() to service_role;

drop trigger if exists position_assignments_enforce_office_chart on public.position_assignments;
create trigger position_assignments_enforce_office_chart
before insert or update of office_configuration_id, organization_chart_id
on public.position_assignments
for each row
execute function app_private.enforce_position_assignment_office_chart();

update public.position_assignments pa
set organization_chart_id = oc.organization_chart_id,
    updated_at = now()
from public.office_configurations oc
where oc.id = pa.office_configuration_id
  and pa.organization_chart_id is null
  and oc.organization_chart_id is not null;

commit;
