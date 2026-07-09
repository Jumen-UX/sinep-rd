-- Defense-in-depth: any direct current assignment insert closes the previous
-- current assignment in the same office/scope before the unique index is checked.

alter table public.position_assignments
  drop constraint if exists position_assignments_successor_assignment_id_fkey;

alter table public.position_assignments
  add constraint position_assignments_successor_assignment_id_fkey
  foreign key (successor_assignment_id)
  references public.position_assignments(id)
  on delete set null
  deferrable initially deferred;

alter table public.position_assignments
  drop constraint if exists position_assignments_replaced_by_assignment_id_fkey;

alter table public.position_assignments
  add constraint position_assignments_replaced_by_assignment_id_fkey
  foreign key (replaced_by_assignment_id)
  references public.position_assignments(id)
  on delete set null
  deferrable initially deferred;

create or replace function public.position_assignments_close_previous_current()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_close_date date;
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;

  if new.is_current = true and new.record_status = 'active' then
    v_close_date := coalesce(new.start_date, new.effective_date, new.term_start_date, current_date) - 1;

    update public.position_assignments
    set is_current = false,
        assignment_status = case
          when assignment_status in ('active', 'term_expired_still_serving', 'vacant') then 'replaced'
          else assignment_status
        end,
        actual_end_date = coalesce(actual_end_date, v_close_date),
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
  end if;

  return new;
end;
$$;

drop trigger if exists trg_position_assignments_close_previous_current on public.position_assignments;

create trigger trg_position_assignments_close_previous_current
before insert on public.position_assignments
for each row
execute function public.position_assignments_close_previous_current();
