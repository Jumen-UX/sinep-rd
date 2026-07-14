begin;

-- Remove the obsolete specialized write block from the two active bishop writers.
-- The canonical ordination_events row already contains date, place, consecrators,
-- evidence, visibility and editorial state.
do $$
declare
  v_definition text;
  v_start integer;
  v_finish integer;
begin
  select pg_get_functiondef('internal.admin_save_bishop(jsonb)'::regprocedure)
  into v_definition;

  v_start := strpos(v_definition, E'\n  insert into public.episcopal_ordinations (');
  v_finish := strpos(v_definition, E'\n\n  return jsonb_build_object');

  if v_start = 0 or v_finish = 0 or v_finish <= v_start then
    raise exception 'No se pudo localizar el bloque especializado en internal.admin_save_bishop(jsonb)';
  end if;

  v_definition := substr(v_definition, 1, v_start - 1) || substr(v_definition, v_finish);
  execute v_definition;

  select pg_get_functiondef('internal.admin_save_canonical_person(jsonb)'::regprocedure)
  into v_definition;

  v_start := strpos(v_definition, E'\n    insert into public.episcopal_ordinations (');
  v_finish := strpos(v_definition, E'\n\n    if v_role_type is not null then');

  if v_start = 0 or v_finish = 0 or v_finish <= v_start then
    raise exception 'No se pudo localizar el bloque especializado en internal.admin_save_canonical_person(jsonb)';
  end if;

  v_definition := substr(v_definition, 1, v_start - 1) || substr(v_definition, v_finish);
  execute v_definition;
end;
$$;

drop view public.public_episcopal_ordinations;

create view public.public_episcopal_ordinations
with (security_invoker = true)
as
select
  oe.id,
  oe.person_id as bishop_person_id,
  bishop.display_name as bishop_name,
  bishop.slug as bishop_slug,
  oe.ordination_date,
  oe.ordination_place,
  oe.principal_ordainer_person_id as principal_consecrator_person_id,
  principal.display_name as principal_consecrator_person_name,
  principal.slug as principal_consecrator_person_slug,
  oe.principal_ordainer_name as principal_consecrator_name,
  oe.assistant_ordainer_1_person_id as co_consecrator_1_person_id,
  co1.display_name as co_consecrator_1_person_name,
  co1.slug as co_consecrator_1_person_slug,
  oe.assistant_ordainer_1_name as co_consecrator_1_name,
  oe.assistant_ordainer_2_person_id as co_consecrator_2_person_id,
  co2.display_name as co_consecrator_2_person_name,
  co2.slug as co_consecrator_2_person_slug,
  oe.assistant_ordainer_2_name as co_consecrator_2_name,
  oe.source_name,
  oe.source_url,
  oe.source_checked_at,
  oe.verification_status,
  oe.notes_public,
  oe.created_at,
  oe.updated_at
from public.ordination_events oe
join public.persons bishop on bishop.id = oe.person_id
left join public.persons principal on principal.id = oe.principal_ordainer_person_id
left join public.persons co1 on co1.id = oe.assistant_ordainer_1_person_id
left join public.persons co2 on co2.id = oe.assistant_ordainer_2_person_id
where oe.degree = 'episcopate'
  and oe.record_status = 'active'
  and oe.visibility = 'public'
  and bishop.status = 'active'
  and bishop.visibility = 'public';

grant select on public.public_episcopal_ordinations to anon, authenticated;

drop table public.episcopal_ordinations;

commit;
