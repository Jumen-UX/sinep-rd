-- Priority 0 data integrity cleanup.
-- Keeps history, archives explicit test records and backfills minimum clergy profiles.

begin;

update public.structure_templates
set is_active = false,
    is_primary = false,
    status = 'draft',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'integrity_resolution', 'empty_template_returned_to_draft',
      'integrity_resolved_at', now()
    ),
    updated_at = now()
where id in (
  '633e4145-d702-48db-9fc4-2eac06e8fbcb',
  '1564f7c5-365c-4855-8341-54b6f0215ca2'
)
  and not exists (
    select 1 from public.structure_nodes sn
    where sn.template_id = structure_templates.id
  );

update public.structure_templates
set is_primary = true,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'integrity_resolution', 'restored_as_primary_after_empty_draft_cleanup',
      'integrity_resolved_at', now()
    ),
    updated_at = now()
where id = '3542af6e-d8b7-4edd-9b0a-032c5c196b3c'
  and is_active = true
  and status = 'active';

update public.entity_relationships
set is_current = false,
    status = 'archived',
    end_date = coalesce(end_date, current_date),
    notes = concat_ws(E'\n', notes, 'Archivada durante saneamiento P0: jerarquía identificada explícitamente como datos de prueba.'),
    updated_at = now()
where id in (
  'edf9dcbf-5821-45d5-bf70-a5b0d2de07b2',
  '77e87112-a886-41fe-a3c7-7ff18db03f98',
  '032ff650-e668-4462-8e42-865a705ecdbd'
);

update public.structure_node_edges
set is_current = false,
    status = 'archived',
    end_date = coalesce(end_date, current_date),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'integrity_resolution', 'test_hierarchy_archived',
      'integrity_resolved_at', now()
    ),
    updated_at = now()
where child_node_id in (
  '57d8e83f-c1ea-4dfd-8aff-12a9f6a0bb8e',
  '10586631-28c6-4071-8adc-37064b509392',
  '01dcbcb7-35a6-4580-ab4a-51b2f6b5b762'
)
   or parent_node_id in (
  '57d8e83f-c1ea-4dfd-8aff-12a9f6a0bb8e',
  '10586631-28c6-4071-8adc-37064b509392',
  '01dcbcb7-35a6-4580-ab4a-51b2f6b5b762'
);

update public.structure_nodes
set is_current = false,
    status = 'archived',
    visibility = 'private',
    end_date = coalesce(end_date, current_date),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'integrity_resolution', 'explicit_test_record_archived',
      'integrity_resolved_at', now()
    ),
    updated_at = now()
where id in (
  '57d8e83f-c1ea-4dfd-8aff-12a9f6a0bb8e',
  '10586631-28c6-4071-8adc-37064b509392',
  '01dcbcb7-35a6-4580-ab4a-51b2f6b5b762'
);

update public.ecclesiastical_entities
set status = 'archived',
    visibility = 'internal',
    updated_at = now()
where id in (
  'ac752e84-0fb4-4695-889d-08da8acfcdb7',
  '2a8328ea-0b9b-4c68-9a1c-580173dacbfc',
  '9f668f92-e144-4c71-a1a9-900e9c70d61a'
);

insert into public.clergy_profiles (
  person_id,
  current_service_entity_id,
  episcopal_ordination_date,
  canonical_status,
  clerical_history_status,
  notes_private
)
select
  p.id,
  case p.id
    when 'b941ab24-41b8-4168-9974-629ce947e0fa'::uuid then 'e6cfc8d9-ddf4-4628-b5fe-78b7edf4f6ec'::uuid
    when '8f141e4a-a67e-4512-b05f-493f85dc16d5'::uuid then '36a0b7e9-47e6-4d23-8d0f-b0aa30ce2f70'::uuid
    else null
  end,
  eo.ordination_date,
  case
    when lower(coalesce(p.biography_public, '')) like '%emérito%'
      or lower(coalesce(p.biography_public, '')) like '%emerito%'
    then 'emeritus'
    when p.id in (
      'b941ab24-41b8-4168-9974-629ce947e0fa'::uuid,
      '8f141e4a-a67e-4512-b05f-493f85dc16d5'::uuid
    ) then 'active'
    else 'unknown'
  end,
  'pending',
  'Perfil clerical mínimo creado durante saneamiento P0 a partir de una ficha episcopal importada. Fechas, incardinación e historial pendientes de verificación documental.'
from public.persons p
left join public.episcopal_ordinations eo on eo.bishop_person_id = p.id
where p.id in (
  'b941ab24-41b8-4168-9974-629ce947e0fa',
  '8f141e4a-a67e-4512-b05f-493f85dc16d5',
  'c3405230-a59a-49a8-8f25-856d68ece799',
  '4b57c577-cb03-4ee5-82d0-6ed530a0306b',
  '3381f7f3-d920-49b9-b829-25f0c7046751',
  'e4533ee6-b0c8-42ae-ad1a-d3d4316b0385',
  '7f4321a9-7a9a-4b55-85a5-0a50358231b5'
)
  and not exists (
    select 1 from public.clergy_profiles cp where cp.person_id = p.id
  );

insert into public.audit_logs (user_id, action, target_table, target_id, new_data)
select null, 'integrity.structure_template.deactivate', 'structure_templates', st.id,
       jsonb_build_object('status', st.status, 'is_active', st.is_active, 'is_primary', st.is_primary)
from public.structure_templates st
where st.id in (
  '633e4145-d702-48db-9fc4-2eac06e8fbcb',
  '1564f7c5-365c-4855-8341-54b6f0215ca2'
);

insert into public.audit_logs (user_id, action, target_table, target_id, new_data)
select null, 'integrity.test_entity.archive', 'ecclesiastical_entities', ee.id,
       jsonb_build_object('name', ee.name, 'status', ee.status, 'visibility', ee.visibility)
from public.ecclesiastical_entities ee
where ee.id in (
  'ac752e84-0fb4-4695-889d-08da8acfcdb7',
  '2a8328ea-0b9b-4c68-9a1c-580173dacbfc',
  '9f668f92-e144-4c71-a1a9-900e9c70d61a'
);

insert into public.audit_logs (user_id, action, target_table, target_id, new_data)
select null, 'integrity.clergy_profile.backfill', 'persons', p.id,
       jsonb_build_object('display_name', p.display_name, 'person_type', p.person_type)
from public.persons p
where p.id in (
  'b941ab24-41b8-4168-9974-629ce947e0fa',
  '8f141e4a-a67e-4512-b05f-493f85dc16d5',
  'c3405230-a59a-49a8-8f25-856d68ece799',
  '4b57c577-cb03-4ee5-82d0-6ed530a0306b',
  '3381f7f3-d920-49b9-b829-25f0c7046751',
  'e4533ee6-b0c8-42ae-ad1a-d3d4316b0385',
  '7f4321a9-7a9a-4b55-85a5-0a50358231b5'
);

commit;
