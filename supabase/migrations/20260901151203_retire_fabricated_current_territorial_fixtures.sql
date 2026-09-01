-- Retira del estado vigente los fixtures territoriales y jurisdiccionales ficticios.
-- No elimina registros: conserva trazabilidad, referencias históricas y auditoría.

insert into public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
select null, 'integrity.fixture.retire', 'jurisdiction_accounts', ja.id, to_jsonb(ja),
       jsonb_build_object('is_current', false, 'status', 'archived', 'visibility', 'internal', 'reason', 'fabricated_fixture_removed_from_current_truth')
from public.jurisdiction_accounts ja
join public.ecclesiastical_entities ee on ee.id = ja.ecclesiastical_entity_id
where ee.source_url = 'https://example.org/fuente-datos-ficticios'
   or ee.source_name in ('SINEP Seed Integral', 'SINEP Seed QA');

insert into public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
select null, 'integrity.fixture.retire', 'jurisdiction_account_edges', e.id, to_jsonb(e),
       jsonb_build_object('is_current', false, 'status', 'archived', 'visibility', 'internal', 'reason', 'fabricated_fixture_removed_from_current_truth')
from public.jurisdiction_account_edges e
where e.parent_account_id in (
        select ja.id from public.jurisdiction_accounts ja join public.ecclesiastical_entities ee on ee.id=ja.ecclesiastical_entity_id
        where ee.source_url='https://example.org/fuente-datos-ficticios' or ee.source_name in ('SINEP Seed Integral','SINEP Seed QA')
      )
   or e.child_account_id in (
        select ja.id from public.jurisdiction_accounts ja join public.ecclesiastical_entities ee on ee.id=ja.ecclesiastical_entity_id
        where ee.source_url='https://example.org/fuente-datos-ficticios' or ee.source_name in ('SINEP Seed Integral','SINEP Seed QA')
      );

insert into public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
select null, 'integrity.fixture.retire', 'structure_templates', st.id, to_jsonb(st),
       jsonb_build_object('is_active', false, 'is_primary', false, 'status', 'archived', 'reason', 'fabricated_fixture_removed_from_current_truth')
from public.structure_templates st
where st.key like 'test-%'
   or st.metadata->>'seed' in ('integral', 'SINEP_QA_2026');

insert into public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
select null, 'integrity.fixture.retire', 'structure_nodes', sn.id, to_jsonb(sn),
       jsonb_build_object('is_current', false, 'status', 'archived', 'visibility', 'private', 'reason', 'fabricated_fixture_removed_from_current_truth')
from public.structure_nodes sn
where sn.template_id in (
  select st.id from public.structure_templates st
  where st.key like 'test-%' or st.metadata->>'seed' in ('integral', 'SINEP_QA_2026')
);

insert into public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
select null, 'integrity.fixture.retire', 'structure_node_edges', sne.id, to_jsonb(sne),
       jsonb_build_object('is_current', false, 'status', 'archived', 'reason', 'fabricated_fixture_removed_from_current_truth')
from public.structure_node_edges sne
where sne.template_id in (
  select st.id from public.structure_templates st
  where st.key like 'test-%' or st.metadata->>'seed' in ('integral', 'SINEP_QA_2026')
);

insert into public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
select null, 'integrity.fixture.retire', 'entity_relationships', er.id, to_jsonb(er),
       jsonb_build_object('is_current', false, 'status', 'archived', 'reason', 'fabricated_fixture_removed_from_current_truth')
from public.entity_relationships er
where er.parent_entity_id in (
        select id from public.ecclesiastical_entities
        where source_url='https://example.org/fuente-datos-ficticios' or source_name in ('SINEP Seed Integral','SINEP Seed QA')
      )
   or er.child_entity_id in (
        select id from public.ecclesiastical_entities
        where source_url='https://example.org/fuente-datos-ficticios' or source_name in ('SINEP Seed Integral','SINEP Seed QA')
      );

insert into public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
select null, 'integrity.fixture.retire', 'ecclesiastical_entities', ee.id, to_jsonb(ee),
       jsonb_build_object('status', 'archived', 'visibility', 'internal', 'reason', 'fabricated_fixture_removed_from_current_truth')
from public.ecclesiastical_entities ee
where ee.source_url='https://example.org/fuente-datos-ficticios'
   or ee.source_name in ('SINEP Seed Integral','SINEP Seed QA');

update public.jurisdiction_account_edges e
set is_current=false,
    status='archived',
    visibility='internal',
    valid_to=coalesce(valid_to,current_date),
    notes=concat_ws(E'\n', notes, 'Retirado del estado vigente: fixture de datos ficticios.'),
    updated_at=now()
