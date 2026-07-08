-- Integrity: keep one current position assignment per configured office and entity scope.
-- This protects all write paths, including quick wizard assignments.

-- 1) Normalize any duplicated current assignments that may already exist.
with ranked_current_assignments as (
  select
    id,
    first_value(id) over (
      partition by
        office_configuration_id,
        organization_chart_id,
        organization_unit_id,
        ecclesiastical_entity_id,
        pastoral_entity_id
      order by
        start_date desc nulls last,
        term_start_date desc nulls last,
        id::text desc
    ) as kept_assignment_id,
    first_value(start_date) over (
      partition by
        office_configuration_id,
        organization_chart_id,
        organization_unit_id,
        ecclesiastical_entity_id,
        pastoral_entity_id
      order by
        start_date desc nulls last,
        term_start_date desc nulls last,
        id::text desc
    ) as kept_start_date,
    row_number() over (
      partition by
        office_configuration_id,
        organization_chart_id,
        organization_unit_id,
        ecclesiastical_entity_id,
        pastoral_entity_id
      order by
        start_date desc nulls last,
        term_start_date desc nulls last,
        id::text desc
    ) as rn
  from public.position_assignments
  where is_current = true
    and record_status = 'active'
)
update public.position_assignments pa
set is_current = false,
    assignment_status = case
      when pa.assignment_status in ('active', 'term_expired_still_serving', 'vacant') then 'replaced'
      else pa.assignment_status
    end,
    actual_end_date = coalesce(pa.actual_end_date, r.kept_start_date),
    replaced_by_assignment_id = coalesce(pa.replaced_by_assignment_id, r.kept_assignment_id),
    successor_assignment_id = coalesce(pa.successor_assignment_id, r.kept_assignment_id),
    updated_at = now()
from ranked_current_assignments r
where pa.id = r.id
  and r.rn > 1;

-- 2) Close previous current assignments before a new/current one is accepted.
create or replace function public.close_previous_current_position_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_current is distinct from true or coalesce(new.record_status, 'active') <> 'active' then
    return new;
  end if;

  update public.position_assignments
  set is_current = false,
      assignment_status = case
        when assignment_status in ('active', 'term_expired_still_serving', 'vacant') then 'replaced'
        else assignment_status
      end,
      actual_end_date = coalesce(actual_end_date, new.start_date),
      replaced_by_assignment_id = coalesce(replaced_by_assignment_id, new.id),
      successor_assignment_id = coalesce(successor_assignment_id, new.id),
      updated_at = now()
  where id <> new.id
    and is_current = true
    and record_status = 'active'
    and office_configuration_id = new.office_configuration_id
    and organization_chart_id is not distinct from new.organization_chart_id
    and organization_unit_id is not distinct from new.organization_unit_id
    and ecclesiastical_entity_id is not distinct from new.ecclesiastical_entity_id
    and pastoral_entity_id is not distinct from new.pastoral_entity_id;

  return new;
end;
$$;

drop trigger if exists trg_close_previous_current_position_assignments on public.position_assignments;
create trigger trg_close_previous_current_position_assignments
before insert or update of
  is_current,
  record_status,
  office_configuration_id,
  organization_chart_id,
  organization_unit_id,
  ecclesiastical_entity_id,
  pastoral_entity_id
on public.position_assignments
for each row
execute function public.close_previous_current_position_assignments();

-- 3) Defense-in-depth: prevent two current rows for the same office/entity scope.
create unique index if not exists position_assignments_one_current_per_scope
on public.position_assignments (
  office_configuration_id,
  organization_chart_id,
  organization_unit_id,
  ecclesiastical_entity_id,
  pastoral_entity_id
) nulls not distinct
where is_current = true
  and record_status = 'active';
