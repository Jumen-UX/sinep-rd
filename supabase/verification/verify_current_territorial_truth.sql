-- Verificación reproducible: el estado actual no debe publicar fixtures territoriales
-- y la proyección parent_node_id debe coincidir exactamente con los edges canónicos vigentes.

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.ecclesiastical_entities ee
  where (ee.source_url = 'https://example.org/fuente-datos-ficticios'
         or ee.source_name in ('SINEP Seed Integral', 'SINEP Seed QA'))
    and (ee.status = 'active' or ee.visibility = 'public');
  if v_count <> 0 then
    raise exception 'Current/public fabricated ecclesiastical entities: %', v_count;
  end if;

  select count(*) into v_count
  from public.jurisdiction_accounts ja
  join public.ecclesiastical_entities ee on ee.id = ja.ecclesiastical_entity_id
  where ja.is_current = true
    and ja.status = 'active'
    and (ee.source_url = 'https://example.org/fuente-datos-ficticios'
         or ee.source_name in ('SINEP Seed Integral', 'SINEP Seed QA'));
  if v_count <> 0 then
    raise exception 'Current fabricated jurisdiction accounts: %', v_count;
  end if;

  select count(*) into v_count
  from public.structure_templates st
  where st.status = 'active'
    and (st.key like 'test-%' or st.metadata->>'seed' in ('integral', 'SINEP_QA_2026'));
  if v_count <> 0 then
    raise exception 'Active fabricated structure templates: %', v_count;
  end if;

  select count(*) into v_count
  from public.structure_nodes n
  where n.is_current = true
    and n.status = 'active'
    and n.parent_node_id is not null
    and not exists (
      select 1
      from public.structure_node_edges e
      where e.child_node_id = n.id
        and e.parent_node_id = n.parent_node_id
        and e.is_current = true
        and e.status = 'active'
    );
  if v_count <> 0 then
    raise exception 'Current nodes missing matching canonical parent edge: %', v_count;
  end if;

  select count(*) into v_count
  from public.structure_nodes n
  where n.is_current = true
    and n.status = 'active'
    and n.parent_node_id is null
    and exists (
      select 1 from public.structure_node_edges e
      where e.child_node_id = n.id
        and e.is_current = true
        and e.status = 'active'
    );
  if v_count <> 0 then
    raise exception 'Current root nodes with current parent edge: %', v_count;
  end if;

  select count(*) into v_count
  from (
    select n.id
    from public.structure_nodes n
    join public.structure_node_edges e on e.child_node_id = n.id
    where e.is_current = true and e.status = 'active'
    group by n.id, n.parent_node_id, n.is_current, n.status
    having n.is_current is distinct from true
       or n.status <> 'active'
       or count(*) <> 1
       or count(*) filter (where e.parent_node_id is not distinct from n.parent_node_id) <> 1
  ) issues;
  if v_count <> 0 then
    raise exception 'Current canonical edges inconsistent with node projection/state: %', v_count;
  end if;
end $$;

select
  (select count(*) from public.jurisdiction_accounts where is_current=true and status='active') as current_jurisdictions,
  (select count(*) from public.structure_templates where status='active' and is_active=true) as active_structure_templates,
  (select count(*) from public.structure_nodes where is_current=true and status='active') as current_structure_nodes,
  (select count(*) from public.structure_node_edges where is_current=true and status='active') as current_structure_edges,
  (select count(*) from public.audit_logs where action='integrity.fixture.retire') as fixture_retirement_audit_rows;
