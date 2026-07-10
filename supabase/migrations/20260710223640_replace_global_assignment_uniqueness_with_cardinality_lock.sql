drop index if exists public.uniq_position_assignments_current_scope;

create index if not exists position_assignments_current_scope_idx
on public.position_assignments (
  office_configuration_id,
  coalesce(organization_chart_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(organization_unit_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(ecclesiastical_entity_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(pastoral_entity_id,'00000000-0000-0000-0000-000000000000'::uuid)
)
where is_current=true and record_status='active';

create or replace function internal.lock_position_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path = public, internal, pg_temp
as $$
declare
  v_lock_key bigint;
begin
  if not new.is_current
     or new.record_status<>'active'
     or new.assignment_status in ('ended','replaced','suspended') then
    return new;
  end if;

  v_lock_key := hashtextextended(
    concat_ws('|',
      new.office_configuration_id::text,
      coalesce(new.organization_chart_id::text,'00000000-0000-0000-0000-000000000000'),
      coalesce(new.organization_unit_id::text,'00000000-0000-0000-0000-000000000000'),
      coalesce(new.ecclesiastical_entity_id::text,'00000000-0000-0000-0000-000000000000'),
      coalesce(new.pastoral_entity_id::text,'00000000-0000-0000-0000-000000000000')
    ),
    0
  );

  perform pg_advisory_xact_lock(v_lock_key);
  return new;
end;
$$;

revoke all on function internal.lock_position_assignment_scope() from public, anon;

drop trigger if exists position_assignments_00_lock_scope on public.position_assignments;
create trigger position_assignments_00_lock_scope
before insert or update on public.position_assignments
for each row execute function internal.lock_position_assignment_scope();
