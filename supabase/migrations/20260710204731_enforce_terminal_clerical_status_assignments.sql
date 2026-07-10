create or replace function internal.close_position_assignment_for_terminal_clerical_status()
returns trigger
language plpgsql
set search_path = public, internal, pg_temp
as $$
declare
  v_status text;
  v_end_date date;
begin
  if new.person_id is null
     or not new.is_current
     or new.record_status <> 'active'
     or new.assignment_status not in ('active','term_expired_still_serving') then
    return new;
  end if;

  select csh.status_type, coalesce(csh.start_date,current_date)
  into v_status, v_end_date
  from public.clerical_status_history csh
  where csh.person_id=new.person_id
    and csh.is_current=true
    and csh.record_status='active'
    and csh.status_type in ('deceased','lost_clerical_state')
  limit 1;

  if found then
    update public.position_assignments
    set is_current=false,
        assignment_status='ended',
        actual_end_date=coalesce(actual_end_date,v_end_date),
        notes_internal=concat_ws(E'\n',notes_internal,'Cargo cerrado automáticamente por estado canónico terminal: ' || v_status || '.'),
        updated_at=now()
    where id=new.id;
  end if;

  return new;
end;
$$;

create trigger position_assignments_terminal_clerical_status
after insert or update of person_id,is_current,record_status,assignment_status
on public.position_assignments
for each row execute function internal.close_position_assignment_for_terminal_clerical_status();

create or replace function internal.close_legacy_appointment_for_terminal_clerical_status()
returns trigger
language plpgsql
set search_path = public, internal, pg_temp
as $$
declare
  v_status text;
  v_end_date date;
begin
  if not new.is_current or new.status <> 'active' then
    return new;
  end if;

  select csh.status_type, coalesce(csh.start_date,current_date)
  into v_status, v_end_date
  from public.clerical_status_history csh
  where csh.person_id=new.person_id
    and csh.is_current=true
    and csh.record_status='active'
    and csh.status_type in ('deceased','lost_clerical_state')
  limit 1;

  if found then
    update public.appointments
    set is_current=false,
        status='ended',
        end_date=coalesce(end_date,v_end_date),
        notes_internal=concat_ws(E'\n',notes_internal,'Nombramiento cerrado automáticamente por estado canónico terminal: ' || v_status || '.'),
        updated_at=now()
    where id=new.id;
  end if;

  return new;
end;
$$;

create trigger appointments_terminal_clerical_status
after insert or update of person_id,is_current,status
on public.appointments
for each row execute function internal.close_legacy_appointment_for_terminal_clerical_status();

revoke all on function internal.close_position_assignment_for_terminal_clerical_status() from public,anon,authenticated;
revoke all on function internal.close_legacy_appointment_for_terminal_clerical_status() from public,anon,authenticated;