where e.parent_account_id in (
        select ja.id from public.jurisdiction_accounts ja join public.ecclesiastical_entities ee on ee.id=ja.ecclesiastical_entity_id
        where ee.source_url='https://example.org/fuente-datos-ficticios' or ee.source_name in ('SINEP Seed Integral','SINEP Seed QA')
      )
   or e.child_account_id in (
        select ja.id from public.jurisdiction_accounts ja join public.ecclesiastical_entities ee on ee.id=ja.ecclesiastical_entity_id
        where ee.source_url='https://example.org/fuente-datos-ficticios' or ee.source_name in ('SINEP Seed Integral','SINEP Seed QA')
      );

update public.jurisdiction_accounts ja
set is_current=false,
    status='archived',
    visibility='internal',
    valid_to=coalesce(valid_to,current_date),
    notes=concat_ws(E'\n', notes, 'Retirado del estado vigente: fixture de datos ficticios.'),
    updated_at=now()
where ja.ecclesiastical_entity_id in (
  select id from public.ecclesiastical_entities
  where source_url='https://example.org/fuente-datos-ficticios' or source_name in ('SINEP Seed Integral','SINEP Seed QA')
);

update public.structure_node_edges sne
set is_current=false,
    status='archived',
    end_date=coalesce(end_date,current_date),
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('integrity_resolution','fabricated_fixture_removed_from_current_truth','integrity_resolved_at',now()),
    updated_at=now()
where sne.template_id in (
  select st.id from public.structure_templates st
  where st.key like 'test-%' or st.metadata->>'seed' in ('integral','SINEP_QA_2026')
);

update public.structure_nodes sn
set is_current=false,
    status='archived',
    visibility='private',
    end_date=coalesce(end_date,current_date),
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('integrity_resolution','fabricated_fixture_removed_from_current_truth','integrity_resolved_at',now()),
    updated_at=now()
where sn.template_id in (
  select st.id from public.structure_templates st
  where st.key like 'test-%' or st.metadata->>'seed' in ('integral','SINEP_QA_2026')
);

update public.structure_templates st
set is_active=false,
    is_primary=false,
    status='archived',
    valid_to=coalesce(valid_to,current_date),
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('integrity_resolution','fabricated_fixture_removed_from_current_truth','integrity_resolved_at',now()),
    updated_at=now()
where st.key like 'test-%'
   or st.metadata->>'seed' in ('integral','SINEP_QA_2026');

update public.entity_relationships er
set is_current=false,
    status='archived',
    end_date=coalesce(end_date,current_date),
    notes=concat_ws(E'\n', notes, 'Retirado del estado vigente: fixture de datos ficticios.'),
    updated_at=now()
where er.parent_entity_id in (
        select id from public.ecclesiastical_entities
        where source_url='https://example.org/fuente-datos-ficticios' or source_name in ('SINEP Seed Integral','SINEP Seed QA')
      )
   or er.child_entity_id in (
        select id from public.ecclesiastical_entities
        where source_url='https://example.org/fuente-datos-ficticios' or source_name in ('SINEP Seed Integral','SINEP Seed QA')
      );

update public.ecclesiastical_entities ee
set status='archived', visibility='internal', updated_at=now()
where ee.source_url='https://example.org/fuente-datos-ficticios'
   or ee.source_name in ('SINEP Seed Integral','SINEP Seed QA');

do $$
begin
  if exists (
    select 1 from public.jurisdiction_accounts ja
    join public.ecclesiastical_entities ee on ee.id=ja.ecclesiastical_entity_id
    where ja.is_current=true
      and (ee.source_url='https://example.org/fuente-datos-ficticios' or ee.source_name in ('SINEP Seed Integral','SINEP Seed QA'))
  ) then raise exception 'fabricated current jurisdiction accounts remain'; end if;

  if exists (
    select 1 from public.structure_templates st
    where st.status='active' and (st.key like 'test-%' or st.metadata->>'seed' in ('integral','SINEP_QA_2026'))
  ) then raise exception 'active fabricated structure templates remain'; end if;

  if exists (
    select 1 from public.structure_nodes n
    where n.is_current=true and n.status='active' and n.parent_node_id is not null
      and not exists (
        select 1 from public.structure_node_edges e
        where e.child_node_id=n.id and e.parent_node_id=n.parent_node_id and e.is_current=true and e.status='active'
      )
  ) then raise exception 'current structure parent projection/edge mismatch remains'; end if;
end $$;
