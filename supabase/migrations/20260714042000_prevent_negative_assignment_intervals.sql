begin;

create or replace function app_private.normalize_position_assignment_date_order()
returns trigger
language plpgsql
set search_path = public, app_private, pg_temp
as $$
begin
  if new.actual_end_date is not null
     and new.start_date is not null
     and new.actual_end_date < new.start_date then
    new.actual_end_date := new.start_date;
  end if;

  return new;
end;
$$;

revoke all on function app_private.normalize_position_assignment_date_order() from public, anon, authenticated;
grant execute on function app_private.normalize_position_assignment_date_order() to service_role;

drop trigger if exists position_assignments_normalize_date_order on public.position_assignments;
create trigger position_assignments_normalize_date_order
before insert or update of start_date, actual_end_date
on public.position_assignments
for each row
execute function app_private.normalize_position_assignment_date_order();

update public.position_assignments
set actual_end_date = start_date,
    notes_internal = concat_ws(
      E'\n',
      notes_internal,
      'Fecha real de finalización ajustada al inicio para corregir una sucesión importada el mismo día.'
    ),
    updated_at = now()
where actual_end_date is not null
  and start_date is not null
  and actual_end_date < start_date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'position_assignments_actual_end_not_before_start'
      and conrelid = 'public.position_assignments'::regclass
  ) then
    alter table public.position_assignments
      add constraint position_assignments_actual_end_not_before_start
      check (
        actual_end_date is null
        or start_date is null
        or actual_end_date >= start_date
      );
  end if;
end;
$$;

commit;
