drop trigger if exists trg_position_assignments_close_previous_current on public.position_assignments;
drop function if exists public.position_assignments_close_previous_current();

create or replace function internal.prepare_position_assignment_cardinality()
returns trigger
language plpgsql
security definer
set search_path = public, internal, pg_temp
as $$
declare
  v_holder_cardinality text;
  v_max_current_holders integer;
  v_current_count integer;
  v_close_date date;
begin
  if new.id is null then new.id := gen_random_uuid(); end if;

  if not new.is_current
     or new.record_status <> 'active'
     or new.assignment_status in ('ended','replaced','suspended') then
    return new;
  end if;

  select holder_cardinality, max_current_holders
  into v_holder_cardinality, v_max_current_holders
  from public.office_configurations
  where id = new.office_configuration_id and status = 'active';

  if not found then
    raise exception 'El cargo configurado no existe o no está activo' using errcode = '22023';
  end if;

  v_close_date := coalesce(new.start_date,new.effective_date,new.term_start_date,current_date) - 1;

  if new.predecessor_assignment_id is not null then
    update public.position_assignments
    set is_current=false,
        assignment_status=case when assignment_status in ('active','term_expired_still_serving','vacant') then 'replaced' else assignment_status end,
        actual_end_date=coalesce(actual_end_date,v_close_date),
        replaced_by_assignment_id=coalesce(replaced_by_assignment_id,new.id),
        successor_assignment_id=coalesce(successor_assignment_id,new.id),
        updated_at=now()
    where id=new.predecessor_assignment_id and id<>new.id;
  end if;

  if v_holder_cardinality='single' then
    update public.position_assignments
    set is_current=false,
        assignment_status=case when assignment_status in ('active','term_expired_still_serving','vacant') then 'replaced' else assignment_status end,
        actual_end_date=coalesce(actual_end_date,v_close_date),
        replaced_by_assignment_id=coalesce(replaced_by_assignment_id,new.id),
        successor_assignment_id=coalesce(successor_assignment_id,new.id),
        updated_at=now()
    where id<>new.id
      and is_current=true
      and record_status='active'
      and office_configuration_id=new.office_configuration_id
      and organization_chart_id is not distinct from new.organization_chart_id
      and organization_unit_id is not distinct from new.organization_unit_id
      and ecclesiastical_entity_id is not distinct from new.ecclesiastical_entity_id
      and pastoral_entity_id is not distinct from new.pastoral_entity_id;
    return new;
  end if;

  if new.person_id is null and new.assignment_status='vacant' and exists (
    select 1 from public.position_assignments pa
    where pa.id<>new.id and pa.is_current=true and pa.record_status='active'
      and pa.assignment_status<>'vacant'
      and pa.office_configuration_id=new.office_configuration_id
      and pa.organization_chart_id is not distinct from new.organization_chart_id
      and pa.organization_unit_id is not distinct from new.organization_unit_id
      and pa.ecclesiastical_entity_id is not distinct from new.ecclesiastical_entity_id
      and pa.pastoral_entity_id is not distinct from new.pastoral_entity_id
  ) then
    raise exception 'No puede registrarse una vacante mientras existan titulares vigentes en este cargo múltiple' using errcode='22023';
  end if;

  if new.person_id is not null and exists (
    select 1 from public.position_assignments pa
    where pa.id<>new.id and pa.person_id=new.person_id
      and pa.is_current=true and pa.record_status='active'
      and pa.office_configuration_id=new.office_configuration_id
      and pa.organization_chart_id is not distinct from new.organization_chart_id
      and pa.organization_unit_id is not distinct from new.organization_unit_id
      and pa.ecclesiastical_entity_id is not distinct from new.ecclesiastical_entity_id
      and pa.pastoral_entity_id is not distinct from new.pastoral_entity_id
  ) then
    raise exception 'La persona ya tiene este cargo vigente en la misma entidad' using errcode='23505';
  end if;

  if v_max_current_holders is not null and new.assignment_status<>'vacant' then
    select count(*) into v_current_count
    from public.position_assignments pa
    where pa.id<>new.id and pa.is_current=true and pa.record_status='active'
      and pa.assignment_status<>'vacant'
      and pa.office_configuration_id=new.office_configuration_id
      and pa.organization_chart_id is not distinct from new.organization_chart_id
      and pa.organization_unit_id is not distinct from new.organization_unit_id
      and pa.ecclesiastical_entity_id is not distinct from new.ecclesiastical_entity_id
      and pa.pastoral_entity_id is not distinct from new.pastoral_entity_id;

    if v_current_count>=v_max_current_holders then
      raise exception 'El cargo alcanzó el máximo configurado de titulares vigentes (%)',v_max_current_holders using errcode='23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function internal.prepare_position_assignment_cardinality() from public, anon;

create trigger position_assignments_prepare_cardinality
before insert or update on public.position_assignments
for each row execute function internal.prepare_position_assignment_cardinality();

create or replace function internal.enforce_position_assignment_canonical_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public, internal, pg_temp
as $$
declare
  v_result jsonb;
begin
  if new.person_id is null
     or not new.is_current
     or new.record_status<>'active'
     or new.assignment_status in ('vacant','ended','replaced','suspended') then
    return new;
  end if;

  v_result := internal.evaluate_position_assignment_eligibility(
    new.person_id,new.office_configuration_id,new.ecclesiastical_entity_id,null,true
  );

  if not coalesce((v_result->>'eligible')::boolean,false) then
    raise exception '%',coalesce(v_result->>'message','La persona no cumple las condiciones del cargo') using errcode='23514';
  end if;

  return new;
end;
$$;

revoke all on function internal.enforce_position_assignment_canonical_eligibility() from public, anon;

drop trigger if exists position_assignments_canonical_eligibility on public.position_assignments;
create constraint trigger position_assignments_canonical_eligibility
after insert or update on public.position_assignments
deferrable initially deferred
for each row execute function internal.enforce_position_assignment_canonical_eligibility();
